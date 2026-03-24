import { app, shell, BrowserWindow } from 'electron'
import { createWriteStream } from 'fs'
import { promises as fsp } from 'fs'
import { join, dirname } from 'path'
import type {
  UpdateAssetKind,
  UpdateCheckNowResult,
  UpdateEventPayload,
  UpdateFailedEventPayload,
  UpdateRemindChoice,
  UpdateReadyEventPayload
} from '@shared/types/update'
import { IPC_UPDATE_EVENT } from '@shared/ipc/channels'

const GITHUB_OWNER = 'Nliuco'
const GITHUB_REPO = 's-plus-record'

type DownloadStatus = 'idle' | 'downloading' | 'downloaded' | 'failed' | 'giveup'
type RemindPolicy = 'none' | 'until' | 'always'

type UpdateStateJson = {
  version: string
  latestTag?: string
  download: {
    assetKind?: UpdateAssetKind
    status: DownloadStatus
    downloadedAt?: number
    downloadedPath?: string
    downloadUrl?: string | null
    attempts: number
    lastAttemptAt?: number
    remindPolicy: RemindPolicy
    remindUntilIso?: string
  }
  failure?: {
    reason: string
    maxAttempts: number
    lastErrorAt?: number
  }
  settings: {
    maxDownloadAttempts: number
    minTryIntervalHours: number
  }
}

const DEFAULT_STATE: UpdateStateJson = {
  version: '1',
  latestTag: undefined,
  download: {
    status: 'idle',
    assetKind: undefined,
    downloadedAt: undefined,
    downloadedPath: undefined,
    downloadUrl: null,
    attempts: 0,
    lastAttemptAt: undefined,
    remindPolicy: 'none',
    remindUntilIso: undefined
  },
  failure: undefined,
  settings: {
    maxDownloadAttempts: 3,
    minTryIntervalHours: 6
  }
}

function getAppAssetKindFromExecPath(): UpdateAssetKind {
  const p = process.execPath.toLowerCase()
  return p.includes('-portable-') ? 'portable' : 'installer'
}

function parseSemverLoose(v: string): number[] | null {
  const s = v.trim().replace(/^v/i, '')
  const parts = s.split('.')
  if (parts.length < 2) return null
  const nums = parts.map((x) => Number(x))
  if (nums.some((n) => Number.isNaN(n))) return null
  return nums.slice(0, 3)
}

function compareSemver(a: string, b: string): number {
  const pa = parseSemverLoose(a)
  const pb = parseSemverLoose(b)
  if (!pa || !pb) return 0
  for (let i = 0; i < 3; i++) {
    const da = pa[i] ?? 0
    const db = pb[i] ?? 0
    if (da < db) return -1
    if (da > db) return 1
  }
  return 0
}

function isoNow(): number {
  return Date.now()
}

function computeTomorrowAt10Iso(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(10, 0, 0, 0)
  return d.toISOString()
}

async function ensureDir(p: string): Promise<void> {
  await fsp.mkdir(p, { recursive: true })
}

async function downloadToFile(url: string, filePath: string): Promise<void> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`)
  }
  const webBody = res.body
  if (!webBody) {
    throw new Error('Empty response body')
  }

  await ensureDir(dirname(filePath))
  await new Promise<void>((resolve, reject) => {
    const stream = createWriteStream(filePath)
    stream.on('finish', () => resolve())
    stream.on('error', reject)

    const reader = webBody.getReader()
    ;(async () => {
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          if (value) {
            stream.write(Buffer.from(value))
          }
        }
        stream.end()
      } catch (e) {
        reject(e)
      }
    })()
  })
}

function mdToNotesItems(md: string | null | undefined): { section?: string; text: string }[] {
  if (!md) return []
  const lines = md.split(/\r?\n/)
  const items: { section?: string; text: string }[] = []
  let section: string | undefined

  for (const line of lines) {
    const heading = line.match(/^##\s+(.*)\s*$/)
    if (heading) {
      section = heading[1].trim()
      continue
    }
    const bullet = line.match(/^\s*-\s+(.*)\s*$/)
    if (bullet) {
      items.push({ section, text: bullet[1].trim() })
    }
  }
  return items
}

export class UpdateService {
  private statePath: string
  private state: UpdateStateJson
  private mainWindow: BrowserWindow | null = null

  private ongoingDownload: Promise<void> | null = null
  private ongoingCheck: Promise<UpdateCheckNowResult> | null = null
  private lastManualCheckAtMs: number | null = null
  private manualCheckCooldownMs = 30_000

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow
    this.statePath = join(app.getPath('userData'), 'update-state.json')
    this.state = { ...DEFAULT_STATE }
  }

  private async loadState(): Promise<void> {
    try {
      const s = await fsp.readFile(this.statePath, 'utf-8')
      const parsed = JSON.parse(s) as Partial<UpdateStateJson>
      this.state = {
        ...DEFAULT_STATE,
        ...(parsed ?? {}),
        download: {
          ...DEFAULT_STATE.download,
          ...(parsed.download ?? {})
        },
        settings: {
          ...DEFAULT_STATE.settings,
          ...((parsed.settings ?? {}) as UpdateStateJson['settings'])
        }
      }
    } catch {
      this.state = { ...DEFAULT_STATE }
    }
  }

  private async saveState(): Promise<void> {
    await ensureDir(dirname(this.statePath))
    await fsp.writeFile(this.statePath, JSON.stringify(this.state, null, 2), 'utf-8')
  }

  private sendToRenderer(payload: UpdateEventPayload): void {
    if (!this.mainWindow) return
    this.mainWindow.webContents.send(IPC_UPDATE_EVENT, payload)
  }

  private isRemindDueNow(): boolean {
    const p = this.state.download.remindPolicy
    if (p === 'none') return false
    if (p === 'always') return true
    if (p === 'until') {
      const t = this.state.download.remindUntilIso
      if (!t) return false
      return Date.now() >= Date.parse(t)
    }
    return false
  }

  private assetKindForThisApp(): UpdateAssetKind {
    return getAppAssetKindFromExecPath()
  }

  private async fetchLatestRelease(): Promise<{
    tagName: string
    version: string
    body: string
    htmlUrl: string
    assetInstallerUrl: string | null
    assetPortableUrl: string | null
  }> {
    const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 8000)
    try {
      const res = await fetch(apiUrl, {
        signal: controller.signal,
        headers: {
          Accept: 'application/vnd.github+json'
        }
      })
      if (!res.ok) {
        if (res.status === 403) {
          const remaining = res.headers.get('x-ratelimit-remaining')
          const resetSeconds = res.headers.get('x-ratelimit-reset')
          const resetMs = resetSeconds ? Number(resetSeconds) * 1000 : null
          const secondsLeft =
            resetMs != null ? Math.max(0, Math.ceil((resetMs - Date.now()) / 1000)) : null
          const suffix = secondsLeft != null ? `，约需等待 ${secondsLeft} 秒` : ''
          const base = remaining === '0' || remaining === '0.0' ? 'GitHub API 限流（rate limit）' : 'GitHub API 禁止访问'
          throw new Error(`${base}（HTTP 403）${suffix}`)
        }
        throw new Error(`HTTP ${res.status} ${res.statusText}`)
      }
      const json = (await res.json()) as {
        tag_name: string
        body: string
        html_url: string
        assets: { name: string; browser_download_url: string }[]
      }

      const tagName = json.tag_name
      const version = tagName.replace(/^v/i, '')
      const installer = json.assets.find((a) => a.name.toLowerCase().endsWith('-x64.exe') && !a.name.toLowerCase().includes('portable'))
      const portable = json.assets.find((a) => a.name.toLowerCase().includes('-portable-') && a.name.toLowerCase().endsWith('-x64.exe'))

      return {
        tagName,
        version,
        body: json.body ?? '',
        htmlUrl: json.html_url,
        assetInstallerUrl: installer?.browser_download_url ?? null,
        assetPortableUrl: portable?.browser_download_url ?? null
      }
    } finally {
      clearTimeout(t)
    }
  }

  private getDownloadedUrlForAssetKind(assetKind: UpdateAssetKind): string | null {
    return this.state.download.downloadUrl ?? null
  }

  private async pickAssetDownloadUrlForApp(
    release: Awaited<ReturnType<UpdateService['fetchLatestRelease']>>,
    assetKind: UpdateAssetKind
  ): Promise<string | null> {
    if (assetKind === 'installer') return release.assetInstallerUrl
    return release.assetPortableUrl
  }

  private shouldAttemptDownloadForLatestTag(latestTag: string): boolean {
    const currentKind = this.assetKindForThisApp()
    if (this.state.latestTag !== latestTag) return true
    if (this.state.download.assetKind !== currentKind) return true
    if (this.state.download.status === 'downloaded') return false
    if (this.state.download.status === 'giveup') return false

    const attempts = this.state.download.attempts ?? 0
    if (attempts >= this.state.settings.maxDownloadAttempts) return false

    const last = this.state.download.lastAttemptAt
    if (last != null) {
      const minMs = this.state.settings.minTryIntervalHours * 60 * 60 * 1000
      if (Date.now() - last < minMs) return false
    }
    return true
  }

  private buildReadyPayload(
    release: Awaited<ReturnType<UpdateService['fetchLatestRelease']>>
  ): UpdateReadyEventPayload {
    const assetKind = this.assetKindForThisApp()
    const downloadUrl = assetKind === 'installer' ? release.assetInstallerUrl : release.assetPortableUrl
    return {
      type: 'ready',
      tag: release.tagName,
      version: release.version,
      assetKind,
      releaseUrl: release.htmlUrl,
      downloadUrl,
      notesItems: mdToNotesItems(release.body)
    }
  }

  private buildFailedPayload(params: {
    tag: string
    version: string
    assetKind: UpdateAssetKind
    releaseUrl: string
    downloadUrl: string | null
    attempts: number
    maxAttempts: number
    reason: string
    body: string
  }): UpdateFailedEventPayload {
    return {
      type: 'failed',
      tag: params.tag,
      version: params.version,
      assetKind: params.assetKind,
      releaseUrl: params.releaseUrl,
      downloadUrl: params.downloadUrl,
      attempts: params.attempts,
      maxAttempts: params.maxAttempts,
      reason: params.reason,
      notesItems: mdToNotesItems(params.body)
    }
  }

  private async tryDownloadForLatest(latestTag: string, release: Awaited<ReturnType<UpdateService['fetchLatestRelease']>>): Promise<void> {
    if (this.ongoingDownload) return this.ongoingDownload

    const assetKind = this.assetKindForThisApp()
    const downloadUrl = await this.pickAssetDownloadUrlForApp(release, assetKind)
    if (!downloadUrl) {
      throw new Error(`Missing GitHub asset for ${assetKind}`)
    }

    const now = isoNow()
    this.state.latestTag = latestTag
    this.state.download.assetKind = assetKind
    this.state.download.downloadUrl = downloadUrl
    this.state.download.status = 'downloading'
    this.state.download.attempts = (this.state.download.attempts ?? 0) + 1
    this.state.download.lastAttemptAt = now
    this.state.failure = undefined
    this.state.download.downloadedAt = undefined
    this.state.download.downloadedPath = undefined
    await this.saveState()

    const fileDir = join(app.getPath('userData'), 'updates', latestTag, assetKind)
    const fileName = assetKind === 'installer' ? 'installer.exe' : 'portable.exe'
    const filePath = join(fileDir, fileName)

    const p = (async () => {
      try {
        await downloadToFile(downloadUrl, filePath)
        this.state.download.status = 'downloaded'
        this.state.download.downloadedAt = Date.now()
        this.state.download.downloadedPath = filePath
        this.state.failure = undefined
        this.state.download.remindPolicy = this.state.download.remindPolicy === 'none' ? 'always' : this.state.download.remindPolicy
        await this.saveState()

        const dueNow = this.isRemindDueNow()
        if (dueNow) {
          this.sendToRenderer(this.buildReadyPayload(release))
        }
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e)
        const attempts = this.state.download.attempts ?? 0
        const maxAttempts = this.state.settings.maxDownloadAttempts

        this.state.download.status = attempts >= maxAttempts ? 'giveup' : 'failed'
        this.state.failure = {
          reason,
          maxAttempts,
          lastErrorAt: Date.now()
        }
        await this.saveState()

        if (attempts >= maxAttempts) {
          const failPayload = this.buildFailedPayload({
            tag: release.tagName,
            version: release.version,
            assetKind,
            releaseUrl: release.htmlUrl,
            downloadUrl,
            attempts,
            maxAttempts,
            reason,
            body: release.body
          })
          this.sendToRenderer(failPayload)
        }
      }
    })()

    this.ongoingDownload = p
    try {
      await p
    } finally {
      this.ongoingDownload = null
    }
  }

  async startOrContinueBackgroundDownload(): Promise<void> {
    try {
      await this.loadState()

      const latest = await this.fetchLatestRelease()
      const currentVersion = app.getVersion()
      const newer = compareSemver(latest.version, currentVersion) > 0
      if (!newer) return

      if (!this.shouldAttemptDownloadForLatestTag(latest.tagName)) return
      await this.tryDownloadForLatest(latest.tagName, latest)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.warn('[update] startup check/download skipped:', msg)
    }
  }

  async checkForUpdatesNow(): Promise<UpdateCheckNowResult> {
    if (this.ongoingCheck) return this.ongoingCheck

    const currentVersion = app.getVersion()
    const now = Date.now()
    if (this.lastManualCheckAtMs != null && now - this.lastManualCheckAtMs < this.manualCheckCooldownMs) {
      const secondsLeft = Math.ceil((this.manualCheckCooldownMs - (now - this.lastManualCheckAtMs)) / 1000)
      return {
        ok: true,
        status: 'check-failed',
        currentVersion,
        latestVersion: null,
        latestTag: null,
        message: `检查太频繁，请稍后再试（约 ${secondsLeft} 秒后）。`
      }
    }
    this.lastManualCheckAtMs = now

    const p = (async (): Promise<UpdateCheckNowResult> => {
      await this.loadState()
      let latest: Awaited<ReturnType<UpdateService['fetchLatestRelease']>> | null = null
      try {
        latest = await this.fetchLatestRelease()
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        return {
          ok: true,
          status: 'check-failed',
          currentVersion,
          latestVersion: null,
          latestTag: null,
          message
        }
      }
      if (!latest) {
        return {
          ok: true,
          status: 'check-failed',
          currentVersion,
          latestVersion: null,
          latestTag: null,
          message: '无法获取最新版本信息。'
        }
      }
      const newer = compareSemver(latest.version, currentVersion) > 0
      if (!newer) {
        return {
          ok: true,
          status: 'checked-no-update',
          currentVersion,
          latestVersion: latest.version,
          latestTag: latest.tagName
        }
      }

      if (this.state.download.status === 'downloading' && this.state.latestTag === latest.tagName) {
        return {
          ok: true,
          status: 'downloading',
          currentVersion,
          latestVersion: latest.version,
          latestTag: latest.tagName
        }
      }

      const dueNow =
        this.state.latestTag === latest.tagName &&
        this.state.download.status === 'downloaded' &&
        this.state.download.assetKind === this.assetKindForThisApp() &&
        this.isRemindDueNow()
      if (dueNow) {
        this.sendToRenderer(this.buildReadyPayload(latest))
        return {
          ok: true,
          status: 'downloaded-ready',
          currentVersion,
          latestVersion: latest.version,
          latestTag: latest.tagName
        }
      }

      if (!this.shouldAttemptDownloadForLatestTag(latest.tagName)) {
        return {
          ok: true,
          status: 'checked-no-update',
          currentVersion,
          latestVersion: latest.version,
          latestTag: latest.tagName
        }
      }

      // 新版本且允许下载：启动后台下载（不保证立即完成）
      void this.tryDownloadForLatest(latest.tagName, latest)
      return {
        ok: true,
        status: 'downloading',
        currentVersion,
        latestVersion: latest.version,
        latestTag: latest.tagName
      }
    })()

    this.ongoingCheck = p
    try {
      return await p
    } finally {
      this.ongoingCheck = null
    }
  }

  async setRemindChoice(choice: UpdateRemindChoice): Promise<void> {
    await this.loadState()
    if (this.state.latestTag !== choice.tag) {
      this.state.latestTag = choice.tag
    }
    if (choice.mode === 'until') {
      this.state.download.remindPolicy = 'until'
      this.state.download.remindUntilIso = choice.remindUntilIso
    } else {
      this.state.download.remindPolicy = 'always'
      this.state.download.remindUntilIso = undefined
    }
    await this.saveState()
  }

  async installUpdateNow(): Promise<void> {
    await this.loadState()
    if (this.state.download.status !== 'downloaded' || !this.state.download.downloadedPath) {
      throw new Error('Update not ready')
    }
    const assetKind = this.state.download.assetKind ?? this.assetKindForThisApp()

    if (assetKind === 'portable') {
      // 便携版：我们只负责“打开目录”，避免直接多实例运行冲突
      await shell.openPath(this.state.download.downloadedPath)
      return
    }

    // 安装包：静默安装，然后让用户自行重启（NSIS 安装完成时间不易可靠探测）
    // NSIS 常见静默参数：/S，安装目录：/D=...
    // electron-builder 的 NSIS 生成遵循该约定。
    const exe = this.state.download.downloadedPath
    // 为了不误装到缓存目录，这里改为当前 app 所在目录
    const currentDir = dirname(app.getPath('exe'))

    const { spawn } = await import('child_process')
    spawn(exe, ['/S', `/D=${currentDir}`], { windowsHide: true })

    // 安装后退出，让用户手动重新打开；这比立即重启更安全（避免覆盖过程中抢占文件）
    app.quit()
  }

  async openUpdateDownloadDir(): Promise<void> {
    await this.loadState()
    if (!this.state.download.downloadedPath) return
    const p = this.state.download.downloadedPath
    await shell.showItemInFolder(p)
  }

  async hasDownloadedUpdateForCurrentApp(): Promise<boolean> {
    await this.loadState()
    if (this.state.download.status !== 'downloaded') return false
    if (!this.state.download.downloadedPath) return false
    return true
  }
}


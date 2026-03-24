import { ref } from 'vue'
import { checkForUpdatesNow, installUpdateNow, onUpdateEvent, openUpdateDownloadDir, setUpdateRemindChoice } from '@renderer/api/update'
import type { UpdateEventPayload, UpdateRemindChoice } from '@shared/types/update'

type FeedbackTone = 'success' | 'error' | 'info'

function computeTomorrowAt10Iso(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(10, 0, 0, 0)
  return d.toISOString()
}

function formatCheckVersionInfo(currentVersion: string, latestVersion: string | null): string {
  const latest = latestVersion ?? '未知'
  return `当前版本：v${currentVersion}；最新版本：v${latest}`
}

export function useUpdateReminder(options: {
  showError: (message: string) => void
}) {
  const updateModalOpen = ref(false)
  const updatePayload = ref<UpdateEventPayload | null>(null)
  const updateBusy = ref(false)
  const updateInlineFeedback = ref<string | null>(null)
  const updateInlineFeedbackTone = ref<FeedbackTone>('info')
  let updateInlineFeedbackTimer: ReturnType<typeof setTimeout> | null = null

  function showUpdateInlineFeedback(text: string, tone: FeedbackTone = 'info', ms = 3500): void {
    updateInlineFeedback.value = text
    updateInlineFeedbackTone.value = tone
    if (updateInlineFeedbackTimer) {
      clearTimeout(updateInlineFeedbackTimer)
      updateInlineFeedbackTimer = null
    }
    updateInlineFeedbackTimer = setTimeout(() => {
      updateInlineFeedback.value = null
      updateInlineFeedbackTimer = null
    }, ms)
  }

  function closeUpdateModal(): void {
    updateModalOpen.value = false
    updatePayload.value = null
  }

  function applyUpdatePayload(payload: UpdateEventPayload): void {
    updatePayload.value = payload
    updateModalOpen.value = true
  }

  async function onCheckUpdatesClick(): Promise<void> {
    updateBusy.value = true
    try {
      const res = await checkForUpdatesNow()
      const versionInfo = formatCheckVersionInfo(res.currentVersion, res.latestVersion)
      if (res.status === 'checked-no-update') {
        showUpdateInlineFeedback(`检查完成：当前已是最新版本。${versionInfo}`, 'info', 6500)
      } else if (res.status === 'downloading') {
        showUpdateInlineFeedback(`检查完成：发现新版本，已在后台下载。${versionInfo}`, 'success', 6500)
      } else if (res.status === 'downloaded-ready') {
        showUpdateInlineFeedback(`检查完成：新版本已下载完成，已为你打开更新弹窗。${versionInfo}`, 'success', 6500)
      } else if (res.status === 'check-failed') {
        showUpdateInlineFeedback(
          `检查失败：${res.message ?? '无法获取最新版本信息'}。当前版本：v${res.currentVersion}。${versionInfo}`,
          'error',
          7000
        )
      } else {
        showUpdateInlineFeedback(
          `检查完成：状态 ${String((res as { status?: unknown }).status ?? 'unknown')}。${versionInfo}`,
          'info',
          6500
        )
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      showUpdateInlineFeedback(`检查更新失败：${message}`, 'error', 5000)
    } finally {
      updateBusy.value = false
    }
  }

  async function onRemindLater(): Promise<void> {
    const p = updatePayload.value
    if (!p) return
    const tag = p.tag
    const choice: UpdateRemindChoice = { tag, mode: 'until', remindUntilIso: computeTomorrowAt10Iso() }
    const res = await setUpdateRemindChoice(choice)
    if ('ok' in res && res.ok === false) {
      options.showError(res.message)
      return
    }
    closeUpdateModal()
  }

  async function onDismissForever(): Promise<void> {
    const p = updatePayload.value
    if (!p) return
    const tag = p.tag
    const choice: UpdateRemindChoice = { tag, mode: 'always' }
    const res = await setUpdateRemindChoice(choice)
    if ('ok' in res && res.ok === false) {
      options.showError(res.message)
      return
    }
    closeUpdateModal()
  }

  async function onInstallUpdate(): Promise<void> {
    const p = updatePayload.value
    if (!p || p.type !== 'ready') return
    if (p.assetKind !== 'installer') return
    updateBusy.value = true
    try {
      const res = await installUpdateNow()
      if (!res.ok) {
        options.showError(res.message)
        return
      }
      closeUpdateModal()
    } finally {
      updateBusy.value = false
    }
  }

  async function onOpenDownloadDir(): Promise<void> {
    updateBusy.value = true
    try {
      const res = await openUpdateDownloadDir()
      if (!res.ok) {
        options.showError(res.message)
        return
      }
    } finally {
      updateBusy.value = false
    }
  }

  function onOpenGitHubRelease(): void {
    const p = updatePayload.value
    if (!p) return
    window.open(p.releaseUrl, '_blank', 'noopener,noreferrer')
  }

  function startUpdateEventLoop(): void {
    onUpdateEvent((payload) => {
      applyUpdatePayload(payload)
    })
    // 启动即后台检查/下载；若已下载完成且到期，由主进程主动推送弹窗事件
    void checkForUpdatesNow().catch(() => {})
  }

  function cleanup(): void {
    if (updateInlineFeedbackTimer) {
      clearTimeout(updateInlineFeedbackTimer)
      updateInlineFeedbackTimer = null
    }
  }

  return {
    updateModalOpen,
    updatePayload,
    updateBusy,
    updateInlineFeedback,
    updateInlineFeedbackTone,
    closeUpdateModal,
    onCheckUpdatesClick,
    onRemindLater,
    onDismissForever,
    onInstallUpdate,
    onOpenDownloadDir,
    onOpenGitHubRelease,
    startUpdateEventLoop,
    cleanup
  }
}


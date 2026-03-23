import { existsSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { tryLeagueClientUxCredentialsFromWindows } from './credentialsFromProcess'

export interface LockfileCredentials {
  port: string
  password: string
}

/**
 * 常见 League Client lockfile 位置（国际服 Riot / 国服 WeGame 不同）。
 * - Riot：通常在 %LOCALAPPDATA%\\Riot Games\\League of Legends\\lockfile
 * - 国服 WeGame：常见为 …\\WeGameApps\\英雄联盟\\LeagueClient\\lockfile（非 Game\\League of Legends）
 */
export function getLockfileCandidatePaths(): string[] {
  const paths: string[] = []

  const envPath = process.env.LEAGUE_LOCKFILE_PATH?.trim()
  if (envPath) {
    paths.push(envPath)
  }

  const la = process.env.LOCALAPPDATA
  const pf = process.env.PROGRAMFILES
  const pf86 = process.env['PROGRAMFILES(X86)']
  const sd = process.env.SystemDrive ?? 'C:'

  if (la) {
    paths.push(join(la, 'Riot Games', 'League of Legends', 'lockfile'))
    paths.push(join(la, 'Tencent Games', '英雄联盟', 'Game', 'League of Legends', 'lockfile'))
    paths.push(join(la, '腾讯游戏', '英雄联盟', 'Game', 'League of Legends', 'lockfile'))
  }

  paths.push(join(sd, 'Riot Games', 'League of Legends', 'lockfile'))

  if (pf) {
    paths.push(join(pf, 'Riot Games', 'League of Legends', 'lockfile'))
    paths.push(join(pf, 'Tencent Games', '英雄联盟', 'Game', 'League of Legends', 'lockfile'))
    paths.push(join(pf, '腾讯游戏', '英雄联盟', 'Game', 'League of Legends', 'lockfile'))
    paths.push(join(pf, 'WeGameApps', '英雄联盟', 'Game', 'League of Legends', 'lockfile'))
    paths.push(join(pf, 'WeGameApps', '英雄联盟', 'LeagueClient', 'lockfile'))
  }
  if (pf86) {
    paths.push(join(pf86, 'Riot Games', 'League of Legends', 'lockfile'))
    paths.push(join(pf86, 'Tencent Games', '英雄联盟', 'Game', 'League of Legends', 'lockfile'))
    paths.push(join(pf86, '腾讯游戏', '英雄联盟', 'Game', 'League of Legends', 'lockfile'))
    paths.push(join(pf86, 'WeGameApps', '英雄联盟', 'Game', 'League of Legends', 'lockfile'))
    paths.push(join(pf86, 'WeGameApps', '英雄联盟', 'LeagueClient', 'lockfile'))
  }

  const userProfile = process.env.USERPROFILE
  if (userProfile) {
    paths.push(join(userProfile, 'Games', 'WeGameApps', '英雄联盟', 'Game', 'League of Legends', 'lockfile'))
    paths.push(join(userProfile, 'Games', 'WeGameApps', '英雄联盟', 'LeagueClient', 'lockfile'))
  }
  paths.push(join('C:', 'UserSpace', 'Games', 'WeGameApps', '英雄联盟', 'Game', 'League of Legends', 'lockfile'))
  paths.push(join('C:', 'UserSpace', 'Games', 'WeGameApps', '英雄联盟', 'LeagueClient', 'lockfile'))

  if (process.platform === 'win32') {
    for (const drive of ['D:', 'E:', 'F:']) {
      paths.push(join(drive, 'WeGameApps', '英雄联盟', 'Game', 'League of Legends', 'lockfile'))
      paths.push(join(drive, 'WeGameApps', '英雄联盟', 'LeagueClient', 'lockfile'))
      paths.push(join(drive, '英雄联盟', 'Game', 'League of Legends', 'lockfile'))
      paths.push(join(drive, 'Riot Games', 'League of Legends', 'lockfile'))
      paths.push(join(drive, '腾讯游戏', '英雄联盟', 'Game', 'League of Legends', 'lockfile'))
    }
  }

  return [...new Set(paths)]
}

const WEGAME_SCAN_ROOTS: string[] = []

function getWeGameScanRoots(): string[] {
  if (WEGAME_SCAN_ROOTS.length > 0) {
    return WEGAME_SCAN_ROOTS
  }
  const up = process.env.USERPROFILE
  if (up) {
    WEGAME_SCAN_ROOTS.push(join(up, 'Games', 'WeGameApps'))
  }
  WEGAME_SCAN_ROOTS.push(join('C:', 'UserSpace', 'Games', 'WeGameApps'))
  WEGAME_SCAN_ROOTS.push(join('C:', 'Games', 'WeGameApps'))
  WEGAME_SCAN_ROOTS.push(join('D:', 'Games', 'WeGameApps'))
  const pf = process.env.PROGRAMFILES
  const pf86 = process.env['PROGRAMFILES(X86)']
  if (pf) {
    WEGAME_SCAN_ROOTS.push(join(pf, 'WeGameApps'))
  }
  if (pf86) {
    WEGAME_SCAN_ROOTS.push(join(pf86, 'WeGameApps'))
  }
  return WEGAME_SCAN_ROOTS
}

/**
 * 扫描 WeGameApps 下各游戏目录，收集 Game\\League of Legends\\lockfile 与 LeagueClient\\lockfile（先 Game 后 Client）。
 */
function collectWeGameLockfilesByScan(): string[] {
  const out: string[] = []
  for (const root of [...new Set(getWeGameScanRoots())]) {
    if (!root || !existsSync(root)) {
      continue
    }
    try {
      const dirents = readdirSync(root, { withFileTypes: true })
      for (const d of dirents) {
        if (!d.isDirectory()) {
          continue
        }
        const base = join(root, d.name)
        out.push(join(base, 'Game', 'League of Legends', 'lockfile'))
        out.push(join(base, 'LeagueClient', 'lockfile'))
      }
    } catch {
      // 忽略无权限或非目录
    }
  }
  return out
}

/** Riot 启动器用的 lockfile，端口不是英雄联盟 LCU，需跳过 */
function isRiotLauncherLockfileNotGame(path: string): boolean {
  const n = path.replace(/\\/g, '/').toLowerCase()
  return (
    n.includes('/riot client data/metadata/') ||
    n.includes('/riot client data/user data/config/')
  )
}

/** 合并候选路径（静态 + 扫描），去重且保持顺序 */
export function getAllLockfileCandidatesOrdered(): string[] {
  return [...new Set([...getLockfileCandidatePaths(), ...collectWeGameLockfilesByScan()])]
}

/** 在候选路径中查找第一个可解析的 lockfile；均不可用时返回 null */
export function findLockfilePath(): string | null {
  for (const p of getAllLockfileCandidatesOrdered()) {
    if (!p || !existsSync(p) || isRiotLauncherLockfileNotGame(p)) {
      continue
    }
    let raw: string
    try {
      raw = readFileSync(p, { encoding: 'utf-8' })
    } catch {
      continue
    }
    if (!raw.trim()) {
      continue
    }
    try {
      parseLockfile(raw)
      return p
    } catch {
      continue
    }
  }
  return null
}

/** @deprecated 使用 findLockfilePath；仅保留供单一路径场景 */
export function getDefaultLockfilePath(): string {
  const la = process.env.LOCALAPPDATA
  if (!la) {
    throw new Error('LOCALAPPDATA is not defined')
  }
  return join(la, 'Riot Games', 'League of Legends', 'lockfile')
}

/**
 * lockfile 单行格式: name:pid:port:password:protocol
 * name 在 Windows 上常为带盘符路径（含多个 `:`），不能按固定下标取 port/password，应从末尾解析。
 * @see https://hextechdocs.dev/getting-started-with-the-lcu-websocket
 */
export function parseLockfile(content: string): LockfileCredentials {
  const trimmed = content.trim().replace(/^\uFEFF/, '')
  const parts = trimmed.split(':')
  if (parts.length < 5) {
    throw new Error('LOCKFILE_INVALID')
  }
  const protocol = parts[parts.length - 1]
  const password = parts[parts.length - 2]
  const port = parts[parts.length - 3]
  if (!port || !password || !protocol) {
    throw new Error('LOCKFILE_INVALID')
  }
  if (!/^\d+$/.test(port)) {
    throw new Error('LOCKFILE_INVALID')
  }
  return { port, password }
}

export function readLockfileCredentials(lockfilePath: string): LockfileCredentials {
  if (!existsSync(lockfilePath)) {
    throw new Error('LOCKFILE_NOT_FOUND')
  }
  const raw = readFileSync(lockfilePath, { encoding: 'utf-8' })
  try {
    return parseLockfile(raw)
  } catch {
    throw new Error('LOCKFILE_INVALID')
  }
}

/** 自动发现 lockfile 并读取；跳过空文件与 Riot 启动器 lockfile；找不到可解析项时抛出 LOCKFILE_NOT_FOUND */
export function readLockfileCredentialsAuto(): LockfileCredentials {
  for (const p of getAllLockfileCandidatesOrdered()) {
    if (!p || !existsSync(p) || isRiotLauncherLockfileNotGame(p)) {
      continue
    }
    let raw: string
    try {
      raw = readFileSync(p, { encoding: 'utf-8' })
    } catch {
      continue
    }
    if (!raw.trim()) {
      continue
    }
    try {
      return parseLockfile(raw)
    } catch {
      continue
    }
  }
  const fromProc = tryLeagueClientUxCredentialsFromWindows()
  if (fromProc) {
    return fromProc
  }
  throw new Error('LOCKFILE_NOT_FOUND')
}

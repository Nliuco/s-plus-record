import { readLockfileCredentialsAuto, type LockfileCredentials } from './lockfile'
import { loadPersistedLcuCredentials } from './persistedCredentials'

let sessionOverride: LockfileCredentials | null = null

export function setSessionCredentialsOverride(creds: LockfileCredentials | null): void {
  sessionOverride = creds
}

/**
 * 内存手动覆盖 > 本机加密文件 > lockfile / 进程命令行
 */
export function resolveLcuCredentials(): LockfileCredentials {
  if (sessionOverride !== null) {
    return sessionOverride
  }
  const persisted = loadPersistedLcuCredentials()
  if (persisted !== null) {
    return persisted
  }
  return readLockfileCredentialsAuto()
}

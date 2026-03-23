import { ipcMain } from 'electron'
import axios, { type AxiosError } from 'axios'
import type { GetMasteryResult, LcuErrorCode, LcuSessionCredentialsInput } from '@shared/types/lcu'
import {
  IPC_LCU_GET_CHAMPION_MASTERY,
  IPC_LCU_GET_REVEAL_VAULT_STATUS,
  IPC_LCU_REVEAL_PERSISTED_CREDENTIALS,
  IPC_LCU_SETUP_REVEAL_PASSWORD,
  IPC_LCU_SET_SESSION_CREDENTIALS,
  IPC_LCU_TRY_DISCOVER_CREDENTIALS
} from '@shared/ipc/channels'
import type {
  LcuDiscoveredCredentialsResult,
  LcuRevealPersistedInput,
  LcuRevealPersistedResult,
  LcuSetupRevealPasswordInput,
  LcuSetupRevealPasswordResult,
  LcuRevealVaultStatus
} from '@shared/types/lcu'
import { fetchChampionMastery } from './client'
import {
  clearPersistedLcuCredentials,
  loadPersistedLcuCredentials,
  persistedLcuCredentialFileExists,
  savePersistedLcuCredentials
} from './persistedCredentials'
import {
  clearRevealVault,
  hasRevealPassword,
  saveRevealPasswordHash,
  verifyRevealPassword
} from './revealVault'
import { readLockfileCredentialsAuto } from './lockfile'
import { resolveLcuCredentials, setSessionCredentialsOverride } from './sessionCredentials'

function axiosErrorToUserMessage(e: AxiosError): string {
  const status = e.response?.status
  const errCode = e.code
  if (status != null) {
    return `无法连接 LCU（HTTP ${status}）。请确认客户端已登录，或尝试在「高级」中更新 remoting-auth-token。`
  }
  if (errCode != null && errCode !== '') {
    return `无法连接 LCU（网络错误：${errCode}）。请确认英雄联盟客户端正在运行。`
  }
  return '无法连接 LCU（请确认英雄联盟客户端已登录）。'
}

function mapErrorToResult(err: unknown): GetMasteryResult {
  const msg = err instanceof Error ? err.message : String(err)
  let code: LcuErrorCode = 'REQUEST_FAILED'
  if (msg === 'LOCKFILE_NOT_FOUND') {
    code = 'LOCKFILE_NOT_FOUND'
  } else if (msg === 'LOCKFILE_INVALID') {
    code = 'LOCKFILE_INVALID'
  } else if (msg === 'PARSE_ERROR') {
    code = 'PARSE_ERROR'
  }
  const friendly =
    code === 'LOCKFILE_NOT_FOUND'
      ? '未获取到 LCU 凭证（本机未能自动读取 lockfile 或 LeagueClientUx 命令行，国服环境较常见）。请点击「LCU 凭证…」：先试「尝试自动读取」，或按步骤粘贴管理员 PowerShell 输出的一整行，无需手抄端口与 token。'
      : code === 'LOCKFILE_INVALID'
        ? 'lockfile 格式无效，请确认客户端已完全启动。'
        : code === 'PARSE_ERROR'
          ? 'LCU 返回的数据格式无法解析。'
          : '请求 LCU 失败，请确认客户端正在运行且未休眠。'
  return { ok: false, code, message: friendly }
}

function validateAndApplySessionCredentials(
  payload: LcuSessionCredentialsInput | null | undefined
): { ok: true } | { ok: false; message: string } {
  if (payload === null || payload === undefined) {
    setSessionCredentialsOverride(null)
    clearPersistedLcuCredentials()
    clearRevealVault()
    return { ok: true }
  }
  const port = payload.port.trim()
  const password = payload.password.trim()
  if (!/^\d+$/.test(port)) {
    return { ok: false, message: 'app-port 须为数字。' }
  }
  if (password.length === 0) {
    return { ok: false, message: 'remoting-auth-token 不能为空。' }
  }
  if (payload.persistToDisk === true) {
    const saved = savePersistedLcuCredentials(port, password)
    if (!saved.ok) {
      return saved
    }
  }
  setSessionCredentialsOverride({ port, password })
  return { ok: true }
}

function handleTryDiscoverCredentials(): LcuDiscoveredCredentialsResult {
  try {
    const c = readLockfileCredentialsAuto()
    return { ok: true, port: c.port, password: c.password }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg === 'LOCKFILE_NOT_FOUND') {
      return {
        ok: false,
        message:
          '未读到凭证：请先登录英雄联盟并保持客户端开启。若仍失败，请用下方「粘贴命令行」（管理员 PowerShell 里复制输出的整行即可，无需自己拆端口和 token）。'
      }
    }
    return { ok: false, message: '自动读取失败，请尝试粘贴命令行或手动填写两项。' }
  }
}

function handleGetRevealVaultStatus(): LcuRevealVaultStatus {
  return {
    hasPersistedCredentials: persistedLcuCredentialFileExists(),
    hasRevealPassword: hasRevealPassword()
  }
}

function handleSetupRevealPassword(
  payload: LcuSetupRevealPasswordInput | null | undefined
): LcuSetupRevealPasswordResult {
  const a = payload?.password?.trim() ?? ''
  const b = payload?.passwordConfirm?.trim() ?? ''
  if (a.length < 6) {
    return { ok: false, message: '查看密码至少 6 位。' }
  }
  if (a !== b) {
    return { ok: false, message: '两次输入的查看密码不一致。' }
  }
  if (!persistedLcuCredentialFileExists()) {
    return {
      ok: false,
      message: '当前没有本机加密保存的 LCU 凭证。请先填写并勾选「记住到本机」保存一次。'
    }
  }
  const saved = saveRevealPasswordHash(a)
  if (!saved.ok) {
    return saved
  }
  const creds = loadPersistedLcuCredentials()
  if (creds === null) {
    return { ok: false, message: '已保存查看密码，但读取本机 LCU 凭证失败。' }
  }
  return { ok: true, port: creds.port, token: creds.password }
}

function handleRevealPersisted(
  payload: LcuRevealPersistedInput | null | undefined
): LcuRevealPersistedResult {
  const pwd = payload?.password ?? ''
  if (!persistedLcuCredentialFileExists()) {
    return { ok: false, message: '没有本机保存的 LCU 凭证。' }
  }
  if (!hasRevealPassword()) {
    return {
      ok: false,
      code: 'NO_REVEAL_PASSWORD',
      message: '尚未设置查看密码，请先在下方完成首次设置。'
    }
  }
  if (!verifyRevealPassword(pwd)) {
    return { ok: false, message: '查看密码错误。' }
  }
  const creds = loadPersistedLcuCredentials()
  if (creds === null) {
    return { ok: false, message: '读取本机凭证失败。' }
  }
  return { ok: true, port: creds.port, token: creds.password }
}

export function registerLcuIpcHandlers(): void {
  ipcMain.removeHandler(IPC_LCU_SET_SESSION_CREDENTIALS)
  ipcMain.handle(
    IPC_LCU_SET_SESSION_CREDENTIALS,
    (_evt, payload: LcuSessionCredentialsInput | null | undefined) =>
      validateAndApplySessionCredentials(payload)
  )

  ipcMain.removeHandler(IPC_LCU_GET_REVEAL_VAULT_STATUS)
  ipcMain.handle(IPC_LCU_GET_REVEAL_VAULT_STATUS, () => handleGetRevealVaultStatus())

  ipcMain.removeHandler(IPC_LCU_SETUP_REVEAL_PASSWORD)
  ipcMain.handle(
    IPC_LCU_SETUP_REVEAL_PASSWORD,
    (_evt, payload: LcuSetupRevealPasswordInput | null | undefined) => handleSetupRevealPassword(payload)
  )

  ipcMain.removeHandler(IPC_LCU_REVEAL_PERSISTED_CREDENTIALS)
  ipcMain.handle(
    IPC_LCU_REVEAL_PERSISTED_CREDENTIALS,
    (_evt, payload: LcuRevealPersistedInput | null | undefined) => handleRevealPersisted(payload)
  )

  ipcMain.removeHandler(IPC_LCU_TRY_DISCOVER_CREDENTIALS)
  ipcMain.handle(IPC_LCU_TRY_DISCOVER_CREDENTIALS, () => handleTryDiscoverCredentials())

  ipcMain.removeHandler(IPC_LCU_GET_CHAMPION_MASTERY)
  ipcMain.handle(IPC_LCU_GET_CHAMPION_MASTERY, async (): Promise<GetMasteryResult> => {
    try {
      const { port, password } = resolveLcuCredentials()
      const data = await fetchChampionMastery(port, password)
      return { ok: true, data }
    } catch (e) {
      if (axios.isAxiosError(e)) {
        return {
          ok: false,
          code: 'REQUEST_FAILED',
          message: axiosErrorToUserMessage(e)
        }
      }
      return mapErrorToResult(e)
    }
  })
}

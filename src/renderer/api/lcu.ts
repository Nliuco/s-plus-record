import type {
  GetMasteryResult,
  LcuDiscoveredCredentialsResult,
  LcuRevealPersistedInput,
  LcuRevealPersistedResult,
  LcuRevealVaultStatus,
  LcuSessionCredentialsInput,
  LcuSetupRevealPasswordInput,
  LcuSetupRevealPasswordResult,
  SetLcuSessionCredentialsResult
} from '@shared/types/lcu'

function requireBridge(): Window['electron'] {
  const bridge = window.electron
  if (bridge === undefined) {
    return undefined
  }
  return bridge
}

export async function getChampionMastery(): Promise<GetMasteryResult> {
  const bridge = requireBridge()
  if (bridge === undefined || typeof bridge.getChampionMastery !== 'function') {
    return {
      ok: false,
      code: 'REQUEST_FAILED',
      message:
        'preload 未就绪（window.electron 不存在）。请检查主进程 BrowserWindow 的 preload 是否指向 out/preload/index.mjs。'
    }
  }
  return bridge.getChampionMastery()
}

export async function setLcuSessionCredentials(
  payload: LcuSessionCredentialsInput | null
): Promise<SetLcuSessionCredentialsResult> {
  const bridge = requireBridge()
  if (bridge === undefined || typeof bridge.setLcuSessionCredentials !== 'function') {
    return { ok: false, message: 'preload 未就绪，无法设置会话凭证。' }
  }
  return bridge.setLcuSessionCredentials(payload)
}

export async function getLcuRevealVaultStatus(): Promise<LcuRevealVaultStatus | null> {
  const bridge = requireBridge()
  if (bridge === undefined || typeof bridge.getLcuRevealVaultStatus !== 'function') {
    return null
  }
  return bridge.getLcuRevealVaultStatus()
}

export async function setupLcuRevealPassword(
  payload: LcuSetupRevealPasswordInput
): Promise<LcuSetupRevealPasswordResult> {
  const bridge = requireBridge()
  if (bridge === undefined || typeof bridge.setupLcuRevealPassword !== 'function') {
    return { ok: false, message: 'preload 未就绪，无法设置查看密码。' }
  }
  return bridge.setupLcuRevealPassword(payload)
}

export async function revealPersistedLcuCredentials(
  payload: LcuRevealPersistedInput
): Promise<LcuRevealPersistedResult> {
  const bridge = requireBridge()
  if (bridge === undefined || typeof bridge.revealPersistedLcuCredentials !== 'function') {
    return { ok: false, message: 'preload 未就绪，无法回显凭证。' }
  }
  return bridge.revealPersistedLcuCredentials(payload)
}

export async function tryDiscoverLcuCredentials(): Promise<LcuDiscoveredCredentialsResult> {
  const bridge = requireBridge()
  if (bridge === undefined || typeof bridge.tryDiscoverLcuCredentials !== 'function') {
    return { ok: false, message: 'preload 未就绪，无法自动读取凭证。' }
  }
  return bridge.tryDiscoverLcuCredentials()
}


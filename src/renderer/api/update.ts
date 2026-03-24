import type {
  UpdateCheckNowResult,
  UpdateEventPayload,
  UpdateInstallResult,
  UpdateOpenDirResult,
  UpdateRemindChoice
} from '@shared/types/update'

function requireBridge(): Window['electron'] {
  const bridge = window.electron
  if (bridge === undefined) return undefined
  return bridge
}

export async function checkForUpdatesNow(): Promise<UpdateCheckNowResult> {
  const bridge = requireBridge()
  if (bridge === undefined || typeof bridge.checkForUpdatesNow !== 'function') {
    throw new Error('preload 未就绪，无法检查更新。')
  }
  return bridge.checkForUpdatesNow()
}

export async function setUpdateRemindChoice(
  choice: UpdateRemindChoice
): Promise<{ ok: true } | { ok: false; message: string }> {
  const bridge = requireBridge()
  if (bridge === undefined || typeof bridge.setUpdateRemindChoice !== 'function') {
    return { ok: false, message: 'preload 未就绪，无法设置更新提醒。' }
  }
  return bridge.setUpdateRemindChoice(choice)
}

export async function installUpdateNow(): Promise<UpdateInstallResult> {
  const bridge = requireBridge()
  if (bridge === undefined || typeof bridge.installUpdateNow !== 'function') {
    return { ok: false, message: 'preload 未就绪，无法安装更新。' }
  }
  return bridge.installUpdateNow()
}

export async function openUpdateDownloadDir(): Promise<UpdateOpenDirResult> {
  const bridge = requireBridge()
  if (bridge === undefined || typeof bridge.openUpdateDownloadDir !== 'function') {
    return { ok: false, message: 'preload 未就绪，无法打开目录。' }
  }
  return bridge.openUpdateDownloadDir()
}

export function onUpdateEvent(cb: (payload: UpdateEventPayload) => void): void {
  const bridge = requireBridge()
  if (bridge === undefined || typeof bridge.onUpdateEvent !== 'function') return
  bridge.onUpdateEvent(cb)
}


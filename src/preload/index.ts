import { contextBridge, ipcRenderer } from 'electron'
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
import type { ApplyWindowLayoutResult, WindowLayoutPreset } from '@shared/types/window'
import type {
  UpdateCheckNowResult,
  UpdateEventPayload,
  UpdateInstallResult,
  UpdateOpenDirResult,
  UpdateRemindChoice
} from '@shared/types/update'
import {
  IPC_LCU_GET_CHAMPION_MASTERY,
  IPC_LCU_GET_REVEAL_VAULT_STATUS,
  IPC_LCU_REVEAL_PERSISTED_CREDENTIALS,
  IPC_LCU_SETUP_REVEAL_PASSWORD,
  IPC_LCU_SET_SESSION_CREDENTIALS,
  IPC_LCU_TRY_DISCOVER_CREDENTIALS,
  IPC_WINDOW_APPLY_LAYOUT_PRESET,
  IPC_UPDATE_CHECK_NOW,
  IPC_UPDATE_EVENT,
  IPC_UPDATE_INSTALL_NOW,
  IPC_UPDATE_OPEN_DOWNLOAD_DIR,
  IPC_UPDATE_SET_REMIND
} from '@shared/ipc/channels'

const api = {
  getChampionMastery: (): Promise<GetMasteryResult> =>
    ipcRenderer.invoke(IPC_LCU_GET_CHAMPION_MASTERY),
  setLcuSessionCredentials: (
    payload: LcuSessionCredentialsInput | null
  ): Promise<SetLcuSessionCredentialsResult> =>
    ipcRenderer.invoke(IPC_LCU_SET_SESSION_CREDENTIALS, payload),
  getLcuRevealVaultStatus: (): Promise<LcuRevealVaultStatus> =>
    ipcRenderer.invoke(IPC_LCU_GET_REVEAL_VAULT_STATUS),
  setupLcuRevealPassword: (
    payload: LcuSetupRevealPasswordInput
  ): Promise<LcuSetupRevealPasswordResult> =>
    ipcRenderer.invoke(IPC_LCU_SETUP_REVEAL_PASSWORD, payload),
  revealPersistedLcuCredentials: (
    payload: LcuRevealPersistedInput
  ): Promise<LcuRevealPersistedResult> =>
    ipcRenderer.invoke(IPC_LCU_REVEAL_PERSISTED_CREDENTIALS, payload),
  tryDiscoverLcuCredentials: (): Promise<LcuDiscoveredCredentialsResult> =>
    ipcRenderer.invoke(IPC_LCU_TRY_DISCOVER_CREDENTIALS),
  applyWindowLayoutPreset: (preset: WindowLayoutPreset): Promise<ApplyWindowLayoutResult> =>
    ipcRenderer.invoke(IPC_WINDOW_APPLY_LAYOUT_PRESET, preset),

  checkForUpdatesNow: (): Promise<UpdateCheckNowResult> =>
    ipcRenderer.invoke(IPC_UPDATE_CHECK_NOW),

  setUpdateRemindChoice: (
    choice: UpdateRemindChoice
  ): Promise<{ ok: true } | { ok: false; message: string }> =>
    ipcRenderer.invoke(IPC_UPDATE_SET_REMIND, choice),

  installUpdateNow: (): Promise<UpdateInstallResult> => ipcRenderer.invoke(IPC_UPDATE_INSTALL_NOW),

  openUpdateDownloadDir: (): Promise<UpdateOpenDirResult> => ipcRenderer.invoke(IPC_UPDATE_OPEN_DOWNLOAD_DIR),

  onUpdateEvent: (cb: (payload: UpdateEventPayload) => void): void => {
    ipcRenderer.on(IPC_UPDATE_EVENT, (_evt, payload: UpdateEventPayload) => {
      cb(payload)
    })
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', api)
  } catch (error) {
    console.error(error)
  }
} else {
  ;(window as unknown as { electron: typeof api }).electron = api
}

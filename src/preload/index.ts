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
import {
  IPC_LCU_GET_CHAMPION_MASTERY,
  IPC_LCU_GET_REVEAL_VAULT_STATUS,
  IPC_LCU_REVEAL_PERSISTED_CREDENTIALS,
  IPC_LCU_SETUP_REVEAL_PASSWORD,
  IPC_LCU_SET_SESSION_CREDENTIALS,
  IPC_LCU_TRY_DISCOVER_CREDENTIALS,
  IPC_WINDOW_APPLY_LAYOUT_PRESET
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
    ipcRenderer.invoke(IPC_WINDOW_APPLY_LAYOUT_PRESET, preset)
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

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

export interface ElectronAPI {
  /** 从主进程经 LCU 拉取本地召唤师英雄熟练度列表（不含 Token） */
  getChampionMastery: () => Promise<GetMasteryResult>
  /** 会话级手动凭证，仅存主进程内存；传 null 清除 */
  setLcuSessionCredentials: (
    payload: LcuSessionCredentialsInput | null
  ) => Promise<SetLcuSessionCredentialsResult>
  getLcuRevealVaultStatus: () => Promise<LcuRevealVaultStatus>
  setupLcuRevealPassword: (
    payload: LcuSetupRevealPasswordInput
  ) => Promise<LcuSetupRevealPasswordResult>
  revealPersistedLcuCredentials: (
    payload: LcuRevealPersistedInput
  ) => Promise<LcuRevealPersistedResult>
  /** 从 lockfile / 进程尝试读取，不写入磁盘 */
  tryDiscoverLcuCredentials: () => Promise<LcuDiscoveredCredentialsResult>
  applyWindowLayoutPreset: (preset: WindowLayoutPreset) => Promise<ApplyWindowLayoutResult>
}

declare global {
  interface Window {
    /** preload 成功注入后存在；未指向正确 preload 文件时可能为 undefined */
    electron?: ElectronAPI
  }
}

export {}

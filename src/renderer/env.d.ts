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

  /** 手动检查：触发后台下载（如有新版本），返回当前检查状态 */
  checkForUpdatesNow: () => Promise<UpdateCheckNowResult>

  /** 设置“稍后提醒/关闭/❌”后的提醒策略（不影响后台下载进度） */
  setUpdateRemindChoice: (
    choice: UpdateRemindChoice
  ) => Promise<{ ok: true } | { ok: false; message: string }>

  /** 安装/更新动作（下载完成后才可用） */
  installUpdateNow: () => Promise<UpdateInstallResult>

  /** 打开便携版下载目录（不会覆盖当前版本） */
  openUpdateDownloadDir: () => Promise<UpdateOpenDirResult>

  /** 订阅更新事件：打开弹窗（ready/failed） */
  onUpdateEvent: (cb: (payload: UpdateEventPayload) => void) => void
}

declare global {
  interface Window {
    /** preload 成功注入后存在；未指向正确 preload 文件时可能为 undefined */
    electron?: ElectronAPI
  }
}

export {}

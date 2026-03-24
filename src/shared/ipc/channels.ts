/** 与主进程 registerLcuIpcHandlers 保持一致 */
export const IPC_LCU_GET_CHAMPION_MASTERY = 'lcu:getChampionMastery' as const

export const IPC_LCU_SET_SESSION_CREDENTIALS = 'lcu:setSessionCredentials' as const

export const IPC_LCU_GET_REVEAL_VAULT_STATUS = 'lcu:getRevealVaultStatus' as const
export const IPC_LCU_SETUP_REVEAL_PASSWORD = 'lcu:setupRevealPassword' as const
export const IPC_LCU_REVEAL_PERSISTED_CREDENTIALS = 'lcu:revealPersistedCredentials' as const

/** 尝试从 lockfile / Windows 进程自动读取凭证（不写入磁盘） */
export const IPC_LCU_TRY_DISCOVER_CREDENTIALS = 'lcu:tryDiscoverCredentials' as const

export const IPC_WINDOW_APPLY_LAYOUT_PRESET = 'window:applyLayoutPreset' as const

/** 更新：手动检查触发后台下载（不保证立即弹窗） */
export const IPC_UPDATE_CHECK_NOW = 'update:checkNow' as const

/** 更新：用户选择稍后/关闭后，主进程更新提醒策略 */
export const IPC_UPDATE_SET_REMIND = 'update:setRemind' as const

/** 更新：用户点击重启/去更新，主进程执行安装/启动 */
export const IPC_UPDATE_INSTALL_NOW = 'update:installNow' as const

/** 更新：主进程向渲染进程广播“可更新/下载失败”等事件 */
export const IPC_UPDATE_EVENT = 'update:event' as const

/** 更新：打开下载目录（便携版提示） */
export const IPC_UPDATE_OPEN_DOWNLOAD_DIR = 'update:openDownloadDir' as const

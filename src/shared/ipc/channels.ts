/** 与主进程 registerLcuIpcHandlers 保持一致 */
export const IPC_LCU_GET_CHAMPION_MASTERY = 'lcu:getChampionMastery' as const

export const IPC_LCU_SET_SESSION_CREDENTIALS = 'lcu:setSessionCredentials' as const

export const IPC_LCU_GET_REVEAL_VAULT_STATUS = 'lcu:getRevealVaultStatus' as const
export const IPC_LCU_SETUP_REVEAL_PASSWORD = 'lcu:setupRevealPassword' as const
export const IPC_LCU_REVEAL_PERSISTED_CREDENTIALS = 'lcu:revealPersistedCredentials' as const

/** 尝试从 lockfile / Windows 进程自动读取凭证（不写入磁盘） */
export const IPC_LCU_TRY_DISCOVER_CREDENTIALS = 'lcu:tryDiscoverCredentials' as const

export const IPC_WINDOW_APPLY_LAYOUT_PRESET = 'window:applyLayoutPreset' as const

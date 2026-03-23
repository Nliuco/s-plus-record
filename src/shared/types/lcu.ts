/** LCU 英雄熟练度列表单项（与客户端 JSON 对齐的最小字段集） */
export interface ChampionMasteryEntry {
  championId: number
  /** 本赛季最高评价，如 S+、S、A+ 等 */
  highestGrade?: string | null
}

export type LcuErrorCode =
  | 'LOCKFILE_NOT_FOUND'
  | 'LOCKFILE_INVALID'
  | 'REQUEST_FAILED'
  | 'PARSE_ERROR'

export type GetMasteryResult =
  | { ok: true; data: ChampionMasteryEntry[] }
  | { ok: false; code: LcuErrorCode; message: string }

/** 渲染进程传入的手动 LCU 会话凭证（与 lockfile / 命令行等价） */
export interface LcuSessionCredentialsInput {
  port: string
  password: string
  /** 为 true 时用 safeStorage 加密写入用户数据目录，下次启动自动使用 */
  persistToDisk?: boolean
}

export type SetLcuSessionCredentialsResult =
  | { ok: true }
  | { ok: false; message: string }

/** 自动发现或解析得到凭证，仅返回给渲染进程填入表单，须用户再点「应用」 */
export type LcuDiscoveredCredentialsResult =
  | { ok: true; port: string; password: string }
  | { ok: false; message: string }

/** 本机是否已有加密 LCU 文件、是否已设置「查看密码」 */
export interface LcuRevealVaultStatus {
  hasPersistedCredentials: boolean
  hasRevealPassword: boolean
}

export interface LcuSetupRevealPasswordInput {
  password: string
  passwordConfirm: string
}

/** 首次设置查看密码后立即返回解密后的凭证（须已存在本机保存的 LCU 文件） */
export type LcuSetupRevealPasswordResult =
  | { ok: true; port: string; token: string }
  | { ok: false; message: string }

export interface LcuRevealPersistedInput {
  password: string
}

export type LcuRevealPersistedResult =
  | { ok: true; port: string; token: string }
  | { ok: false; message: string; code?: 'NO_REVEAL_PASSWORD' }

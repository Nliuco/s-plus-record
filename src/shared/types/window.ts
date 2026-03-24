/** 主窗口布局预设（与主进程 IPC 一致） */
export type WindowLayoutPreset =
  | 'default'
  | 'narrow-tall'
  | 'narrow-tall-left'
  | 'fullscreen'

export type ApplyWindowLayoutResult = { ok: true } | { ok: false; message: string }

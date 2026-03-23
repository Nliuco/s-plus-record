import { BrowserWindow, ipcMain, screen } from 'electron'
import { IPC_WINDOW_APPLY_LAYOUT_PRESET } from '@shared/ipc/channels'
import type { ApplyWindowLayoutResult, WindowLayoutPreset } from '@shared/types/window'

const DEFAULT_WIDTH = 670
const DEFAULT_HEIGHT = 900
/** 列表行较窄即可，靠右贴边方便与联盟客户端同屏 */
const NARROW_WIDTH = 500

function applyLayoutPreset(win: BrowserWindow, preset: WindowLayoutPreset): void {
  switch (preset) {
    case 'fullscreen':
      win.setFullScreen(true)
      break
    case 'maximized':
      win.setFullScreen(false)
      if (!win.isMaximized()) {
        win.maximize()
      }
      break
    case 'default':
      win.setFullScreen(false)
      win.unmaximize()
      win.setSize(DEFAULT_WIDTH, DEFAULT_HEIGHT)
      win.center()
      break
    case 'narrow-tall': {
      win.setFullScreen(false)
      win.unmaximize()
      const display = screen.getDisplayMatching(win.getBounds())
      const { workArea } = display
      const w = Math.min(NARROW_WIDTH, workArea.width)
      const h = workArea.height
      const x = workArea.x + workArea.width - w
      const y = workArea.y
      win.setBounds({ x, y, width: w, height: h })
      break
    }
    default:
      break
  }
}

export function registerWindowLayoutIpcHandlers(): void {
  ipcMain.removeHandler(IPC_WINDOW_APPLY_LAYOUT_PRESET)
  ipcMain.handle(
    IPC_WINDOW_APPLY_LAYOUT_PRESET,
    (event, preset: WindowLayoutPreset): ApplyWindowLayoutResult => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win || win.isDestroyed()) {
        return { ok: false, message: '未找到窗口。' }
      }
      applyLayoutPreset(win, preset)
      return { ok: true }
    }
  )
}

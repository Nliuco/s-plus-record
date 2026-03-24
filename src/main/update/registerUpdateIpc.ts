import { ipcMain, app } from 'electron'
import type {
  UpdateCheckNowResult,
  UpdateInstallResult,
  UpdateOpenDirResult,
  UpdateRemindChoice
} from '@shared/types/update'
import {
  IPC_UPDATE_CHECK_NOW,
  IPC_UPDATE_INSTALL_NOW,
  IPC_UPDATE_OPEN_DOWNLOAD_DIR,
  IPC_UPDATE_SET_REMIND
} from '@shared/ipc/channels'
import type { UpdateService } from './updateService'

export function registerUpdateIpcHandlers(updateService: UpdateService): void {
  ipcMain.removeHandler(IPC_UPDATE_CHECK_NOW)
  ipcMain.handle(IPC_UPDATE_CHECK_NOW, async (): Promise<UpdateCheckNowResult> => {
    try {
      return await updateService.checkForUpdatesNow()
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return {
        ok: true,
        status: 'check-failed',
        currentVersion: app.getVersion(),
        latestVersion: null,
        latestTag: null,
        message
      }
    }
  })

  ipcMain.removeHandler(IPC_UPDATE_SET_REMIND)
  ipcMain.handle(IPC_UPDATE_SET_REMIND, async (_evt, choice: UpdateRemindChoice) => {
    try {
      await updateService.setRemindChoice(choice)
      return { ok: true } as const
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return { ok: false, message } as const
    }
  })

  ipcMain.removeHandler(IPC_UPDATE_INSTALL_NOW)
  ipcMain.handle(IPC_UPDATE_INSTALL_NOW, async (): Promise<UpdateInstallResult> => {
    try {
      await updateService.installUpdateNow()
      return { ok: true } as const
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return { ok: false, message } as const
    }
  })

  ipcMain.removeHandler(IPC_UPDATE_OPEN_DOWNLOAD_DIR)
  ipcMain.handle(IPC_UPDATE_OPEN_DOWNLOAD_DIR, async (): Promise<UpdateOpenDirResult> => {
    try {
      await updateService.openUpdateDownloadDir()
      return { ok: true } as const
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return { ok: false, message } as const
    }
  })
}


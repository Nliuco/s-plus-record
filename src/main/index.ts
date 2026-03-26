import { app, BrowserWindow, shell } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerLcuIpcHandlers } from './lcu/ipc'
import { registerWindowLayoutIpcHandlers } from './windowLayout'
import { registerUpdateIpcHandlers } from './update/registerUpdateIpc'
import { UpdateService } from './update/updateService'

/**
 * Windows 上 Chromium 常用覆盖式滚动条，会弱化或忽略 ::-webkit-scrollbar 宽度；
 * 关闭后走经典滚动条，列表里自定义的轨道宽度才稳定可见。
 */
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('disable-features', 'OverlayScrollbar')
}

let updateService: UpdateService | null = null

/** electron-vite 默认产出 index.mjs，若写死 index.js 会导致 preload 未加载、window.electron 不存在 */
function resolvePreloadPath(): string {
  const dir = join(__dirname, '../preload')
  const mjs = join(dir, 'index.mjs')
  const js = join(dir, 'index.js')
  if (existsSync(mjs)) {
    return mjs
  }
  if (existsSync(js)) {
    return js
  }
  return mjs
}

/** 开发时窗口用仓库内 build/icon.png；安装包运行时不打包该路径，窗口图标来自 exe 内嵌 .ico */
function resolveWindowIconPath(): string | undefined {
  const fromMain = join(__dirname, '../../build/icon.png')
  if (existsSync(fromMain)) {
    return fromMain
  }
  const fromCwd = join(process.cwd(), 'build', 'icon.png')
  if (existsSync(fromCwd)) {
    return fromCwd
  }
  return undefined
}

function createWindow(): BrowserWindow {
  const iconPath = resolveWindowIconPath()
  const mainWindow = new BrowserWindow({
    width: 670,
    height: 900,
    minWidth: 360,
    minHeight: 480,
    show: false,
    autoHideMenuBar: true,
    ...(iconPath ? { icon: iconPath } : {}),
    webPreferences: {
      preload: resolvePreloadPath(),
      // LCU HTTPS 与 axios 均在主进程完成；若将 LCU 逻辑全部保留在 main，可再评估改为 sandbox: true
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // 处理链接点击，在默认浏览器打开
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('[renderer did-fail-load]', { code, desc, url })
    if (is.dev) {
      mainWindow.webContents.openDevTools({ mode: 'detach' })
    }
  })

  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error('[render-process-gone]', details)
  })

  // 开发环境加载 Vite 开发服务器 URL，生产环境加载本地文件
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (is.dev && devUrl) {
    void mainWindow.loadURL(devUrl)
  } else {
    const htmlPath = join(__dirname, '../renderer/index.html')
    if (is.dev && !devUrl) {
      console.warn(
        '[electron] 未设置 ELECTRON_RENDERER_URL，已回退为本地 out/renderer/index.html。若白屏请先执行 npm run build，或务必通过 npm run dev 启动。'
      )
    }
    void mainWindow.loadFile(htmlPath)
  }

  return mainWindow
}

// 当 Electron 完成初始化并准备好创建窗口时，调用此方法
app.whenReady().then(() => {
  registerLcuIpcHandlers()
  registerWindowLayoutIpcHandlers()

  // 设置 App ID (Windows 专用)
  electronApp.setAppUserModelId('com.electron.s-plus-record')

  // 开发环境下，按 F12 自动打开开发者工具
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const mainWindow = createWindow()

  updateService = new UpdateService(mainWindow)
  registerUpdateIpcHandlers(updateService)

  // 启动后立刻后台检查/下载；弹窗由渲染层订阅并在下一次挂载时兜底展示
  void updateService.startOrContinueBackgroundDownload()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      const w = createWindow()
      if (!updateService) {
        updateService = new UpdateService(w)
        registerUpdateIpcHandlers(updateService)
        void updateService.startOrContinueBackgroundDownload()
      }
    }
  })
})

// 当所有窗口都关闭时，退出应用（macOS 除外）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

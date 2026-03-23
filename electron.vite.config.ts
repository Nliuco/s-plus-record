import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import type { Plugin } from 'vite'

/**
 * Vite 5 会给 script/link 加 crossorigin，在部分环境下配合 file:// 加载时会导致入口 JS/CSS 无法执行（白屏）。
 * Electron 打包后走 loadFile，去掉该属性更安全。
 */
function stripCrossoriginForElectronRenderer(): Plugin {
  return {
    name: 'strip-crossorigin-electron-renderer',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(/\s+crossorigin(?:="[^"]*"|)?/gi, '')
    }
  }
}

export default defineConfig({
  main: {
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/shared')
      }
    },
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/shared')
      }
    },
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    // root: resolve(__dirname, 'src/renderer'),
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer'),
        '@shared': resolve(__dirname, 'src/shared')
      }
    },
    plugins: [vue(), stripCrossoriginForElectronRenderer()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/renderer/index.html')
      }
    }
  }
})

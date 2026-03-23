import type { ApplyWindowLayoutResult, WindowLayoutPreset } from '@shared/types/window'

function requireBridge(): Window['electron'] {
  return window.electron
}

export async function applyWindowLayoutPreset(
  preset: WindowLayoutPreset
): Promise<ApplyWindowLayoutResult> {
  const bridge = requireBridge()
  if (bridge === undefined || typeof bridge.applyWindowLayoutPreset !== 'function') {
    return {
      ok: false,
      message:
        '窗口 API 未注入：preload 脚本过旧或未重新编译。请完全退出本应用后执行 npm run build，再重新 npm run dev（或只重启 dev 并确保 out/preload/index.mjs 已更新）。'
    }
  }
  return bridge.applyWindowLayoutPreset(preset)
}

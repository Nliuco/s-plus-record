export type ThemeMode = 'dark' | 'light'

const STORAGE_KEY = 's-plus-record-theme'

export function readStoredTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light') {
      return 'light'
    }
  } catch {
    /* ignore */
  }
  return 'dark'
}

export function writeStoredTheme(mode: ThemeMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    /* ignore */
  }
}

export function applyTheme(mode: ThemeMode): void {
  document.documentElement.dataset.theme = mode
  document.documentElement.style.colorScheme = mode
}

type ViewTransitionHandle = { finished: Promise<void> }

/**
 * 用 View Transitions API 包裹主题更新：整页快照交叉淡化，比给每个子节点加 CSS transition 更顺滑、更省主线程。
 * 不支持或用户选择「减少动态效果」时直接执行 update。
 */
export async function runThemeUpdateWithTransition(
  update: () => void | Promise<void>
): Promise<void> {
  if (typeof window.matchMedia === 'function') {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      await Promise.resolve(update())
      return
    }
  }

  const doc = document as Document & {
    startViewTransition?: (cb: () => void | Promise<void>) => ViewTransitionHandle
  }

  if (typeof doc.startViewTransition !== 'function') {
    await Promise.resolve(update())
    return
  }

  try {
    await doc.startViewTransition(() => Promise.resolve(update())).finished
  } catch {
    await Promise.resolve(update())
  }
}

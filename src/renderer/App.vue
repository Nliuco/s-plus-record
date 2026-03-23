<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import HomeView from '@renderer/views/HomeView.vue'
import { applyWindowLayoutPreset } from '@renderer/api/windowLayout'
import {
  applyTheme,
  readStoredTheme,
  runThemeUpdateWithTransition,
  writeStoredTheme,
  type ThemeMode
} from '@renderer/composables/useAppTheme'
import type { WindowLayoutPreset } from '@shared/types/window'

const theme = ref<ThemeMode>(readStoredTheme())

const isLight = computed(() => theme.value === 'light')

async function toggleTheme(): Promise<void> {
  const next: ThemeMode = theme.value === 'dark' ? 'light' : 'dark'
  await runThemeUpdateWithTransition(async () => {
    theme.value = next
    writeStoredTheme(next)
    applyTheme(next)
    await nextTick()
  })
}

const layoutMenuOpen = ref(false)
const layoutMenuRoot = ref<HTMLElement | null>(null)
const layoutFeedback = ref<string | null>(null)

function onLayoutGlobalPointerDown(e: PointerEvent): void {
  if (!layoutMenuOpen.value || !layoutMenuRoot.value) {
    return
  }
  if (!layoutMenuRoot.value.contains(e.target as Node)) {
    layoutMenuOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', onLayoutGlobalPointerDown, true)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onLayoutGlobalPointerDown, true)
})

async function pickLayout(preset: WindowLayoutPreset): Promise<void> {
  layoutFeedback.value = null
  const r = await applyWindowLayoutPreset(preset)
  layoutMenuOpen.value = false
  if (!r.ok) {
    layoutFeedback.value = r.message
  }
}
</script>

<template>
  <div class="app-root">
    <div class="app-top-fabs">
      <div ref="layoutMenuRoot" class="layout-fab-wrap">
        <button
          type="button"
          class="layout-fab"
          aria-haspopup="menu"
          :aria-expanded="layoutMenuOpen"
          aria-label="窗口布局预设"
          title="窗口布局"
          @click.stop="layoutMenuOpen = !layoutMenuOpen"
        >
        <svg
          class="layout-fab__icon"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="7" height="18" rx="1" />
          <rect x="14" y="3" width="7" height="11" rx="1" />
          <rect x="14" y="17" width="7" height="4" rx="1" />
        </svg>
        </button>
        <ul
        v-show="layoutMenuOpen"
        class="layout-menu"
        role="menu"
        aria-label="窗口布局"
      >
        <li role="none">
          <button type="button" role="menuitem" class="layout-menu__item" @click="pickLayout('default')">
            默认（约 670×900 竖向居中）
          </button>
        </li>
        <li role="none">
          <button type="button" role="menuitem" class="layout-menu__item" @click="pickLayout('narrow-tall')">
            窄条竖屏（靠右贴边）
          </button>
        </li>
        <li role="none">
          <button type="button" role="menuitem" class="layout-menu__item" @click="pickLayout('maximized')">
            最大化（工作区）
          </button>
        </li>
        <li role="none">
          <button type="button" role="menuitem" class="layout-menu__item" @click="pickLayout('fullscreen')">
            全屏
          </button>
        </li>
        </ul>
        <p v-if="layoutFeedback" class="layout-fab__err" role="status">{{ layoutFeedback }}</p>
      </div>
      <button
        type="button"
        class="theme-fab"
        :aria-label="isLight ? '切换到夜间模式' : '切换到日间模式'"
        :title="isLight ? '夜间模式' : '日间模式'"
        @click="toggleTheme"
      >
      <span class="theme-fab__track" aria-hidden="true">
        <span class="theme-fab__thumb" :class="{ 'theme-fab__thumb--light': isLight }">
          <svg
            v-if="!isLight"
            class="theme-fab__icon"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
          </svg>
          <svg
            v-else
            class="theme-fab__icon"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        </span>
      </span>
    </button>
    </div>
    <HomeView />
  </div>
</template>

<style scoped>
.app-root {
  height: 100%;
  min-height: 100vh;
  background: var(--t-bg-deep);
  color: var(--t-text);
  overflow: hidden;
  box-sizing: border-box;
  position: relative;
}

.app-top-fabs {
  position: fixed;
  top: 0.65rem;
  right: 0.65rem;
  z-index: 55;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  pointer-events: none;
}

.app-top-fabs > * {
  pointer-events: auto;
}

.layout-fab-wrap {
  position: relative;
}

/* 与主题开关轨道同尺寸、同圆角，视觉成对 */
.layout-fab {
  margin: 0;
  padding: 0;
  width: 2.875rem;
  height: 1.45rem;
  border-radius: 999px;
  background: var(--t-bg-sort-trigger);
  border: 1px solid var(--t-border-soft);
  color: var(--t-accent-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    color 0.2s ease,
    box-shadow 0.2s ease;
}

.layout-fab:hover {
  border-color: var(--t-accent-42);
  background: var(--t-bg-pin-hover);
  color: var(--t-accent-text);
}

.layout-fab:focus-visible {
  outline: 2px solid var(--t-accent-65);
  outline-offset: 2px;
}

.layout-fab__icon {
  display: block;
  flex-shrink: 0;
}

.layout-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  margin: 0;
  padding: 0.35rem;
  list-style: none;
  min-width: 12.5rem;
  border-radius: 10px;
  background: var(--t-bg-modal);
  border: 1px solid var(--t-border-soft);
  box-shadow: var(--t-shadow-menu);
}

.layout-menu__item {
  display: block;
  width: 100%;
  margin: 0;
  padding: 0.48rem 0.65rem;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--t-text-body);
  font-size: 0.8rem;
  text-align: left;
  cursor: pointer;
  line-height: 1.35;
}

.layout-menu__item:hover {
  background: var(--t-bg-sort-item-hover);
  color: var(--t-text);
}

.layout-fab__err {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  left: auto;
  width: max-content;
  max-width: min(16rem, 70vw);
  margin: 0;
  padding: 0.4rem 0.55rem;
  border-radius: 8px;
  font-size: 0.75rem;
  line-height: 1.35;
  color: var(--t-warn);
  background: var(--t-bg-reveal);
  border: 1px solid var(--t-accent-25);
  z-index: 2;
}

.theme-fab {
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 1.45rem;
}

.theme-fab:focus-visible {
  outline: 2px solid var(--t-accent-65);
  outline-offset: 2px;
  border-radius: 999px;
}

.theme-fab__track {
  display: block;
  width: 2.875rem;
  height: 1.45rem;
  border-radius: 999px;
  background: var(--t-bg-sort-trigger);
  border: 1px solid var(--t-border-soft);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  position: relative;
  transition:
    background 0.45s cubic-bezier(0.4, 0, 0.2, 1),
    border-color 0.45s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.45s cubic-bezier(0.4, 0, 0.2, 1);
}

.theme-fab:hover .theme-fab__track {
  border-color: var(--t-accent-42);
  background: var(--t-bg-pin-hover);
}

.theme-fab__thumb {
  position: absolute;
  top: 50%;
  left: 0.15rem;
  width: 1.1rem;
  height: 1.1rem;
  box-sizing: border-box;
  border-radius: 50%;
  background: var(--t-bg-raised);
  border: 1px solid var(--t-border-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--t-accent-muted);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  line-height: 0;
  transform: translateY(-50%);
  transition:
    transform 0.5s cubic-bezier(0.34, 1.2, 0.64, 1),
    background 0.45s cubic-bezier(0.4, 0, 0.2, 1),
    color 0.45s cubic-bezier(0.4, 0, 0.2, 1),
    border-color 0.45s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.45s cubic-bezier(0.4, 0, 0.2, 1);
}

.theme-fab__thumb--light {
  transform: translate(1.48rem, -50%);
  color: var(--t-title-gold);
}

/* 24×24 笔画图标视觉重心略偏下，微上移与圆钮边缘更齐 */
.theme-fab__icon {
  display: block;
  flex-shrink: 0;
  transform: translateY(-0.5px);
}
</style>

<style>
html,
body,
#app {
  height: 100%;
  margin: 0;
  overflow: hidden;
}
body {
  font-family:
    system-ui,
    -apple-system,
    'Segoe UI',
    Roboto,
    sans-serif;
  background: var(--t-bg-deep);
  color: var(--t-text);
}
</style>

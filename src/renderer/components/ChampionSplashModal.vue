<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { ChampionDisplay } from '@renderer/types/champion'
import { championSplashUrl, formatChampionSlugDisplay } from '@renderer/utils/ddragon'
import { masteryGradeStyleSuffix } from '@renderer/utils/masteryGrade'

const props = defineProps<{
  display: ChampionDisplay
  grade: string | null
}>()

const emit = defineEmits<{
  close: []
}>()

const splashSrc = computed(() => championSplashUrl(props.display.key, 0))

const englishLabel = computed(() => formatChampionSlugDisplay(props.display.key))

const imageLoaded = ref(false)
const imageError = ref(false)

watch(
  () => props.display.key,
  () => {
    imageLoaded.value = false
    imageError.value = false
  },
  { immediate: true }
)

function onImgLoad(): void {
  imageLoaded.value = true
  imageError.value = false
}

function onImgError(): void {
  imageLoaded.value = false
  imageError.value = true
}

const aliasesTitle = computed(() =>
  props.display.aliases.length ? props.display.aliases.join('、') : ''
)

const gradeTagSuffix = computed(() => masteryGradeStyleSuffix(props.grade))

function onBackdropClick(): void {
  emit('close')
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div class="splash-root" role="dialog" aria-modal="true" :aria-label="`${display.name} 立绘`">
      <button type="button" class="backdrop" aria-label="关闭" @click="onBackdropClick" />
      <div class="dialog" @click.stop>
        <header class="hdr">
          <div class="hdr-left">
            <template v-if="display.aliases.length">
              <span class="hdr-aliases-label">别名</span>
              <span class="hdr-aliases" :title="aliasesTitle">{{ display.aliases.join('、') }}</span>
            </template>
          </div>
          <div class="hdr-right">
            <span v-if="grade" class="tag" :class="'tag-' + gradeTagSuffix">{{ grade }}</span>
            <span v-else class="tag tag-empty">本赛季无评价</span>
            <button type="button" class="close-x" aria-label="关闭" @click="emit('close')">×</button>
          </div>
        </header>
        <div class="img-wrap">
          <div v-if="!imageLoaded && !imageError" class="img-placeholder" aria-busy="true">
            <span class="spinner" aria-hidden="true" />
            <span class="placeholder-text">加载原画中…</span>
          </div>
          <div v-else-if="imageError" class="img-error" role="alert">
            <span>原画加载失败</span>
            <span class="img-error-hint">请检查网络或稍后重试</span>
          </div>
          <img
            v-if="!imageError"
            :key="display.key"
            class="splash"
            :class="{ splashVisible: imageLoaded }"
            :src="splashSrc"
            :alt="`${display.name}（${englishLabel}）原画`"
            @load="onImgLoad"
            @error="onImgError"
          />
          <div class="splash-caption">
            <span class="cap-zh">{{ display.name }}</span>
            <span class="cap-en">{{ englishLabel }}</span>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.splash-root {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  box-sizing: border-box;
}
.backdrop {
  position: absolute;
  inset: 0;
  margin: 0;
  padding: 0;
  border: none;
  background: var(--t-overlay);
  cursor: pointer;
}
.dialog {
  position: relative;
  z-index: 1;
  max-width: min(96vw, 920px);
  width: 100%;
  max-height: min(92vh, 900px);
  display: flex;
  flex-direction: column;
  border-radius: 14px;
  overflow: hidden;
  background: var(--t-splash-dialog);
  border: 1px solid var(--t-splash-dialog-border);
  box-shadow: var(--t-splash-shadow);
}
.hdr {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.65rem 0.85rem;
  background: var(--t-splash-hdr);
  border-bottom: 1px solid var(--t-splash-dialog-border);
  flex-shrink: 0;
}
.hdr-left {
  min-width: 0;
  flex: 1;
  margin-right: 0.5rem;
  font-size: 0.78rem;
  line-height: 1.35;
}
.hdr-aliases-label {
  color: var(--t-splash-hdr-aliases);
  font-weight: 600;
  margin-right: 0.35rem;
  white-space: nowrap;
}
.hdr-aliases {
  color: var(--t-splash-hdr-text);
  word-break: break-all;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}
.hdr-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}
.tag {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.2rem 0.45rem;
  border-radius: 6px;
}
.tag-splus {
  color: #2b2318;
  font-weight: 800;
  background: linear-gradient(180deg, #e8c97a 0%, #d0a85c 45%, #b8924d 100%);
  box-shadow: 0 0 0 1px rgba(208, 168, 92, 0.45);
}
.tag-s {
  color: #2a2418;
  font-weight: 700;
  background: linear-gradient(180deg, #d4b870 0%, #b89a4a 100%);
  box-shadow: 0 0 0 1px rgba(184, 154, 74, 0.35);
}
.tag-a {
  color: #dfefff;
  font-weight: 700;
  background: linear-gradient(180deg, #4a7ab0 0%, #3d6694 100%);
  box-shadow: 0 0 0 1px rgba(100, 140, 190, 0.35);
}
.tag-b {
  color: #e2e6ec;
  font-weight: 600;
  background: linear-gradient(180deg, #5a6575 0%, #454e5c 100%);
}
.tag-c {
  color: #c5c8ce;
  font-weight: 600;
  background: #3a3f48;
  border: 1px solid #4a5058;
}
.tag-d {
  color: #9a9da3;
  font-weight: 600;
  background: #2f3238;
  border: 1px solid #3d4048;
}
.tag-unknown {
  color: #b8bcc4;
  font-weight: 600;
  background: #3d424c;
  border: 1px solid #4d525c;
}
.tag-empty {
  color: var(--t-text-faint);
  background: var(--t-splash-tag-empty-bg);
  border: 1px solid var(--t-splash-dialog-border);
  font-weight: 600;
}
.close-x {
  width: 2rem;
  height: 2rem;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--t-text-muted);
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.close-x:hover {
  color: var(--t-text);
  background: var(--t-bg-close-hover);
}
.close-x:focus-visible {
  outline: 2px solid var(--t-btn-primary);
  outline-offset: 2px;
}
.img-wrap {
  position: relative;
  flex: 1;
  min-height: min(52vh, 480px);
  min-width: 0;
  background: var(--t-splash-img-bg);
}
.img-placeholder,
.img-error {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.9rem;
  background: var(--t-splash-placeholder-bg);
}
.placeholder-text {
  font-size: 0.85rem;
  color: var(--t-splash-placeholder-text);
  letter-spacing: 0.02em;
}
.spinner {
  width: 38px;
  height: 38px;
  border: 3px solid var(--t-splash-spinner-ring);
  border-top-color: var(--t-splash-spinner-top);
  border-radius: 50%;
  animation: splash-spin 0.7s linear infinite;
}
@keyframes splash-spin {
  to {
    transform: rotate(360deg);
  }
}
.img-error {
  gap: 0.35rem;
  color: var(--t-text-subtitle);
  font-size: 0.9rem;
  text-align: center;
  padding: 1rem;
}
.img-error-hint {
  font-size: 0.78rem;
  color: var(--t-text-faint);
}
.splash {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  object-fit: contain;
  object-position: center top;
  display: block;
  opacity: 0;
  transition: opacity 0.4s ease;
}
.splash.splashVisible {
  opacity: 1;
}
.splash-caption {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 3;
  padding: 2rem 1rem 1rem;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.82) 0%, rgba(0, 0, 0, 0.35) 55%, transparent 100%);
  pointer-events: none;
  text-align: center;
}
.cap-zh {
  display: block;
  font-size: clamp(1.15rem, 3.5vw, 1.5rem);
  font-weight: 800;
  color: #fff;
  letter-spacing: 0.04em;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9), 0 0 20px rgba(0, 0, 0, 0.5);
  line-height: 1.25;
}
.cap-en {
  display: block;
  margin-top: 0.25rem;
  font-size: clamp(0.8rem, 2.2vw, 0.95rem);
  font-weight: 600;
  color: rgba(255, 255, 255, 0.88);
  letter-spacing: 0.06em;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.95);
  line-height: 1.3;
}
</style>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import type { ChampionDisplay } from '@renderer/types/champion'
import { CHAMPION_ALIASES_ZH } from '@renderer/data/championAliases.zh'
import { useChampionCatalogStore } from '@renderer/stores/championCatalog'
import { useUserChampionAliasesStore } from '@renderer/stores/userChampionAliases'
import { useUserChampionPinsStore } from '@renderer/stores/userChampionPins'
import { formatChampionSlugDisplay } from '@renderer/utils/ddragon'
import { masteryGradeStyleSuffix } from '@renderer/utils/masteryGrade'
import { tryAddUserChampionAlias } from '@renderer/utils/userChampionAliasSubmit'
import ChampionAvatar from './ChampionAvatar.vue'

const props = defineProps<{
  championId: number
  display: ChampionDisplay | undefined
  /** 本赛季最高评价，无数据时为 null */
  grade: string | null
}>()

const emit = defineEmits<{
  open: [payload: { championId: number; display: ChampionDisplay; grade: string | null }]
}>()

const catalog = useChampionCatalogStore()
const { version } = storeToRefs(catalog)
const userAliasStore = useUserChampionAliasesStore()
const pinStore = useUserChampionPinsStore()

const aliasPanelOpen = ref(false)
const newAliasInput = ref('')
const aliasFeedback = ref<string | null>(null)

const canOpenSplash = () => Boolean(props.display && version.value)

const customAliases = computed(() =>
  props.display ? [...userAliasStore.forSlug(props.display.key)] : []
)

/** 应用内置别名（与「我的」分开展示；内置不可在此删除） */
const builtinAliases = computed(() =>
  props.display ? [...(CHAMPION_ALIASES_ZH[props.display.key] ?? [])] : []
)

const englishFormatted = computed(() =>
  props.display ? formatChampionSlugDisplay(props.display.key) : ''
)

function toggleAliasPanel(): void {
  aliasPanelOpen.value = !aliasPanelOpen.value
  if (!aliasPanelOpen.value) {
    newAliasInput.value = ''
    aliasFeedback.value = null
  }
}

function submitRowAlias(): void {
  aliasFeedback.value = null
  const d = props.display
  if (!d) {
    return
  }
  const err = tryAddUserChampionAlias(userAliasStore, d.key, newAliasInput.value, {
    name: d.name,
    englishFormatted: englishFormatted.value
  })
  if (err) {
    aliasFeedback.value = err
    return
  }
  newAliasInput.value = ''
}

function removeRowAlias(alias: string): void {
  const d = props.display
  if (!d) {
    return
  }
  userAliasStore.removeForSlug(d.key, alias)
}

function onActivate(): void {
  if (!props.display || !version.value) {
    return
  }
  emit('open', { championId: props.championId, display: props.display, grade: props.grade })
}

function badgeSuffix(): string {
  return masteryGradeStyleSuffix(props.grade)
}
</script>

<template>
  <li class="row-wrap" :class="{ rowAliasOpen: aliasPanelOpen }">
    <template v-if="display && version">
      <div class="row-line">
        <button
          type="button"
          class="pin-btn"
          :class="{ 'pin-btn-on': pinStore.isPinned(championId) }"
          :aria-pressed="pinStore.isPinned(championId)"
          :aria-label="pinStore.isPinned(championId) ? '取消置顶' : '置顶到列表最前'"
          :title="pinStore.isPinned(championId) ? '取消置顶' : '置顶'"
          @click.stop="pinStore.togglePin(championId)"
        >
          <svg class="pin-svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              class="pin-path"
              d="M6 4.75A1.25 1.25 0 017.25 3.5h9.5A1.25 1.25 0 0118 4.75V19a.5.5 0 01-.78.42L12 16.21l-5.22 3.21A.5.5 0 016 19V4.75z"
            />
          </svg>
        </button>
        <button
          type="button"
          class="row-splash"
          :class="{ rowClickable: canOpenSplash() }"
          :disabled="!canOpenSplash()"
          @click="onActivate"
        >
          <ChampionAvatar :ddragon-version="version" :image-key="display.key" :name="display.name" />
          <div class="name-block">
            <span class="name">{{ display.name }}</span>
            <span v-if="display.aliases.length > 0" class="aliases" :title="display.aliases.join('、')">
              {{ display.aliases.slice(0, 2).join('、') }}{{ display.aliases.length > 2 ? '…' : '' }}
            </span>
          </div>
        </button>
        <button
          type="button"
          class="alias-toggle"
          :class="{ aliasToggleOn: aliasPanelOpen }"
          :aria-expanded="aliasPanelOpen"
          aria-label="展开或收起别名管理"
          @click.stop="toggleAliasPanel"
        >
          管理别名
        </button>
        <div class="badges" role="group" :aria-label="`${display.name} 本赛季评价`">
          <span v-if="grade" class="badge" :class="`badge-${badgeSuffix()}`">{{ grade }}</span>
          <span v-else class="badge badge-empty">—</span>
        </div>
      </div>
      <div v-if="aliasPanelOpen" class="alias-panel" @click.stop>
        <div class="alias-mgmt-head">
          <span class="alias-mgmt-title">别名管理</span>
          <span class="alias-mgmt-sub">
            内置与应用自带列表同步；「我的别名」仅保存在本机，可添加、可点 × 删除。
          </span>
        </div>

        <div class="alias-mgmt-block">
          <div class="alias-mgmt-label">内置别名</div>
          <ul
            v-if="builtinAliases.length > 0"
            class="alias-chips"
            aria-label="应用内置别名（不可在此删除）"
          >
            <li v-for="a in builtinAliases" :key="'builtin-' + a" class="alias-chip alias-chip-builtin">
              <span class="alias-chip-text">{{ a }}</span>
            </li>
          </ul>
          <p v-else class="alias-mgmt-empty">暂无内置别名</p>
        </div>

        <div class="alias-mgmt-block">
          <div class="alias-mgmt-label">我的别名</div>
          <ul
            v-if="customAliases.length > 0"
            class="alias-chips"
            aria-label="我的别名（可删除）"
          >
            <li v-for="a in customAliases" :key="'mine-' + a" class="alias-chip alias-chip-mine">
              <span class="alias-chip-text">{{ a }}</span>
              <button
                type="button"
                class="alias-chip-remove"
                :aria-label="`删除我的别名 ${a}`"
                title="删除"
                @click="removeRowAlias(a)"
              >
                ×
              </button>
            </li>
          </ul>
          <p v-else class="alias-mgmt-empty">暂无；输入后点「添加」或按回车</p>
          <div class="alias-panel-form">
            <input
              v-model="newAliasInput"
              type="text"
              class="alias-input"
              placeholder="添加新的我的别名…"
              maxlength="32"
              autocomplete="off"
              spellcheck="false"
              @keydown.enter.prevent="submitRowAlias"
            />
            <button type="button" class="alias-add" @click="submitRowAlias">添加</button>
          </div>
        </div>
        <p v-if="aliasFeedback" class="alias-panel-msg" role="status">{{ aliasFeedback }}</p>
      </div>
    </template>
    <template v-else>
      <button type="button" class="row row-fallback" disabled>
        <div class="avatar-ph" aria-hidden="true" />
        <span class="name muted">英雄 #{{ championId }}</span>
        <span v-if="grade" class="badge" :class="`badge-${badgeSuffix()}`">{{ grade }}</span>
        <span v-else class="badge badge-empty">—</span>
      </button>
    </template>
  </li>
</template>

<style scoped>
.row-wrap {
  border-bottom: 1px solid var(--t-border-row);
}
.row-wrap:last-child {
  border-bottom: none;
}
.rowAliasOpen {
  padding-bottom: 0.15rem;
}
.row-line {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  width: 100%;
}
.pin-btn {
  flex-shrink: 0;
  width: 2.125rem;
  height: 2.125rem;
  margin: 0;
  padding: 0;
  border: 1px solid var(--t-pin-border);
  border-radius: 10px;
  background: var(--t-bg-pin);
  color: var(--t-pin-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    color 0.15s ease,
    border-color 0.15s ease,
    background 0.15s ease;
}
.pin-btn:hover {
  color: var(--t-pin-hover);
  border-color: var(--t-pin-border-hover);
  background: var(--t-bg-pin-hover);
}
.pin-btn:focus-visible {
  outline: 2px solid var(--t-accent-85);
  outline-offset: 2px;
}
.pin-btn-on {
  color: var(--t-pin-on);
  border-color: var(--t-accent-50);
  background: var(--t-accent-22);
}
.pin-btn-on:hover {
  color: var(--t-accent-text-2);
  border-color: var(--t-accent-65);
  background: var(--t-accent-30);
}
.pin-svg {
  display: block;
}
.pin-path {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.65;
  stroke-linejoin: round;
  transition: fill 0.15s ease;
}
.pin-btn-on .pin-path {
  fill: currentColor;
  stroke: currentColor;
}
.row-splash {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 0;
  padding: 0.5rem 0;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: default;
  border-radius: 6px;
}
.rowClickable {
  cursor: pointer;
}
.rowClickable:hover {
  background: var(--t-bg-row-hover);
}
.rowClickable:focus-visible {
  outline: 2px solid var(--t-btn-primary);
  outline-offset: -2px;
}
.row-splash:disabled {
  opacity: 1;
  cursor: not-allowed;
}
.alias-toggle {
  flex-shrink: 0;
  align-self: center;
  margin: 0;
  padding: 0.28rem 0.5rem;
  border-radius: 6px;
  border: 1px solid var(--t-border);
  background: var(--t-bg-base);
  color: var(--t-alias-toggle);
  font-size: 0.7rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
.alias-toggle:hover {
  border-color: var(--t-border-ghost);
  background: var(--t-bg-raised);
}
.alias-toggle:focus-visible {
  outline: 2px solid var(--t-btn-primary);
  outline-offset: 2px;
}
.aliasToggleOn {
  border-color: var(--t-btn-primary);
  background: var(--t-bg-tab-active);
  color: var(--t-accent-text);
}
.badges {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 0;
}
.name-block {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}
.name {
  color: var(--t-text);
  font-size: 0.95rem;
}
.aliases {
  font-size: 0.72rem;
  color: var(--t-text-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.name.muted {
  color: var(--t-text-dim);
}
.badge {
  flex-shrink: 0;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
}
.badge-splus {
  color: #2b2318;
  font-weight: 800;
  background: linear-gradient(180deg, #e8c97a 0%, #d0a85c 45%, #b8924d 100%);
  box-shadow: 0 0 0 1px rgba(208, 168, 92, 0.45);
}
.badge-s {
  color: #2a2418;
  font-weight: 700;
  background: linear-gradient(180deg, #d4b870 0%, #b89a4a 100%);
  box-shadow: 0 0 0 1px rgba(184, 154, 74, 0.35);
}
.badge-a {
  color: #dfefff;
  font-weight: 700;
  background: linear-gradient(180deg, #4a7ab0 0%, #3d6694 100%);
  box-shadow: 0 0 0 1px rgba(100, 140, 190, 0.35);
}
.badge-b {
  color: #e2e6ec;
  font-weight: 600;
  background: linear-gradient(180deg, #5a6575 0%, #454e5c 100%);
}
.badge-c {
  color: #c5c8ce;
  font-weight: 600;
  background: #3a3f48;
  border: 1px solid #4a5058;
}
.badge-d {
  color: #9a9da3;
  font-weight: 600;
  background: #2f3238;
  border: 1px solid #3d4048;
}
.badge-unknown {
  color: #b8bcc4;
  font-weight: 600;
  background: #3d424c;
  border: 1px solid #4d525c;
}
.badge-empty {
  color: var(--t-text-faint);
  background: var(--t-bg-raised);
  border: 1px solid var(--t-border-row);
  font-weight: 500;
}
.avatar-ph {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: var(--t-avatar-ph);
}
.row-fallback {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  margin: 0;
  padding: 0.5rem 0;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  border-radius: 6px;
  cursor: not-allowed;
}
.alias-panel {
  margin: 0 0 0.35rem 0;
  padding: 0.55rem 0.65rem 0.65rem 0.5rem;
  border-radius: 8px;
  background: var(--t-alias-panel-bg);
  border: 1px solid var(--t-alias-panel-border);
}
.alias-mgmt-head {
  margin-bottom: 0.5rem;
  padding-bottom: 0.45rem;
  border-bottom: 1px solid var(--t-alias-panel-divider);
}
.alias-mgmt-title {
  display: block;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--t-text-alias-mgmt);
  margin-bottom: 0.25rem;
}
.alias-mgmt-sub {
  display: block;
  font-size: 0.65rem;
  color: var(--t-text-alias-sub);
  line-height: 1.45;
}
.alias-mgmt-block {
  margin-bottom: 0.5rem;
}
.alias-mgmt-block:last-of-type {
  margin-bottom: 0;
}
.alias-mgmt-label {
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--t-text-alias-label);
  margin-bottom: 0.3rem;
}
.alias-mgmt-empty {
  margin: 0 0 0.35rem;
  font-size: 0.68rem;
  color: var(--t-text-faint);
}
.alias-chips {
  list-style: none;
  margin: 0 0 0.35rem;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
.alias-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  max-width: 100%;
  padding: 0.12rem 0.4rem;
  border-radius: 999px;
  font-size: 0.72rem;
}
.alias-chip-builtin {
  background: var(--t-chip-builtin-bg);
  border: 1px dashed var(--t-chip-builtin-border);
  color: var(--t-text-chip);
}
.alias-chip-mine {
  background: var(--t-chip-mine-bg);
  border: 1px solid var(--t-chip-mine-border);
  color: var(--t-text-chip-mine);
  padding-right: 0.2rem;
}
.alias-chip-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 10rem;
}
.alias-chip-remove {
  flex-shrink: 0;
  width: 1.25rem;
  height: 1.25rem;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--t-text-chip);
  font-size: 0.95rem;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.alias-chip-remove:hover {
  color: #ffb4a2;
  background: var(--t-bg-chip-remove-hover);
}
.alias-panel-form {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
  margin-top: 0.15rem;
}
.alias-input {
  flex: 1;
  min-width: 120px;
  padding: 0.32rem 0.5rem;
  border-radius: 6px;
  border: 1px solid var(--t-border-alias);
  background: var(--t-bg-input);
  color: var(--t-text);
  font-size: 0.8rem;
}
.alias-add {
  cursor: pointer;
  padding: 0.32rem 0.65rem;
  border: none;
  border-radius: 6px;
  background: var(--t-btn-primary);
  color: #fff;
  font-size: 0.78rem;
  font-weight: 600;
}
.alias-add:hover {
  filter: brightness(1.08);
}
.alias-panel-msg {
  margin: 0.35rem 0 0;
  font-size: 0.72rem;
  color: var(--t-warn);
}
</style>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import ChampionRow from '@renderer/components/ChampionRow.vue'
import ChampionSplashModal from '@renderer/components/ChampionSplashModal.vue'
import HomeListControls from '@renderer/components/HomeListControls.vue'
import HomeLcuCredentialModal from '@renderer/components/HomeLcuCredentialModal.vue'
import HomeUpdateModal from '@renderer/components/HomeUpdateModal.vue'
import { useHomeChampionList } from '@renderer/composables/useHomeChampionList'
import { useHomeOverlayHotkeys } from '@renderer/composables/useHomeOverlayHotkeys'
import { useHomePageLifecycle } from '@renderer/composables/useHomePageLifecycle'
import type { ListSortMode } from '@renderer/composables/useHomeChampionList'
import { useLcuCredentialPanel } from '@renderer/composables/useLcuCredentialPanel'
import { useLcuMastery } from '@renderer/composables/useLcuMastery'
import { useUpdateReminder } from '@renderer/composables/useUpdateReminder'
import { useLcuStore } from '@renderer/stores/lcu'
import { useChampionCatalogStore } from '@renderer/stores/championCatalog'
import { useUserChampionAliasesStore } from '@renderer/stores/userChampionAliases'
import { useUserChampionPinsStore } from '@renderer/stores/userChampionPins'

const store = useLcuStore()
const { status, errorMessage, masteryList } = storeToRefs(store)
const { refresh } = useLcuMastery()
const catalogStore = useChampionCatalogStore()
const { totalChampions, loadError: catalogLoadError, sortedChampions, version } = storeToRefs(catalogStore)
const userAliasStore = useUserChampionAliasesStore()
const pinStore = useUserChampionPinsStore()
const {
  viewMode,
  searchQuery,
  listSortMode,
  sortMenuOpen,
  sortOptions,
  currentSortLabel,
  onSortRootChange,
  selectSortMode,
  onSortGlobalPointerDown,
  parsedGradeSearch,
  sPlusCountInCatalog,
  visibleRows,
  singleSearchInsight,
  splashTarget,
  splashMergedDisplay,
  onChampionRowOpen,
  closeSplash
} = useHomeChampionList({
  sortedChampions,
  masteryList,
  pinOrder: computed(() => pinStore.order),
  getAliasesBySlug: (slug) => userAliasStore.forSlug(slug),
  getDisplayById: (championId) => catalogStore.getDisplay(championId)
})

const lcuAdvOpen = ref(false)
const {
  updateModalOpen,
  updatePayload,
  updateBusy,
  updateInlineFeedback,
  updateInlineFeedbackTone,
  closeUpdateModal,
  onCheckUpdatesClick,
  onRemindLater,
  onDismissForever,
  onInstallUpdate,
  onOpenDownloadDir,
  onOpenGitHubRelease,
  startUpdateEventLoop,
  cleanup: cleanupUpdateReminder
} = useUpdateReminder({
  showError: (message) => {
    showAdvFeedback(message, 'error')
  }
})

const { mountGlobalListeners, unmountGlobalListeners } = useHomeOverlayHotkeys({
  updateModalOpen,
  closeUpdateModal,
  lcuAdvOpen,
  sortMenuOpen,
  onSortGlobalPointerDown
})

function openLcuCredentialModal(): void {
  lcuAdvOpen.value = true
}

function closeLcuCredentialModal(): void {
  lcuAdvOpen.value = false
}

function toggleSortMenu(): void {
  sortMenuOpen.value = !sortMenuOpen.value
}

function onSelectSortMode(value: string): void {
  selectSortMode(value as ListSortMode)
}

const {
  PS_LEAGUE_UX_ONELINER,
  advFeedback,
  advFeedbackTone,
  manualPort,
  manualToken,
  rememberPersist,
  pasteUxLine,
  discoverBusy,
  revealVaultStatus,
  revealSetupPwd,
  revealSetupPwd2,
  revealUnlockPwd,
  revealedPort,
  revealedToken,
  revealBusy,
  revealFormMsg,
  isCredentialRevealed,
  runTryDiscover,
  runParsePaste,
  copyPowerShellSnippet,
  hideRevealedCredentials,
  submitRevealPasswordSetup,
  submitRevealUnlock,
  applyManualCredentials,
  clearManualCredentials,
  showAdvFeedback,
  onPanelOpenChange
} = useLcuCredentialPanel({ refreshMastery: refresh })

useHomePageLifecycle({
  lcuAdvOpen,
  onPanelOpenChange,
  startUpdateEventLoop,
  cleanupUpdateReminder,
  ensureCatalogLoaded: () => catalogStore.ensureLoaded(),
  refreshMastery: refresh,
  mountGlobalListeners,
  unmountGlobalListeners
})
</script>

<template>
  <div class="home">
    <header class="header">
      <h1>S+ Record</h1>
      <p class="subtitle">
        全英雄列表 · 搜索别名 / 中文名 / 自定义别名 · 整段输入 A+、S- 等按本赛季等级筛选 · S+ 进度
      </p>
      <div class="header-bar">
        <button type="button" class="btn" :disabled="status === 'loading'" @click="refresh">
          {{ status === 'loading' ? '刷新中…' : '刷新数据' }}
        </button>
        <button type="button" class="header-lcu-link" @click="openLcuCredentialModal">
          LCU 凭证…
        </button>
      </div>
      <p
        v-if="updateInlineFeedback"
        class="update-inline-feedback"
        :class="`update-inline-feedback--${updateInlineFeedbackTone}`"
        role="status"
        aria-live="polite"
      >
        {{ updateInlineFeedback }}
      </p>
    </header>

    <section v-if="status === 'error'" class="panel error">
      <p>{{ errorMessage }}</p>
    </section>

    <section v-else-if="status === 'idle' || status === 'loading'" class="panel muted">
      <p>{{ status === 'loading' ? '正在连接 LCU…' : '准备中…' }}</p>
    </section>

    <section v-else class="panel success panel-fill">
      <p v-if="catalogLoadError" class="catalog-warn">{{ catalogLoadError }}</p>
      <div class="stats-card" aria-label="本赛季 S+ 进度">
        <div class="stats-main">
          <span class="stats-label">本赛季 S+</span>
          <span class="stats-value">{{ sPlusCountInCatalog }}</span>
          <template v-if="totalChampions > 0">
            <span class="stats-sep">/</span>
            <span class="stats-total">{{ totalChampions }}</span>
            <span class="stats-unit">英雄</span>
          </template>
        </div>
      </div>

      <HomeListControls
        :view-mode="viewMode"
        :search-query="searchQuery"
        :sort-menu-open="sortMenuOpen"
        :current-sort-label="currentSortLabel"
        :list-sort-mode="listSortMode"
        :sort-options="sortOptions"
        :single-search-insight="singleSearchInsight"
        :on-sort-root-change="onSortRootChange"
        @update:view-mode="viewMode = $event"
        @update:search-query="searchQuery = $event"
        @toggle-sort-menu="toggleSortMenu"
        @select-sort-mode="onSelectSortMode"
      />

      <div class="list-region">
        <ul v-if="visibleRows.length > 0" class="list list-scroll">
          <ChampionRow
            v-for="row in visibleRows"
            :key="row.championId"
            :champion-id="row.championId"
            :display="row.display"
            :grade="row.grade"
            @open="onChampionRowOpen"
          />
        </ul>
        <p v-else class="empty">
          <template v-if="searchQuery.trim()">
            <template v-if="parsedGradeSearch">
              没有本赛季等级为「{{ parsedGradeSearch }}」的英雄（可与上方「全部 / 仅 S+ / 非 S+」组合使用）。
            </template>
            <template v-else>
              没有匹配「{{ searchQuery }}」的英雄，试试官方名或外号；需要按等级筛选时可单独输入如 A+、S-。
            </template>
          </template>
          <template v-else-if="viewMode === 'sPlus'">暂无 S+ 记录，去对局里打出一场吧。</template>
          <template v-else>暂无英雄数据。</template>
        </p>
      </div>

      <p class="list-meta">
        当前列表：{{ visibleRows.length }} 位
        <span v-if="visibleRows.length > 0" class="list-meta-hint">
          · 星标置顶；「管理别名」；点头像或名称看原画
        </span>
      </p>

      <p v-if="version" class="stats-source-line">Data Dragon · zh_CN {{ version }}</p>
      <p class="app-author-line">
        剑圣灬狠嚣张 制作
        <button
          type="button"
          class="update-quiet-link"
          :disabled="updateBusy"
          @click="onCheckUpdatesClick"
        >
          {{ updateBusy ? '检查中…' : '检查更新' }}
        </button>
      </p>
    </section>

    <ChampionSplashModal
      v-if="splashMergedDisplay && splashTarget"
      :display="splashMergedDisplay"
      :grade="splashTarget.grade"
      @close="closeSplash"
    />

    <HomeLcuCredentialModal
      :open="lcuAdvOpen"
      :adv-feedback="advFeedback"
      :adv-feedback-tone="advFeedbackTone"
      :discover-busy="discoverBusy"
      :ps-league-ux-oneliner="PS_LEAGUE_UX_ONELINER"
      :paste-ux-line="pasteUxLine"
      :remember-persist="rememberPersist"
      :manual-port="manualPort"
      :manual-token="manualToken"
      :reveal-vault-status="revealVaultStatus"
      :reveal-setup-pwd="revealSetupPwd"
      :reveal-setup-pwd2="revealSetupPwd2"
      :reveal-unlock-pwd="revealUnlockPwd"
      :revealed-port="revealedPort"
      :revealed-token="revealedToken"
      :reveal-busy="revealBusy"
      :reveal-form-msg="revealFormMsg"
      :is-credential-revealed="isCredentialRevealed"
      @close="closeLcuCredentialModal"
      @run-try-discover="runTryDiscover"
      @copy-power-shell-snippet="copyPowerShellSnippet"
      @run-parse-paste="runParsePaste"
      @apply-manual-credentials="applyManualCredentials"
      @clear-manual-credentials="clearManualCredentials"
      @submit-reveal-password-setup="submitRevealPasswordSetup"
      @submit-reveal-unlock="submitRevealUnlock"
      @hide-revealed-credentials="hideRevealedCredentials"
      @update:paste-ux-line="pasteUxLine = $event"
      @update:remember-persist="rememberPersist = $event"
      @update:manual-port="manualPort = $event"
      @update:manual-token="manualToken = $event"
      @update:reveal-setup-pwd="revealSetupPwd = $event"
      @update:reveal-setup-pwd2="revealSetupPwd2 = $event"
      @update:reveal-unlock-pwd="revealUnlockPwd = $event"
    />

    <HomeUpdateModal
      :open="updateModalOpen"
      :payload="updatePayload"
      :busy="updateBusy"
      @close="closeUpdateModal"
      @remind-later="onRemindLater"
      @dismiss-forever="onDismissForever"
      @install-update="onInstallUpdate"
      @open-download-dir="onOpenDownloadDir"
      @open-git-hub-release="onOpenGitHubRelease"
    />

  </div>
</template>

<style scoped>
.home {
  max-width: 920px;
  width: 100%;
  margin: 0 auto;
  padding: 1rem 1.25rem 1.25rem;
  box-sizing: border-box;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.stats-source-line {
  flex-shrink: 0;
  margin: 0.2rem 0 0;
  padding: 0 0.15rem;
  font-size: 0.68rem;
  line-height: 1.35;
  color: var(--t-stats-meta);
  letter-spacing: 0.02em;
  text-align: center;
  opacity: 0.85;
}
.app-author-line {
  flex-shrink: 0;
  margin: 0.12rem 0 0;
  padding: 0 0.15rem;
  font-size: 0.62rem;
  line-height: 1.3;
  color: var(--t-text-faint);
  text-align: center;
  letter-spacing: 0.06em;
  opacity: 0.88;
}
.update-quiet-link {
  margin-left: 0.5rem;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--t-text-faint);
  font-size: 0.62rem;
  line-height: 1.3;
  letter-spacing: 0.02em;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
  opacity: 0.82;
}
.update-quiet-link:hover {
  color: var(--t-accent-muted);
  opacity: 1;
}
.update-quiet-link:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.update-quiet-link:focus-visible {
  outline: 1px solid var(--t-accent-45);
  outline-offset: 2px;
  border-radius: 4px;
}
.list-meta {
  flex-shrink: 0;
  margin: 0.35rem 0 0;
  padding: 0 0.15rem;
  font-size: 0.78rem;
  color: var(--t-text-dim);
  line-height: 1.45;
  text-align: center;
}
.list-meta-hint {
  color: var(--t-text-meta-hint);
}
.list-region {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.list-scroll {
  flex: 1;
  min-height: 120px;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 0 0.35rem 0.25rem 0;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: var(--t-accent-55) transparent;
}
.list-scroll::-webkit-scrollbar {
  width: 8px;
}
.list-scroll::-webkit-scrollbar-track {
  background: transparent;
  margin: 4px 0;
}
.list-scroll::-webkit-scrollbar-thumb {
  background: var(--t-accent-50);
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: padding-box;
}
.list-scroll::-webkit-scrollbar-thumb:hover {
  background: var(--t-accent-75);
  border: 2px solid transparent;
  background-clip: padding-box;
}
.header {
  text-align: center;
  margin-bottom: 0.65rem;
  flex-shrink: 0;
}
h1 {
  margin: 0 0 0.35rem;
  color: var(--t-title-gold);
  font-size: 1.6rem;
}
.subtitle {
  margin: 0 0 0.65rem;
  color: var(--t-text-subtitle);
  font-size: 0.88rem;
  line-height: 1.45;
}
.header-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.5rem 1rem;
}
.update-inline-feedback {
  margin: 0.55rem auto 0;
  width: fit-content;
  max-width: min(92%, 760px);
  padding: 0.4rem 0.75rem;
  border-radius: 8px;
  font-size: 0.8rem;
  line-height: 1.35;
  border: 1px solid transparent;
}
.update-inline-feedback--success {
  color: #9decc2;
  background: rgba(34, 120, 67, 0.24);
  border-color: rgba(88, 180, 126, 0.35);
}
.update-inline-feedback--error {
  color: #ffd0c8;
  background: rgba(148, 54, 40, 0.26);
  border-color: rgba(222, 93, 73, 0.36);
}
.update-inline-feedback--info {
  color: var(--t-accent-muted);
  background: var(--t-bg-pin);
  border-color: var(--t-border-soft);
}
.header-lcu-link {
  margin: 0;
  padding: 0.4rem 0.85rem;
  border: 1px solid var(--t-border-soft);
  border-radius: 999px;
  background: var(--t-bg-pin);
  color: var(--t-accent-muted);
  font-size: 0.78rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition:
    color 0.15s ease,
    border-color 0.15s ease,
    background 0.15s ease;
}
.header-lcu-link:hover {
  color: var(--t-accent-link-hover);
  border-color: var(--t-accent-45);
  background: var(--t-accent-12);
}
.header-lcu-link:focus-visible {
  outline: 2px solid var(--t-accent-65);
  outline-offset: 2px;
}
.btn {
  cursor: pointer;
  padding: 0.5rem 1.25rem;
  border: none;
  border-radius: 8px;
  background: var(--t-btn-primary);
  color: #fff;
  font-size: 0.95rem;
}
.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.panel {
  border-radius: 12px;
  padding: 1rem 1.25rem;
  background: var(--t-bg-raised);
}
.panel-fill {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.panel.error {
  border: 1px solid var(--t-error-border);
  color: var(--t-error-text);
}
.panel.muted {
  color: var(--t-text-muted);
}
.panel.success {
  border: 1px solid var(--t-btn-primary);
}
.stats-card {
  flex-shrink: 0;
  margin: 0 0 0.65rem;
  padding: 0.85rem 1rem;
  border-radius: 10px;
  background: var(--t-stats-card);
  border: 1px solid var(--t-accent-45);
  box-shadow: var(--t-stats-inset);
}
.stats-main {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.35rem 0.5rem;
  color: var(--t-stats-main);
  font-size: 0.95rem;
  line-height: 1.35;
}
.stats-label {
  color: var(--t-stats-label);
  font-weight: 600;
  letter-spacing: 0.02em;
}
.stats-value {
  color: var(--t-stats-value);
  font-size: 1.5rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.stats-sep {
  color: var(--t-stats-sep);
  font-weight: 500;
  margin: 0 0.1rem;
}
.stats-total {
  color: var(--t-stats-total);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.stats-unit {
  color: var(--t-stats-unit);
  font-size: 0.88rem;
}
.catalog-warn {
  margin: 0 0 0.75rem;
  font-size: 0.85rem;
  color: var(--t-catalog-warn);
  flex-shrink: 0;
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.empty {
  margin: 0;
  color: var(--t-empty);
  font-size: 0.9rem;
  flex: 1;
  min-height: 3rem;
  display: flex;
  align-items: center;
  padding: 0.5rem 0;
}

</style>

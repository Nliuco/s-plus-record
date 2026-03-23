<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import {
  getLcuRevealVaultStatus,
  revealPersistedLcuCredentials,
  setLcuSessionCredentials,
  setupLcuRevealPassword,
  tryDiscoverLcuCredentials
} from '@renderer/api/lcu'
import { parseLeagueClientUxCommandLine } from '@shared/utils/parseLeagueUxCommandLine'
import ChampionRow from '@renderer/components/ChampionRow.vue'
import ChampionSplashModal from '@renderer/components/ChampionSplashModal.vue'
import type { ChampionDisplay } from '@renderer/types/champion'
import { useLcuMastery } from '@renderer/composables/useLcuMastery'
import { useLcuStore } from '@renderer/stores/lcu'
import { useChampionCatalogStore } from '@renderer/stores/championCatalog'
import { useUserChampionAliasesStore } from '@renderer/stores/userChampionAliases'
import { mergeChampionAliases } from '@renderer/utils/championAliasesMerge'
import { championDisplayMatchesQuery } from '@renderer/utils/championSearch'
import {
  compareMasteryGrades,
  getPinyinNameCollator,
  normalizeMasteryGradeLabel,
  tryParseMasteryGradeSearchQuery
} from '@renderer/utils/masteryGrade'
import { useUserChampionPinsStore } from '@renderer/stores/userChampionPins'

type ViewMode = 'all' | 'sPlus' | 'notSPlus'

/** 空字符串 = 默认（与英雄数据顺序一致，即中文目录序） */
type ListSortMode = '' | 'grade-desc' | 'grade-asc'

const sortOptions: { value: ListSortMode; label: string }[] = [
  { value: '', label: '默认（与英雄数据顺序一致）' },
  { value: 'grade-desc', label: '本赛季评分从高到低' },
  { value: 'grade-asc', label: '本赛季评分从低到高' }
]

const store = useLcuStore()
const { status, errorMessage, masteryList, sPlusEntries } = storeToRefs(store)
const { refresh } = useLcuMastery()
const catalogStore = useChampionCatalogStore()
const { totalChampions, loadError: catalogLoadError, sortedChampions, version } = storeToRefs(catalogStore)
const userAliasStore = useUserChampionAliasesStore()
const pinStore = useUserChampionPinsStore()

const viewMode = ref<ViewMode>('all')
const searchQuery = ref('')
const listSortMode = ref<ListSortMode>('')
const sortMenuOpen = ref(false)
const sortPickerRoot = ref<HTMLElement | null>(null)

const currentSortLabel = computed(() => {
  const hit = sortOptions.find((o) => o.value === listSortMode.value)
  return hit?.label ?? sortOptions[0].label
})

function selectSortMode(val: ListSortMode): void {
  listSortMode.value = val
  sortMenuOpen.value = false
}

function onSortGlobalPointerDown(e: PointerEvent): void {
  if (!sortMenuOpen.value || !sortPickerRoot.value) {
    return
  }
  if (!sortPickerRoot.value.contains(e.target as Node)) {
    sortMenuOpen.value = false
  }
}

const lcuAdvOpen = ref(false)

function onSortGlobalKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') {
    return
  }
  if (lcuAdvOpen.value) {
    lcuAdvOpen.value = false
    return
  }
  sortMenuOpen.value = false
}

const splashTarget = ref<{ championId: number; grade: string | null } | null>(null)

const splashMergedDisplay = computed((): ChampionDisplay | null => {
  const t = splashTarget.value
  if (t === null) {
    return null
  }
  const d = catalogStore.getDisplay(t.championId)
  if (!d) {
    return null
  }
  return {
    ...d,
    aliases: mergeChampionAliases(d.aliases, userAliasStore.forSlug(d.key))
  }
})

function onChampionRowOpen(payload: {
  championId: number
  display: ChampionDisplay
  grade: string | null
}): void {
  splashTarget.value = { championId: payload.championId, grade: payload.grade }
}

function closeSplash(): void {
  splashTarget.value = null
}

const masteryGradeById = computed(() => {
  const m = new Map<number, string | null>()
  for (const e of masteryList.value) {
    m.set(e.championId, e.highestGrade ?? null)
  }
  return m
})

const tableRows = computed(() =>
  sortedChampions.value.map((d) => ({
    championId: d.id,
    display: {
      ...d,
      aliases: mergeChampionAliases(d.aliases, userAliasStore.forSlug(d.key))
    },
    grade: masteryGradeById.value.get(d.id) ?? null
  }))
)

const parsedGradeSearch = computed(() => tryParseMasteryGradeSearchQuery(searchQuery.value))

const filteredRows = computed(() => {
  let rows = tableRows.value
  if (viewMode.value === 'sPlus') {
    rows = rows.filter((r) => r.grade === 'S+')
  } else if (viewMode.value === 'notSPlus') {
    rows = rows.filter((r) => r.grade !== 'S+')
  }
  const q = searchQuery.value
  const gradeToken = tryParseMasteryGradeSearchQuery(q)
  if (gradeToken !== null) {
    rows = rows.filter((r) => normalizeMasteryGradeLabel(r.grade) === gradeToken)
  } else if (q.trim()) {
    rows = rows.filter((r) => championDisplayMatchesQuery(r.display, q))
  }
  return rows
})

const visibleRows = computed(() => {
  const rows = [...filteredRows.value]
  const idInView = new Set(rows.map((r) => r.championId))
  const pinnedIds = pinStore.order.filter((id) => idInView.has(id))
  const pinSet = new Set(pinnedIds)
  const pinnedRows = pinnedIds
    .map((id) => rows.find((r) => r.championId === id))
    .filter((r): r is (typeof rows)[number] => Boolean(r))
  let rest = rows.filter((r) => !pinSet.has(r.championId))
  const mode = listSortMode.value
  const collator = getPinyinNameCollator()
  if (mode === 'grade-desc') {
    rest.sort((a, b) =>
      compareMasteryGrades(a.grade, b.grade, 'desc', collator, a.display.name, b.display.name)
    )
  } else if (mode === 'grade-asc') {
    rest.sort((a, b) =>
      compareMasteryGrades(a.grade, b.grade, 'asc', collator, a.display.name, b.display.name)
    )
  }
  return [...pinnedRows, ...rest]
})

const singleSearchInsight = computed(() => {
  if (!searchQuery.value.trim() || visibleRows.value.length !== 1) {
    return null
  }
  const r = visibleRows.value[0]
  const name = r.display.name
  if (r.grade === 'S+') {
    return `${name}：本赛季已获得 S+。`
  }
  if (r.grade) {
    return `${name}：本赛季最高「${r.grade}」，尚未达到 S+。`
  }
  return `${name}：客户端未返回本赛季熟练度（可能尚未使用）。`
})

/** 管理员 PowerShell 一行命令（与主进程读取进程所用逻辑一致） */
const PS_LEAGUE_UX_ONELINER =
  '(Get-CimInstance Win32_Process -Filter "Name = \'LeagueClientUx.exe\'" | Select-Object -First 1).CommandLine'

type AdvFeedbackTone = 'success' | 'error' | 'info'

const manualPort = ref('')
const manualToken = ref('')
const rememberPersist = ref(true)
const advFeedback = ref<string | null>(null)
const advFeedbackTone = ref<AdvFeedbackTone>('info')
const pasteUxLine = ref('')
const discoverBusy = ref(false)

function showAdvFeedback(text: string | null, tone: AdvFeedbackTone = 'info'): void {
  advFeedback.value = text
  if (text !== null) {
    advFeedbackTone.value = tone
  }
}

const revealVaultStatus = ref<{
  hasPersistedCredentials: boolean
  hasRevealPassword: boolean
} | null>(null)
const revealSetupPwd = ref('')
const revealSetupPwd2 = ref('')
const revealUnlockPwd = ref('')
const revealedPort = ref<string | null>(null)
const revealedToken = ref<string | null>(null)
const revealBusy = ref(false)
const revealFormMsg = ref<string | null>(null)

const isCredentialRevealed = computed(
  () => revealedPort.value !== null && revealedToken.value !== null
)

async function refreshRevealVaultStatus(): Promise<void> {
  const s = await getLcuRevealVaultStatus()
  revealVaultStatus.value =
    s ?? { hasPersistedCredentials: false, hasRevealPassword: false }
}

function clearRevealUi(): void {
  revealSetupPwd.value = ''
  revealSetupPwd2.value = ''
  revealUnlockPwd.value = ''
  revealedPort.value = null
  revealedToken.value = null
  revealFormMsg.value = null
}

watch(lcuAdvOpen, (open) => {
  if (open) {
    showAdvFeedback(null)
    pasteUxLine.value = ''
    void refreshRevealVaultStatus()
  } else {
    clearRevealUi()
    pasteUxLine.value = ''
    showAdvFeedback(null)
  }
})

async function runTryDiscover(): Promise<void> {
  showAdvFeedback(null)
  discoverBusy.value = true
  try {
    const r = await tryDiscoverLcuCredentials()
    if (r.ok) {
      manualPort.value = r.port
      manualToken.value = r.password
      showAdvFeedback(
        '已自动填入端口与 token。确认「记住到本机」后，点击「应用并刷新」。',
        'success'
      )
    } else {
      showAdvFeedback(r.message, 'error')
    }
  } finally {
    discoverBusy.value = false
  }
}

function runParsePaste(): void {
  showAdvFeedback(null)
  const text = pasteUxLine.value.trim()
  if (!text) {
    showAdvFeedback('请先把内容粘贴到文本框。', 'error')
    return
  }
  const parsed = parseLeagueClientUxCommandLine(text)
  if (!parsed) {
    showAdvFeedback(
      '未能识别 --app-port 与 --remoting-auth-token。请确认复制的是完整一行（国服命令行里应同时包含这两项）。',
      'error'
    )
    return
  }
  manualPort.value = parsed.port
  manualToken.value = parsed.password
  showAdvFeedback(
    '已从粘贴内容解析并填入端口与 token。确认「记住到本机」后，点击「应用并刷新」。',
    'success'
  )
}

async function copyPowerShellSnippet(): Promise<void> {
  showAdvFeedback(null)
  try {
    await navigator.clipboard.writeText(PS_LEAGUE_UX_ONELINER)
    showAdvFeedback(
      '已复制命令。请以管理员身份打开 PowerShell，粘贴后回车，再把输出的整段贴到下方文本框。',
      'info'
    )
  } catch {
    showAdvFeedback('无法写入剪贴板，请手动选中灰色框内命令复制。', 'error')
  }
}

function hideRevealedCredentials(): void {
  revealedPort.value = null
  revealedToken.value = null
  revealFormMsg.value = null
}

async function submitRevealPasswordSetup(): Promise<void> {
  revealFormMsg.value = null
  revealBusy.value = true
  try {
    const r = await setupLcuRevealPassword({
      password: revealSetupPwd.value,
      passwordConfirm: revealSetupPwd2.value
    })
    if (!r.ok) {
      revealFormMsg.value = r.message
      return
    }
    revealedPort.value = r.port
    revealedToken.value = r.token
    revealSetupPwd.value = ''
    revealSetupPwd2.value = ''
    revealFormMsg.value = '查看密码已保存（仅本机哈希）；下方已回显，关闭窗口后将隐藏。'
    await refreshRevealVaultStatus()
  } finally {
    revealBusy.value = false
  }
}

async function submitRevealUnlock(): Promise<void> {
  revealFormMsg.value = null
  revealBusy.value = true
  try {
    const r = await revealPersistedLcuCredentials({ password: revealUnlockPwd.value })
    if (!r.ok) {
      revealFormMsg.value = r.message
      return
    }
    revealedPort.value = r.port
    revealedToken.value = r.token
    revealUnlockPwd.value = ''
  } finally {
    revealBusy.value = false
  }
}

async function applyManualCredentials(): Promise<void> {
  showAdvFeedback(null)
  const result = await setLcuSessionCredentials({
    port: manualPort.value.trim(),
    password: manualToken.value.trim(),
    persistToDisk: rememberPersist.value
  })
  if (result.ok) {
    manualPort.value = ''
    manualToken.value = ''
    showAdvFeedback(
      rememberPersist.value
        ? '已写入本机用户目录（加密），输入框已清空；正在刷新…'
        : '已用于本会话（未写入磁盘），输入框已清空；正在刷新…',
      'success'
    )
    await refresh()
    await refreshRevealVaultStatus()
  } else {
    showAdvFeedback(result.message, 'error')
  }
}

async function clearManualCredentials(): Promise<void> {
  showAdvFeedback(null)
  const result = await setLcuSessionCredentials(null)
  if (result.ok) {
    manualPort.value = ''
    manualToken.value = ''
    showAdvFeedback(
      '已清除内存中的手动凭证、本机加密文件、查看密码与下方输入框。忘记查看密码时也可点此重置。',
      'success'
    )
    await refreshRevealVaultStatus()
    clearRevealUi()
  } else {
    showAdvFeedback(result.message, 'error')
  }
}

onMounted(() => {
  void catalogStore.ensureLoaded()
  void refresh()
  document.addEventListener('pointerdown', onSortGlobalPointerDown, true)
  document.addEventListener('keydown', onSortGlobalKeydown)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onSortGlobalPointerDown, true)
  document.removeEventListener('keydown', onSortGlobalKeydown)
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
        <button type="button" class="header-lcu-link" @click="lcuAdvOpen = true">
          LCU 凭证…
        </button>
      </div>
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
          <span class="stats-value">{{ sPlusEntries.length }}</span>
          <template v-if="totalChampions > 0">
            <span class="stats-sep">/</span>
            <span class="stats-total">{{ totalChampions }}</span>
            <span class="stats-unit">英雄</span>
          </template>
        </div>
      </div>

      <div class="list-controls">
        <div class="toolbar toolbar-filters">
          <div class="tabs" role="tablist">
            <button
              type="button"
              role="tab"
              class="tab"
              :class="{ active: viewMode === 'all' }"
              @click="viewMode = 'all'"
            >
              全部英雄
            </button>
            <button
              type="button"
              role="tab"
              class="tab"
              :class="{ active: viewMode === 'sPlus' }"
              @click="viewMode = 'sPlus'"
            >
              仅 S+
            </button>
            <button
              type="button"
              role="tab"
              class="tab"
              :class="{ active: viewMode === 'notSPlus' }"
              @click="viewMode = 'notSPlus'"
            >
              非 S+
            </button>
          </div>
          <input
            v-model="searchQuery"
            type="search"
            class="search-input"
            placeholder="名称 / 别名，或整段输入等级如 A+、S-、S+…"
            autocomplete="off"
            spellcheck="false"
          />
        </div>

        <div ref="sortPickerRoot" class="toolbar toolbar-sort">
          <span class="sort-label" id="sort-picker-label">排序</span>
          <div class="sort-picker">
            <button
              type="button"
              class="sort-trigger"
              :aria-expanded="sortMenuOpen"
              aria-haspopup="listbox"
              aria-labelledby="sort-picker-label"
              @click.stop="sortMenuOpen = !sortMenuOpen"
            >
              <span class="sort-trigger-text">{{ currentSortLabel }}</span>
              <svg
                class="sort-chevron"
                :class="{ 'sort-chevron--open': sortMenuOpen }"
                width="18"
                height="18"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M5 7.5L10 12.5L15 7.5"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
            <ul
              v-show="sortMenuOpen"
              class="sort-menu"
              role="listbox"
              aria-labelledby="sort-picker-label"
            >
              <li
                v-for="opt in sortOptions"
                :key="opt.value === '' ? '__default' : opt.value"
                role="option"
                :aria-selected="listSortMode === opt.value"
                class="sort-menu-item"
                :class="{ 'sort-menu-item--active': listSortMode === opt.value }"
                @click.stop="selectSortMode(opt.value)"
              >
                {{ opt.label }}
              </li>
            </ul>
          </div>
        </div>

        <p v-if="singleSearchInsight" class="insight">{{ singleSearchInsight }}</p>
      </div>

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
      <p class="app-author-line">Pianone 制作</p>
    </section>

    <ChampionSplashModal
      v-if="splashMergedDisplay && splashTarget"
      :display="splashMergedDisplay"
      :grade="splashTarget.grade"
      @close="closeSplash"
    />

    <Teleport to="body">
      <div
        v-if="lcuAdvOpen"
        class="lcuadv-root"
        role="presentation"
      >
        <button
          type="button"
          class="lcuadv-backdrop"
          aria-label="关闭"
          @click="lcuAdvOpen = false"
        />
        <div
          class="lcuadv-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lcuadv-title"
          @click.stop
        >
          <header class="lcuadv-hdr">
            <h2 id="lcuadv-title" class="lcuadv-title">LCU 连接与凭证</h2>
            <button
              type="button"
              class="lcuadv-close"
              aria-label="关闭"
              @click="lcuAdvOpen = false"
            >
              ×
            </button>
          </header>
          <div class="lcuadv-body">
            <div
              v-if="advFeedback"
              class="adv-feedback-banner"
              :class="`adv-feedback-banner--${advFeedbackTone}`"
              role="status"
              aria-live="polite"
            >
              {{ advFeedback }}
            </div>
            <section class="adv-section">
              <h3 class="adv-section-title">① 先试自动读取（推荐）</h3>
              <p class="adv-lead">
                请先<strong>打开英雄联盟客户端并登录</strong>。本应用会尝试读取本机 lockfile；在 Windows
                上还会尝试读取 <code>LeagueClientUx.exe</code> 进程信息（与主界面点「刷新数据」时相同）。
              </p>
              <button
                type="button"
                class="btn btn-secondary adv-inline-btn"
                :disabled="discoverBusy"
                @click="runTryDiscover"
              >
                {{ discoverBusy ? '正在读取…' : '尝试自动读取并填入' }}
              </button>
            </section>

            <section class="adv-section">
              <h3 class="adv-section-title">② 仍失败：粘贴一整行（不必手抄端口）</h3>
              <p class="adv-lead adv-lead--tight">
                国服等环境下常需<strong>管理员</strong>权限才能读到进程命令行。按下面三步操作即可，<strong>不用</strong>自己在长字符串里找
                <code>--app-port</code> 与 <code>--remoting-auth-token</code>。
              </p>
              <ol class="adv-steps">
                <li>右键「开始」→ 打开 <strong>终端 (管理员)</strong> 或 <strong>Windows PowerShell (管理员)</strong>。</li>
                <li>点下方 <strong>复制命令</strong>，在管理员窗口粘贴并回车。</li>
                <li>把终端里输出的<strong>完整一行</strong>（很长也可以）复制到下方文本框，点 <strong>解析并填入</strong>。</li>
              </ol>
              <div class="adv-snippet-row">
                <code class="adv-snippet">{{ PS_LEAGUE_UX_ONELINER }}</code>
                <button type="button" class="btn btn-ghost adv-snippet-copy" @click="copyPowerShellSnippet">
                  复制命令
                </button>
              </div>
              <p class="adv-paste-hint">
                支持国服 WeGame 等形式：整行里只要有 <code>--app-port=数字</code> 与
                <code>--remoting-auth-token=…</code> 即可，前面的 <code>--riotclient-</code> 等参数可一并保留。
              </p>
              <textarea
                v-model="pasteUxLine"
                class="adv-paste"
                rows="4"
                placeholder="在此粘贴管理员 PowerShell 输出的整行内容…"
                spellcheck="false"
                autocomplete="off"
              />
              <button type="button" class="btn btn-secondary adv-parse-btn" @click="runParsePaste">
                解析并填入
              </button>
            </section>

            <section class="adv-section">
              <h3 class="adv-section-title">③ 核对、记住并应用</h3>
              <p class="adv-lead adv-lead--tight">
                端口与 token 会出现在下方。勾选「记住到本机」会用系统安全存储<strong>加密</strong>写入用户数据目录，下次启动自动使用；不勾选则仅本次运行有效。<strong>Token 会过期</strong>，失效后重复 ① 或 ② 再点「应用并刷新」。应用成功后输入框会清空。点「清除手动凭证」会同时删除本机加密文件与<strong>查看密码</strong>。
              </p>
            </section>

            <label class="adv-check">
              <input v-model="rememberPersist" type="checkbox" />
              <span>记住到本机（加密保存，下次启动无需再填）</span>
            </label>
            <div class="adv-fields">
              <label class="adv-label">
                <span>app-port</span>
                <input v-model="manualPort" type="text" inputmode="numeric" autocomplete="off" class="adv-input" />
              </label>
              <label class="adv-label">
                <span>remoting-auth-token</span>
                <input
                  v-model="manualToken"
                  type="password"
                  autocomplete="off"
                  class="adv-input"
                  spellcheck="false"
                />
              </label>
            </div>
            <div class="adv-actions">
              <button type="button" class="btn btn-secondary" @click="applyManualCredentials">应用并刷新</button>
              <button type="button" class="btn btn-ghost" @click="clearManualCredentials">清除手动凭证</button>
            </div>

            <div class="lcuadv-reveal">
              <h3 class="lcuadv-reveal-title">回显本机已保存的凭证</h3>
              <p class="lcuadv-reveal-note">
                仅当已勾选「记住到本机」并成功保存过凭证时可用。首次需设定<strong>查看密码</strong>（≥6
                位，仅本机保存校验用哈希）；之后输入该密码即可显示 app-port 与 token。若忘记查看密码，请使用「清除手动凭证」后重新从客户端获取并保存。
              </p>

              <template v-if="revealVaultStatus && !revealVaultStatus.hasPersistedCredentials">
                <p class="lcuadv-reveal-muted">当前没有本机加密保存的凭证，保存并勾选「记住到本机」后可在此设置查看密码并回显。</p>
              </template>

              <template v-else-if="revealVaultStatus">
                <template v-if="!revealVaultStatus.hasRevealPassword">
                  <p class="lcuadv-reveal-step">首次使用：设置查看密码（两次一致）</p>
                  <div class="adv-fields reveal-fields">
                    <label class="adv-label">
                      <span>查看密码</span>
                      <input
                        v-model="revealSetupPwd"
                        type="password"
                        class="adv-input"
                        autocomplete="new-password"
                        spellcheck="false"
                        placeholder="至少 6 位"
                      />
                    </label>
                    <label class="adv-label">
                      <span>确认查看密码</span>
                      <input
                        v-model="revealSetupPwd2"
                        type="password"
                        class="adv-input"
                        autocomplete="new-password"
                        spellcheck="false"
                        @keydown.enter.prevent="submitRevealPasswordSetup"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    class="btn btn-secondary reveal-btn"
                    :disabled="revealBusy"
                    @click="submitRevealPasswordSetup"
                  >
                    {{ revealBusy ? '处理中…' : '保存查看密码并回显' }}
                  </button>
                </template>

                <template v-else-if="!isCredentialRevealed">
                  <p class="lcuadv-reveal-step">输入查看密码以显示已保存内容</p>
                  <div class="adv-fields reveal-fields">
                    <label class="adv-label">
                      <span>查看密码</span>
                      <input
                        v-model="revealUnlockPwd"
                        type="password"
                        class="adv-input"
                        autocomplete="off"
                        spellcheck="false"
                        @keydown.enter.prevent="submitRevealUnlock"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    class="btn btn-secondary reveal-btn"
                    :disabled="revealBusy"
                    @click="submitRevealUnlock"
                  >
                    {{ revealBusy ? '验证中…' : '验证并回显' }}
                  </button>
                </template>

                <template v-else>
                  <div class="reveal-values">
                    <div class="reveal-row">
                      <span class="reveal-k">app-port</span>
                      <code class="reveal-v">{{ revealedPort }}</code>
                    </div>
                    <div class="reveal-row">
                      <span class="reveal-k">remoting-auth-token</span>
                      <code class="reveal-v reveal-v-token">{{ revealedToken }}</code>
                    </div>
                  </div>
                  <button type="button" class="btn btn-ghost reveal-hide-btn" @click="hideRevealedCredentials">
                    隐藏已显示内容
                  </button>
                </template>
              </template>

              <p v-if="revealFormMsg" class="reveal-form-msg" role="status">{{ revealFormMsg }}</p>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
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
.list-controls {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  min-width: 0;
  flex-shrink: 0;
  margin: 0.1rem 0 0.4rem;
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
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.7rem;
  margin: 0;
  min-width: 0;
  flex-shrink: 0;
}
.toolbar-filters {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.5rem 0.75rem;
}
@media (max-width: 520px) {
  .toolbar-filters {
    grid-template-columns: 1fr;
  }
}
.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
.tab {
  cursor: pointer;
  padding: 0.42rem 0.8rem;
  border: 1px solid var(--t-border);
  border-radius: 8px;
  background: var(--t-bg-base);
  color: var(--t-text-muted);
  font-size: 0.85rem;
  line-height: 1.25;
  min-height: 2.25rem;
  box-sizing: border-box;
}
.tab.active {
  border-color: var(--t-btn-primary);
  color: var(--t-accent-text);
  background: var(--t-bg-tab-active);
}
.search-input {
  width: 100%;
  min-width: 0;
  min-height: 2.25rem;
  box-sizing: border-box;
  padding: 0.42rem 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--t-border);
  background: var(--t-bg-input);
  color: var(--t-text);
  font-size: 0.875rem;
  line-height: 1.35;
}
.toolbar-sort {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.5rem 0.75rem;
}
.sort-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--t-text-sort);
  flex-shrink: 0;
  letter-spacing: 0.02em;
  line-height: 1.2;
  white-space: nowrap;
}
.sort-picker {
  position: relative;
  min-width: 0;
  width: 100%;
}
.sort-trigger {
  width: 100%;
  min-height: 2.25rem;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  padding: 0.42rem 0.8rem;
  border-radius: 10px;
  border: 1px solid var(--t-border-soft);
  background: var(--t-bg-sort-trigger);
  color: var(--t-text-2);
  font-size: 0.875rem;
  line-height: 1.35;
  cursor: pointer;
  text-align: left;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    box-shadow 0.15s ease;
}
.sort-trigger:hover {
  border-color: var(--t-accent-42);
  background: var(--t-bg-row-hover);
}
.sort-trigger:focus-visible {
  outline: none;
  border-color: var(--t-accent-65);
  box-shadow: 0 0 0 2px var(--t-accent-35);
}
.sort-trigger-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sort-chevron {
  flex-shrink: 0;
  opacity: 0.5;
  color: var(--t-text-muted);
  transition: transform 0.2s ease, opacity 0.15s ease;
}
.sort-chevron--open {
  transform: rotate(180deg);
  opacity: 0.85;
}
.sort-menu {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 6px);
  z-index: 80;
  margin: 0;
  padding: 0.35rem;
  list-style: none;
  border-radius: 12px;
  border: 1px solid var(--t-border-soft);
  background: var(--t-bg-modal);
  box-shadow: var(--t-shadow-menu);
  max-height: min(52vh, 320px);
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--t-accent-45) transparent;
}
.sort-menu::-webkit-scrollbar {
  width: 6px;
}
.sort-menu::-webkit-scrollbar-thumb {
  background: var(--t-accent-45);
  border-radius: 999px;
}
.sort-menu-item {
  padding: 0.52rem 0.7rem;
  border-radius: 8px;
  font-size: 0.84rem;
  line-height: 1.35;
  color: var(--t-text-4);
  cursor: pointer;
  transition:
    background 0.12s ease,
    color 0.12s ease;
}
.sort-menu-item:hover {
  background: var(--t-bg-sort-item-hover);
  color: var(--t-text);
}
.sort-menu-item--active {
  background: var(--t-accent-22);
  color: var(--t-accent-text-2);
  font-weight: 600;
}
.sort-menu-item--active:hover {
  background: var(--t-accent-30);
  color: var(--t-accent-text);
}
.insight {
  margin: 0;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  background: var(--t-insight-bg);
  border: 1px solid var(--t-insight-border);
  color: var(--t-insight-text);
  font-size: 0.88rem;
  flex-shrink: 0;
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
.btn-secondary {
  background: var(--t-btn-secondary);
}
.btn-ghost {
  background: transparent;
  border: 1px solid var(--t-border-ghost);
  color: var(--t-text-3);
}
.lcuadv-root {
  position: fixed;
  inset: 0;
  z-index: 9990;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  box-sizing: border-box;
}
.lcuadv-backdrop {
  position: absolute;
  inset: 0;
  margin: 0;
  padding: 0;
  border: none;
  background: var(--t-overlay);
  cursor: pointer;
}
.lcuadv-dialog {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 520px;
  max-height: min(86vh, 640px);
  display: flex;
  flex-direction: column;
  border-radius: 14px;
  overflow: hidden;
  background: var(--t-bg-modal);
  border: 1px solid var(--t-border-soft);
  box-shadow: var(--t-shadow-dialog);
}
.lcuadv-hdr {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.7rem 1rem;
  flex-shrink: 0;
  background: linear-gradient(180deg, var(--t-bg-modal-hdr-t) 0%, var(--t-bg-modal-hdr-b) 100%);
  border-bottom: 1px solid var(--t-border-soft);
}
.lcuadv-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--t-lcu-title);
  letter-spacing: 0.02em;
}
.lcuadv-close {
  width: 2rem;
  height: 2rem;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--t-text-dim);
  font-size: 1.35rem;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.lcuadv-close:hover {
  color: var(--t-text);
  background: var(--t-bg-close-hover);
}
.lcuadv-close:focus-visible {
  outline: 2px solid var(--t-accent-75);
  outline-offset: 2px;
}
.lcuadv-body {
  padding: 1rem 1.1rem 1.15rem;
  overflow-x: hidden;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  font-size: 0.85rem;
  color: var(--t-text-body);
  scrollbar-width: thin;
  scrollbar-color: var(--t-accent-45) transparent;
  position: relative;
}
.adv-feedback-banner {
  position: sticky;
  top: 0;
  z-index: 4;
  margin: -0.35rem -0.2rem 0.75rem;
  padding: 0.55rem 0.7rem;
  border-radius: 8px;
  font-size: 0.84rem;
  line-height: 1.45;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.18);
}
.adv-feedback-banner--success {
  background: var(--t-bg-tab-active);
  color: var(--t-success);
  border: 1px solid var(--t-accent-45);
}
.adv-feedback-banner--error {
  background: var(--t-bg-reveal);
  color: var(--t-warn);
  border: 1px solid var(--t-accent-25);
}
.adv-feedback-banner--info {
  background: var(--t-bg-sort-trigger);
  color: var(--t-text-body);
  border: 1px solid var(--t-accent-25);
}
.lcuadv-body::-webkit-scrollbar {
  width: 8px;
}
.lcuadv-body::-webkit-scrollbar-thumb {
  background: var(--t-accent-45);
  border-radius: 999px;
}
.adv-section {
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--t-border-soft);
}
.adv-section:last-of-type {
  border-bottom: none;
  margin-bottom: 0.6rem;
  padding-bottom: 0;
}
.adv-section-title {
  margin: 0 0 0.45rem;
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--t-lcu-reveal-title);
  letter-spacing: 0.02em;
}
.adv-lead {
  margin: 0 0 0.55rem;
  line-height: 1.55;
  font-size: 0.82rem;
  color: var(--t-text-body);
}
.adv-lead--tight {
  margin-bottom: 0.45rem;
}
.adv-lead code {
  font-size: 0.78rem;
  word-break: break-all;
  color: var(--t-text-dialog);
}
.adv-steps {
  margin: 0 0 0.55rem;
  padding-left: 1.15rem;
  line-height: 1.55;
  font-size: 0.8rem;
  color: var(--t-text-body);
}
.adv-steps li {
  margin-bottom: 0.32rem;
}
.adv-inline-btn {
  margin-top: 0.1rem;
}
.adv-snippet-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 0.45rem;
  margin-bottom: 0.5rem;
}
.adv-snippet {
  flex: 1;
  min-width: 0;
  display: block;
  padding: 0.45rem 0.55rem;
  border-radius: 8px;
  background: var(--t-bg-reveal);
  border: 1px solid var(--t-border-soft);
  font-size: 0.7rem;
  line-height: 1.45;
  word-break: break-all;
  color: var(--t-text-dialog);
}
.adv-snippet-copy {
  flex-shrink: 0;
  font-size: 0.76rem;
  padding: 0.32rem 0.6rem;
}
.adv-paste {
  width: 100%;
  box-sizing: border-box;
  margin-bottom: 0.45rem;
  padding: 0.45rem 0.55rem;
  border-radius: 8px;
  border: 1px solid var(--t-border);
  background: var(--t-bg-input);
  color: var(--t-text);
  font-size: 0.78rem;
  line-height: 1.4;
  font-family: ui-monospace, 'Cascadia Code', 'Segoe UI Mono', monospace;
  resize: vertical;
  min-height: 4.25rem;
}
.adv-parse-btn {
  margin-bottom: 0.1rem;
}
.adv-paste-hint {
  margin: 0 0 0.4rem;
  font-size: 0.76rem;
  line-height: 1.5;
  color: var(--t-text-lcu-muted);
}
.adv-paste-hint code {
  font-size: 0.72rem;
  word-break: break-all;
}
.adv-check {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin: 0 0 0.75rem;
  cursor: pointer;
  color: var(--t-text-3);
}
.adv-check input {
  margin-top: 0.2rem;
}
.adv-fields {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  margin-bottom: 0.75rem;
}
.adv-label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  color: var(--t-text-muted);
}
.adv-label span {
  font-size: 0.8rem;
}
.adv-input {
  padding: 0.45rem 0.6rem;
  border-radius: 6px;
  border: 1px solid var(--t-border);
  background: var(--t-bg-input);
  color: var(--t-text);
  font-size: 0.9rem;
}
.adv-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.lcuadv-reveal {
  margin-top: 1.15rem;
  padding-top: 1rem;
  border-top: 1px solid var(--t-border-soft);
}
.lcuadv-reveal-title {
  margin: 0 0 0.45rem;
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--t-lcu-reveal-title);
  letter-spacing: 0.02em;
}
.lcuadv-reveal-note {
  margin: 0 0 0.65rem;
  font-size: 0.76rem;
  line-height: 1.5;
  color: var(--t-text-lcu-muted);
}
.lcuadv-reveal-muted {
  margin: 0;
  font-size: 0.78rem;
  color: var(--t-text-faint);
  line-height: 1.45;
}
.lcuadv-reveal-step {
  margin: 0 0 0.45rem;
  font-size: 0.78rem;
  color: var(--t-text-lcu-step);
  font-weight: 600;
}
.reveal-fields {
  margin-bottom: 0.55rem;
}
.reveal-btn {
  margin-bottom: 0.35rem;
}
.reveal-values {
  margin: 0.35rem 0 0.65rem;
  padding: 0.55rem 0.65rem;
  border-radius: 8px;
  background: var(--t-bg-reveal);
  border: 1px solid var(--t-accent-25);
}
.reveal-row {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin-bottom: 0.5rem;
}
.reveal-row:last-child {
  margin-bottom: 0;
}
.reveal-k {
  font-size: 0.72rem;
  color: var(--t-text-reveal-k);
  font-weight: 600;
}
.reveal-v {
  font-size: 0.78rem;
  color: var(--t-text-reveal-v);
  word-break: break-all;
  line-height: 1.4;
}
.reveal-v-token {
  font-size: 0.72rem;
}
.reveal-hide-btn {
  margin-top: 0.15rem;
}
.reveal-form-msg {
  margin: 0.55rem 0 0;
  font-size: 0.78rem;
  color: var(--t-warn);
  line-height: 1.4;
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

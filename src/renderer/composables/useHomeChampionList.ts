import { computed, ref, type Ref } from 'vue'
import type { ChampionDisplay } from '@renderer/types/champion'
import { mergeChampionAliases } from '@renderer/utils/championAliasesMerge'
import { championDisplayMatchesQuery } from '@renderer/utils/championSearch'
import {
  compareMasteryGrades,
  getPinyinNameCollator,
  normalizeMasteryGradeLabel,
  tryParseMasteryGradeSearchQuery
} from '@renderer/utils/masteryGrade'

type ViewMode = 'all' | 'sPlus' | 'notSPlus'
export type ListSortMode = '' | 'grade-desc' | 'grade-asc'

type ChampionRowItem = {
  championId: number
  display: ChampionDisplay
  grade: string | null
}

export function useHomeChampionList(options: {
  sortedChampions: Ref<ChampionDisplay[]>
  masteryList: Ref<Array<{ championId: number; highestGrade?: string | null }>>
  pinOrder: Ref<number[]>
  getAliasesBySlug: (slug: string) => readonly string[]
  getDisplayById: (championId: number) => ChampionDisplay | null | undefined
}) {
  const viewMode = ref<ViewMode>('all')
  const searchQuery = ref('')
  const listSortMode = ref<ListSortMode>('')
  const sortMenuOpen = ref(false)
  const sortPickerRoot = ref<HTMLElement | null>(null)
  const splashTarget = ref<{ championId: number; grade: string | null } | null>(null)

  const sortOptions: { value: ListSortMode; label: string }[] = [
    { value: '', label: '默认（与英雄数据顺序一致）' },
    { value: 'grade-desc', label: '本赛季评分从高到低' },
    { value: 'grade-asc', label: '本赛季评分从低到高' }
  ]

  function onSortRootChange(el: unknown): void {
    sortPickerRoot.value = (el as HTMLElement | null) ?? null
  }

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

  const masteryGradeById = computed(() => {
    const m = new Map<number, string | null>()
    for (const e of options.masteryList.value) {
      m.set(e.championId, e.highestGrade ?? null)
    }
    return m
  })

  const tableRows = computed<ChampionRowItem[]>(() =>
    options.sortedChampions.value.map((d) => ({
      championId: d.id,
      display: {
        ...d,
        aliases: mergeChampionAliases(d.aliases, options.getAliasesBySlug(d.key))
      },
      grade: masteryGradeById.value.get(d.id) ?? null
    }))
  )

  /**
   * 「本赛季 S+ xx / 总英雄」里的 xx：与列表每一行展示的评分同源（图鉴内英雄逐行计数）。
   * 仅用 masteryMap 在已渲染英雄集合上累计，不把 masteryList 里可能存在的多余/污染条目算进总数。
   */
  const sPlusCountInCatalog = computed(
    () => tableRows.value.filter((r) => r.grade === 'S+').length
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
    const pinnedIds = options.pinOrder.value.filter((id) => idInView.has(id))
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

  const splashMergedDisplay = computed((): ChampionDisplay | null => {
    const t = splashTarget.value
    if (t === null) {
      return null
    }
    const d = options.getDisplayById(t.championId)
    if (!d) {
      return null
    }
    return {
      ...d,
      aliases: mergeChampionAliases(d.aliases, options.getAliasesBySlug(d.key))
    }
  })

  function onChampionRowOpen(payload: {
    championId: number
    grade: string | null
  }): void {
    splashTarget.value = { championId: payload.championId, grade: payload.grade }
  }

  function closeSplash(): void {
    splashTarget.value = null
  }

  return {
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
  }
}


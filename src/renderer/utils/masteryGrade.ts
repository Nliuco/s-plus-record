/** 与 LCU highestGrade 对齐，用于等级相等比较（无评分 → null） */
export function normalizeMasteryGradeLabel(g: string | null | undefined): string | null {
  if (g == null || String(g).trim() === '') {
    return null
  }
  const t = String(g).trim().toUpperCase()
  if (t === 'S+') {
    return 'S+'
  }
  return t
}

/**
 * 搜索框整段为熟练度等级时（如 A+、s+、S-），返回规范等级串。
 * 与名称搜索互斥：仅当整段匹配 S+/S-/S 或 A～D 带可选 ± 时视为等级检索。
 */
export function tryParseMasteryGradeSearchQuery(raw: string): string | null {
  const q = raw.trim()
  if (q.length === 0) {
    return null
  }
  const u = q.toUpperCase()
  if (/^(S\+|S-|S|[ABCD](\+|-)?)$/.test(u)) {
    return u
  }
  return null
}

/** 用于排序：无评分为 0（最低档）；D=1 … S+=6；无法识别的字符串视为 0 */
export function masteryGradeRank(grade: string | null | undefined): number {
  if (grade == null || String(grade).trim() === '') {
    return 0
  }
  const g = String(grade).trim().toUpperCase()
  if (g === 'S+') {
    return 6
  }
  if (g.startsWith('S')) {
    return 5
  }
  if (g.startsWith('A')) {
    return 4
  }
  if (g.startsWith('B')) {
    return 3
  }
  if (g.startsWith('C')) {
    return 2
  }
  if (g.startsWith('D')) {
    return 1
  }
  return 0
}

let pinyinCollator: Intl.Collator | undefined

/** 名称排序用：优先汉语拼音排序，环境不支持时退回 zh-CN */
export function getPinyinNameCollator(): Intl.Collator {
  if (pinyinCollator !== undefined) {
    return pinyinCollator
  }
  try {
    pinyinCollator = new Intl.Collator('zh-CN-u-co-pinyin')
  } catch {
    pinyinCollator = new Intl.Collator('zh-CN')
  }
  return pinyinCollator
}

export type MasteryGradeSortDir = 'asc' | 'desc'

export function compareMasteryGrades(
  gradeA: string | null,
  gradeB: string | null,
  dir: MasteryGradeSortDir,
  nameCollator: Intl.Collator,
  nameA: string,
  nameB: string
): number {
  const ra = masteryGradeRank(gradeA)
  const rb = masteryGradeRank(gradeB)
  if (ra === rb) {
    return nameCollator.compare(nameA, nameB)
  }
  if (dir === 'desc') {
    /** 从高到低：有评分的按档排；无评分（0）固定在最后 */
    if (ra === 0) {
      return 1
    }
    if (rb === 0) {
      return -1
    }
    return rb - ra
  }
  /** 从低到高：0 视为最低档，排在最前，其次 D→S+ */
  return ra - rb
}

/** 列表 / 弹窗徽章的样式后缀：badge-xxx / tag-xxx */
export function masteryGradeStyleSuffix(grade: string | null): string {
  if (grade == null || String(grade).trim() === '') {
    return 'empty'
  }
  const g = String(grade).trim().toUpperCase()
  if (g === 'S+') {
    return 'splus'
  }
  if (g.startsWith('S')) {
    return 's'
  }
  if (g.startsWith('A')) {
    return 'a'
  }
  if (g.startsWith('B')) {
    return 'b'
  }
  if (g.startsWith('C')) {
    return 'c'
  }
  if (g.startsWith('D')) {
    return 'd'
  }
  return 'unknown'
}

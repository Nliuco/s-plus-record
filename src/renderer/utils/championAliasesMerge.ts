/** 合并内置与用户别名，按出现顺序、大小写不敏感去重 */
export function mergeChampionAliases(
  builtin: readonly string[],
  custom: readonly string[]
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const push = (s: string): void => {
    const t = s.trim()
    if (!t) {
      return
    }
    const k = t.toLowerCase()
    if (seen.has(k)) {
      return
    }
    seen.add(k)
    out.push(t)
  }
  for (const a of builtin) {
    push(a)
  }
  for (const a of custom) {
    push(a)
  }
  return out
}

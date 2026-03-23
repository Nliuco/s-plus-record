import type { ChampionDisplay } from '@renderer/types/champion'

/** 名称、slug、别名是否匹配搜索词（支持中英文大小写不敏感） */
export function championDisplayMatchesQuery(display: ChampionDisplay, rawQuery: string): boolean {
  const q = rawQuery.trim()
  if (q.length === 0) {
    return true
  }
  const qLower = q.toLowerCase()
  const parts: string[] = [display.name, display.key, ...display.aliases]
  return parts.some((p) => p.includes(q) || p.toLowerCase().includes(qLower))
}

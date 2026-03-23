import { CHAMPION_ALIASES_ZH } from '@renderer/data/championAliases.zh'
import type { useUserChampionAliasesStore } from '@renderer/stores/userChampionAliases'

type UserAliasStore = ReturnType<typeof useUserChampionAliasesStore>

/** 校验并写入自定义别名；成功返回 null，失败返回提示文案 */
export function tryAddUserChampionAlias(
  store: UserAliasStore,
  slug: string,
  raw: string,
  meta: { name: string; englishFormatted: string }
): string | null {
  const t = raw.trim()
  if (!t) {
    return '请输入别名'
  }
  const reserved = [
    meta.name,
    slug,
    meta.englishFormatted,
    ...(CHAMPION_ALIASES_ZH[slug] ?? []),
    ...store.forSlug(slug)
  ]
  if (reserved.some((r) => r.trim().toLowerCase() === t)) {
    return '与已有名称或别名重复'
  }
  const r = store.addForSlug(slug, raw)
  return r.ok ? null : r.reason
}

import { defineStore } from 'pinia'
import { ref } from 'vue'

const STORAGE_KEY = 's-plus-record:user-champion-aliases'

function loadRaw(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return {}
    }
    const o = JSON.parse(raw) as unknown
    if (!o || typeof o !== 'object' || Array.isArray(o)) {
      return {}
    }
    const out: Record<string, string[]> = {}
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (typeof k !== 'string' || !k) {
        continue
      }
      if (!Array.isArray(v)) {
        continue
      }
      const list = v
        .filter((x): x is string => typeof x === 'string')
        .map((x) => x.trim())
        .filter(Boolean)
      if (list.length > 0) {
        out[k] = list
      }
    }
    return out
  } catch {
    return {}
  }
}

export const useUserChampionAliasesStore = defineStore('userChampionAliases', () => {
  const bySlug = ref<Record<string, string[]>>(loadRaw())

  function persist(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bySlug.value))
  }

  function forSlug(slug: string): readonly string[] {
    return bySlug.value[slug] ?? []
  }

  function addForSlug(slug: string, raw: string): { ok: true } | { ok: false; reason: string } {
    const alias = raw.trim()
    if (!alias) {
      return { ok: false, reason: '别名不能为空' }
    }
    const list = [...(bySlug.value[slug] ?? [])]
    if (list.some((a) => a.toLowerCase() === alias.toLowerCase())) {
      return { ok: false, reason: '该自定义别名已添加过' }
    }
    list.push(alias)
    bySlug.value = { ...bySlug.value, [slug]: list }
    persist()
    return { ok: true }
  }

  function removeForSlug(slug: string, alias: string): void {
    const list = bySlug.value[slug]
    if (!list) {
      return
    }
    const next = list.filter((a) => a !== alias)
    if (next.length === 0) {
      const { [slug]: _, ...rest } = bySlug.value
      bySlug.value = rest
    } else {
      bySlug.value = { ...bySlug.value, [slug]: next }
    }
    persist()
  }

  return { bySlug, forSlug, addForSlug, removeForSlug }
})

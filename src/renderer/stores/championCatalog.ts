import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { CHAMPION_ALIASES_ZH } from '@renderer/data/championAliases.zh'
import type { ChampionDisplay } from '@renderer/types/champion'

export const useChampionCatalogStore = defineStore('championCatalog', () => {
  const version = ref<string | null>(null)
  const idToDisplay = shallowRef<Map<number, ChampionDisplay>>(new Map())
  const loadError = ref<string | null>(null)
  const loading = ref(false)

  const totalChampions = computed(() => idToDisplay.value.size)

  /** 按中文名排序的完整列表（用于表格） */
  const sortedChampions = computed(() => {
    const arr = Array.from(idToDisplay.value.values())
    arr.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    return arr
  })

  function getDisplay(id: number): ChampionDisplay | undefined {
    return idToDisplay.value.get(id)
  }

  async function ensureLoaded(): Promise<void> {
    if (loading.value) {
      return
    }
    if (version.value !== null && idToDisplay.value.size > 0) {
      return
    }
    loading.value = true
    loadError.value = null
    try {
      const vRes = await fetch('https://ddragon.leagueoflegends.com/api/versions.json')
      if (!vRes.ok) {
        throw new Error('versions')
      }
      const versions = (await vRes.json()) as string[]
      const v = versions[0]
      if (!v) {
        throw new Error('versions')
      }
      const cRes = await fetch(
        `https://ddragon.leagueoflegends.com/cdn/${v}/data/zh_CN/champion.json`
      )
      if (!cRes.ok) {
        throw new Error('champion')
      }
      const json = (await cRes.json()) as {
        data: Record<string, { key: string; name: string; id: string }>
      }
      const map = new Map<number, ChampionDisplay>()
      for (const c of Object.values(json.data)) {
        const nid = Number(c.key)
        const slug = c.id
        map.set(nid, {
          id: nid,
          key: slug,
          name: c.name,
          aliases: [...(CHAMPION_ALIASES_ZH[slug] ?? [])]
        })
      }
      version.value = v
      idToDisplay.value = map
    } catch {
      loadError.value = '无法加载英雄数据（Data Dragon）'
    } finally {
      loading.value = false
    }
  }

  return {
    version,
    loadError,
    loading,
    totalChampions,
    sortedChampions,
    getDisplay,
    ensureLoaded
  }
})

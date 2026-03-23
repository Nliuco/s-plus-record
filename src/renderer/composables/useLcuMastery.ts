import { getChampionMastery } from '@renderer/api/lcu'
import { useLcuStore } from '@renderer/stores/lcu'

export function useLcuMastery(): { refresh: () => Promise<void> } {
  const store = useLcuStore()

  async function refresh(): Promise<void> {
    store.setLoading()
    try {
      const result = await getChampionMastery()
      if (result.ok) {
        store.setReady(result.data)
      } else {
        store.setError(result.code, result.message)
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      store.setError('REQUEST_FAILED', `请求失败：${message}`)
    }
  }

  return { refresh }
}

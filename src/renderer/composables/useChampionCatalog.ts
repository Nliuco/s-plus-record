import { storeToRefs } from 'pinia'
import type { ChampionDisplay } from '@renderer/types/champion'
import { useChampionCatalogStore } from '@renderer/stores/championCatalog'

export function useChampionCatalog() {
  const store = useChampionCatalogStore()
  const { version, loadError } = storeToRefs(store)
  return {
    ensureCatalog: () => store.ensureLoaded(),
    version,
    loadError,
    getDisplay: (id: number): ChampionDisplay | undefined => store.getDisplay(id)
  }
}

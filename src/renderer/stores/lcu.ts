import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { ChampionMasteryEntry, LcuErrorCode } from '@renderer/types/lcu'

export type LcuUiStatus = 'idle' | 'loading' | 'ready' | 'error'

export const useLcuStore = defineStore('lcu', () => {
  const status = ref<LcuUiStatus>('idle')
  const errorCode = ref<LcuErrorCode | null>(null)
  const errorMessage = ref<string | null>(null)
  const masteryList = ref<ChampionMasteryEntry[]>([])

  const sPlusEntries = computed(() =>
    masteryList.value.filter((e) => e.highestGrade === 'S+')
  )

  function resetError(): void {
    errorCode.value = null
    errorMessage.value = null
  }

  function setLoading(): void {
    status.value = 'loading'
    resetError()
  }

  function setReady(list: ChampionMasteryEntry[]): void {
    masteryList.value = list
    status.value = 'ready'
    resetError()
  }

  function setError(code: LcuErrorCode, message: string): void {
    status.value = 'error'
    errorCode.value = code
    errorMessage.value = message
  }

  return {
    status,
    errorCode,
    errorMessage,
    masteryList,
    sPlusEntries,
    setLoading,
    setReady,
    setError
  }
})

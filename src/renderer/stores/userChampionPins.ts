import { defineStore } from 'pinia'
import { ref } from 'vue'

const STORAGE_KEY = 's-plus-record:user-champion-pins'

function loadRaw(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return []
    }
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) {
      return []
    }
    return arr.filter((x): x is number => typeof x === 'number' && Number.isFinite(x))
  } catch {
    return []
  }
}

export const useUserChampionPinsStore = defineStore('userChampionPins', () => {
  const order = ref<number[]>(loadRaw())

  function persist(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order.value))
  }

  function isPinned(championId: number): boolean {
    return order.value.includes(championId)
  }

  function togglePin(championId: number): void {
    const i = order.value.indexOf(championId)
    if (i >= 0) {
      order.value = order.value.filter((id) => id !== championId)
    } else {
      order.value = [...order.value, championId]
    }
    persist()
  }

  return { order, isPinned, togglePin }
})

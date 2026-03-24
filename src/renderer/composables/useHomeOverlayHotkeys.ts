import type { Ref } from 'vue'

export function useHomeOverlayHotkeys(options: {
  updateModalOpen: Ref<boolean>
  closeUpdateModal: () => void
  lcuAdvOpen: Ref<boolean>
  sortMenuOpen: Ref<boolean>
  onSortGlobalPointerDown: (e: PointerEvent) => void
}) {
  function onGlobalKeydown(e: KeyboardEvent): void {
    if (e.key !== 'Escape') {
      return
    }
    if (options.updateModalOpen.value) {
      options.closeUpdateModal()
      return
    }
    if (options.lcuAdvOpen.value) {
      options.lcuAdvOpen.value = false
      return
    }
    options.sortMenuOpen.value = false
  }

  function mountGlobalListeners(): void {
    document.addEventListener('pointerdown', options.onSortGlobalPointerDown, true)
    document.addEventListener('keydown', onGlobalKeydown)
  }

  function unmountGlobalListeners(): void {
    document.removeEventListener('pointerdown', options.onSortGlobalPointerDown, true)
    document.removeEventListener('keydown', onGlobalKeydown)
  }

  return {
    mountGlobalListeners,
    unmountGlobalListeners
  }
}


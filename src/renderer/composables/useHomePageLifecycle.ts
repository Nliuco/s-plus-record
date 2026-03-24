import { onMounted, onUnmounted, watch, type Ref } from 'vue'

export function useHomePageLifecycle(options: {
  lcuAdvOpen: Ref<boolean>
  onPanelOpenChange: (open: boolean) => void
  startUpdateEventLoop: () => void
  cleanupUpdateReminder: () => void
  ensureCatalogLoaded: () => Promise<unknown>
  refreshMastery: () => Promise<unknown>
  mountGlobalListeners: () => void
  unmountGlobalListeners: () => void
}) {
  watch(options.lcuAdvOpen, (open) => {
    options.onPanelOpenChange(open)
  })

  onMounted(() => {
    options.startUpdateEventLoop()
    void options.ensureCatalogLoaded()
    void options.refreshMastery()
    options.mountGlobalListeners()
  })

  onUnmounted(() => {
    options.cleanupUpdateReminder()
    options.unmountGlobalListeners()
  })
}


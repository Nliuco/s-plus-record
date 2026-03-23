import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './styles/theme.css'
import { applyTheme, readStoredTheme } from './composables/useAppTheme'

try {
  applyTheme(readStoredTheme())
} catch (e) {
  console.error('[theme init]', e)
}

const app = createApp(App)
app.config.errorHandler = (err, _instance, info) => {
  console.error('[Vue]', err, info)
}
app.use(createPinia())
app.mount('#app')

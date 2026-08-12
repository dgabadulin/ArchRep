import { createApp } from 'vue'
import './styles/theme.css'
import './echarts/registerDashboardCharts.js'
import App from './App.vue'
import router from './router'
import VNetworkGraph from 'v-network-graph'
import 'v-network-graph/lib/style.css'
import { api } from './api/client'
import { setConfig } from './config/params'
import { authStore } from './auth/authStore'

async function bootstrap() {
  let config = {}
  try {
    config = await api.getConfig()
    setConfig(config)
  } catch (_) {
    setConfig({})
  }
  await authStore.loadFromConfig(config)

  const app = createApp(App)
  app.use(router)
  app.use(VNetworkGraph)
  app.mount('#app')

  if (authStore.state.authEnabled && !authStore.state.user) {
    const path = window.location.pathname
    if (path === '/login' || path.startsWith('/login/')) {
      return
    }
    const q = new URLSearchParams(window.location.search)
    const forceLocal = q.get('local') === '1' || q.get('local') === 'true'
    const kcOn = Boolean(config.keycloak_enabled)
    const mode = String(config.keycloak_login_mode || 'button').toLowerCase()
    if (kcOn && mode === 'auto' && !forceLocal) {
      const { startOidcLogin } = await import('./auth/oidc')
      startOidcLogin({ redirect: path + window.location.search })
      return
    }
    await router.replace({ name: 'login', query: { redirect: path + window.location.search } })
  }
}
bootstrap()

import { createApp } from 'vue'
import './echarts/registerDashboardCharts.js'
import App from './App.vue'
import router from './router'
import VNetworkGraph from 'v-network-graph'
import 'v-network-graph/lib/style.css'
import { api } from './api/client'
import { setConfig } from './config/params'

async function bootstrap() {
  try {
    const config = await api.getConfig()
    setConfig(config)
  } catch (_) {
    setConfig({})
  }
  const app = createApp(App)
  app.use(router)
  app.use(VNetworkGraph)
  app.mount('#app')
}
bootstrap()

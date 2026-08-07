import { reactive, computed } from 'vue'
import { api } from '../api/client'
import { clearToken, getToken, setToken } from './session'

const state = reactive({
  ready: false,
  authEnabled: false,
  user: null,
  roles: [],
  permissions: [],
})

export const authStore = {
  state,
  isReady: computed(() => state.ready),
  isAuthEnabled: computed(() => state.authEnabled),
  user: computed(() => state.user),
  roles: computed(() => state.roles),
  permissions: computed(() => state.permissions),

  hasPermission(code) {
    if (!state.authEnabled) return true
    const set = state.permissions || []
    return set.includes('*') || set.includes(code)
  },

  hasAnyPermission(codes) {
    if (!state.authEnabled) return true
    if (!codes || !codes.length) return true
    return codes.some((c) => authStore.hasPermission(c))
  },

  hasAllPermissions(codes) {
    if (!state.authEnabled) return true
    if (!codes || !codes.length) return true
    return codes.every((c) => authStore.hasPermission(c))
  },

  async loadFromConfig(config) {
    state.authEnabled = Boolean(config && config.auth_enabled)
    if (!state.authEnabled) {
      clearToken()
      try {
        const me = await api.getAuthMe()
        applyMe(me)
      } catch {
        state.user = { login: 'anonymous', display_name: 'Anonymous' }
        state.roles = ['OPEN_ACCESS']
        state.permissions = ['*']
      }
      state.ready = true
      return
    }
    if (!getToken()) {
      state.user = null
      state.roles = []
      state.permissions = []
      state.ready = true
      return
    }
    try {
      const me = await api.getAuthMe()
      applyMe(me)
    } catch {
      clearToken()
      state.user = null
      state.roles = []
      state.permissions = []
    }
    state.ready = true
  },

  async login(login, password) {
    const data = await api.login({ login, password })
    setToken(data.access_token)
    state.authEnabled = true
    state.user = data.user
    state.roles = data.roles || []
    state.permissions = data.permissions || []
    state.ready = true
    return data
  },

  logout() {
    clearToken()
    state.user = null
    state.roles = []
    state.permissions = []
  },
}

function applyMe(me) {
  if (me && typeof me.auth_enabled === 'boolean') {
    state.authEnabled = me.auth_enabled
  }
  state.user = me.user || null
  state.roles = me.roles || []
  state.permissions = me.permissions || []
}

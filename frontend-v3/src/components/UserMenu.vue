<template>
  <div class="user-menu" v-click-outside="() => (open = false)">
    <button
      type="button"
      class="user-menu-trigger"
      :aria-expanded="open"
      aria-haspopup="menu"
      @click.stop="open = !open"
    >
      <span class="user-avatar" aria-hidden="true">{{ initials }}</span>
      <span class="user-label">{{ displayLabel }}</span>
      <span class="user-chevron" aria-hidden="true">{{ open ? '▲' : '▼' }}</span>
    </button>
    <div v-if="open" class="user-menu-dropdown" role="menu">
      <router-link to="/profile" class="user-menu-item" role="menuitem" @click="open = false">
        Профиль
      </router-link>
      <a
        v-if="changePasswordExternal"
        :href="changePasswordExternal"
        class="user-menu-item"
        role="menuitem"
        target="_blank"
        rel="noopener noreferrer"
        @click="open = false"
      >
        Сменить пароль
      </a>
      <router-link
        v-else-if="showLocalChangePassword"
        to="/change-password"
        class="user-menu-item"
        role="menuitem"
        @click="open = false"
      >
        Сменить пароль
      </router-link>
      <button
        v-if="showLogout"
        type="button"
        class="user-menu-item user-menu-item--button"
        role="menuitem"
        @click="onLogout"
      >
        Выход
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { authStore } from '../auth/authStore'
import { getConfig } from '../config/params'

const router = useRouter()
const open = ref(false)

const vClickOutside = {
  mounted(el, binding) {
    el._clickOutside = (e) => {
      if (!el.contains(e.target)) binding.value()
    }
    document.addEventListener('click', el._clickOutside)
  },
  unmounted(el) {
    document.removeEventListener('click', el._clickOutside)
  },
}

const user = computed(() => authStore.state.user)
const authEnabled = computed(() => authStore.state.authEnabled)

const displayLabel = computed(() => user.value?.display_name || user.value?.login || 'Пользователь')

const initials = computed(() => {
  const src = (user.value?.display_name || user.value?.login || '?').trim()
  const parts = src.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return src.slice(0, 2).toUpperCase()
})

const isKeycloakUser = computed(() => user.value?.auth_provider === 'keycloak')

const changePasswordExternal = computed(() => {
  if (!isKeycloakUser.value) return ''
  const url = getConfig().keycloak_account_url
  return url ? String(url).trim() : ''
})

const showLocalChangePassword = computed(() => {
  if (!authEnabled.value) return false
  if (isKeycloakUser.value) return false
  return user.value?.auth_provider === 'local' || user.value?.auth_provider === 'hybrid'
})

const showLogout = computed(() => authEnabled.value && user.value?.auth_provider !== 'open')

function onLogout() {
  open.value = false
  authStore.logout()
  router.replace({ name: 'login' })
}
</script>

<style scoped>
.user-menu {
  position: relative;
}
.user-menu-trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.06);
  border-radius: var(--ar-radius-sm);
  padding: 0.35rem 0.55rem 0.35rem 0.4rem;
  color: #fff;
  cursor: pointer;
  font: inherit;
  font-size: 0.85rem;
  max-width: min(16rem, 42vw);
}
.user-menu-trigger:hover {
  border-color: var(--ar-accent);
  background: rgba(255, 255, 255, 0.1);
}
.user-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  background: rgba(0, 229, 204, 0.2);
  color: var(--ar-accent);
  font-size: 0.72rem;
  font-weight: 700;
  flex-shrink: 0;
}
.user-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.user-chevron {
  font-size: 0.55rem;
  opacity: 0.85;
  flex-shrink: 0;
}
.user-menu-dropdown {
  position: absolute;
  top: calc(100% + 0.35rem);
  right: 0;
  min-width: 11rem;
  background: var(--ar-surface);
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  padding: 0.35rem 0;
  z-index: 200;
}
.user-menu-item {
  display: block;
  width: 100%;
  box-sizing: border-box;
  padding: 0.5rem 0.85rem;
  text-align: left;
  color: var(--ar-text);
  text-decoration: none;
  font-size: 0.875rem;
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
}
.user-menu-item:hover {
  background: var(--ar-accent-soft);
  color: var(--ar-link);
}
.user-menu-item--button {
  border-top: 1px solid var(--ar-border);
  margin-top: 0.25rem;
  padding-top: 0.65rem;
}
</style>

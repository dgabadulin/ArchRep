<template>
  <header class="app-topbar">
    <router-link to="/" class="app-topbar-title">ИСАР</router-link>
    <UserMenu v-if="showUserMenu" />
  </header>
</template>

<script setup>
import { computed } from 'vue'
import { authStore } from '../auth/authStore'
import UserMenu from './UserMenu.vue'

const showUserMenu = computed(() => Boolean(authStore.state.user))
</script>

<style scoped>
.app-topbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-height: 3rem;
  padding: 0 1.25rem;
  background: linear-gradient(135deg, var(--ar-header) 0%, #252842 100%);
  border-bottom: 1px solid var(--ar-header-border);
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.06);
}
.app-topbar-title {
  font-weight: 700;
  font-size: 1.05rem;
  letter-spacing: 0.06em;
  color: #fff;
  text-decoration: none;
}
.app-topbar-title:hover {
  color: var(--ar-accent);
}
</style>

<template>
  <div class="layout" :class="{ 'layout--minimal': minimalLayout }">
    <aside v-if="!minimalLayout" class="sidebar">
      <div class="sidebar-header">
        <router-link to="/" class="logo">
          <img src="/logo.png" alt="" class="logo-img" />
          <span class="logo-text">Архитектурный репозиторий v3</span>
        </router-link>
      </div>
      <nav class="sidebar-nav">
        <router-link to="/" class="nav-link nav-link-home" :class="{ active: route.path === '/' }">
          <component :is="getMenuIconComponent('home')" :size="16" :stroke-width="1.9" class="nav-icon nav-icon-svg" />
          Главная
        </router-link>
        <template v-for="item in menuItems" :key="item.label">
          <div v-if="item.children?.length" class="nav-group">
            <button type="button" class="nav-group-title" :aria-expanded="isGroupOpen(item.label)" @click="toggleGroup(item.label)">
              <component :is="getMenuIconComponent(item.icon)" :size="16" :stroke-width="1.9" class="nav-icon nav-icon-svg" />
              {{ item.label }}
              <span class="nav-group-chevron">{{ isGroupOpen(item.label) ? '▼' : '▶' }}</span>
            </button>
            <div v-show="isGroupOpen(item.label)" class="nav-group-children">
              <router-link v-for="child in item.children" :key="child.label" :to="child.path" class="nav-link nav-link-sub" active-class="active">
                <component :is="getMenuIconComponent(child.icon)" :size="16" :stroke-width="1.9" class="nav-icon nav-icon-svg" />
                {{ child.label }}
              </router-link>
            </div>
          </div>
          <router-link v-else-if="item.path" :to="item.path" class="nav-link" active-class="active">
            <component :is="getMenuIconComponent(item.icon)" :size="16" :stroke-width="1.9" class="nav-icon nav-icon-svg" />
            {{ item.label }}
          </router-link>
        </template>
      </nav>
    </aside>
    <main class="main" :class="{ 'main--minimal': minimalLayout }">
      <Breadcrumbs v-if="!minimalLayout" />
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { menuItems } from '../config/menu'
import { getMenuIconComponent } from '../config/icons'
import Breadcrumbs from '../components/Breadcrumbs.vue'
import { getConfig } from '@/config/params'

const route = useRoute()
const minimalLayout = computed(() => Boolean(route.meta.minimalLayout))
const expandedGroups = ref([])

function getCookie() {
  const COOKIE_NAME = getConfig().ARR_MENU_COOKIE || 'ar-v3-menu-expanded'
  try {
    const v = document.cookie.split(';').find(c => c.trim().startsWith(COOKIE_NAME + '='))
    if (v) {
      const json = decodeURIComponent(v.split('=')[1].trim())
      const arr = JSON.parse(json)
      return Array.isArray(arr) ? arr : []
    }
  } catch (_) {}
  return []
}
function setCookie(arr) {
  const COOKIE_NAME = getConfig().ARR_MENU_COOKIE || 'ar-v3-menu-expanded'
  const days = (getConfig().ARR_COOKIE_MAX_DAYS ?? 365) | 0
  const maxAge = days * 24 * 60 * 60
  document.cookie = COOKIE_NAME + '=' + encodeURIComponent(JSON.stringify(arr)) + ';path=/;max-age=' + maxAge
}
function openGroupForCurrentRoute() {
  const path = route.path
  for (const item of menuItems) {
    if (!item.children?.length) continue
    const hasActiveChild = item.children.some(c => c.path && (path === c.path || path.startsWith(c.path + '/')))
    if (hasActiveChild && !expandedGroups.value.includes(item.label)) {
      expandedGroups.value = [...expandedGroups.value, item.label]
      setCookie(expandedGroups.value)
    }
  }
}
onMounted(() => {
  expandedGroups.value = getCookie()
  openGroupForCurrentRoute()
})
watch(() => route.path, () => openGroupForCurrentRoute())
function isGroupOpen(label) { return expandedGroups.value.includes(label) }
function toggleGroup(label) {
  const next = isGroupOpen(label) ? expandedGroups.value.filter(l => l !== label) : [...expandedGroups.value, label]
  expandedGroups.value = next
  setCookie(next)
}
</script>

<style scoped>
.layout {
  display: flex;
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--ar-bg);
}
.sidebar {
  width: 260px;
  flex-shrink: 0;
  background: var(--ar-surface);
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--ar-border);
  box-shadow: 2px 0 12px rgba(0, 0, 0, 0.04);
}
.sidebar-header {
  padding: 1rem 1.1rem;
  border-bottom: 1px solid var(--ar-border);
  background: linear-gradient(135deg, var(--ar-header) 0%, #252842 100%);
}
.logo {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  font-weight: 700;
  font-size: 0.9rem;
  color: #fff;
  text-decoration: none;
  letter-spacing: 0.02em;
}
.logo:hover {
  color: var(--ar-accent);
}
.logo-img {
  width: 36px;
  height: 36px;
  object-fit: contain;
  flex-shrink: 0;
  border-radius: 50%;
  border: 2px solid var(--ar-header-border);
  background: #2a2d3e;
  padding: 2px;
}
.logo-text {
  flex: 1;
  min-width: 0;
}
.sidebar-nav {
  padding: 0.4rem 0 0.75rem;
  overflow-y: auto;
}
.nav-group {
  margin-bottom: 0.15rem;
}
.nav-group-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.55rem 0.9rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--ar-text);
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  border-radius: var(--ar-radius-sm);
  transition: background 0.12s, color 0.12s;
}
.nav-group-title:hover {
  background: var(--ar-accent-soft);
  color: var(--ar-link);
}
.nav-group-chevron {
  margin-left: auto;
  font-size: 0.65rem;
  color: var(--ar-muted);
}
.nav-group-children {
  padding: 0.15rem 0 0.35rem;
  margin: 0 0.35rem 0.35rem;
  background: #f8f9fb;
  border-radius: var(--ar-radius-sm);
  border: 1px solid var(--ar-border);
}
.nav-link,
.nav-link-sub {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.85rem;
  margin: 0 0.25rem;
  color: var(--ar-text);
  text-decoration: none;
  font-size: 0.875rem;
  border-radius: var(--ar-radius-sm);
  transition: background 0.12s, color 0.12s;
}
.nav-link-sub {
  padding-left: 1.35rem;
}
.nav-link-home {
  margin: 0 0.35rem 0.35rem;
}
.nav-icon {
  flex-shrink: 0;
  width: 1.25em;
  text-align: center;
}
.nav-icon-svg {
  color: currentColor;
}
.nav-link:hover,
.nav-link-sub:hover {
  background: var(--ar-accent-soft);
  color: var(--ar-link);
}
.nav-link.active,
.nav-link-sub.active {
  background: var(--ar-accent);
  color: var(--ar-text-on-accent);
  font-weight: 700;
}
.main {
  flex: 1;
  padding: 1.1rem 1.5rem;
  overflow: auto;
}
.layout--minimal {
  height: 100dvh;
  max-height: 100dvh;
  min-height: 100dvh;
  overflow: hidden;
}
.main--minimal {
  flex: 1;
  min-width: 0;
  min-height: 0;
  max-width: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
}
</style>

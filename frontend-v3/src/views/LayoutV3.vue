<template>
  <div class="layout" :class="{ 'layout--minimal': minimalLayout }">
    <aside v-if="!minimalLayout" class="sidebar">
      <div class="sidebar-header">
        <router-link to="/" class="logo" title="ИСАР">
          <img src="/logo.png" alt="ИСАР" class="logo-img" />
        </router-link>
      </div>
      <nav class="sidebar-nav">
        <router-link
          v-if="canSeeHome"
          to="/"
          class="nav-link nav-link-home"
          :class="{ active: route.path === '/' }"
        >
          <component :is="getMenuIconComponent('home')" :size="16" :stroke-width="1.9" class="nav-icon nav-icon-svg" />
          Главная
        </router-link>
        <template v-for="item in visibleMenu" :key="item.label">
          <div v-if="item.children?.length" class="nav-group">
            <button type="button" class="nav-group-title" :aria-expanded="isGroupOpen(item.label)" @click="toggleGroup(item.label)">
              <component :is="getMenuIconComponent(item.icon)" :size="16" :stroke-width="1.9" class="nav-icon nav-icon-svg" />
              {{ item.label }}
              <span class="nav-group-chevron">{{ isGroupOpen(item.label) ? '▼' : '▶' }}</span>
            </button>
            <div v-show="isGroupOpen(item.label)" class="nav-group-children">
              <template v-for="child in item.children" :key="child.label">
                <div v-if="child.children?.length" class="nav-subgroup">
                  <div class="nav-subgroup-title">
                    <component :is="getMenuIconComponent(child.icon)" :size="14" :stroke-width="1.9" class="nav-icon nav-icon-svg" />
                    {{ child.label }}
                  </div>
                  <router-link
                    v-for="leaf in child.children"
                    :key="leaf.label"
                    :to="leaf.path"
                    class="nav-link nav-link-sub nav-link-nested"
                    active-class="active"
                  >
                    <component :is="getMenuIconComponent(leaf.icon)" :size="16" :stroke-width="1.9" class="nav-icon nav-icon-svg" />
                    {{ leaf.label }}
                  </router-link>
                </div>
                <router-link
                  v-else-if="child.path"
                  :to="child.path"
                  class="nav-link nav-link-sub"
                  active-class="active"
                >
                  <component :is="getMenuIconComponent(child.icon)" :size="16" :stroke-width="1.9" class="nav-icon nav-icon-svg" />
                  {{ child.label }}
                </router-link>
              </template>
            </div>
          </div>
          <router-link v-else-if="item.path" :to="item.path" class="nav-link" active-class="active">
            <component :is="getMenuIconComponent(item.icon)" :size="16" :stroke-width="1.9" class="nav-icon nav-icon-svg" />
            {{ item.label }}
          </router-link>
        </template>
      </nav>
      <div v-if="aiAvailable" class="sidebar-footer">
        <button
          type="button"
          class="ai-toggle"
          :class="{ active: aiState.open }"
          :title="aiTitle"
          @click="aiToggle"
        >
          <Sparkles :size="16" :stroke-width="1.9" class="nav-icon nav-icon-svg" />
          {{ aiTitle }}
        </button>
      </div>
    </aside>
    <div class="layout-body" :class="{ 'layout-body--minimal': minimalLayout }">
      <AppTopBar v-if="!minimalLayout" />
      <main class="main" :class="{ 'main--minimal': minimalLayout }">
        <Breadcrumbs v-if="!minimalLayout" />
        <router-view />
      </main>
    </div>
    <AiArchitectPanel v-if="!minimalLayout" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { menuItems, filterMenuItems } from '../config/menu'
import { getMenuIconComponent } from '../config/icons'
import { Sparkles } from 'lucide-vue-next'
import AiArchitectPanel from '../components/ai/AiArchitectPanel.vue'
import { useAiPanel } from '../composables/useAiPanel'
import Breadcrumbs from '../components/Breadcrumbs.vue'
import AppTopBar from '../components/AppTopBar.vue'
import { getConfig } from '@/config/params'
import { authStore } from '../auth/authStore'

const route = useRoute()
const minimalLayout = computed(() => Boolean(route.meta.minimalLayout))
const expandedGroups = ref([])
const canSeeHome = computed(() => authStore.hasPermission('dashboard:read'))
// ИИ-архитектор (issue #78): кнопка видна только при SYS_AI_ENABLED=true и праве ai_architect:use.
const { state: aiState, available: aiAvailable, aiTitle, toggle: aiToggle } = useAiPanel()
const visibleMenu = computed(() =>
  filterMenuItems(menuItems, (code) => authStore.hasPermission(code))
)

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
function menuItemMatchesPath(item, path) {
  if (item.path && (path === item.path || path.startsWith(item.path + '/'))) return true
  if (item.children?.length) return item.children.some((c) => menuItemMatchesPath(c, path))
  return false
}

function openGroupForCurrentRoute() {
  const path = route.path
  for (const item of visibleMenu.value) {
    if (!item.children?.length) continue
    if (menuItemMatchesPath(item, path) && !expandedGroups.value.includes(item.label)) {
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
  height: 100vh;
  height: 100dvh;
  min-height: 100vh;
  min-height: 100dvh;
  overflow: hidden;
  background: var(--ar-bg);
}
.sidebar {
  width: 260px;
  flex-shrink: 0;
  height: 100%;
  min-height: 0;
  background: var(--ar-surface);
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--ar-border);
  box-shadow: 2px 0 12px rgba(0, 0, 0, 0.04);
}
.sidebar-header {
  flex-shrink: 0;
  padding: 0.85rem 1.1rem;
  border-bottom: 1px solid var(--ar-border);
  display: flex;
  justify-content: center;
}
.logo {
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
}
.logo:hover .logo-img {
  border-color: var(--ar-accent);
}
.logo-img {
  width: 40px;
  height: 40px;
  object-fit: contain;
  flex-shrink: 0;
  border-radius: 50%;
  border: 2px solid var(--ar-border);
  background: #2a2d3e;
  padding: 2px;
  transition: border-color 0.12s;
}
.layout-body {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.layout-body--minimal {
  flex: 1;
  min-width: 0;
  min-height: 0;
}
.sidebar-nav {
  flex: 1;
  min-height: 0;
  padding: 0.4rem 0 0.75rem;
  overflow-y: auto;
  overflow-x: hidden;
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
  min-width: 0;
  min-height: 0;
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
.nav-subgroup {
  margin: 0.15rem 0 0.35rem;
}
.nav-subgroup-title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.85rem 0.25rem 1.85rem;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ar-muted);
}
.nav-link-nested {
  padding-left: 2.35rem !important;
}
.sidebar-footer {
  flex-shrink: 0;
  padding: 0.5rem 0.6rem;
  border-top: 1px solid var(--ar-border);
}
.ai-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius);
  background: var(--ar-surface);
  color: var(--ar-text);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
}
.ai-toggle:hover {
  background: var(--ar-accent-soft);
  border-color: var(--ar-accent);
  color: var(--ar-link);
}
.ai-toggle.active {
  background: var(--ar-accent);
  border-color: var(--ar-accent);
  color: var(--ar-text-on-accent);
}
</style>

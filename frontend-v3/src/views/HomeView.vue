<template>
  <div class="page home-page">
    <div class="page-head">
      <h1>Архитектурный репозиторий</h1>
    </div>
    <p class="home-desc">
      Принципы и решения, каталог ИС и технологий, бизнес-архитектура и связи метамодели TOGAF.
    </p>

    <div class="home-layout">
      <div class="home-main">
        <template v-for="section in sections" :key="section.title">
          <h2 class="section-title">{{ section.title }}</h2>
          <div class="tiles">
            <router-link
              v-for="tile in section.tiles"
              :key="tile.path"
              :to="tile.path"
              class="tile"
            >
              <component :is="tile.icon" :size="24" :stroke-width="1.9" class="tile-icon-svg" />
              <span class="tile-title">{{ tile.title }}</span>
              <span class="tile-desc">{{ tile.desc }}</span>
            </router-link>
          </div>
        </template>
      </div>

      <aside class="home-aside">
        <h2 class="aside-title">Объём каталога</h2>
        <p v-if="!statsLoaded" class="aside-loading">Загрузка…</p>
        <p v-else-if="homeStatsError" class="aside-err">Не удалось загрузить статистику. Обновите страницу или проверьте миграции БД (issue #34): <code>DB/schema/archrep_issue34_home_dashboard.sql</code>.</p>
        <div v-else class="kpi-grid">
          <div
            v-for="(kpi, idx) in kpiTiles"
            :key="idx"
            class="kpi-card"
            :class="{ 'kpi-card--error': kpi.error }"
          >
            <component :is="iconComponentFor(kpi.icon)" :size="22" :stroke-width="1.9" class="kpi-icon-svg" />
            <div class="kpi-title">{{ kpi.title }}</div>
            <div class="kpi-primary">
              <template v-if="kpi.error">—</template>
              <template v-else>{{ formatInt(kpi.primary) }}</template>
            </div>
            <div v-if="kpi.footer" class="kpi-footer">{{ kpi.footer }}</div>
          </div>
        </div>

        <details v-if="statsLoaded && !homeStatsError && accordionRows.length" class="home-accordion">
          <summary class="accordion-summary">Другие сущности метамодели</summary>
          <ul class="accordion-list">
            <li v-for="row in accordionRows" :key="row.entityTypeCode" class="accordion-row">
              <span class="accordion-label">{{ row.label }}</span>
              <span class="accordion-count">{{ formatInt(row.count) }}</span>
            </li>
          </ul>
        </details>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { menuItems } from '../config/menu'
import { getMenuIconComponent } from '../config/icons'
import { api } from '../api/client'

const statsLoaded = ref(false)
const homeStatsError = ref(false)
const kpiTiles = ref([])
const accordionRows = ref([])

function formatInt(n) {
  if (n == null || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat('ru-RU').format(n)
}

function iconComponentFor(iconKey) {
  return getMenuIconComponent(iconKey || 'list')
}

onMounted(async () => {
  homeStatsError.value = false
  try {
    const data = await api.getHomeStats()
    kpiTiles.value = Array.isArray(data.kpiTiles) ? data.kpiTiles : []
    accordionRows.value = Array.isArray(data.accordion) ? data.accordion : []
  } catch {
    homeStatsError.value = true
    kpiTiles.value = []
    accordionRows.value = []
  } finally {
    statsLoaded.value = true
  }
})

const tileDescriptions = {
  '/principles': 'Принципы архитектуры',
  '/decisions/principle': 'ADRP',
  '/decisions/applied': 'ADRA с инкрементами',
  '/architecture-debt': 'Реестр архитектурного долга (разрывы, отклонения)',
  '/organization-units': 'Структура организации',
  '/actors': 'Роли и исполнители',
  '/business-services': 'Продукты и сервисы',
  '/business-functions': 'Бизнес-способности',
  '/systems': 'Реестр информационных систем',
  '/integrations': 'Реестр интеграций между системами',
  '/metamodel-relations': 'Связи между объектами метамодели',
  '/technologies': 'Технологический стек',
  '/tech-radar': 'Открыть в интерфейсе',
  '/analytics': 'Анализ зависимостей',
  '/dashboards': 'Дашборды ECharts (treemap и др.)',
  '/dashboards/catalog': 'Описание и ссылки на дашборды',
  '/goals': 'Цели и задачи (дерево/список)',
  '/references': 'Статусы, владельцы, типы (ИС и технологии)',
  '/references-togaf': 'Категории орг. единиц, типы акторов, статусы',
  '/settings/parameters': 'Настроечные параметры системы (Keycloak, лимиты, флаги)',
  '/settings/service-operations': 'Массовые операции (пересборка проекций и др.)',
}

const sections = computed(() => {
  const result = []
  for (const item of menuItems) {
    const tiles = []
    if (item.path) {
      tiles.push({
        path: item.path,
        title: item.label,
        desc: tileDescriptions[item.path] || '',
        icon: iconComponentFor(item.icon),
      })
    }
    if (item.children?.length) {
      for (const child of item.children) {
        if (child.path) {
          tiles.push({
            path: child.path,
            title: child.label,
            desc: tileDescriptions[child.path] || '',
            icon: iconComponentFor(child.icon),
          })
        }
      }
    }
    if (tiles.length > 0) {
      result.push({ title: item.label, tiles })
    }
  }
  return result
})
</script>

<style scoped>
.home-page {
  max-width: 1200px;
}
.page-head h1 {
  margin: 0 0 0.5rem;
  font-size: 1.5rem;
  color: var(--ar-text);
}
.home-desc {
  color: var(--ar-muted);
  margin-bottom: 1.5rem;
  font-size: 0.95rem;
}

.home-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.75rem;
  align-items: start;
}
@media (min-width: 960px) {
  .home-layout {
    grid-template-columns: 1fr minmax(260px, 300px);
  }
}

.home-main {
  min-width: 0;
}

.aside-loading {
  margin: 0 0 0.5rem;
  font-size: 0.85rem;
  color: #6b635a;
}
.aside-err {
  margin: 0 0 0.5rem;
  font-size: 0.82rem;
  color: #8b4513;
  line-height: 1.35;
}
.aside-err code {
  font-size: 0.75rem;
  word-break: break-all;
}
.aside-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--ar-muted);
  margin: 0 0 0.75rem;
  padding-bottom: 0.35rem;
  border-bottom: 1px solid var(--ar-border);
}

.kpi-grid {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.kpi-card {
  background: var(--ar-surface);
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius);
  padding: 1rem 1.1rem;
  box-shadow: var(--ar-shadow-card);
}
.kpi-card--error {
  opacity: 0.85;
  border-color: #e8c4b8;
}
.kpi-icon-svg {
  color: var(--ar-muted);
  display: block;
  margin-bottom: 0.35rem;
}
.kpi-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--ar-muted);
  line-height: 1.25;
  margin-bottom: 0.35rem;
}
.kpi-primary {
  font-size: 1.85rem;
  font-weight: 700;
  color: var(--ar-text);
  line-height: 1.1;
  letter-spacing: -0.02em;
}
.kpi-footer {
  margin-top: 0.45rem;
  font-size: 0.78rem;
  color: #6b635a;
  line-height: 1.3;
}

.home-accordion {
  margin-top: 1.25rem;
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius);
  background: var(--ar-table-head-bg);
  overflow: hidden;
}
.accordion-summary {
  padding: 0.65rem 0.85rem;
  font-weight: 600;
  font-size: 0.85rem;
  color: #4a433c;
  cursor: pointer;
  list-style: none;
  user-select: none;
}
.accordion-summary::-webkit-details-marker {
  display: none;
}
.home-accordion[open] .accordion-summary {
  border-bottom: 1px solid var(--ar-border);
}
.accordion-list {
  margin: 0;
  padding: 0.35rem 0;
  list-style: none;
}
.accordion-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
  padding: 0.4rem 0.85rem;
  font-size: 0.82rem;
}
.accordion-label {
  color: var(--ar-muted);
}
.accordion-count {
  font-weight: 600;
  color: var(--ar-text);
  font-variant-numeric: tabular-nums;
}

.section-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--ar-muted);
  margin: 1.5rem 0 0.75rem;
  padding-bottom: 0.35rem;
  border-bottom: 1px solid var(--ar-border);
}
.section-title:first-of-type {
  margin-top: 0;
}
.tiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}
.tile {
  display: flex;
  flex-direction: column;
  padding: 1.25rem;
  background: var(--ar-surface);
  border-radius: var(--ar-radius);
  border: 1px solid var(--ar-border);
  text-decoration: none;
  color: inherit;
  transition: box-shadow 0.2s, border-color 0.2s;
}
.tile:hover {
  border-color: var(--ar-accent);
  box-shadow: 0 4px 16px rgba(0, 229, 204, 0.15);
}
.tile-icon-svg {
  color: var(--ar-muted);
  margin-bottom: 0.5rem;
}
.tile-title {
  font-weight: 600;
  color: var(--ar-text);
  margin-bottom: 0.25rem;
}
.tile-desc {
  font-size: 0.85rem;
  color: var(--ar-muted);
}
</style>

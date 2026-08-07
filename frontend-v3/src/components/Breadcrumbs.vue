<template>
  <nav v-if="items.length" class="breadcrumbs" aria-label="Хлебные крошки">
    <router-link to="/" class="breadcrumb-link">Главная</router-link>
    <template v-for="(item, i) in items" :key="i">
      <span class="breadcrumb-sep">/</span>
      <router-link v-if="item.path" :to="item.path" class="breadcrumb-link">{{ item.title }}</router-link>
      <span v-else class="breadcrumb-current">{{ item.title }}</span>
    </template>
  </nav>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { dashboardSlugLabels } from '../dashboards/registry'

const route = useRoute()

const items = computed(() => {
  const path = route.path
  if (!path || path === '/') return []
  const parts = path.split('/').filter(Boolean)
  const result = []
  let acc = ''
  for (let i = 0; i < parts.length; i++) {
    acc = acc ? acc + '/' + parts[i] : '/' + parts[i]
    const isLast = i === parts.length - 1
    const title =
      isLast && route.meta?.title
        ? route.meta.title
        : formatTitle(parts[i], i, parts, path)
    result.push({ title, path: isLast ? null : acc })
  }
  return result
})

function formatTitle(segment, index, parts, _fullPath) {
  if (parts[0] === 'dashboards') {
    if (segment === 'dashboards') return 'Дашборды'
    if (segment === 'catalog') return 'Справочник дашбордов'
    if (segment === 'full') return 'Просмотр'
    if (dashboardSlugLabels[segment]) return dashboardSlugLabels[segment]
  }
  const labels = {
    principles: 'Архитектурные принципы',
    decisions: 'Архитектурные решения',
    principle: 'Архитектурные решения (ADR)',
    applied: 'Архитектурные заключения',
    systems: 'Каталог ИС',
    integrations: 'Интеграционные потоки',
    technologies: 'Каталог технологий',
    'tech-radar': 'Тех.радар',
    analytics: 'Аналитика',
    dashboards: 'Дашборды',
    catalog: 'Справочник дашбордов',
    full: 'Просмотр',
    'organization-units': 'Организационные единицы',
    actors: 'Заинтересованные лица',
    'business-services': 'Бизнес-сервисы',
    'business-functions': 'Бизнес-функции',
    'metamodel-relations': 'Связи метамодели',
    references: 'Справочники',
    'references-togaf': 'Справочники (метамодель)',
    parameters: 'Параметры',
    'service-operations': 'Сервисные операции',
    import: 'Импорт данных',
    settings: 'Настройки',
    administration: 'Администрирование',
    users: 'Пользователи',
    roles: 'Роли',
    'change-password': 'Смена пароля',
    goals: 'Цели и задачи',
    new: 'Новая запись',
    edit: 'Редактирование',
    'diagram-editor': 'Диаграмма',
  }
  if (labels[segment]) return labels[segment]
  if (/^\d+$/.test(segment)) return 'Редактирование'
  return segment
}
</script>

<style scoped>
.breadcrumbs {
  font-size: 0.85rem;
  color: var(--ar-muted);
  margin-bottom: 0.75rem;
}
.breadcrumb-link {
  color: var(--ar-link);
  text-decoration: none;
  font-weight: 500;
}
.breadcrumb-link:hover {
  text-decoration: underline;
}
.breadcrumb-sep {
  margin: 0 0.35rem;
  color: var(--ar-border);
}
.breadcrumb-current {
  color: var(--ar-text);
  font-weight: 600;
}
</style>

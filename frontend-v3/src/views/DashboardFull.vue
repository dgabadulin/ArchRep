<template>
  <div class="page dashboard-full-page">
    <div class="page-head">
      <h1>{{ entry?.title || 'Дашборд' }}</h1>
      <router-link to="/dashboards" class="btn btn-secondary">← К дашбордам</router-link>
    </div>
    <p v-if="entry" class="lead">{{ entry.description }}</p>
    <div v-else class="msg error">Дашборд не найден (неизвестный код).</div>
    <div v-if="entry" class="chart-shell">
      <component :is="entry.component" :compact="false" :show-title="false" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { getDashboard } from '../dashboards/registry'

const route = useRoute()
const slug = computed(() => route.params.slug)
const entry = computed(() => getDashboard(slug.value))
</script>

<style scoped>
.dashboard-full-page {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 5rem);
}
.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}
.page-head h1 {
  margin: 0;
  font-size: 1.35rem;
  color: var(--ar-text);
}
.lead {
  color: var(--ar-muted);
  font-size: 0.95rem;
  line-height: 1.45;
  margin: 0 0 1rem;
  max-width: 60rem;
}
.chart-shell {
  flex: 1;
  min-height: 420px;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-lg);
  overflow: hidden;
  background: var(--ar-surface);
  box-shadow: var(--ar-shadow-card);
}
.msg.error {
  color: var(--ar-danger);
  margin-bottom: 1rem;
}
</style>

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
  color: #2d2a26;
}
.lead {
  color: #5c5349;
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
  border: 1px solid #e5dccf;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}
.msg.error {
  color: #a94442;
  margin-bottom: 1rem;
}
.btn {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  text-decoration: none;
  font-size: 0.9rem;
  border: none;
  cursor: pointer;
  display: inline-block;
  text-align: center;
}
.btn-secondary {
  background: #e5dccf;
  color: #2d2a26;
}
.btn-secondary:hover {
  background: #d4c4b0;
}
</style>

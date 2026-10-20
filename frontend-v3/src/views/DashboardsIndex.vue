<template>
  <div class="page">
    <div class="page-head">
      <h1>Дашборды</h1>
      <router-link to="/dashboards/catalog" class="btn btn-secondary">Справочник дашбордов</router-link>
    </div>
    <p class="lead">
      Визуализации на Apache ECharts. В карточке — превью; кнопка открывает дашборд на всю рабочую область. Назад — из шапки полноэкранного вида или хлебные крошки.
    </p>

    <div class="dashboard-grid">
      <article v-for="d in dashboards" :key="d.slug" class="dashboard-card card">
        <div class="card-top">
          <div class="card-titles">
            <h2 class="card-title">{{ d.title }}</h2>
            <span class="card-category">{{ d.category }}</span>
          </div>
          <router-link :to="`/dashboards/full/${d.slug}`" class="btn btn-primary btn-sm">На весь экран</router-link>
        </div>
        <p class="card-desc">{{ d.description }}</p>
        <div class="preview-wrap">
          <component :is="d.component" :compact="true" :show-title="false" />
        </div>
      </article>
    </div>
  </div>
</template>

<script setup>
import { dashboards } from '../dashboards/registry'
</script>

<style scoped>
.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
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
  margin: 0 0 1.25rem;
  max-width: 56rem;
}
.dashboard-grid {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  align-items: flex-start;
}
/* Карточка по ширине превью — без пустой «белой полосы» справа на весь экран */
.dashboard-card {
  box-sizing: border-box;
  width: min(100%, max(22rem, 50vw));
  padding: 1rem 1.25rem;
  background: var(--ar-surface);
  border-radius: var(--ar-radius-lg);
  box-shadow: var(--ar-shadow-card);
  border: 1px solid var(--ar-border);
}
.card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 0.5rem;
}
.card-titles {
  min-width: 0;
}
.card-title {
  margin: 0 0 0.25rem;
  font-size: 1.1rem;
  color: var(--ar-text);
}
.card-category {
  font-size: 0.8rem;
  color: var(--ar-link);
  font-weight: 600;
}
.card-desc {
  margin: 0 0 0.75rem;
  font-size: 0.88rem;
  color: var(--ar-muted);
  line-height: 1.4;
}
/* Превью на всю ширину карточки; высота — половина окна */
.preview-wrap {
  width: 100%;
  height: 50vh;
  min-height: 220px;
  max-height: 85vh;
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  overflow: hidden;
  background: var(--ar-table-head-bg);
  display: flex;
  flex-direction: column;
}
@media (max-width: 720px) {
  .dashboard-card {
    width: 100%;
  }
  .preview-wrap {
    height: min(50vh, 360px);
  }
}
.btn-sm {
  flex-shrink: 0;
}
</style>

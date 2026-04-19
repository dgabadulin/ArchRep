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
  color: #2d2a26;
}
.lead {
  color: #5c5349;
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
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  border: 1px solid #e5dccf;
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
  color: #2d2a26;
}
.card-category {
  font-size: 0.8rem;
  color: #8b6914;
}
.card-desc {
  margin: 0 0 0.75rem;
  font-size: 0.88rem;
  color: #5c5349;
  line-height: 1.4;
}
/* Превью на всю ширину карточки; высота — половина окна */
.preview-wrap {
  width: 100%;
  height: 50vh;
  min-height: 220px;
  max-height: 85vh;
  border: 1px solid #e5dccf;
  border-radius: 6px;
  overflow: hidden;
  background: #faf8f5;
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
  padding: 0.35rem 0.75rem;
  font-size: 0.85rem;
  flex-shrink: 0;
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
.btn-primary {
  background: #cb997e;
  color: #fff;
}
.btn-primary:hover {
  background: #b8866b;
}
.btn-secondary {
  background: #e5dccf;
  color: #2d2a26;
}
.btn-secondary:hover {
  background: #d4c4b0;
}
</style>

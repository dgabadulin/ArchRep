<template>
  <div class="page">
    <div class="page-head">
      <h1>Справочник дашбордов</h1>
      <router-link to="/dashboards" class="btn btn-secondary">← К дашбордам</router-link>
    </div>
    <p class="lead">
      Перечень доступных дашбордов: назначение, категория и прямая ссылка на полноэкранный просмотр. Состав реестра задаётся в коде приложения (
      <code>src/dashboards/registry.js</code>
      ).
    </p>

    <div class="card table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Наименование</th>
            <th>Категория</th>
            <th>Описание</th>
            <th>Код (slug)</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in dashboards" :key="d.slug">
            <td>{{ d.title }}</td>
            <td>{{ d.category }}</td>
            <td class="desc">{{ d.description }}</td>
            <td><code>{{ d.slug }}</code></td>
            <td>
              <router-link :to="`/dashboards/full/${d.slug}`" class="link">Открыть</router-link>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { dashboards } from '../dashboards/registry'
</script>

<style scoped>
.lead {
  color: var(--ar-muted);
  font-size: 0.95rem;
  line-height: 1.45;
  margin: 0 0 1rem;
  max-width: 56rem;
}
.lead code {
  font-size: 0.85em;
  background: var(--ar-table-head-bg);
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
}
.desc {
  max-width: 28rem;
  line-height: 1.4;
}
code {
  font-size: 0.85em;
}
</style>

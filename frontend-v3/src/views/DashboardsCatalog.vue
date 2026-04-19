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
  margin: 0 0 1rem;
  max-width: 56rem;
}
.lead code {
  font-size: 0.85em;
  background: #f0ebe3;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
}
.card {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  border: 1px solid #e5dccf;
  overflow: hidden;
}
.table-wrap {
  padding: 0;
  overflow: auto;
}
.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}
.table th,
.table td {
  padding: 0.5rem 0.75rem;
  text-align: left;
  border-bottom: 1px solid #e5dccf;
  vertical-align: top;
}
.table th {
  background: #faf8f5;
  font-weight: 600;
  color: #5c5349;
}
.desc {
  max-width: 28rem;
  line-height: 1.4;
}
.link {
  color: #8b6914;
  text-decoration: none;
  white-space: nowrap;
}
.link:hover {
  text-decoration: underline;
}
code {
  font-size: 0.85em;
}
.btn {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  text-decoration: none;
  font-size: 0.9rem;
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

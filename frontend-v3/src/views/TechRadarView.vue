<template>
  <div class="tech-radar-page">
    <div class="page-head">
      <h1>Тех.радар</h1>
    </div>
    <iframe
      v-if="radarUrl"
      class="radar-iframe"
      :src="radarUrl"
      title="Технологический радар"
    />
    <p v-else class="radar-empty">
      Источник для технологического радара не определен, задайте URL в системном параметре TECH_RADAR_EMBED_URL
    </p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { getConfig } from '@/config/params'

const radarUrl = computed(() => String(getConfig().TECH_RADAR_EMBED_URL || '').trim())
</script>

<style scoped>
.tech-radar-page { height: calc(100vh - 8rem); display: flex; flex-direction: column; }
.page-head { margin-bottom: 0.5rem; }
.page-head h1 {
  margin: 0;
  font-size: 1.2rem;
  color: var(--ar-text);
}
.radar-iframe {
  flex: 1;
  width: 100%;
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-lg);
  background: var(--ar-surface);
}
.radar-empty {
  flex: 1;
  margin: 0;
  padding: 1rem 1.25rem;
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-lg);
  background: var(--ar-table-head-bg);
  color: var(--ar-muted);
  font-size: 0.95rem;
  line-height: 1.5;
}
</style>

<template>
  <div class="placeholder-page">
    <h1>{{ title }}</h1>
    <p>Раздел в разработке.</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const title = computed(() => route.meta?.title || 'Страница')
</script>

<style scoped>
.placeholder-page { padding: 0.5rem 0; }
.placeholder-page h1 { margin: 0 0 0.5rem; font-size: 1.35rem; color: #0f172a; }
.placeholder-page p { color: #64748b; }
</style>

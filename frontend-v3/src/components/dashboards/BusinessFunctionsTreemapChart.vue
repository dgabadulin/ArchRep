<template>
  <div class="bf-treemap-wrap">
    <div v-if="loading" class="state loading">Загрузка…</div>
    <div v-else-if="error" class="state error">{{ error }}</div>
    <div v-else-if="!hasData" class="state empty">Нет бизнес-функций в каталоге.</div>
    <v-chart v-else class="chart" :option="option" autoresize />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import VChart from 'vue-echarts'
import { togafApi } from '../../api'
import { flatBusinessFunctionsToTreemap, treemapOptionFromTree } from './businessFunctionsTreemap.js'

const props = defineProps({
  /** Компактный режим (карточка на галерее) */
  compact: { type: Boolean, default: false },
  /** Подзаголовок графика */
  showTitle: { type: Boolean, default: true },
})

const loading = ref(true)
const error = ref('')
const rows = ref([])

const tree = computed(() => flatBusinessFunctionsToTreemap(rows.value))
const hasData = computed(() => rows.value.length > 0)

const option = computed(() => {
  if (!hasData.value) return {}
  return treemapOptionFromTree(tree.value, {
    titleText: props.showTitle ? (props.compact ? 'Бизнес-способности' : '') : '',
    compact: props.compact,
  })
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    rows.value = await togafApi.businessFunctions()
  } catch (e) {
    error.value = e.message || 'Ошибка загрузки'
    rows.value = []
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.bf-treemap-wrap {
  width: 100%;
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}
.chart {
  width: 100%;
  flex: 1;
  min-height: 200px;
}
.state {
  padding: 1rem;
  text-align: center;
  color: #5c5349;
  font-size: 0.9rem;
}
.state.error {
  color: #a94442;
}
.state.empty {
  color: #5c5349;
}
</style>

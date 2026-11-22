<!--
  Общая раскладка: подсказка + тулбар + таблица слева (~40%) и граф справа (~60%).
  Граф строится только из переданного массива relations (как на вкладке «Связи» у gap).
  Использование: GapForm, SystemForm (технологии), дальше — другие формы с тем же UX.
-->
<template>
  <div class="entity-links-card" ref="cardRef">
    <div v-if="$slots.hint" class="tab-hint">
      <slot name="hint" />
    </div>
    <div v-if="$slots.toolbar" class="entity-links-toolbar">
      <slot name="toolbar" />
    </div>
    <div v-if="loading" class="loading">Загрузка...</div>
    <template v-else>
      <div
        class="relations-split"
        :class="{ 'relations-split--no-graph': !relationCount }"
        :style="splitStyle"
        ref="splitRef"
      >
        <div class="relations-split__table">
          <slot name="table" />
        </div>
        <div v-if="relationCount > 0" class="relations-split__graph">
          <h3 class="graph-section-title">{{ graphTitle }}</h3>
          <div class="relations-split__graph-inner">
            <AnalyzerGraph
              ref="graphRef"
              variant="embed"
              :graph-height="autoGraphHeight"
              :show-export-buttons="true"
              :nodes="graphNodes"
              :edges="graphEdges"
              :relations="relationsNormalized"
              :relation-types="relationTypes"
              :center-node-id="centerNodeId"
            />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onMounted, onBeforeUnmount, computed } from 'vue'
import AnalyzerGraph from './AnalyzerGraph.vue'
import { relationsToGraphData, fetchEntity } from '../api/graphApi'
import { parseNodeId } from '../utils/entityTypeConfig'

const props = defineProps({
  /** Показать индикатор загрузки вместо сплита */
  loading: { type: Boolean, default: false },
  /**
   * Связи в формате метамодели (как в /api/togaf/relations): id, from_entity_type, from_entity_id,
   * to_entity_type, to_entity_id, relation_type, relation_type_name, name, displayed_name, …
   */
  relations: { type: Array, default: () => [] },
  /** Узел-центр для раскладки «звезда», например gap:12 или system:34 */
  centerNodeId: { type: String, default: null },
  relationTypes: { type: Array, default: () => [] },
  /**
   * Готовые подписи узлов (`nodeId → name`). Нужны, когда срез карточки уже содержит наименования
   * связанных объектов и не должен требовать права на их реестр (например, серверы ИС, issue #125).
   */
  nodeNames: { type: Object, default: () => ({}) },
  graphTitle: { type: String, default: 'Граф связей' },
  /** Fallback-высота графа, если авто-высота недоступна (узкий экран, нет измерения). */
  graphHeight: { type: String, default: '780px' },
  /**
   * Авто-высота области (issue #125): сплит занимает всё доступное место до липкой панели
   * сохранения, чтобы граф не уходил под неё и не требовал прокрутки страницы.
   */
  autoHeight: { type: Boolean, default: true },
})

const graphRef = ref(null)
const graphNodes = ref({})
const graphEdges = ref({})

const relationCount = computed(() => (Array.isArray(props.relations) ? props.relations.length : 0))

/** Минимальная высота области: ниже граф нечитаем на типовых экранах. */
const MIN_AREA_HEIGHT = 360
/** Узкие экраны: сплит превращается в колонку, авто-высота отключается (fallback `graphHeight`). */
const AUTO_HEIGHT_MAX_WIDTH = 1024

const areaHeight = ref(0)
const cardRef = ref(null)
const splitRef = ref(null)

/** В авто-режиме граф растягивается по высоте области сплита. */
const autoGraphHeight = computed(() => (areaHeight.value ? '100%' : props.graphHeight))
const splitStyle = computed(() => (areaHeight.value ? { height: `${areaHeight.value}px` } : null))

/**
 * Высота области = доступное место до липкой панели сохранения.
 * Считаем от низа контейнера прокрутки `.main`: разница top'ов не зависит от скролла,
 * поэтому размер не «прыгает» при прокрутке страницы. Высота `.save-bar` измеряется
 * фактически (кнопки могут переноситься на узких экранах).
 */
function measureArea() {
  if (!props.autoHeight || typeof window === 'undefined') return
  if (window.innerWidth <= AUTO_HEIGHT_MAX_WIDTH) {
    areaHeight.value = 0
    return
  }
  const el = splitRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const scrollEl = el.closest('.main')
  const scrollRect = scrollEl ? scrollEl.getBoundingClientRect() : null
  const viewTop = scrollRect ? scrollRect.top : 0
  const viewHeight = scrollRect ? scrollRect.height : window.innerHeight
  const offsetTop = Math.max(0, rect.top - viewTop)
  const saveBar = document.querySelector('.save-bar')
  const saveBarHeight = saveBar ? saveBar.getBoundingClientRect().height : 0
  // Зазор: padding карточки снизу + отступ до липкой панели сохранения.
  const BOTTOM_RESERVE = 28
  const available = Math.floor(viewHeight - offsetTop - saveBarHeight - BOTTOM_RESERVE)
  areaHeight.value = Math.max(MIN_AREA_HEIGHT, available)
}

let areaRaf = 0
let areaObserver = null

function scheduleMeasure() {
  if (!props.autoHeight) return
  if (typeof requestAnimationFrame !== 'function') {
    measureArea()
    return
  }
  if (areaRaf) cancelAnimationFrame(areaRaf)
  areaRaf = requestAnimationFrame(() => {
    areaRaf = 0
    measureArea()
  })
}

/**
 * Пересчёт при изменении контейнера прокрутки (ресайз окна) и карточки
 * (баннеры, перенос подсказки, появление тулбара).
 */
function observeArea() {
  if (typeof ResizeObserver === 'undefined') return
  areaObserver = new ResizeObserver(() => scheduleMeasure())
  const scrollEl = cardRef.value?.closest('.main')
  if (scrollEl) areaObserver.observe(scrollEl)
  if (cardRef.value) areaObserver.observe(cardRef.value)
}

// Сплит рендерится только после загрузки — пересчитываем, когда он появился.
watch(() => props.loading, () => nextTick(scheduleMeasure))
watch(relationCount, () => nextTick(scheduleMeasure))

/** Копия для графа (AnalyzerGraph не мутирует) */
const relationsNormalized = computed(() => props.relations || [])

async function resolveGraphNodeNames() {
  const updates = {}
  const promises = []
  for (const nid of Object.keys(graphNodes.value)) {
    // Подпись уже пришла в срезе карточки — не ходим в реестр связанной сущности (может не быть прав).
    const provided = props.nodeNames?.[nid]
    if (provided) {
      updates[nid] = String(provided)
      continue
    }
    const p = parseNodeId(nid)
    if (!p) continue
    promises.push(
      fetchEntity(p.entityType, p.entityId).then((data) => {
        const name =
          data?.display_name || data?.name || data?.code || data?.task_name || nid
        updates[nid] = name
      })
    )
  }
  await Promise.all(promises)
  if (Object.keys(updates).length === 0) return
  const next = { ...graphNodes.value }
  for (const [nid, name] of Object.entries(updates)) {
    if (next[nid]) next[nid] = { ...next[nid], name }
  }
  graphNodes.value = next
}

async function rebuildGraph() {
  const rels = props.relations || []
  if (!rels.length) {
    graphNodes.value = {}
    graphEdges.value = {}
    return
  }
  const { nodes, edges } = relationsToGraphData(rels, new Set())
  graphNodes.value = nodes
  graphEdges.value = edges
  await nextTick()
  await resolveGraphNodeNames()
  await nextTick()
  const center = props.centerNodeId
  if (center && Object.keys(graphNodes.value).length > 1) {
    graphRef.value?.applyLayout('star', center)
  } else if (Object.keys(graphNodes.value).length > 0) {
    graphRef.value?.applyLayout('grid')
  }
}

watch(
  () => props.relations,
  () => {
    rebuildGraph()
  },
  { deep: true }
)

watch(
  () => props.centerNodeId,
  () => {
    rebuildGraph()
  }
)

watch(
  () => props.nodeNames,
  () => {
    rebuildGraph()
  },
  { deep: true }
)

onMounted(() => {
  rebuildGraph()
  observeArea()
  scheduleMeasure()
  window.addEventListener('resize', scheduleMeasure)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', scheduleMeasure)
  if (areaRaf) cancelAnimationFrame(areaRaf)
  areaObserver?.disconnect()
  areaObserver = null
})
</script>

<style scoped>
.entity-links-card {
  margin-top: 0;
}
.tab-hint {
  font-size: 0.9rem;
  color: var(--ar-muted);
  margin-bottom: 1rem;
}
.entity-links-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  border-bottom: 1px solid var(--ar-border);
}
.loading {
  padding: 1rem;
}
.relations-split {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: 1.25rem;
  margin-top: 0.75rem;
  min-height: 0;
}
.relations-split--no-graph .relations-split__table {
  flex: 1 1 100%;
  max-width: 100%;
}
.relations-split__table {
  flex: 0 0 40%;
  max-width: 40%;
  min-width: 0;
  /* Таблица прокручивается внутри своей колонки и не выезжает под карточку графа. */
  max-height: 100%;
  overflow: auto;
  overscroll-behavior: contain;
}
.relations-split__graph {
  flex: 1 1 60%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}
.relations-split__graph-inner {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.relations-split__graph-inner :deep(.analyzer-wrap--embed) {
  flex: 1;
  min-height: 0;
  height: 100%;
}
.relations-split__graph-inner :deep(.analyzer-graph-wrap) {
  flex: 1;
  min-height: 0;
}
.graph-section-title {
  margin: 0 0 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  color: #374151;
}
@media (max-width: 1024px) {
  .relations-split {
    flex-direction: column;
  }
  .relations-split__table,
  .relations-split__graph {
    flex: 1 1 auto;
    max-width: 100%;
  }
  .relations-split__graph {
    min-height: 480px;
  }
}
</style>

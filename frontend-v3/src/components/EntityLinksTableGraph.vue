<!--
  Общая раскладка: подсказка + тулбар + таблица слева (~40%) и граф справа (~60%).
  Граф строится только из переданного массива relations (как на вкладке «Связи» у gap).
  Использование: GapForm, SystemForm (технологии), дальше — другие формы с тем же UX.
-->
<template>
  <div class="entity-links-card">
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
              :graph-height="graphHeight"
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
import { ref, watch, nextTick, onMounted, computed } from 'vue'
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
  graphTitle: { type: String, default: 'Граф связей' },
  graphHeight: { type: String, default: '780px' },
})

const graphRef = ref(null)
const graphNodes = ref({})
const graphEdges = ref({})

const relationCount = computed(() => (Array.isArray(props.relations) ? props.relations.length : 0))

/** Копия для графа (AnalyzerGraph не мутирует) */
const relationsNormalized = computed(() => props.relations || [])

async function resolveGraphNodeNames() {
  const updates = {}
  const promises = []
  for (const nid of Object.keys(graphNodes.value)) {
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
  graphRef.value?.fitToContents?.()
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

onMounted(() => {
  rebuildGraph()
})
</script>

<style scoped>
.entity-links-card {
  margin-top: 0;
}
.tab-hint {
  font-size: 0.9rem;
  color: #5c5349;
  margin-bottom: 1rem;
}
.entity-links-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
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
}
.relations-split__graph {
  flex: 1 1 60%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 780px;
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

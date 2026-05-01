<template>
  <div class="page analytics-page">
    <div class="page-head">
      <h1>Анализ зависимостей</h1>
    </div>

    <div v-if="!graphBuilt" class="picker-card card">
      <p class="picker-hint">Выберите тип сущности и объекты для отображения на графе. Граф строится по связям метамодели, интеграционным потокам (система → система) и связям систем с технологиями.</p>
      <div class="picker-row">
        <label class="picker-label">Тип сущности</label>
        <select v-model="selectedEntityType" class="picker-select" @change="onEntityTypeChange">
          <option v-for="et in entityTypes" :key="et.code" :value="et.code">{{ et.display_name || et.name || et.code }}</option>
        </select>
      </div>
      <div class="picker-row">
        <label class="picker-label">Объекты</label>
        <input v-model="pickerSearch" type="text" class="picker-search" placeholder="Поиск по названию или коду..." />
        <div class="picker-list-wrap">
          <div v-if="listLoading" class="loading-inline">Загрузка...</div>
          <div v-else class="picker-list">
            <label v-for="item in filteredEntityList" :key="item.id" class="picker-item">
              <input type="checkbox" :value="item.id" v-model="selectedIds" />
              <span>{{ item.display_name || item.full_name || item.name || item.code || `#${item.id}` }}</span>
            </label>
          </div>
          <p v-if="!listLoading && entityList.length === 0" class="empty-inline">Нет записей</p>
        </div>
      </div>
      <div class="picker-actions">
        <button type="button" class="btn btn-primary" :disabled="selectedIds.length === 0" @click="buildGraph">
          Построить граф
        </button>
      </div>
    </div>

    <template v-else>
      <div class="graph-actions">
        <button type="button" class="btn btn-secondary" @click="resetGraph">Новый граф</button>
      </div>
      <p v-if="graphTooLargeWarning" class="graph-warning">Число узлов на графе превышает заданный максимум (GRAPH_MAX_NODES). Построение выполнено.</p>
      <AnalyzerGraph
        ref="analyzerRef"
        :nodes="analyzerGraphNodes"
        :edges="analyzerGraphEdges"
        :relations="relations"
        :relation-types="relationTypes"
        :legend-entity-types="entityTypes"
        :show-cascade-toggle="rootNodeId != null"
        v-model:show-all-edges-cascade="showAllEdgesCascade"
        :can-collapse-modules="analyzerCanCollapseModules"
        :can-expand-modules="analyzerCanExpandModules"
        @add-level="onAddLevel"
        @layout="onLayout"
        @hide-node="onHideNode"
        @hide-edge="onHideEdge"
        @collapse-modules="onCollapseModules"
        @expand-modules="onExpandModules"
      />
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch, computed, nextTick } from 'vue'
import AnalyzerGraph from '../components/AnalyzerGraph.vue'
import { nodeId } from '../utils/entityTypeConfig'
import {
  loadAllRelations,
  loadMetamodelRefs,
  loadEntityList,
  relationsToGraphData,
  getIncidentRelations,
  getRelationsBetweenNodes,
  fetchEntity,
  buildSubsystemParentSystemMap,
  applyModuleCollapse,
} from '../api/graphApi'
import { getConfig } from '@/config/params'

const entityTypes = ref([])
const relationTypes = ref([])
const relations = ref([])
const selectedEntityType = ref('system')
const entityList = ref([])
const listLoading = ref(false)
const selectedIds = ref([])
const graphBuilt = ref(false)
const graphNodes = ref({})
const graphEdges = ref({})
const graphTooLargeWarning = ref(false)
const rootNodeId = ref(null)
const showAllEdgesCascade = ref(false)
const expandedFrom = ref({})
const hiddenNodeIds = ref(new Set())
const hiddenEdgeIds = ref(new Set())
/** Узлы system:id, для которых на графе свернуты модули (issue #48) */
const collapsedSystemNodeIds = ref([])
const analyzerRef = ref(null)
const pickerSearch = ref('')

const filteredEntityList = computed(() => {
  const q = (pickerSearch.value || '').trim().toLowerCase()
  if (!q) return entityList.value
  return entityList.value.filter(
    (e) =>
      (e.display_name && e.display_name.toLowerCase().includes(q)) ||
      (e.name && e.name.toLowerCase().includes(q)) ||
      (e.code && e.code.toLowerCase().includes(q)) ||
      (e.fullname && e.fullname.toLowerCase().includes(q)) ||
      (e.full_name && e.full_name.toLowerCase().includes(q)) ||
      String(e.id).includes(q)
  )
})

const visibleNodes = computed(() => {
  const hidden = hiddenNodeIds.value
  const nodes = graphNodes.value
  const out = {}
  for (const id of Object.keys(nodes)) {
    if (!hidden.has(id)) out[id] = nodes[id]
  }
  return out
})

function isEdgeVisible(edgeId, source, target) {
  if (hiddenEdgeIds.value.has(edgeId)) return false
  if (hiddenNodeIds.value.has(source) || hiddenNodeIds.value.has(target)) return false
  if (showAllEdgesCascade.value) return true
  const root = rootNodeId.value
  if (!root) return true
  const exp = expandedFrom.value
  if (source === root || target === root) return true
  if (exp[source] === target || exp[target] === source) return true
  return false
}

const visibleEdges = computed(() => {
  const edges = graphEdges.value
  const out = {}
  for (const [eid, e] of Object.entries(edges)) {
    if (isEdgeVisible(eid, e.source, e.target)) out[eid] = e
  }
  return out
})

/** subsystem:nid → system:parentId по связям метамодели system_module */
const subsystemParentMap = computed(() => buildSubsystemParentSystemMap(relations.value))

const analyzerPresentation = computed(() =>
  applyModuleCollapse({
    nodes: visibleNodes.value,
    edges: visibleEdges.value,
    collapsedSystemNodeIds: collapsedSystemNodeIds.value,
    subsystemToParentSystem: subsystemParentMap.value,
    collapsedSystemIcon: getConfig().GRAPH_COLLAPSED_SYSTEM_ICON || 'MonitorDot',
  })
)

const analyzerGraphNodes = computed(() => analyzerPresentation.value.nodes)
const analyzerGraphEdges = computed(() => analyzerPresentation.value.edges)

function analyzerCanCollapseModules(nid) {
  if (collapsedSystemNodeIds.value.includes(nid)) return false
  const p = nid.indexOf(':')
  if (p < 0 || nid.slice(0, p) !== 'system') return false
  const map = subsystemParentMap.value
  for (const [subNid, sysNid] of Object.entries(map)) {
    if (sysNid !== nid) continue
    if (visibleNodes.value[subNid]) return true
  }
  return false
}

function analyzerCanExpandModules(nid) {
  return collapsedSystemNodeIds.value.includes(nid)
}

function onCollapseModules(nid) {
  if (!analyzerCanCollapseModules(nid)) return
  if (!collapsedSystemNodeIds.value.includes(nid)) {
    collapsedSystemNodeIds.value = [...collapsedSystemNodeIds.value, nid]
  }
  nextTick(() => analyzerRef.value?.fitToContents?.())
}

function onExpandModules(nid) {
  collapsedSystemNodeIds.value = collapsedSystemNodeIds.value.filter((x) => x !== nid)
  const map = subsystemParentMap.value
  const candidateSubs = Object.keys(map).filter((sub) => map[sub] === nid)
  nextTick(() => {
    const nodes = analyzerGraphNodes.value
    const present = candidateSubs.filter((sub) => nodes[sub])
    if (present.length) {
      analyzerRef.value?.placeRevealedModules?.(nid, present)
    }
    analyzerRef.value?.fitToContents?.()
  })
}

const defaultEntityTypeOrder = [
  'system', 'subsystem', 'technology', 'organization_unit', 'actor', 'employee',
  'business_service', 'business_function', 'principle',
]
function getEntityTypeOrder() {
  const o = getConfig().GRAPH_ENTITY_ORDER
  return Array.isArray(o) && o.length ? o : defaultEntityTypeOrder
}

onMounted(async () => {
  const entityTypeOrder = getEntityTypeOrder()
  const { entityTypes: et, relationTypes: rt } = await loadMetamodelRefs()
  entityTypes.value = (et || []).sort((a, b) => {
    const i = entityTypeOrder.indexOf(a.code)
    const j = entityTypeOrder.indexOf(b.code)
    if (i >= 0 && j >= 0) return i - j
    return (a.display_name || a.name || a.code).localeCompare(b.display_name || b.name || b.code)
  })
  relationTypes.value = rt || []
  if (entityTypes.value.length && !selectedEntityType.value) selectedEntityType.value = entityTypes.value[0].code
  await loadRelationsList()
  relations.value = await loadAllRelations()
})

async function loadRelationsList() {
  listLoading.value = true
  try {
    const params = selectedEntityType.value === 'system'
      ? { exclude_modules: true }
      : selectedEntityType.value === 'subsystem'
        ? { only_modules: true }
        : {}
    entityList.value = await loadEntityList(selectedEntityType.value, params)
  } finally {
    listLoading.value = false
  }
}

function onEntityTypeChange() {
  selectedIds.value = []
  loadRelationsList()
}

watch(selectedEntityType, () => {
  if (!entityTypes.value.some((e) => e.code === selectedEntityType.value)) return
  loadRelationsList()
})

function buildGraph() {
  const type = selectedEntityType.value
  const ids = [...selectedIds.value]
  if (!type || ids.length === 0) return

  hiddenNodeIds.value = new Set()
  hiddenEdgeIds.value = new Set()
  collapsedSystemNodeIds.value = []
  const root = ids.length === 1 ? nodeId(type, ids[0]) : null
  rootNodeId.value = root
  expandedFrom.value = {}

  const nodes = {}
  const nodeIds = new Set()
  ids.forEach((id) => {
    const nid = nodeId(type, id)
    nodeIds.add(nid)
    const item = entityList.value.find((e) => e.id === id)
    const displayType = type === 'system' && item?.parent_ar_systems_id != null ? 'subsystem' : type
    nodes[nid] = {
      name: item?.display_name || item?.full_name || item?.name || item?.code || `${type}:${id}`,
      entityType: displayType,
      entityId: id,
    }
  })

  const incident = getIncidentRelations(relations.value, nodeIds, null)
  const { nodes: extraNodes, edges } = relationsToGraphData(incident, nodeIds)

  const mergedNodes = { ...nodes }
  Object.keys(extraNodes).forEach((nid) => {
    if (!mergedNodes[nid]) {
      mergedNodes[nid] = extraNodes[nid]
      if (root) expandedFrom.value[nid] = root
    }
  })
  const allNodeIds = new Set(Object.keys(mergedNodes))
  const betweenRelations = getRelationsBetweenNodes(relations.value, allNodeIds)
  const { edges: betweenEdges } = relationsToGraphData(betweenRelations, allNodeIds)

  const totalNodes = Object.keys(mergedNodes).length
  const maxNodes = (getConfig().GRAPH_MAX_NODES ?? 200) | 0
  graphTooLargeWarning.value = maxNodes > 0 && totalNodes > maxNodes

  graphNodes.value = mergedNodes
  graphEdges.value = { ...edges, ...betweenEdges }
  graphBuilt.value = true

  resolveNodeNames(mergedNodes)

  const layoutDef = getConfig().GRAPH_LAYOUT_DEF || 'star'
  nextTick(() => {
    if (ids.length === 1) {
      const centerId = nodeId(type, ids[0])
      analyzerRef.value?.applyLayout(layoutDef, centerId)
    } else {
      analyzerRef.value?.applyLayout('grid')
    }
  })
}

async function resolveNodeNames(nodesObj) {
  const promises = []
  const updates = {}
  for (const nid of Object.keys(nodesObj)) {
    const n = nodesObj[nid]
    if (n.name && !String(n.name).includes(':')) continue
    const p = nid.indexOf(':')
    if (p < 0) continue
    const entityType = nid.slice(0, p)
    const entityId = parseInt(nid.slice(p + 1), 10)
    promises.push(
      fetchEntity(entityType, entityId).then((data) => {
        updates[nid] = data?.display_name || data?.name || data?.code || nid
      })
    )
  }
  await Promise.all(promises)
  if (Object.keys(updates).length > 0) {
    graphNodes.value = { ...graphNodes.value }
    for (const [nid, name] of Object.entries(updates)) {
      if (graphNodes.value[nid]) graphNodes.value[nid] = { ...graphNodes.value[nid], name }
    }
  }
}

function onAddLevel({ nodeId: nid, relationType }) {
  const edges = graphEdges.value
  const incidentNodeIds = new Set([nid])
  const incidentEdgeIds = new Set()
  Object.entries(edges).forEach(([eid, e]) => {
    if (e.source === nid || e.target === nid) {
      incidentEdgeIds.add(eid)
      if (e.source) incidentNodeIds.add(e.source)
      if (e.target) incidentNodeIds.add(e.target)
    }
  })
  hiddenNodeIds.value = new Set([...hiddenNodeIds.value].filter((id) => !incidentNodeIds.has(id)))
  hiddenEdgeIds.value = new Set([...hiddenEdgeIds.value].filter((id) => !incidentEdgeIds.has(id)))

  const prevNodeIds = Object.keys(graphNodes.value)
  const allNodeIds = new Set(prevNodeIds)
  const incident = getIncidentRelations(relations.value, new Set([nid]), relationType || null)
  const { nodes: newNodes, edges: newEdges } = relationsToGraphData(incident, allNodeIds)

  const addedNodeIds = []
  Object.keys(newNodes).forEach((id) => {
    if (!graphNodes.value[id]) addedNodeIds.push(id)
  })

  const nextNodes = { ...graphNodes.value }
  const nextEdges = { ...graphEdges.value }
  let added = false
  Object.entries(newNodes).forEach(([id, node]) => {
    if (!nextNodes[id]) {
      nextNodes[id] = node
      expandedFrom.value[id] = nid
      added = true
    }
  })
  Object.entries(newEdges).forEach(([eid, edge]) => {
    if (!nextEdges[eid]) {
      nextEdges[eid] = edge
      added = true
    }
  })
  const allNodeIdsAfter = new Set(Object.keys(nextNodes))
  const betweenRelations = getRelationsBetweenNodes(relations.value, allNodeIdsAfter)
  const { edges: betweenEdges } = relationsToGraphData(betweenRelations, allNodeIdsAfter)
  Object.assign(nextEdges, betweenEdges)
  graphNodes.value = nextNodes
  graphEdges.value = nextEdges
  if (added) resolveNodeNames(nextNodes)
  nextTick(() => {
    if (addedNodeIds.length > 0) {
      analyzerRef.value?.applyLayoutForAddedLevel?.(nid, addedNodeIds)
    }
    analyzerRef.value?.fitToContents?.()
  })
}

function onLayout(layoutType) {
  analyzerRef.value?.applyLayout(layoutType, rootNodeId.value || null)
}

function onHideNode(nodeId) {
  hiddenNodeIds.value = new Set(hiddenNodeIds.value).add(nodeId)
}

function onHideEdge(edgeId) {
  hiddenEdgeIds.value = new Set(hiddenEdgeIds.value).add(edgeId)
}

function resetGraph() {
  graphBuilt.value = false
  graphNodes.value = {}
  graphEdges.value = {}
  rootNodeId.value = null
  expandedFrom.value = {}
  hiddenNodeIds.value = new Set()
  hiddenEdgeIds.value = new Set()
  collapsedSystemNodeIds.value = []
  selectedIds.value = []
}
</script>

<style scoped>
.picker-card {
  padding: 1.25rem;
  max-width: 640px;
}
.picker-hint {
  margin: 0 0 1rem;
  color: var(--ar-muted);
  font-size: 0.9rem;
}
.picker-row {
  margin-bottom: 1rem;
}
.picker-label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.35rem;
  color: var(--ar-text);
}
.picker-search {
  width: 100%;
  max-width: 320px;
  margin-bottom: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: var(--ar-radius-sm);
  border: 1px solid var(--ar-border);
  font-size: 0.9rem;
  background: var(--ar-surface);
}
.picker-select {
  padding: 0.5rem 0.75rem;
  border-radius: var(--ar-radius-sm);
  border: 1px solid var(--ar-border);
  font-size: 0.9rem;
  min-width: 220px;
  background: var(--ar-surface);
}
.picker-list-wrap {
  max-height: 280px;
  overflow-y: auto;
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  padding: 0.5rem;
  background: var(--ar-table-head-bg);
}
.picker-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.picker-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.9rem;
}
.picker-item input {
  flex-shrink: 0;
}
.loading-inline,
.empty-inline {
  margin: 0;
  padding: 0.5rem;
  color: var(--ar-muted);
  font-size: 0.9rem;
}
.picker-actions {
  margin-top: 1rem;
}
.graph-actions {
  margin-bottom: 0.75rem;
}
.graph-warning {
  margin-bottom: 0.5rem;
  color: #b45309;
  font-size: 0.9rem;
}
</style>

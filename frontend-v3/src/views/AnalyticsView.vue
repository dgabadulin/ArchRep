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
        @toggle-relations="onToggleRelations"
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
import { useRoute, useRouter } from 'vue-router'
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
  bundleIntegrationFlowEdges,
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
/** Активные типы связи у узла для пошагового раскрытия (C2): '__all__' или Set<relation_type>. */
const activeRelationTypesAtNode = ref({})
const ALL_RELATION_TYPES = '__all__'
/** Узлы system:id, для которых на графе свернуты модули (issue #48) */
const collapsedSystemNodeIds = ref([])
const analyzerRef = ref(null)
const pickerSearch = ref('')

/**
 * Лимит идентификаторов в диплинке — параметр `SYS_AI_FOCUS_MAX_IDS` (issue #91), тот же, что у `maxItems`
 * у `focusIds` в `backend/ai/tools.js`. Дефолт 50 — согласован с официальным сидом параметра.
 */
const DEEPLINK_MAX_IDS = (Number(getConfig().SYS_AI_FOCUS_MAX_IDS) || 50) | 0

const route = useRoute()
const router = useRouter()

/**
 * Разбор диплинка `?entity=<код типа>&ids=<csv id>` — контракт действия `open_view` ИИ-архитектора
 * при открытии экрана с фокусом (docs/ai-architect.md §7). Смысл тот же, что и у ручного сценария:
 * отметить объекты в списке и построить граф. Битые значения молча игнорируются.
 */
function parseDeepLinkFocus() {
  const entity = String(route.query.entity ?? '').trim()
  const raw = String(route.query.ids ?? '').trim()
  if (!entity || !raw) return { entity: '', ids: [] }
  const ids = []
  for (const part of raw.split(',')) {
    const n = Number.parseInt(part.trim(), 10)
    if (Number.isInteger(n) && n > 0 && !ids.includes(n)) ids.push(n)
    if (ids.length >= DEEPLINK_MAX_IDS) break
  }
  return { entity, ids }
}

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

function isEdgeVisible(edgeId, source, target, hiddenNodes = hiddenNodeIds.value, hiddenEdges = hiddenEdgeIds.value) {
  if (hiddenEdges.has(edgeId)) return false
  if (hiddenNodes.has(source) || hiddenNodes.has(target)) return false
  if (showAllEdgesCascade.value) return true
  const root = rootNodeId.value
  if (!root) return true
  const exp = expandedFrom.value
  if (source === root || target === root) return true
  if (exp[source] === target || exp[target] === source) return true
  return false
}

/** Есть ли у узла хотя бы одно видимое ребро к другому не скрытому узлу. */
function nodeHasVisibleEdgeToOtherNode(nid, hiddenNodes, hiddenEdges) {
  for (const [eid, e] of Object.entries(graphEdges.value)) {
    if (!e) continue
    if (!isEdgeVisible(eid, e.source, e.target, hiddenNodes, hiddenEdges)) continue
    if (e.source !== nid && e.target !== nid) continue
    const other = e.source === nid ? e.target : e.source
    if (other && other !== nid && !hiddenNodes.has(other)) return true
  }
  return false
}

/** Скрыть узлы без видимых связей с остальным графом (каскадно). */
function pruneOrphanVisibleNodes(...preserveNodeIds) {
  const preserve = new Set(preserveNodeIds.filter(Boolean))
  if (rootNodeId.value) preserve.add(rootNodeId.value)

  let changed = true
  while (changed) {
    changed = false
    const nextHiddenNodes = new Set(hiddenNodeIds.value)
    const hiddenEdges = hiddenEdgeIds.value
    for (const nid of Object.keys(graphNodes.value)) {
      if (nextHiddenNodes.has(nid)) continue
      if (preserve.has(nid)) continue
      if (!nodeHasVisibleEdgeToOtherNode(nid, nextHiddenNodes, hiddenEdges)) {
        nextHiddenNodes.add(nid)
        changed = true
      }
    }
    if (changed) hiddenNodeIds.value = nextHiddenNodes
  }
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

const analyzerPresentation = computed(() => {
  const collapsed = applyModuleCollapse({
    nodes: visibleNodes.value,
    edges: visibleEdges.value,
    collapsedSystemNodeIds: collapsedSystemNodeIds.value,
    subsystemToParentSystem: subsystemParentMap.value,
    collapsedSystemIcon: getConfig().GRAPH_COLLAPSED_SYSTEM_ICON || 'MonitorDot',
  })
  const maxVisible = (getConfig().GRAPH_INTEGRATION_FLOW_VISIBLE_MAX ?? 10) | 0
  return {
    nodes: collapsed.nodes,
    edges: bundleIntegrationFlowEdges(collapsed.edges, { threshold: maxVisible }),
  }
})

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
  'system', 'web_resource', 'domain', 'subsystem', 'technology', 'organization_unit', 'actor', 'employee',
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
  // Диплинк (`open_view` с фокусом, docs/ai-architect.md §7): тип фокуса выставляем ДО первой загрузки
  // списка объектов, иначе `watch(selectedEntityType)` продублирует запрос.
  const focus = parseDeepLinkFocus()
  if (focus.entity && entityTypes.value.some((e) => e.code === focus.entity)) {
    suppressListReload = true
    selectedEntityType.value = focus.entity
  } else if (entityTypes.value.length && !selectedEntityType.value) {
    selectedEntityType.value = entityTypes.value[0].code
  }
  await loadRelationsList()
  suppressListReload = false
  relations.value = await loadAllRelations()
  await applyDeepLinkFocus()
})

/**
 * Применить фокус диплинка (`?entity=&ids=`) к экрану, который **уже открыт**.
 *
 * `onMounted` при переходе из карточки ИИ на открытый «Анализ зависимостей» не выполняется: Vue Router
 * переиспользует компонент, меняется только query — без этой функции граф не строился (клик по кнопке
 * выглядел «нерабочим»). Тип и список объектов перезагружаются только если тип фокуса отличается;
 * повторный вызов с тем же `selectedEntityType` переиспользует уже загруженные связи.
 */
async function applyDeepLinkFocus() {
  const focus = parseDeepLinkFocus()
  if (!focus.entity || !focus.ids.length) return
  if (!entityTypes.value.some((e) => e.code === focus.entity)) return
  if (selectedEntityType.value !== focus.entity) {
    suppressListReload = true
    selectedEntityType.value = focus.entity
    try {
      await loadRelationsList()
    } finally {
      suppressListReload = false
    }
  }
  if (!relations.value.length) relations.value = await loadAllRelations()
  buildGraphWithIds(focus.ids)
}

/**
 * Фокус приходит только query-параметрами, поэтому достаточно следить за ними: «Новый граф» очищает
 * query (`resetGraph`) и наблюдатель молча выходит, а F5 и прямой переход обрабатывает `onMounted`.
 */
watch(
  () => `${route.query.entity ?? ''}|${route.query.ids ?? ''}`,
  () => {
    void applyDeepLinkFocus()
  },
)

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

/**
 * Пока `true` — смена типа сущности не перезагружает список объектов: диплинк грузит его сам, один раз.
 * Флаг живёт только внутри `onMounted`, поэтому ручная смена типа в пикере не затрагивается.
 */
let suppressListReload = false

watch(selectedEntityType, () => {
  if (suppressListReload) return
  if (!entityTypes.value.some((e) => e.code === selectedEntityType.value)) return
  loadRelationsList()
})

function buildGraph() {
  const type = selectedEntityType.value
  const ids = [...selectedIds.value]
  if (!type || ids.length === 0) return

  hiddenNodeIds.value = new Set()
  hiddenEdgeIds.value = new Set()
  activeRelationTypesAtNode.value = {}
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

/**
 * Фокус диплинка: отметить переданные объекты и сразу построить граф — то же самое, что пользователь
 * делает руками в пикере. Идентификаторы, которых нет в текущем списке (например, модуль при
 * `entity=system`, где список идёт с `exclude_modules: true`), не отбрасываем: имя узла подтянет
 * `resolveNodeNames`.
 */
function buildGraphWithIds(ids) {
  selectedIds.value = [...ids]
  buildGraph()
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

function edgeMatchesRelationFilter(edge, relationType) {
  if (relationType == null) return true
  return String(edge?.relationType || '') === relationType
}

function incidentRelationTypeCodesForNode(nid) {
  const codes = new Set()
  for (const r of relations.value || []) {
    if (!r) continue
    const fromId = `${r.from_entity_type}:${r.from_entity_id}`
    const toId = `${r.to_entity_type}:${r.to_entity_id}`
    if (fromId !== nid && toId !== nid) continue
    const code = String(r.relation_type || '').trim()
    if (code) codes.add(code)
  }
  return codes
}

function setActiveRelationTypesAtNode(nid, value) {
  const next = { ...activeRelationTypesAtNode.value }
  if (value == null) delete next[nid]
  else next[nid] = value
  activeRelationTypesAtNode.value = next
}

function addActiveRelationType(nid, relationType) {
  if (relationType == null) {
    setActiveRelationTypesAtNode(nid, ALL_RELATION_TYPES)
    return
  }
  const prev = activeRelationTypesAtNode.value[nid]
  if (prev === ALL_RELATION_TYPES) return
  const set = prev instanceof Set ? new Set(prev) : new Set()
  set.add(relationType)
  setActiveRelationTypesAtNode(nid, set)
}

function removeActiveRelationType(nid, relationType) {
  if (relationType == null) {
    setActiveRelationTypesAtNode(nid, null)
    return
  }
  const prev = activeRelationTypesAtNode.value[nid]
  if (prev === ALL_RELATION_TYPES) {
    const codes = incidentRelationTypeCodesForNode(nid)
    codes.delete(relationType)
    setActiveRelationTypesAtNode(nid, codes.size ? codes : null)
    return
  }
  if (!(prev instanceof Set)) {
    setActiveRelationTypesAtNode(nid, null)
    return
  }
  const set = new Set(prev)
  set.delete(relationType)
  setActiveRelationTypesAtNode(nid, set.size ? set : null)
}

function edgeMatchesActiveTypesAtNode(nid, relationTypeCode) {
  const active = activeRelationTypesAtNode.value[nid]
  if (!active) return false
  if (active === ALL_RELATION_TYPES) return true
  return active instanceof Set && active.has(relationTypeCode)
}

function relayoutHubForNode(nid, nodesToPlaceOnRing = []) {
  nextTick(() => {
    if (nodesToPlaceOnRing.length > 0) {
      const parentStarCenterId = expandedFrom.value[nid] || rootNodeId.value || null
      analyzerRef.value?.relayoutHubAroundNode?.(nid, nodesToPlaceOnRing, {
        parentStarCenterId,
        rootNodeId: rootNodeId.value,
      })
    }
    analyzerRef.value?.fitToContents?.()
  })
}

function hideRelationsAtNode(nid, relationType) {
  removeActiveRelationType(nid, relationType)
  const nextHidden = new Set(hiddenEdgeIds.value)
  for (const [eid, e] of Object.entries(graphEdges.value)) {
    if (!e) continue
    if (e.source !== nid && e.target !== nid) continue
    if (!edgeMatchesRelationFilter(e, relationType)) continue
    nextHidden.add(eid)
  }
  hiddenEdgeIds.value = nextHidden
  pruneOrphanVisibleNodes(nid)
  nextTick(() => analyzerRef.value?.fitToContents?.())
}

function expandRelationsAtNode(nid, relationType) {
  const visibleBefore = new Set(
    Object.keys(graphNodes.value).filter((id) => !hiddenNodeIds.value.has(id))
  )
  addActiveRelationType(nid, relationType)
  const edges = graphEdges.value
  const incidentNodeIds = new Set([nid])
  const incidentEdgeIds = new Set()
  Object.entries(edges).forEach(([eid, e]) => {
    if (!e) return
    if (e.source !== nid && e.target !== nid) return
    if (!edgeMatchesRelationFilter(e, relationType)) return
    incidentEdgeIds.add(eid)
    if (e.source) incidentNodeIds.add(e.source)
    if (e.target) incidentNodeIds.add(e.target)
  })
  hiddenNodeIds.value = new Set([...hiddenNodeIds.value].filter((id) => !incidentNodeIds.has(id)))
  hiddenEdgeIds.value = new Set([...hiddenEdgeIds.value].filter((id) => !incidentEdgeIds.has(id)))

  const allNodeIds = new Set(Object.keys(graphNodes.value))
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
  // «Все типы»: дополнительно все связи между уже показанными узлами.
  // Один тип: только инцидентные связи выбранного relation_type (без «добора» других типов с теми же От/К).
  if (relationType == null) {
    const allNodeIdsAfter = new Set(Object.keys(nextNodes))
    const betweenRelations = getRelationsBetweenNodes(relations.value, allNodeIdsAfter)
    const { edges: betweenEdges } = relationsToGraphData(betweenRelations, allNodeIdsAfter)
    Object.assign(nextEdges, betweenEdges)
  }
  graphNodes.value = nextNodes
  graphEdges.value = nextEdges
  const nodesToPlaceOnRing = Object.keys(nextNodes).filter(
    (id) => id !== nid && !hiddenNodeIds.value.has(id) && !visibleBefore.has(id)
  )
  if (added) resolveNodeNames(nextNodes)
  relayoutHubForNode(nid, nodesToPlaceOnRing)
}

function onToggleRelations({ nodeId: nid, relationType, show }) {
  if (!nid) return
  if (show) expandRelationsAtNode(nid, relationType)
  else hideRelationsAtNode(nid, relationType)
}

function onLayout(layoutType) {
  analyzerRef.value?.applyLayout(layoutType, rootNodeId.value || null)
}

function onHideNode(nodeId) {
  hiddenNodeIds.value = new Set(hiddenNodeIds.value).add(nodeId)
  pruneOrphanVisibleNodes()
  nextTick(() => analyzerRef.value?.fitToContents?.())
}

function onHideEdge(edgeId) {
  const next = new Set(hiddenEdgeIds.value)
  const edge = analyzerGraphEdges.value[edgeId]
  if (edge?.bundled && edge.memberRelationIds?.length) {
    for (const rid of edge.memberRelationIds) {
      next.add(`rel-${rid}`)
    }
  } else {
    next.add(edgeId)
  }
  hiddenEdgeIds.value = next
  pruneOrphanVisibleNodes()
  nextTick(() => analyzerRef.value?.fitToContents?.())
}

function resetGraph() {
  graphBuilt.value = false
  graphNodes.value = {}
  graphEdges.value = {}
  rootNodeId.value = null
  expandedFrom.value = {}
  hiddenNodeIds.value = new Set()
  hiddenEdgeIds.value = new Set()
  activeRelationTypesAtNode.value = {}
  collapsedSystemNodeIds.value = []
  selectedIds.value = []
  // Сбрасываем и диплинк-фокус в URL: иначе F5 после «Нового графа» вернул бы прежний граф.
  if (route.query.entity || route.query.ids) router.replace({ path: route.path })
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

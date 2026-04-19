/**
 * Слой поверх API метамодели для графа зависимостей (Анализатор).
 * Загружает связи, типы сущностей/связей и разрешает сущности по (entity_type, entity_id).
 */
import { api } from './client'
import { togafApi } from './index'
import { nodeId } from '../utils/entityTypeConfig'

const entityFetchers = {
  system: (id) => api.getSystem(String(id)),
  subsystem: (id) => api.getSystem(String(id)),
  system_child: (id) => api.getSystem(String(id)),
  technology: (id) => api.getTechnology(String(id)),
  organization_unit: (id) => togafApi.organizationUnit(id),
  actor: (id) => togafApi.actor(id),
  business_service: (id) => togafApi.businessService(id),
  business_function: (id) => togafApi.businessFunction(id),
  principle: (id) => api.getPrinciple(String(id)),
  gap: (id) => api.getGap(String(id)),
}

const listFetchers = {
  system: (params) => api.getSystems(params),
  subsystem: (params) => api.getSystems(params),
  technology: (params) => api.getTechnologies(params),
  organization_unit: (params) => togafApi.organizationUnits(params),
  actor: (params) => togafApi.actors(params),
  business_service: (params) => togafApi.businessServices(params),
  business_function: (params) => togafApi.businessFunctions(params),
  principle: (params) => api.getPrinciples(params),
  gap: (params) => api.getGaps(params),
}

/**
 * Загрузить все связи метамодели (с опциональным поиском).
 */
export async function loadRelations(params = {}) {
  return togafApi.relations(params)
}

/**
 * @deprecated Интеграции для графа берутся только из метамодели (проекции ar_integration_flows, issue #56).
 * Оставлено для совместимости импортов; возвращает пустой массив.
 */
export async function loadIntegrationFlowsAsRelations() {
  return []
}

/**
 * Загрузить все связи для графа: метамодель (включая проекции интеграционных потоков и system_technology).
 * Отдельный вызов /api/integration-flows не используется — дубли и рассинхрон с типами концов исключены (issue #56).
 */
export async function loadAllRelations(params = {}) {
  const metamodel = await togafApi.relations(params)
  return (metamodel || []).map((r) => ({ ...r, id: r.id }))
}

/**
 * Загрузить типы сущностей и типы связей.
 */
export async function loadMetamodelRefs() {
  const [entityTypes, relationTypes] = await Promise.all([
    togafApi.entityTypes(),
    togafApi.relationTypes(),
  ])
  return { entityTypes, relationTypes }
}

/**
 * Получить данные сущности по типу и id (для подписи и модалки просмотра).
 * Возвращает объект с полями сущности или { id, name: '—', _error } при ошибке.
 */
export async function fetchEntity(entityType, entityId) {
  const fn = entityFetchers[entityType]
  if (!fn) return { id: entityId, name: '—', _error: 'Unknown type' }
  try {
    const data = await fn(entityId)
    const d = data || { id: entityId, name: '—' }
    if (!d.name && d.display_name) d.name = d.display_name
    if (d.display_name) d.name = d.display_name
    return d
  } catch (e) {
    return { id: entityId, name: '—', _error: e.message || 'Ошибка загрузки' }
  }
}

/**
 * Загрузить список сущностей одного типа (для выбора объектов).
 */
export async function loadEntityList(entityType, params = {}) {
  const fn = listFetchers[entityType]
  if (!fn) return []
  try {
    const list = await fn(params)
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

/** Подпись связи: displayed_name → name → имя типа из справочника (relation_type_name с бэка) → код типа (issue #33). */
export function relationDisplayName(r) {
  if (!r) return ''
  const d = String(r.displayed_name ?? '').trim()
  if (d) return d
  const n = String(r.name ?? '').trim()
  if (n) return n
  const tn = String(r.relation_type_name ?? '').trim()
  if (tn) return tn
  return String(r.relation_type ?? '')
}

/**
 * Преобразовать массив связей из API в узлы и рёбра для v-network-graph.
 * nodes: { [nodeId]: { name, entityType, entityId, ...payload } }
 * edges: { [edgeId]: { source, target, relationType, name } }
 * Также возвращает Set nodeIds для быстрой проверки.
 */
export function relationsToGraphData(relations, existingNodeIds = new Set()) {
  const nodes = {}
  const edges = {}
  const nodeIds = new Set(existingNodeIds)

  for (const r of relations || []) {
    const fromId = nodeId(r.from_entity_type, r.from_entity_id)
    const toId = nodeId(r.to_entity_type, r.to_entity_id)
    if (!nodeIds.has(fromId)) {
      nodeIds.add(fromId)
      nodes[fromId] = {
        name: `${r.from_entity_type}:${r.from_entity_id}`,
        entityType: r.from_entity_type,
        entityId: r.from_entity_id,
      }
    }
    if (!nodeIds.has(toId)) {
      nodeIds.add(toId)
      nodes[toId] = {
        name: `${r.to_entity_type}:${r.to_entity_id}`,
        entityType: r.to_entity_type,
        entityId: r.to_entity_id,
      }
    }
    const edgeId = `rel-${r.id}`
    const label = relationDisplayName(r)
    edges[edgeId] = {
      source: fromId,
      target: toId,
      relationType: r.relation_type,
      name: label,
      relationId: r.id,
    }
  }
  return { nodes, edges, nodeIds }
}

/**
 * Найти связи, инцидентные заданным узлам (from или to совпадает с nodeId).
 * relationTypeFilter — опционально, один тип связи или массив типов.
 */
export function getIncidentRelations(relations, nodeIdsSet, relationTypeFilter = null) {
  const allowType = relationTypeFilter == null
    ? () => true
    : Array.isArray(relationTypeFilter)
      ? (t) => relationTypeFilter.includes(t)
      : (t) => t === relationTypeFilter
  return (relations || []).filter((r) => {
    const fromId = nodeId(r.from_entity_type, r.from_entity_id)
    const toId = nodeId(r.to_entity_type, r.to_entity_id)
    if (!nodeIdsSet.has(fromId) && !nodeIdsSet.has(toId)) return false
    return allowType(r.relation_type)
  })
}

/**
 * Найти связи, у которых оба конца принадлежат заданному множеству узлов.
 * Используется для отображения всех рёбер между уже присутствующими на графе узлами.
 */
export function getRelationsBetweenNodes(relations, nodeIdsSet) {
  return (relations || []).filter((r) => {
    const fromId = nodeId(r.from_entity_type, r.from_entity_id)
    const toId = nodeId(r.to_entity_type, r.to_entity_id)
    return nodeIdsSet.has(fromId) && nodeIdsSet.has(toId)
  })
}

/**
 * Карта «модуль (subsystem) → родительская ИС (system)» по связям метамодели `system_module`
 * (from_entity_type=subsystem, to_entity_type=system).
 * @param {Array} relations — полный список связей метамодели
 * @returns {Record<string, string>} например { 'subsystem:42': 'system:34' }
 */
export function buildSubsystemParentSystemMap(relations) {
  /** @type {Record<string, string>} */
  const map = {}
  for (const r of relations || []) {
    if (r.relation_type !== 'system_module') continue
    if (r.from_entity_type !== 'subsystem' || r.to_entity_type !== 'system') continue
    map[nodeId('subsystem', r.from_entity_id)] = nodeId('system', r.to_entity_id)
  }
  return map
}

/**
 * Свертка модулей в узел родительской ИС (issue #48): скрыть модули, убрать рёбра system↔module,
 * перенаправить остальные инцидентные рёбра модулей на систему.
 * Рёбра с одинаковой подписью (name || relationType) между той же парой узлов сливаются в одно;
 * с разными подписями — несколько рёбер.
 *
 * @param {{ nodes: Record<string, object>, edges: Record<string, object>, collapsedSystemNodeIds: string[], subsystemToParentSystem: Record<string, string>, collapsedSystemIcon?: string }} opts
 */
export function applyModuleCollapse(opts) {
  const {
    nodes,
    edges,
    collapsedSystemNodeIds = [],
    subsystemToParentSystem = {},
    collapsedSystemIcon = 'MonitorDot',
  } = opts
  const collapsed = new Set(collapsedSystemNodeIds)
  if (collapsed.size === 0) {
    return { nodes: { ...nodes }, edges: { ...edges } }
  }

  const mapEndpoint = (nid) => {
    const parent = subsystemToParentSystem[nid]
    if (parent && collapsed.has(parent)) return parent
    return nid
  }

  const modulesToHide = new Set()
  for (const nid of Object.keys(nodes)) {
    const parent = subsystemToParentSystem[nid]
    if (parent && collapsed.has(parent) && nid.startsWith('subsystem:')) {
      modulesToHide.add(nid)
    }
  }

  const nodesOut = { ...nodes }
  for (const m of modulesToHide) {
    delete nodesOut[m]
  }

  const icon = String(collapsedSystemIcon || 'MonitorDot').trim() || 'MonitorDot'
  for (const sid of collapsed) {
    if (nodesOut[sid]) {
      nodesOut[sid] = { ...nodesOut[sid], iconOverride: icon }
    }
  }

  /** @type {Record<string, true>} */
  const seenBucket = {}
  const edgesOut = {}

  for (const [eid, e] of Object.entries(edges)) {
    const ns = mapEndpoint(e.source)
    const nt = mapEndpoint(e.target)
    if (ns === nt) continue
    const label = String(e.name ?? e.relationType ?? '').trim()
    const bk = `${ns}\0${nt}\0${label}`
    if (seenBucket[bk]) continue
    seenBucket[bk] = true
    edgesOut[eid] = { ...e, source: ns, target: nt }
  }

  return { nodes: nodesOut, edges: edgesOut }
}

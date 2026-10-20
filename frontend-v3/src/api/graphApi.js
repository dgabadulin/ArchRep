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
  web_resource: async (id) => {
    const d = await togafApi.webResource(id)
    return { ...d, name: d.display_name || d.short_name || d.code || '—' }
  },
  domain: async (id) => {
    const d = await togafApi.domain(id)
    return { ...d, name: d.display_name || d.name || '—' }
  },
  certificate: async (id) => {
    const d = await api.getCertificate(String(id))
    return { ...d, name: d.display_name || d.code || '—' }
  },
  employee: (id) => api.getEmployee(String(id)),
  partner: (id) => api.getPartner(String(id)),
  system_function: (id) => api.getSystemFunction(String(id)),
  adr_principle: async (id) => {
    const d = await api.getDecisionPrinciple(String(id))
    return { ...d, name: d.name || d.code || '—' }
  },
  applied: async (id) => {
    const d = await api.getDecisionApplied(String(id))
    return { ...d, name: d.task_name || d.code || '—' }
  },
}

const listFetchers = {
  system: (params) => api.getSystems(params),
  subsystem: (params) => api.getSystems(params),
  system_child: (params) => api.getSystems(params),
  technology: (params) => api.getTechnologies(params),
  organization_unit: (params) => togafApi.organizationUnits(params),
  actor: (params) => togafApi.actors(params),
  business_service: (params) => togafApi.businessServices(params),
  business_function: (params) => togafApi.businessFunctions(params),
  principle: (params) => api.getPrinciples(params),
  gap: (params) => api.getGaps(params),
  web_resource: (params) => togafApi.webResources(params),
  domain: (params) => togafApi.domains(params),
  certificate: (params) => api.getCertificates(params),
  employee: (params) => api.getEmployees(params),
  partner: (params) => api.getPartners(params),
  system_function: (params) => api.getSystemFunctionsGlobal(params),
  adr_principle: (params) => api.getDecisionsPrinciple(params),
  applied: (params) => api.getDecisionsApplied(params),
  integration_flow: (params) => api.getIntegrationFlows(params),
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

/** Типы связей метамодели — проекции из ar_integration_flows (issues #33, #56). */
export const INTEGRATION_FLOW_METAMODEL_RELATION_TYPES = new Set([
  'integration_flow',
  'integration_flow_system_module',
  'integration_flow_module_system',
  'integration_flow_module_module',
])

/**
 * Сворачивает пучки интеграционных потоков между одной парой узлов (from → to).
 * Если потоков больше threshold — одно ребро с подписью «N потоков передачи данных».
 *
 * @param {Record<string, object>} edges
 * @param {{ threshold?: number, relationTypes?: Set<string> }} [options]
 */
export function bundleIntegrationFlowEdges(edges, options = {}) {
  const threshold = Math.max(1, Number(options.threshold) || 10) | 0
  const flowTypes = options.relationTypes || INTEGRATION_FLOW_METAMODEL_RELATION_TYPES

  /** @type {Array<[string, object]>} */
  const integrationItems = []
  const edgesOut = {}

  for (const [eid, e] of Object.entries(edges || {})) {
    const rt = String(e?.relationType || '').trim()
    if (flowTypes.has(rt)) {
      integrationItems.push([eid, e])
    } else {
      edgesOut[eid] = e
    }
  }

  /** @type {Record<string, Array<[string, object]>>} */
  const groups = {}
  for (const [eid, e] of integrationItems) {
    const key = `${e.source}\0${e.target}`
    if (!groups[key]) groups[key] = []
    groups[key].push([eid, e])
  }

  for (const [key, items] of Object.entries(groups)) {
    if (items.length <= threshold) {
      for (const [eid, e] of items) edgesOut[eid] = e
      continue
    }
    const sep = key.indexOf('\0')
    const source = key.slice(0, sep)
    const target = key.slice(sep + 1)
    const memberRelationIds = items.map(([eid, e]) => {
      if (e.relationId != null) return e.relationId
      const m = /^rel-(\d+)$/.exec(eid)
      return m ? Number(m[1]) : null
    }).filter((id) => id != null)
    const bundleId = `bundle-${source}-${target}`
    edgesOut[bundleId] = {
      source,
      target,
      relationType: 'integration_flow',
      name: `${items.length} потоков передачи данных`,
      bundled: true,
      bundleKey: key,
      memberRelationIds,
      memberCount: items.length,
    }
  }

  return edgesOut
}

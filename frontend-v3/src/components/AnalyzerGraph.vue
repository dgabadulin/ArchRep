<template>
  <div class="analyzer-wrap" :class="{ 'analyzer-wrap--embed': isEmbed }" ref="containerRef">
    <div v-if="effectiveShowToolbar" class="toolbar-left">
      <label v-if="showCascadeToggle" class="toolbar-toggle">
        <input type="checkbox" v-model="showAllEdgesCascadeLocal" />
        <span>Показывать связи (каскадно)</span>
      </label>
      <label v-if="legendRows.length" class="toolbar-toggle">
        <input type="checkbox" v-model="showLegend" />
        <span>Показать легенду</span>
      </label>
      <div class="toolbar-layouts">
        <button
          v-for="opt in layoutOptions"
          :key="opt.type"
          type="button"
          class="btn-layout"
          :title="opt.label"
          @click="emit('layout', opt.type)"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>
    <div class="analyzer-graph-wrap" :style="graphWrapStyle">
    <v-network-graph
      ref="graphRef"
      v-model:layouts="layouts"
      v-model:zoom-level="zoomLevel"
      :nodes="nodes"
      :edges="edges"
      :configs="configs"
      :event-handlers="eventHandlers"
      class="analyzer-graph"
    >
      <template #override-node="{ nodeId: nid }">
        <g class="node-custom">
          <rect x="-24" y="-24" width="48" height="48" rx="8" fill="#f8f9fb" stroke="#00c4ae" stroke-width="1" />
          <g transform="translate(-12, -12)">
            <component :is="getIconComponent(nid)" :size="24" stroke-width="1.5" />
          </g>
        </g>
      </template>
      <!-- Подпись в локальных координатах узла (слот внутри transform узла): под rect иконки -->
      <template #override-node-label="{ text, config }">
        <text
          x="0"
          y="26"
          text-anchor="middle"
          dominant-baseline="hanging"
          :font-size="config?.fontSize ?? 12"
          :fill="config?.color ?? '#333'"
        >{{ text }}</text>
      </template>
      <template #edge-label="{ edge, config, area }">
        <v-edge-label
          v-if="(edge.name || edge.relationType)"
          :area="area"
          :config="config"
          :text="edge.name || edge.relationType || ''"
          align="center"
          vertical-align="center"
        />
      </template>
    </v-network-graph>

    <!-- Контекстное меню -->
    <div
      v-if="contextMenu.show && effectiveContextMenu !== 'off'"
      class="context-menu"
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
      ref="contextMenuRef"
    >
      <template v-if="contextMenu.type === 'node'">
        <template v-if="effectiveContextMenu === 'full'">
          <button
            v-if="showCtxCollapseModules"
            type="button"
            class="ctx-item"
            @click="onCtxCollapseModules"
          >
            Свернуть модули в систему
          </button>
          <button
            v-if="showCtxExpandModules"
            type="button"
            class="ctx-item"
            @click="onCtxExpandModules"
          >
            Развернуть модули
          </button>
          <div v-if="showCtxModuleActions" class="ctx-divider" />
          <button type="button" class="ctx-item" @click="onCtxAddLevel(null)">Показать связи (все типы)</button>
          <div class="ctx-divider" />
          <button type="button" class="ctx-item" @click="onCtxHideNode">Скрыть объект</button>
          <div class="ctx-divider" />
        </template>
        <button type="button" class="ctx-item" @click="onCtxView">Просмотр</button>
      </template>
      <template v-else-if="contextMenu.type === 'edge'">
        <template v-if="effectiveContextMenu === 'full'">
          <button type="button" class="ctx-item" @click="onCtxHideEdge">Скрыть объект</button>
          <div class="ctx-divider" />
        </template>
        <button type="button" class="ctx-item" @click="onCtxViewEdge">Просмотр</button>
      </template>
    </div>

    <!-- Модалка просмотра сущности -->
    <div v-if="viewModal.show" class="modal-overlay">
      <div class="modal-card">
        <div class="modal-header">
          <h3>{{ viewModal.title }}</h3>
          <button type="button" class="modal-close" @click="viewModal.show = false">×</button>
        </div>
        <div class="modal-body">
          <pre class="view-json">{{ viewModal.json }}</pre>
        </div>
      </div>
    </div>

    <!-- Экспорт SVG/PNG: в анализаторе вместе с левой панелью; во встройке — по showExportButtons -->
    <div v-if="effectiveShowExportButtons" class="toolbar">
      <button type="button" class="btn-tool" @click="exportSvg" title="Экспорт SVG">SVG</button>
      <button type="button" class="btn-tool" @click="exportPng" title="Экспорт PNG">PNG</button>
    </div>

    <!-- Легенда типов сущностей (метамодель): слева мини-вершина как на графе, справа название типа -->
    <div v-if="showLegend && legendRows.length" class="graph-legend" aria-label="Легенда типов сущностей">
      <div v-for="row in legendRows" :key="row.code" class="legend-row">
        <svg class="legend-node-svg" viewBox="-24 -24 48 48" width="36" height="36" aria-hidden="true">
          <g class="node-custom">
            <rect x="-24" y="-24" width="48" height="48" rx="8" fill="#f8f9fb" stroke="#00c4ae" stroke-width="1" />
            <g transform="translate(-12, -12)">
              <component :is="getIconComponent(row.syntheticNodeId)" :size="24" stroke-width="1.5" />
            </g>
          </g>
        </svg>
        <span class="legend-label">{{ row.label }}</span>
      </div>
    </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { parseNodeId, getEntityTypeConfig } from '../utils/entityTypeConfig'
import { fetchEntity } from '../api/graphApi'
import { getConfig } from '@/config/params'
import { downloadBlob } from '../utils/downloadBlob'
import * as LucideIcons from 'lucide-vue-next'

const iconComponents = {
  Monitor: LucideIcons.Monitor,
  MonitorDot: LucideIcons.MonitorDot,
  Server: LucideIcons.Server,
  Cpu: LucideIcons.Cpu,
  Building2: LucideIcons.Building2,
  User: LucideIcons.User,
  Package: LucideIcons.Package,
  GitBranch: LucideIcons.GitBranch,
  Scale: LucideIcons.Scale,
  Puzzle: LucideIcons.Puzzle,
  AlertTriangle: LucideIcons.AlertTriangle,
  Circle: LucideIcons.Circle,
}

const layoutOptions = [
  { type: 'star', label: 'Звезда' },
  { type: 'ring', label: 'Кольцо' },
  { type: 'extendedStar', label: 'Расш. звезда' },
  { type: 'hierarchy', label: 'Иерархия' },
  { type: 'full', label: 'Полносвязная' },
  { type: 'grid', label: 'Сетка' },
]

const props = defineProps({
  /** Режим анализатора зависимостей или встройка на формах (вкладка «Связи»). */
  variant: {
    type: String,
    default: 'analyzer',
    validator: (v) => v === 'analyzer' || v === 'embed',
  },
  /**
   * Левая панель (каскад, раскладки) и кнопки экспорта SVG/PNG.
   * Если не задано: embed → false, analyzer → true.
   */
  showToolbar: { type: Boolean, default: undefined },
  /**
   * Контекстное меню ПКМ: full — как в анализаторе; minimal — только «Просмотр»; off — отключено.
   * Если не задано: embed → minimal, analyzer → full.
   */
  contextMenu: { type: String, default: undefined },
  /** Высота области графа (например «780px» как в анализаторе). Для embed без значения — ~420px. */
  graphHeight: { type: String, default: undefined },
  /**
   * Кнопки экспорта SVG/PNG. Если не задано: показываются вместе с полной панелью (effectiveShowToolbar).
   * На формах во встройке передайте true, чтобы оставить экспорт без левой панели раскладок.
   */
  showExportButtons: { type: Boolean, default: undefined },
  /**
   * Узел-центр для первичной раскладки «звезда» (nodeId вида gap:12).
   * Имеет смысл в variant=embed при нескольких узлах.
   */
  centerNodeId: { type: String, default: null },
  nodes: { type: Object, default: () => ({}) },
  edges: { type: Object, default: () => ({}) },
  relations: { type: Array, default: () => [] },
  relationTypes: { type: Array, default: () => [] },
  showCascadeToggle: { type: Boolean, default: false },
  showAllEdgesCascade: { type: Boolean, default: false },
  /** Типы сущностей метамодели (как в /api/togaf/entity-types) для легенды; пусто — чекбокс скрыт. */
  legendEntityTypes: { type: Array, default: () => [] },
  /**
   * Анализатор (issue #48): можно ли свернуть модули в эту ИС (ПКМ по узлу system:id).
   * Если не передано — пункт меню не показывается.
   */
  canCollapseModules: { type: Function, default: null },
  /** Анализатор: можно ли развернуть модули (узел уже в режиме свёртки). */
  canExpandModules: { type: Function, default: null },
})

function getIconComponent(nodeId) {
  const node = props.nodes[nodeId]
  if (node?.iconOverride) {
    const o = String(node.iconOverride).trim()
    return iconComponents[o] || LucideIcons[o] || LucideIcons.Circle
  }
  const type = node?.entityType || (nodeId && nodeId.indexOf(':') >= 0 ? nodeId.split(':')[0] : '')
  const config = getEntityTypeConfig(type)
  const name = config.icon || 'Circle'
  return iconComponents[name] || LucideIcons[name] || LucideIcons.Circle
}

/** Список типов из метамодели для легенды (синтетический id «code:0» — только для выбора иконки). */
const legendRows = computed(() => {
  const raw = props.legendEntityTypes
  if (!Array.isArray(raw) || raw.length === 0) return []
  const byCode = new Map()
  for (const et of raw) {
    const code = (et && et.code) ? String(et.code).trim() : ''
    if (!code || byCode.has(code)) continue
    byCode.set(code, {
      code,
      label: (et.display_name || et.name || code).trim() || code,
      syntheticNodeId: `${code}:0`,
    })
  }
  return [...byCode.values()].sort((a, b) => a.label.localeCompare(b.label, 'ru'))
})

const isEmbed = computed(() => props.variant === 'embed')

const effectiveShowToolbar = computed(() =>
  props.showToolbar !== undefined ? props.showToolbar : !isEmbed.value
)

/** @type {import('vue').ComputedRef<'full'|'minimal'|'off'>} */
const effectiveContextMenu = computed(() => {
  if (props.contextMenu === 'full' || props.contextMenu === 'minimal' || props.contextMenu === 'off') {
    return props.contextMenu
  }
  return isEmbed.value ? 'minimal' : 'full'
})

const graphWrapStyle = computed(() => {
  if (props.graphHeight) return { height: props.graphHeight }
  if (isEmbed.value) return { height: '420px' }
  return {}
})

const effectiveShowExportButtons = computed(() => {
  if (props.showExportButtons === true) return true
  if (props.showExportButtons === false) return false
  return effectiveShowToolbar.value
})

const emit = defineEmits([
  'add-level',
  'layout',
  'hide-node',
  'hide-edge',
  'update:showAllEdgesCascade',
  'collapse-modules',
  'expand-modules',
])

const showCtxCollapseModules = computed(() => {
  const n = contextMenu.value.node
  return (
    isEmbed.value === false &&
    effectiveContextMenu.value === 'full' &&
    typeof props.canCollapseModules === 'function' &&
    n &&
    props.canCollapseModules(n)
  )
})

const showCtxExpandModules = computed(() => {
  const n = contextMenu.value.node
  return (
    isEmbed.value === false &&
    effectiveContextMenu.value === 'full' &&
    typeof props.canExpandModules === 'function' &&
    n &&
    props.canExpandModules(n)
  )
})

const showCtxModuleActions = computed(() => showCtxCollapseModules.value || showCtxExpandModules.value)

const showAllEdgesCascadeLocal = computed({
  get: () => props.showAllEdgesCascade,
  set: (v) => emit('update:showAllEdgesCascade', v),
})

const showLegend = ref(false)

const containerRef = ref(null)
const graphRef = ref(null)
const contextMenuRef = ref(null)
const layouts = ref({ nodes: {} })
const zoomLevel = ref(1)

/** Последняя выбранная раскладка (для размещения вновь показанных модулей). */
const lastLayoutType = ref('grid')
/** Центр для star / hierarchy / extendedStar (как в computeLayoutNodes). */
const lastLayoutCenterId = ref(null)

/** Минимум между центрами узлов: 48×48 + подпись снизу + зазор (см. #override-node-label). */
const GRAPH_NODE_MIN_CENTER_DIST = 92

const configs = computed(() => ({
  view: {
    autoPanAndZoomOnLoad: 'fit-content',
    fitContentMargin: 40,
    panEnabled: true,
    zoomEnabled: true,
    minZoomLevel: 0.1,
  },
  node: {
    normal: {
      type: 'rect',
      width: 48,
      height: 48,
      borderRadius: 8,
      color: '#f8f9fb',
      strokeWidth: 1,
      strokeColor: '#00c4ae',
    },
    label: {
      visible: true,
      direction: 'south',
      margin: 10,
      fontSize: 12 / Math.max(0.1, zoomLevel.value),
      text: (node) => node?.name ?? '',
    },
    draggable: !isEmbed.value,
  },
  edge: {
    normal: { width: 2, color: '#8b9a6b' },
    type: 'curve',
    gap: 12,
    marker: {
      source: { type: 'none' },
      target: { type: 'arrow', width: 6, height: 6, margin: 0, units: 'userSpaceOnUse' },
    },
    margin: 24 * zoomLevel.value,
    label: {
      visible: true,
      margin: 4,
      padding: 8,
      fontSize: (getConfig().GRAPH_EDGE_FONTSZ ?? 10) | 0,
      text: (edge) => edge.name || edge.relationType || '',
    },
  },
}))

const contextMenu = ref({
  show: false,
  type: null,
  node: null,
  edge: null,
  x: 0,
  y: 0,
})

const viewModal = ref({
  show: false,
  title: '',
  json: '',
})

const eventHandlers = computed(() => {
  if (effectiveContextMenu.value === 'off') return {}
  return {
    'node:contextmenu': ({ node, event }) => {
      event.preventDefault()
      contextMenu.value = {
        show: true,
        type: 'node',
        node,
        edge: null,
        x: event.clientX,
        y: event.clientY,
      }
    },
    'edge:contextmenu': ({ edge, event }) => {
      event.preventDefault()
      contextMenu.value = {
        show: true,
        type: 'edge',
        node: null,
        edge: Array.isArray(edge) ? edge[0] : edge,
        x: event.clientX,
        y: event.clientY,
      }
    },
  }
})

function closeContextMenu() {
  contextMenu.value.show = false
}

function onCtxCollapseModules() {
  const nid = contextMenu.value.node
  if (nid) emit('collapse-modules', nid)
  closeContextMenu()
}

function onCtxExpandModules() {
  const nid = contextMenu.value.node
  if (nid) emit('expand-modules', nid)
  closeContextMenu()
}

function onCtxAddLevel(relationType) {
  if (contextMenu.value.node) emit('add-level', { nodeId: contextMenu.value.node, relationType })
  closeContextMenu()
}

function onCtxHideNode() {
  const nid = contextMenu.value.node
  if (nid) emit('hide-node', nid)
  closeContextMenu()
}

function onCtxHideEdge() {
  const eid = contextMenu.value.edge
  if (eid) emit('hide-edge', eid)
  closeContextMenu()
}

async function onCtxView() {
  const nodeIdStr = contextMenu.value.node
  if (!nodeIdStr) { closeContextMenu(); return }
  const p = parseNodeId(nodeIdStr)
  closeContextMenu()
  if (!p) return
  const data = await fetchEntity(p.entityType, p.entityId)
  const title = `${p.entityType} : ${p.entityId}`
  viewModal.value = {
    show: true,
    title,
    json: JSON.stringify(data, null, 2),
  }
}

function onCtxViewEdge() {
  const edgeId = contextMenu.value.edge
  if (!edgeId) { closeContextMenu(); return }
  const edge = props.edges[edgeId]
  closeContextMenu()
  viewModal.value = {
    show: true,
    title: `Связь: ${edgeId}`,
    json: JSON.stringify(edge || {}, null, 2),
  }
}

/** Минимальная длина ребра по подписям (в единицах графа). ~6 ед. на символ при fontSize 10 + отступ + 48 под узел. */
function getMinEdgeLengthForLabels(edgesObj) {
  let maxChars = 0
  for (const e of Object.values(edgesObj || {})) {
    const text = (e.name || e.relationType || '').toString()
    // Для многострочной подписи учитываем самую длинную строку.
    const lines = text.split(/\r?\n|\/n/g)
    for (const ln of lines) {
      const len = ln.length
      if (len > maxChars) maxChars = len
    }
  }
  const labelWidth = maxChars * 6
  return Math.max(80, labelWidth + 40 + 48)
}

function computeLayoutNodes(layoutType, centerNodeId = null) {
  const ids = Object.keys(props.nodes)
  if (ids.length === 0) return {}
  const edges = props.edges || {}
  const minEdgeLen = getMinEdgeLengthForLabels(edges)
  const center = { x: 0, y: 0 }
  const radius = Math.max(200, minEdgeLen)

  function getNeighbors(id) {
    const out = new Set()
    for (const e of Object.values(edges)) {
      if (e.source === id) out.add(e.target)
      if (e.target === id) out.add(e.source)
    }
    return out
  }

  let orderedIds = ids
  if ((layoutType === 'star' || layoutType === 'extendedStar' || layoutType === 'hierarchy') && centerNodeId && ids.includes(centerNodeId)) {
    orderedIds = [centerNodeId, ...ids.filter((id) => id !== centerNodeId)]
  }
  const L = orderedIds.length
  const result = {}

  if (layoutType === 'star' && L > 1) {
    const centerId = orderedIds[0]
    result[centerId] = { x: center.x, y: center.y }
    for (let i = 1; i < L; i++) {
      const a = ((i - 1) / (L - 1)) * 2 * Math.PI - Math.PI / 2
      result[orderedIds[i]] = { x: center.x + radius * Math.cos(a), y: center.y + radius * Math.sin(a) }
    }
  } else if (layoutType === 'ring' || layoutType === 'full') {
    const ringRadius = L >= 2
      ? Math.max(200, minEdgeLen / (2 * Math.sin(Math.PI / L)))
      : radius
    orderedIds.forEach((id, i) => {
      const a = (i / L) * 2 * Math.PI - Math.PI / 2
      result[id] = { x: center.x + ringRadius * Math.cos(a), y: center.y + ringRadius * Math.sin(a) }
    })
  } else if (layoutType === 'extendedStar' && L > 0) {
    const rootId = orderedIds[0]
    const level0 = [rootId]
    const neighborsRoot = getNeighbors(rootId)
    const level1 = [...neighborsRoot].filter((id) => ids.includes(id))
    const inLevel01 = new Set([...level0, ...level1])
    const level2 = []
    for (const n of level1) {
      for (const t of getNeighbors(n)) {
        if (ids.includes(t) && !inLevel01.has(t)) {
          level2.push(t)
          inLevel01.add(t)
        }
      }
    }
    const rest = ids.filter((id) => !inLevel01.has(id))
    result[rootId] = { x: 0, y: 0 }
    const R1 = Math.max(200, minEdgeLen)
    const R2 = Math.max(380, minEdgeLen * 1.5)
    level1.forEach((id, i) => {
      const a = (i / Math.max(level1.length, 1)) * 2 * Math.PI - Math.PI / 2
      result[id] = { x: R1 * Math.cos(a), y: R1 * Math.sin(a) }
    })
    const childrenOf = {}
    level1.forEach((mid) => { childrenOf[mid] = [] })
    level2.forEach((id) => {
      for (const mid of level1) {
        if (getNeighbors(mid).has(id)) {
          childrenOf[mid].push(id)
          break
        }
      }
    })
    level1.forEach((mid, idx) => {
      const kids = childrenOf[mid] || []
      const baseAngle = (idx / Math.max(level1.length, 1)) * 2 * Math.PI - Math.PI / 2
      const sector = (2 * Math.PI) / Math.max(level1.length, 1) * 0.7
      kids.forEach((kid, k) => {
        const a = baseAngle - sector / 2 + (sector / Math.max(kids.length + 1, 1)) * (k + 1)
        result[kid] = { x: R2 * Math.cos(a), y: R2 * Math.sin(a) }
      })
    })
    const unplacedLevel2 = level2.filter((id) => !result[id])
    unplacedLevel2.forEach((id, i) => {
      const a = (i / Math.max(unplacedLevel2.length, 1)) * 2 * Math.PI - Math.PI / 2
      result[id] = { x: R2 * Math.cos(a), y: R2 * Math.sin(a) }
    })
    const restStart = level1.length > 0 ? (level1.length / (level1.length + 1)) * 2 * Math.PI : 0
    rest.forEach((id, i) => {
      const a = restStart + (i / Math.max(rest.length, 1)) * 2 * Math.PI - Math.PI / 2
      result[id] = { x: R2 * Math.cos(a), y: R2 * Math.sin(a) }
    })
  } else if (layoutType === 'hierarchy' && L > 0) {
    const rootId = orderedIds[0]
    const levels = [[rootId]]
    const seen = new Set([rootId])
    let front = [rootId]
    while (front.length > 0) {
      const next = []
      for (const id of front) {
        for (const t of getNeighbors(id)) {
          if (ids.includes(t) && !seen.has(t)) {
            seen.add(t)
            next.push(t)
          }
        }
      }
      if (next.length > 0) levels.push(next)
      front = next
    }
    const restIds = ids.filter((id) => !seen.has(id))
    if (restIds.length > 0) levels.push(restIds)
    const levelHeight = Math.max(120, minEdgeLen)
    const nodeGap = Math.max(100, minEdgeLen)
    levels.forEach((levelIds, lev) => {
      const y = lev * levelHeight
      const totalW = (levelIds.length - 1) * nodeGap
      levelIds.forEach((id, j) => {
        result[id] = { x: j * nodeGap - totalW / 2, y: y }
      })
    })
  } else {
    const cols = Math.ceil(Math.sqrt(L)) || 1
    const step = Math.max(80, minEdgeLen)
    orderedIds.forEach((id, i) => {
      const row = Math.floor(i / cols)
      const col = i % cols
      result[id] = { x: col * step - (cols * step) / 2, y: row * step - (Math.ceil(L / cols) * step) / 2 }
    })
  }
  return result
}

function applyLayout(layoutType, centerNodeId = null) {
  lastLayoutType.value = layoutType
  lastLayoutCenterId.value = centerNodeId ?? null
  layouts.value = { nodes: computeLayoutNodes(layoutType, centerNodeId) }
  nextTick(fitToContents)
}

/** Выбор полуокружности раскрытия: в сторону, где расположен узел относительно остальных (свободное место). */
function getExpandSemicircle(expandedNodeId, addedNodeIds, current) {
  const cx = current[expandedNodeId]?.x ?? 0
  const cy = current[expandedNodeId]?.y ?? 0
  const otherIds = Object.keys(current).filter(
    (id) => id !== expandedNodeId && !addedNodeIds.includes(id)
  )
  if (otherIds.length === 0) return 'left'
  let mx = 0
  let my = 0
  otherIds.forEach((id) => {
    mx += current[id]?.x ?? 0
    my += current[id]?.y ?? 0
  })
  mx /= otherIds.length
  my /= otherIds.length
  const dx = cx - mx
  const dy = cy - my
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? 'left' : 'right'
  return dy < 0 ? 'top' : 'bottom'
}

function applyLayoutForAddedLevel(expandedNodeId, addedNodeIds) {
  if (!expandedNodeId || !Array.isArray(addedNodeIds) || addedNodeIds.length === 0) return
  const current = layouts.value?.nodes ?? {}
  const centerX = current[expandedNodeId]?.x ?? 0
  const centerY = current[expandedNodeId]?.y ?? 0
  const L = addedNodeIds.length
  const R_main = Math.max(200, getMinEdgeLengthForLabels(props.edges || {}))
  const addedSet = new Set(addedNodeIds)
  const newlyVisibleEdges = {}
  for (const [eid, e] of Object.entries(props.edges || {})) {
    const fromExpanded =
      (e.source === expandedNodeId && addedSet.has(e.target)) ||
      (e.target === expandedNodeId && addedSet.has(e.source))
    const betweenAdded = addedSet.has(e.source) && addedSet.has(e.target)
    if (fromExpanded || betweenAdded) newlyVisibleEdges[eid] = e
  }
  const R_expand = Math.max(200, getMinEdgeLengthForLabels(newlyVisibleEdges))
  /** Расстояние центр главной звезды — центр звезды раскрытия: R_main + R_expand + 10% от суммы. */
  const centerDistance = (R_main + R_expand) * 1.1

  const rootId = lastLayoutCenterId.value
  const ox = rootId && current[rootId] ? current[rootId].x ?? 0 : 0
  const oy = rootId && current[rootId] ? current[rootId].y ?? 0 : 0

  let dirX = centerX - ox
  let dirY = centerY - oy
  const dirLen = Math.hypot(dirX, dirY)
  if (dirLen < 1e-6) {
    const semicircle = getExpandSemicircle(expandedNodeId, addedNodeIds, current)
    switch (semicircle) {
      case 'right':
        dirX = 1
        dirY = 0
        break
      case 'top':
        dirX = 0
        dirY = -1
        break
      case 'bottom':
        dirX = 0
        dirY = 1
        break
      default:
        dirX = -1
        dirY = 0
    }
  } else {
    dirX /= dirLen
    dirY /= dirLen
  }

  const shiftedCenterX = ox + dirX * centerDistance
  const shiftedCenterY = oy + dirY * centerDistance
  const result = { [expandedNodeId]: { x: shiftedCenterX, y: shiftedCenterY } }
  for (let i = 0; i < L; i++) {
    const a = (i / Math.max(L, 1)) * 2 * Math.PI - Math.PI / 2
    result[addedNodeIds[i]] = {
      x: shiftedCenterX + R_expand * Math.cos(a),
      y: shiftedCenterY + R_expand * Math.sin(a),
    }
  }
  const nextLayouts = { ...current }
  Object.assign(nextLayouts, result)
  layouts.value = { nodes: nextLayouts }
}

/**
 * Разместить вновь показанные модули (subsystem) вокруг родительской ИС:
 * дуга в «свободную» полусферу (как при добавлении уровня), радиус подбирается
 * без пересечения с уже существующими узлами (мин. расстояние центров).
 */
function placeRevealedModules(parentId, revealedNodeIds) {
  const revealed = [...new Set(revealedNodeIds || [])].filter(Boolean).sort()
  if (!parentId || revealed.length === 0) return
  const current = { ...(layouts.value?.nodes ?? {}) }
  const pp = current[parentId]
  if (!pp || !Number.isFinite(pp.x) || !Number.isFinite(pp.y)) return
  const cx = pp.x
  const cy = pp.y
  const minD = GRAPH_NODE_MIN_CENTER_DIST
  const minDSq = minD * minD

  const revealedSet = new Set(revealed)
  const obstacles = []
  for (const id of Object.keys(props.nodes || {})) {
    if (revealedSet.has(id)) continue
    const p = current[id]
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) {
      obstacles.push({ x: p.x, y: p.y })
    }
  }

  const L = revealed.length
  const minEdgeLen = getMinEdgeLengthForLabels(props.edges || {})

  function candidatesPass(cand) {
    let ok = true
    for (let i = 0; i < L && ok; i++) {
      for (let j = i + 1; j < L; j++) {
        const dx = cand[i].x - cand[j].x
        const dy = cand[i].y - cand[j].y
        if (dx * dx + dy * dy < minDSq) ok = false
      }
    }
    if (!ok) return false
    for (let i = 0; i < L && ok; i++) {
      for (const o of obstacles) {
        const dx = cand[i].x - o.x
        const dy = cand[i].y - o.y
        if (dx * dx + dy * dy < minDSq) ok = false
      }
    }
    return ok
  }

  function commitCandidates(cand) {
    const nextLayouts = { ...current }
    for (let i = 0; i < L; i++) {
      nextLayouts[revealed[i]] = { x: cand[i].x, y: cand[i].y }
    }
    layouts.value = { nodes: nextLayouts }
  }

  // Иерархия: модули — ряд ниже родителя (как уровни в computeLayoutNodes)
  if (lastLayoutType.value === 'hierarchy') {
    const levelHeight = Math.max(120, minEdgeLen)
    const gapX = minD
    for (let row = 0; row < 60; row++) {
      const y = cy + levelHeight + row * 32
      const totalW = (L - 1) * gapX
      const cand = []
      for (let i = 0; i < L; i++) {
        cand.push({ x: cx - totalW / 2 + i * gapX, y })
      }
      if (candidatesPass(cand)) {
        commitCandidates(cand)
        return
      }
    }
  }

  const semicircle = getExpandSemicircle(parentId, revealed, current)
  let a0
  let a1
  switch (semicircle) {
    case 'right':
      a0 = -Math.PI / 2
      a1 = Math.PI / 2
      break
    case 'top':
      a0 = -Math.PI
      a1 = 0
      break
    case 'bottom':
      a0 = 0
      a1 = Math.PI
      break
    default:
      a0 = Math.PI / 2
      a1 = (3 * Math.PI) / 2
  }

  const useFullCircle = lastLayoutType.value === 'ring' || lastLayoutType.value === 'full'
  const baseR = Math.max(minD + 12, minEdgeLen)
  const maxR = 3200
  const stepR = 26

  for (let R = baseR; R <= maxR; R += stepR) {
    if (R < minD) continue
    const cand = []
    for (let i = 0; i < L; i++) {
      let a
      if (useFullCircle) {
        a = L > 0 ? (i / L) * 2 * Math.PI - Math.PI / 2 : -Math.PI / 2
      } else {
        const t = L > 1 ? i / (L - 1) : 0.5
        a = a0 + t * (a1 - a0)
      }
      cand.push({ x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) })
    }
    if (!candidatesPass(cand)) continue
    commitCandidates(cand)
    return
  }
  // fallback: максимальный радиус (редко)
  const R = maxR
  const cand = []
  for (let i = 0; i < L; i++) {
    let a
    if (useFullCircle) {
      a = L > 0 ? (i / L) * 2 * Math.PI - Math.PI / 2 : -Math.PI / 2
    } else {
      const t = L > 1 ? i / (L - 1) : 0.5
      a = a0 + t * (a1 - a0)
    }
    cand.push({ x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) })
  }
  commitCandidates(cand)
}

function fitToContents() {
  const g = graphRef.value
  if (!g) return
  const getViewBox = g.getViewBox ?? g.instance?.getViewBox
  const setViewBox = g.setViewBox ?? g.instance?.setViewBox
  const fit = g.fitToContents ?? g.instance?.fitToContents
  if (typeof fit !== 'function') return
  let beforeBox = null
  if (typeof getViewBox === 'function' && typeof setViewBox === 'function') {
    beforeBox = getViewBox.call(g)
  }
  fit.call(g)
  if (beforeBox && typeof getViewBox === 'function' && typeof setViewBox === 'function') {
    const afterBox = getViewBox.call(g)
    const beforeW = beforeBox.right - beforeBox.left
    const beforeH = beforeBox.bottom - beforeBox.top
    const afterW = afterBox.right - afterBox.left
    const afterH = afterBox.bottom - afterBox.top
    if (afterW < beforeW || afterH < beforeH) {
      setViewBox.call(g, beforeBox)
    }
  }
  const MIN_VIEWBOX = (getConfig().GRAPH_VIEWBOX_MIN ?? 500) | 0
  if (typeof getViewBox === 'function' && typeof setViewBox === 'function') {
    const box = getViewBox.call(g)
    const w = box.right - box.left
    const h = box.bottom - box.top
    if (w > 0 && h > 0 && (w < MIN_VIEWBOX || h < MIN_VIEWBOX)) {
      const scale = Math.max(MIN_VIEWBOX / w, MIN_VIEWBOX / h, 1)
      const nw = w * scale
      const nh = h * scale
      const cx = (box.left + box.right) / 2
      const cy = (box.top + box.bottom) / 2
      setViewBox.call(g, {
        left: cx - nw / 2,
        right: cx + nw / 2,
        top: cy - nh / 2,
        bottom: cy + nh / 2,
      })
    }
  }
}

function exportSvg() {
  nextTick(() => {
    const wrap = containerRef.value
    const el = wrap?.querySelector('.v-network-graph__container svg') || wrap?.querySelector('svg')
    if (!el) return
    const svg = el.cloneNode(true)
    const s = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([s], { type: 'image/svg+xml;charset=utf-8' })
    downloadBlob(blob, 'graph.svg')
  })
}

function exportPng() {
  nextTick(() => {
    const wrap = containerRef.value?.querySelector('.v-network-graph__container') || containerRef.value
    const el = wrap?.querySelector('svg')
    if (!el) return
    const svg = el.cloneNode(true)
    const bbox = el.getBBox?.()
    const w = bbox?.width || 800
    const h = bbox?.height || 600
    svg.setAttribute('width', String(w))
    svg.setAttribute('height', String(h))
    if (!svg.getAttribute('viewBox') && bbox) svg.setAttribute('viewBox', `${bbox.x} ${bbox.y} ${w} ${h}`)
    const s = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([s], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0)
        canvas.toBlob((b) => {
          if (b) downloadBlob(b, 'graph.png')
        }, 'image/png')
      } finally {
        URL.revokeObjectURL(url)
      }
    }
    img.onerror = () => URL.revokeObjectURL(url)
    img.src = url
  })
}

// Удалить координаты узлов, которых больше нет на графе (например модули при свёртке в ИС)
watch(
  () => Object.keys(props.nodes || {}).slice().sort().join('\0'),
  () => {
    const ids = new Set(Object.keys(props.nodes || {}))
    const n = layouts.value.nodes || {}
    let changed = false
    const next = { ...n }
    for (const k of Object.keys(next)) {
      if (!ids.has(k)) {
        delete next[k]
        changed = true
      }
    }
    if (changed) layouts.value = { nodes: next }
  }
)

// При первом появлении узлов — раскладка (в embed при centerNodeId — звезда от центра)
watch(
  () => [Object.keys(props.nodes).length, props.variant, props.centerNodeId],
  () => {
    const count = Object.keys(props.nodes).length
    if (count > 0 && Object.keys(layouts.value.nodes || {}).length === 0) {
      const center = props.centerNodeId
      if (isEmbed.value && center && props.nodes[center] && count > 1) {
        applyLayout('star', center)
      } else {
        applyLayout('grid')
      }
    }
  },
  { immediate: true }
)

// Закрытие контекстного меню по клику снаружи
function onDocClick(e) {
  if (contextMenu.value.show && contextMenuRef.value && !contextMenuRef.value.contains(e.target)) {
    closeContextMenu()
  }
}
document.addEventListener('click', onDocClick)
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))
defineExpose({
  applyLayout,
  applyLayoutForAddedLevel,
  placeRevealedModules,
  exportSvg,
  exportPng,
  fitToContents,
})
</script>

<style scoped>
.analyzer-wrap {
  display: flex;
  gap: 0.75rem;
  align-items: stretch;
}
.analyzer-wrap--embed {
  flex-direction: column;
}
.analyzer-wrap--embed .analyzer-graph-wrap {
  height: 420px;
  min-height: 280px;
}
.toolbar-left {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex-shrink: 0;
  padding: 0.5rem;
  background: var(--ar-table-head-bg);
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius);
}
.toolbar-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  cursor: pointer;
  white-space: nowrap;
}
.toolbar-toggle input { flex-shrink: 0; }
.toolbar-layouts {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.btn-layout {
  padding: 0.4rem 0.6rem;
  font-size: 0.8rem;
  border: 1px solid var(--ar-border);
  border-radius: 4px;
  background: var(--ar-surface);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
}
.btn-layout:hover {
  background: var(--ar-row-hover);
}
.analyzer-graph-wrap {
  position: relative;
  flex: 1;
  min-width: 0;
  height: 780px;
  background: var(--ar-surface);
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius);
  overflow: hidden;
}
.analyzer-graph {
  width: 100%;
  height: 100%;
}
.toolbar {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 4px;
}
.btn-tool {
  padding: 0.35rem 0.6rem;
  font-size: 0.8rem;
  border: 1px solid var(--ar-border);
  border-radius: 4px;
  background: var(--ar-surface);
  cursor: pointer;
  font-family: inherit;
}
.btn-tool:hover {
  background: var(--ar-row-hover);
}
.graph-legend {
  position: absolute;
  left: 10px;
  bottom: 10px;
  z-index: 6;
  max-width: min(320px, 42vw);
  max-height: 42%;
  overflow-y: auto;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
  font-size: 0.82rem;
  color: var(--ar-text);
}
.legend-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.legend-row:last-child {
  margin-bottom: 0;
}
.legend-node-svg {
  flex-shrink: 0;
  display: block;
}
.legend-label {
  line-height: 1.25;
}
.context-menu {
  position: fixed;
  z-index: 1000;
  background: var(--ar-surface);
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  padding: 0.25rem 0;
  min-width: 200px;
}
.ctx-item {
  display: block;
  width: 100%;
  padding: 0.4rem 0.75rem;
  text-align: left;
  border: none;
  background: none;
  font-size: 0.85rem;
  cursor: pointer;
  color: var(--ar-text);
}
.ctx-item:hover {
  background: var(--ar-row-hover);
}
.ctx-divider {
  height: 1px;
  background: var(--ar-border);
  margin: 0.25rem 0;
}
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
}
.modal-card {
  background: var(--ar-surface);
  border-radius: var(--ar-radius-lg);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  border: 1px solid var(--ar-border);
  max-width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--ar-border);
}
.modal-header h3 {
  margin: 0;
  font-size: 1rem;
  color: var(--ar-text);
}
.modal-close {
  border: none;
  background: none;
  font-size: 1.25rem;
  cursor: pointer;
  color: var(--ar-muted);
}
.modal-body { padding: 1rem; overflow: auto; }
.view-json {
  margin: 0;
  font-size: 0.8rem;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--ar-text);
}
</style>

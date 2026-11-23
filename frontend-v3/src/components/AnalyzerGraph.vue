<template>
  <div class="analyzer-wrap" :class="{ 'analyzer-wrap--embed': isEmbed }" ref="containerRef">
    <AnalyzerPalette
      v-if="effectiveShowPalette"
      v-model:show-all-edges-cascade="showAllEdgesCascadeLocal"
      v-model:show-legend="showLegend"
      v-model:show-relations="showRelations"
      :cascade-available="showCascadeToggle"
      :layout-type="lastLayoutType"
      :layout-options="layoutOptions"
      :selected-node-id="activeNodeId"
      :selected-edge-id="activeEdgeId"
      :nodes="nodes"
      :edges="edges"
      :relations="relations"
      :relation-types="relationTypes"
      @layout="onPaletteLayout"
      @open-flows="openBundledFlows"
    />
    <div class="analyzer-graph-wrap" ref="graphWrapRef" :style="graphWrapStyle">
    <v-network-graph
      ref="graphRef"
      v-model:layouts="layouts"
      v-model:zoom-level="zoomLevel"
      v-model:selected-nodes="selectedNodeIds"
      v-model:selected-edges="selectedEdgeIds"
      :nodes="nodes"
      :edges="edges"
      :configs="configs"
      :event-handlers="eventHandlers"
      class="analyzer-graph"
    >
      <template #override-node="{ nodeId: nid }">
        <g class="node-custom">
          <rect
            v-if="isNodeActive(nid)"
            x="-27"
            y="-27"
            width="54"
            height="54"
            rx="10"
            fill="rgba(31, 56, 100, 0.10)"
          />
          <rect
            x="-24"
            y="-24"
            width="48"
            height="48"
            rx="8"
            :fill="isNodeActive(nid) ? '#eef2fa' : '#f8f9fb'"
            :stroke="isNodeActive(nid) ? '#1f3864' : '#00c4ae'"
            :stroke-width="isNodeActive(nid) ? 3 : 1"
          />
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
          <div
            class="ctx-submenu"
            :class="{ 'ctx-submenu--flip': ctxSubmenuFlipLeft }"
            @mouseenter="updateCtxSubmenuFlip"
          >
            <button type="button" class="ctx-item ctx-item--submenu" @click.prevent>
              <span>Показать связи</span>
              <span class="ctx-caret">{{ ctxSubmenuFlipLeft ? '‹' : '›' }}</span>
            </button>
            <div ref="ctxSubmenuPanelRef" class="ctx-submenu-panel" role="menu" aria-label="Показать связи">
              <button type="button" class="ctx-item" @click="onCtxRelationTypeClick(null)">
                <span class="ctx-check" aria-hidden="true">{{ ctxAllTypesChecked ? '✓' : '' }}</span>
                <span>Все типы</span>
              </button>
              <div class="ctx-divider" />
              <button
                v-for="rt in ctxIncidentRelationTypeOptions"
                :key="rt.code"
                type="button"
                class="ctx-item"
                @click="onCtxRelationTypeClick(rt.code)"
              >
                <span class="ctx-check" aria-hidden="true">{{ ctxShownRelationTypesForNode.has(rt.code) ? '✓' : '' }}</span>
                <span>{{ rt.label }}</span>
              </button>
              <div v-if="ctxIncidentRelationTypeOptions.length === 0" class="ctx-empty">
                Нет связей
              </div>
            </div>
          </div>
          <div class="ctx-divider" />
          <button type="button" class="ctx-item" @click="onCtxHideNode">Скрыть объект</button>
          <div class="ctx-divider" />
        </template>
        <button type="button" class="ctx-item" @click="onCtxView">Просмотр</button>
      </template>
      <template v-else-if="contextMenu.type === 'edge'">
        <template v-if="contextMenuBundledEdge">
          <button type="button" class="ctx-item" @click="onCtxShowBundledFlows">Список потоков данных…</button>
          <div class="ctx-divider" />
        </template>
        <template v-else-if="contextMenuIntegrationFlowId">
          <button type="button" class="ctx-item" @click="onCtxOpenIntegrationInRegistry">Открыть в реестре</button>
          <div class="ctx-divider" />
        </template>
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

    <!-- Список потоков в свёрнутом пучке -->
    <div v-if="flowsListModal.show" class="modal-overlay">
      <div class="modal-card modal-card-wide">
        <div class="modal-header">
          <h3>{{ flowsListModal.title }}</h3>
          <button type="button" class="modal-close" @click="flowsListModal.show = false">×</button>
        </div>
        <div class="modal-body">
          <table class="flows-table">
            <tbody>
              <tr v-for="row in flowsListModal.rows" :key="row.id">
                <td>{{ row.label }}</td>
                <td class="flows-table-action">
                  <a
                    v-if="row.flowId"
                    :href="integrationEditHref(row.flowId)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="link"
                  >Открыть в реестре</a>
                  <span v-else class="muted">—</span>
                </td>
              </tr>
            </tbody>
          </table>
          <p v-if="flowsListModal.rows.length === 0" class="empty-inline">Нет данных о потоках</p>
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
      <div class="graph-panel-head">
        <span class="graph-panel-title">Легенда</span>
        <button type="button" class="graph-panel-close" title="Закрыть легенду" @click="showLegend = false">×</button>
      </div>
      <div class="graph-panel-body">
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

    <!-- Панель «Связи»: типы связей выбранного объекта; чекбокс глобально скрывает тип на графе -->
    <div v-if="showRelations" class="graph-relations" aria-label="Связи выбранного объекта">
      <div class="graph-panel-head">
        <span class="graph-panel-title">Связи</span>
        <button type="button" class="graph-panel-close" title="Закрыть панель связей" @click="showRelations = false">×</button>
      </div>
      <div class="graph-panel-body">
        <p v-if="!activeNodeId" class="graph-panel-empty">
          Выберите объект на графе (ЛКМ) — здесь появятся типы его связей.
        </p>
        <p v-else-if="selectedNodeRelationTypeOptions.length === 0" class="graph-panel-empty">У объекта нет связей.</p>
        <template v-else>
          <div class="relation-actions">
            <button
              type="button"
              class="relation-action"
              :disabled="selectedNodeFullyShownOptionCount >= selectedNodeRelationTypeOptions.length"
              @click="showAllSelectedRelations"
            >
              Выбрать все
            </button>
            <button
              type="button"
              class="relation-action"
              :disabled="selectedNodeVisibleOptionCount === 0"
              @click="hideAllSelectedRelations"
            >
              Отменить все
            </button>
          </div>
          <label v-for="row in selectedNodeRelationTypeOptions" :key="row.code" class="relation-row">
            <input
              type="checkbox"
              :checked="selectedNodeFullyShownRelationTypes.has(row.code)"
              @change="toggleSelectedRelationType(row.code)"
            />
            <span class="relation-label">{{ row.label }}</span>
          </label>
        </template>
      </div>
    </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { parseNodeId, getEntityTypeConfig } from '../utils/entityTypeConfig'
import AnalyzerPalette from './AnalyzerPalette.vue'
import { fetchEntity, relationDisplayName, INTEGRATION_FLOW_METAMODEL_RELATION_TYPES } from '../api/graphApi'
import { getConfig } from '@/config/params'
import { downloadBlob } from '../utils/downloadBlob'
import * as LucideIcons from 'lucide-vue-next'

const router = useRouter()

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
   * Палитра свойств (issue #116). Если не задано — показывается вместе с полной панелью
   * (`variant="analyzer"`); во встройке палитры нет.
   */
  showPalette: { type: Boolean, default: undefined },
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
   * Узел-центр/корень графа: в embed — центр первичной раскладки «звезда» (когда узлов больше одного);
   * в анализаторе — корень графа: не скрывается фильтром типов связей панели «Связи».
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

/** Палитра свойств: по умолчанию вместе с полной панелью анализатора (issue #116). */
const effectiveShowPalette = computed(() =>
  props.showPalette !== undefined ? props.showPalette : effectiveShowToolbar.value
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
  'toggle-relations',
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

/** Панель «Связи»: видимость (фильтр типов — контекстный, как ПКМ; состояние живёт в AnalyticsView). */
const showRelations = ref(false)

/**
 * Выделение на графе (issue #116). Библиотека ведёт узлы и связи отдельными наборами,
 * поэтому «одновременно активен только один объект» обеспечивается вручную (см. selectOnly).
 * Лимит одновременного выбора задан конфигом: node.selectable / edge.selectable = 1.
 */
const selectedNodeIds = ref([])
const selectedEdgeIds = ref([])
const activeNodeId = computed(() => selectedNodeIds.value[0] || null)
const activeEdgeId = computed(() => selectedEdgeIds.value[0] || null)

/** Активный узел: рамка рисуется в слоте #override-node (у него свой прямоугольник). */
function isNodeActive(nodeId) {
  return selectedNodeIds.value.includes(nodeId)
}

/** Опции типов связей узла — как в ПКМ: из полного набора `relations`, включая ещё не показанные. */
function incidentRelationTypeOptions(nid) {
  if (!nid) return []
  const uniqueCodes = new Set()
  for (const r of props.relations || []) {
    if (!r) continue
    const fromId = `${r.from_entity_type}:${r.from_entity_id}`
    const toId = `${r.to_entity_type}:${r.to_entity_id}`
    if (fromId !== nid && toId !== nid) continue
    const code = String(r.relation_type || '').trim()
    if (code) uniqueCodes.add(code)
  }
  const byCode = new Map()
  for (const rt of props.relationTypes || []) {
    const code = String(rt?.code || '').trim()
    if (!code) continue
    byCode.set(code, rt)
  }
  const out = []
  for (const code of uniqueCodes) {
    const rt = byCode.get(code)
    out.push({ code, label: relationTypeMenuLabel(rt) || code })
  }
  out.sort((a, b) => a.label.localeCompare(b.label, 'ru'))
  return out
}

/** relationId видимых рёбер (у пакетных рёбер интеграционных потоков — memberRelationIds). */
function visibleRelationIdsAtGraph() {
  const ids = new Set()
  for (const e of Object.values(props.edges || {})) {
    if (!e) continue
    if (e.relationId != null) ids.add(String(e.relationId))
    if (Array.isArray(e.memberRelationIds)) {
      for (const rid of e.memberRelationIds) ids.add(String(rid))
    }
  }
  return ids
}

/**
 * Статистика типов связей узла по полному набору `relations`:
 * total — сколько связей этого типа инцидентно узлу, visible — сколько из них видно на графе.
 */
function relationTypeStatsAtNode(nid) {
  const stats = new Map()
  if (!nid) return stats
  const visibleIds = visibleRelationIdsAtGraph()
  for (const r of props.relations || []) {
    if (!r) continue
    const fromId = `${r.from_entity_type}:${r.from_entity_id}`
    const toId = `${r.to_entity_type}:${r.to_entity_id}`
    if (fromId !== nid && toId !== nid) continue
    const code = String(r.relation_type || '').trim()
    if (!code) continue
    const row = stats.get(code) || { total: 0, visible: 0 }
    row.total += 1
    if (visibleIds.has(String(r.id))) row.visible += 1
    stats.set(code, row)
  }
  return stats
}

/** Типы, у которых у узла показаны ВСЕ связи — галочка «тип раскрыт полностью» (issue #134). */
function fullyShownRelationTypesAtNode(nid) {
  const set = new Set()
  for (const [code, row] of relationTypeStatsAtNode(nid)) {
    if (row.total > 0 && row.visible >= row.total) set.add(code)
  }
  return set
}

/** Типы, у которых у узла есть хотя бы одна видимая связь (для доступности «Отменить все»). */
function visibleRelationTypesAtNode(nid) {
  const set = new Set()
  for (const [code, row] of relationTypeStatsAtNode(nid)) {
    if (row.visible > 0) set.add(code)
  }
  return set
}

const selectedNodeRelationTypeOptions = computed(() => incidentRelationTypeOptions(activeNodeId.value))
const selectedNodeFullyShownRelationTypes = computed(() => fullyShownRelationTypesAtNode(activeNodeId.value))
const selectedNodeVisibleRelationTypes = computed(() => visibleRelationTypesAtNode(activeNodeId.value))
/** Сколько типов из списка панели раскрыто полностью (синтетические рёбра пучков не учитываем). */
const selectedNodeFullyShownOptionCount = computed(() => {
  const shown = selectedNodeFullyShownRelationTypes.value
  return selectedNodeRelationTypeOptions.value.filter((o) => shown.has(o.code)).length
})
/** Сколько типов из списка панели имеют хоть одну видимую связь. */
const selectedNodeVisibleOptionCount = computed(() => {
  const visible = selectedNodeVisibleRelationTypes.value
  return selectedNodeRelationTypeOptions.value.filter((o) => visible.has(o.code)).length
})

/** Чекбокс типа: раскрыть/скрыть связи этого типа у выбранного узла (как ПКМ «Показать связи»). */
function toggleSelectedRelationType(code) {
  const nid = activeNodeId.value
  if (!nid) return
  emit('toggle-relations', {
    nodeId: nid,
    relationType: code,
    // Частично раскрытый тип (не все инцидентные связи видны) — дораскрываем, а не скрываем.
    show: !selectedNodeFullyShownRelationTypes.value.has(code),
  })
}

/** «Выбрать все» — раскрыть все типы связей узла (как ПКМ «Все типы» вкл). */
function showAllSelectedRelations() {
  if (!activeNodeId.value) return
  emit('toggle-relations', { nodeId: activeNodeId.value, relationType: null, show: true })
}

/** «Отменить все» — скрыть все инцидентные связи узла (как ПКМ «Все типы» выкл). */
function hideAllSelectedRelations() {
  if (!activeNodeId.value) return
  emit('toggle-relations', { nodeId: activeNodeId.value, relationType: null, show: false })
}

/** Сделать объект единственным активным: очищаем «чужой» набор (узлы ↔ связи). */
function selectOnly(kind, id) {
  if (!id) return
  // ЛКМ по другому узлу/ребру не доходит до document: v-network-graph останавливает
  // всплытие, поэтому контекстное меню закрываем здесь же (до открытия нового по ПКМ).
  closeContextMenu()
  if (kind === 'node') {
    if (selectedEdgeIds.value.length) selectedEdgeIds.value = []
    if (selectedNodeIds.value.length !== 1 || selectedNodeIds.value[0] !== id) {
      selectedNodeIds.value = [id]
    }
    return
  }
  if (selectedNodeIds.value.length) selectedNodeIds.value = []
  if (selectedEdgeIds.value.length !== 1 || selectedEdgeIds.value[0] !== id) {
    selectedEdgeIds.value = [id]
  }
}

/** Сбросить выделение, если объект исчез с графа (скрытие, свёртка модулей, новый граф). */
function pruneSelection() {
  const visibleNodes = props.nodes || {}
  const visibleEdges = props.edges || {}
  if (selectedNodeIds.value.some((id) => !visibleNodes[id])) {
    selectedNodeIds.value = selectedNodeIds.value.filter((id) => visibleNodes[id])
  }
  if (selectedEdgeIds.value.some((id) => !visibleEdges[id])) {
    selectedEdgeIds.value = selectedEdgeIds.value.filter((id) => visibleEdges[id])
  }
}

watch(() => Object.keys(props.nodes || {}).join('|'), pruneSelection)
watch(() => Object.keys(props.edges || {}).join('|'), pruneSelection)

// Возврат ранее скрытых узлов (issue #134): если библиотека убрала их из `layouts`,
// восстанавливаем сохранённые координаты — граф не «переезжает» при повторном включении типа.
watch(
  () => Object.keys(props.nodes || {}).join('|'),
  () => {
    const cache = layoutCache.value
    if (!cache || Object.keys(cache).length === 0) return
    const current = layouts.value?.nodes || {}
    const next = { ...current }
    let changed = false
    for (const id of Object.keys(props.nodes || {})) {
      if (next[id] || !cache[id]) continue
      next[id] = { ...cache[id] }
      changed = true
    }
    if (changed) layouts.value = { nodes: next }
  }
)

const containerRef = ref(null)
const graphWrapRef = ref(null)
const graphRef = ref(null)
const contextMenuRef = ref(null)
const ctxSubmenuPanelRef = ref(null)
const ctxSubmenuFlipLeft = ref(false)
const layouts = ref({ nodes: {} })
/**
 * Кэш координат: скрытые фильтром узлы исчезают из `nodes`, и библиотека может убрать их из `layouts`.
 * Позиции сохраняем, чтобы при повторном показе вернуть узел на место, а не перекладывать граф (issue #134).
 */
const layoutCache = ref({})
/**
 * Узлы, координаты которых выставлены НАШИМИ алгоритмами (applyLayout / relayoutHubAroundNode /
 * placeRevealedModules). Проверка по `layouts` для этого не годится: v-network-graph сам присваивает
 * координаты только что добавленным узлам, и они попадают в layoutCache раньше нашего relayout —
 * из-за этого раскрытие не переносило хаб (issue #134).
 */
const laidOutNodeIds = new Set()
watch(
  () => layouts.value?.nodes,
  (nodes) => {
    if (nodes && typeof nodes === 'object') {
      layoutCache.value = { ...layoutCache.value, ...nodes }
    }
  },
  { deep: false }
)
const zoomLevel = ref(1)

/** Последняя выбранная раскладка (для размещения вновь показанных модулей). */
const lastLayoutType = ref('grid')
/** Центр для star / hierarchy / extendedStar (как в computeLayoutNodes). */
const lastLayoutCenterId = ref(null)

/** Минимум между центрами узлов: 48×48 + подпись снизу + зазор (см. #override-node-label). */
const GRAPH_NODE_MIN_CENTER_DIST = 92

const configs = computed(() => ({
  view: {
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
    /**
     * Активный узел (issue #116). Форму рисует слот #override-node, но геометрию (type/width/height)
     * библиотека берёт отсюда — она нужна для обрезки рёбер; без неё в путях рёбер появляется NaN
     * и связи выбранного узла пропадают. Поэтому стиль повторяет normal целиком.
     */
    selected: {
      type: 'rect',
      width: 48,
      height: 48,
      borderRadius: 8,
      color: '#eef2fa',
      strokeWidth: 3,
      strokeColor: '#1f3864',
    },
    /** Одновременно активен только один узел. */
    selectable: 1,
    /**
     * Жёлтая focus-рамка библиотеки (#eebb00) дублировала синюю рамку активного узла
     * (issue #116): на клике появлялись две рамки. Синий контур задаёт слот #override-node.
     */
    focusring: { visible: false },
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
    normal: {
      width: (edge) => (edge?.bundled ? 4 : 2),
      color: (edge) => (edge?.bundled ? '#4a6b3a' : '#8b9a6b'),
    },
    /** Активная связь — красная (issue #116, п.2). Стиль полный: библиотека не мержит с normal. */
    selected: {
      width: 3.5,
      color: '#d32f2f',
      dasharray: 0,
      linecap: 'butt',
      animate: false,
      animationSpeed: 50,
    },
    /** Одновременно активна только одна связь. */
    selectable: 1,
    type: 'curve',
    gap: 12,
    marker: {
      source: { type: 'none' },
      target: { type: 'arrow', width: (edge) => (edge?.bundled ? 8 : 6), height: (edge) => (edge?.bundled ? 8 : 6), margin: 0, units: 'userSpaceOnUse' },
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

const entityTypeLabelByCode = computed(() => {
  const map = new Map()
  for (const et of props.legendEntityTypes || []) {
    const code = String(et?.code || '').trim()
    if (!code || map.has(code)) continue
    map.set(code, String(et.display_name || et.name || code).trim() || code)
  }
  return map
})

function relationTypeMenuLabel(rt) {
  if (!rt) return ''
  const name = String(rt.display_name || rt.name || rt.code || '').trim() || String(rt.code || '').trim()
  const fromCode = String(rt.from_entity_type_code || '').trim()
  const toCode = String(rt.to_entity_type_code || '').trim()
  const fromLabel = entityTypeLabelByCode.value.get(fromCode) || fromCode
  const toLabel = entityTypeLabelByCode.value.get(toCode) || toCode
  if (fromLabel && toLabel) return `${name} (${fromLabel} → ${toLabel})`
  return name
}

const ctxShownRelationTypesForNode = computed(() => fullyShownRelationTypesAtNode(contextMenu.value?.node))

const ctxIncidentRelationTypeOptions = computed(() => incidentRelationTypeOptions(contextMenu.value?.node))

const ctxAllTypesChecked = computed(() => {
  const opts = ctxIncidentRelationTypeOptions.value
  if (!opts.length) return false
  const shown = ctxShownRelationTypesForNode.value
  return opts.every((o) => shown.has(o.code))
})

const viewModal = ref({
  show: false,
  title: '',
  json: '',
})

const flowsListModal = ref({
  show: false,
  title: '',
  rows: [],
})

const contextMenuBundledEdge = computed(() => {
  const eid = contextMenu.value?.edge
  if (!eid) return false
  return !!props.edges?.[eid]?.bundled
})

function integrationFlowRegistryId(edge, edgeId) {
  if (!edge || edge.bundled) return null
  const rt = String(edge.relationType || '').trim()
  if (!INTEGRATION_FLOW_METAMODEL_RELATION_TYPES.has(rt)) return null
  let relationId = edge.relationId
  if (relationId == null) {
    const m = /^rel-(\d+)$/.exec(edgeId || '')
    relationId = m ? Number(m[1]) : null
  }
  if (relationId == null) return null
  const rel = (props.relations || []).find((r) => r.id === relationId)
  return rel?.reference_to_baserow || null
}

const contextMenuIntegrationFlowId = computed(() => {
  const eid = contextMenu.value?.edge
  if (!eid) return null
  return integrationFlowRegistryId(props.edges?.[eid], eid)
})

const eventHandlers = computed(() => ({
  /**
   * Выделение работает всегда — в том числе когда контекстное меню отключено (`contextMenu: 'off'`).
   * Библиотека сама ведёт наборы выбранных узлов/связей, но не очищает «чужой» набор:
   * единственность активного объекта обеспечивает selectOnly (issue #116, п.1–3).
   */
  'node:click': ({ node }) => selectOnly('node', node),
  'edge:click': ({ edge }) => selectOnly('edge', Array.isArray(edge) ? edge[0] : edge),
  'node:contextmenu': ({ node, event }) => {
    selectOnly('node', node)
    if (effectiveContextMenu.value === 'off') return
    event.preventDefault()
    contextMenu.value = {
      show: true,
      type: 'node',
      node,
      edge: null,
      x: event.clientX,
      y: event.clientY,
    }
    nextTick(updateCtxSubmenuFlip)
  },
  'edge:contextmenu': ({ edge, event }) => {
    const edgeId = Array.isArray(edge) ? edge[0] : edge
    selectOnly('edge', edgeId)
    if (effectiveContextMenu.value === 'off') return
    event.preventDefault()
    contextMenu.value = {
      show: true,
      type: 'edge',
      node: null,
      edge: edgeId,
      x: event.clientX,
      y: event.clientY,
    }
  },
}))

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

function updateCtxSubmenuFlip() {
  ctxSubmenuFlipLeft.value = false
  const menu = contextMenuRef.value
  const panel = ctxSubmenuPanelRef.value
  if (!menu || !panel) return
  const menuRect = menu.getBoundingClientRect()
  const panelWidth = Math.max(panel.offsetWidth || 0, 320)
  const gap = 8
  if (menuRect.right + panelWidth + gap > window.innerWidth) {
    ctxSubmenuFlipLeft.value = true
  }
}

function onCtxRelationTypeClick(relationType) {
  const nid = contextMenu.value.node
  if (!nid) return
  const shown = relationType == null
    ? ctxAllTypesChecked.value
    : ctxShownRelationTypesForNode.value.has(relationType)
  emit('toggle-relations', { nodeId: nid, relationType, show: !shown })
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

function nodeDisplayLabel(nodeIdStr) {
  const n = props.nodes?.[nodeIdStr]
  if (n?.name) return String(n.name)
  return nodeIdStr || '—'
}

function integrationEditHref(flowId) {
  return router.resolve({ path: `/integrations/${flowId}/edit` }).href
}

function onCtxOpenIntegrationInRegistry() {
  const flowId = contextMenuIntegrationFlowId.value
  closeContextMenu()
  if (!flowId) return
  window.open(integrationEditHref(flowId), '_blank', 'noopener,noreferrer')
}

/** Модалка «Список потоков данных» для свёрнутого пучка: ПКМ по связи или кнопка в палитре. */
function openBundledFlows(edgeId) {
  const edge = edgeId ? props.edges[edgeId] : null
  if (!edge?.bundled) return
  const fromLabel = nodeDisplayLabel(edge.source)
  const toLabel = nodeDisplayLabel(edge.target)
  const idSet = new Set(edge.memberRelationIds || [])
  const rows = (props.relations || [])
    .filter((r) => idSet.has(r.id))
    .map((r) => ({
      id: r.id,
      label: relationDisplayName(r),
      flowId: r.reference_to_baserow,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ru'))
  flowsListModal.value = {
    show: true,
    title: `Потоки передачи данных (${fromLabel} -> ${toLabel})`,
    rows,
  }
}

function onCtxShowBundledFlows() {
  const edgeId = contextMenu.value.edge
  closeContextMenu()
  if (edgeId) openBundledFlows(edgeId)
}

/** Смена топологии из палитры: применяет родитель (как и прежние кнопки раскладок). */
function onPaletteLayout(layoutType) {
  if (!layoutType) return
  emit('layout', layoutType)
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
  // Полная раскладка пересчитывает позиции — кэш прежних координат и набор «разложенных» узлов не актуальны.
  layoutCache.value = {}
  laidOutNodeIds.clear()
  layouts.value = { nodes: computeLayoutNodes(layoutType, centerNodeId) }
  for (const id of Object.keys(layouts.value.nodes || {})) laidOutNodeIds.add(id)
  // Новая раскладка — вписываем граф в область заново (а не только уменьшаем масштаб).
  nextTick(() => fitToContents({ reset: true }))
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

/** R★ — радиус прежней звезды с центром S (по layout и подписям рёбер). */
function estimateParentStarRadius(starCenterId, current, excludeIds) {
  if (!starCenterId) return 200
  const sp = current[starCenterId]
  if (!sp || !Number.isFinite(sp.x) || !Number.isFinite(sp.y)) return 200
  const exclude = excludeIds || new Set()
  let maxDist = 0
  const starEdges = {}
  for (const [eid, e] of Object.entries(props.edges || {})) {
    if (!e) continue
    if (e.source !== starCenterId && e.target !== starCenterId) continue
    const other = e.source === starCenterId ? e.target : e.source
    if (!other || exclude.has(other)) continue
    starEdges[eid] = e
    const p = current[other]
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) {
      const d = Math.hypot(p.x - sp.x, p.y - sp.y)
      if (d > maxDist) maxDist = d
    }
  }
  return Math.max(200, maxDist, getMinEdgeLengthForLabels(starEdges))
}

/** Мин. радиус нового кольца: подписи рёбер + плотность при L узлах. */
function minRingRadiusForNewNodes(nodeCount, expandEdgesObj) {
  const minEdgeLen = getMinEdgeLengthForLabels(expandEdgesObj)
  const R_labels = Math.max(200, minEdgeLen)
  if (nodeCount < 2) return R_labels
  return Math.max(R_labels, minEdgeLen / (2 * Math.sin(Math.PI / nodeCount)))
}

/**
 * Расстояние хаба X от центра прежней звезды S: d_new ≥ R★ + R_ring + m (с запасом 10%).
 * @param {number} d0 — текущее |X − S|
 */
function hubDistanceFromParentStar(d0, R_star, R_ring, margin, paddingFactor = 1.1) {
  const clearance = (R_star + R_ring + margin) * paddingFactor
  const outwardOnly = d0 > 1e-6 ? d0 + R_ring + margin : clearance
  return Math.max(clearance, outwardOnly)
}

/**
 * Инкрементальное раскрытие: при появлении новых узлов сдвинуть хаб X по оси связи
 * и разложить возвращаемые узлы звездой; если новых узлов нет — геометрию не менять.
 * @param {object} [layoutContext] — { parentStarCenterId, rootNodeId }
 */
function relayoutHubAroundNode(expandedNodeId, nodesToPlaceOnRing, layoutContext = {}) {
  if (!expandedNodeId) return false
  const toPlaceAll = [...new Set((nodesToPlaceOnRing || []).filter((id) => id && id !== expandedNodeId))]
  const current = { ...layoutCache.value, ...(layouts.value?.nodes ?? {}) }
  // Раскладываем только при появлении узлов, которые ещё не разложены нашими алгоритмами: повторное
  // включение уже показанных типов не должно двигать граф (issue #134). Наличие координат в layouts
  // здесь не показатель — библиотека присваивает их новым узлам автоматически.
  const fresh = toPlaceAll.filter((id) => !laidOutNodeIds.has(id))
  if (fresh.length === 0) return false
  const toPlace = toPlaceAll

  const centerX = current[expandedNodeId]?.x ?? 0
  const centerY = current[expandedNodeId]?.y ?? 0
  const L = toPlace.length
  const toPlaceSet = new Set(toPlace)
  const expandEdges = {}
  for (const [eid, e] of Object.entries(props.edges || {})) {
    if (!e) continue
    const fromHub =
      (e.source === expandedNodeId && toPlaceSet.has(e.target)) ||
      (e.target === expandedNodeId && toPlaceSet.has(e.source))
    if (fromHub) expandEdges[eid] = e
  }

  const movingSet = new Set([expandedNodeId, ...toPlace])
  const rootId = layoutContext.rootNodeId || lastLayoutCenterId.value
  const parentId = layoutContext.parentStarCenterId || rootId
  const starCenterId =
    parentId && current[parentId] && Number.isFinite(current[parentId].x) ? parentId : rootId
  const sx = starCenterId && current[starCenterId] ? current[starCenterId].x ?? 0 : 0
  const sy = starCenterId && current[starCenterId] ? current[starCenterId].y ?? 0 : 0

  let dirX = centerX - sx
  let dirY = centerY - sy
  const d0 = Math.hypot(dirX, dirY)
  if (d0 < 1e-6) {
    const semicircle = getExpandSemicircle(expandedNodeId, toPlace, current)
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
    dirX /= d0
    dirY /= d0
  }

  const R_star = estimateParentStarRadius(starCenterId, current, movingSet)
  const margin = GRAPH_NODE_MIN_CENTER_DIST
  const minD = margin
  const minDSq = minD * minD
  const baseR = Math.max(minRingRadiusForNewNodes(L, expandEdges), minD + 12)

  const obstacles = []
  for (const id of Object.keys(props.nodes || {})) {
    if (movingSet.has(id)) continue
    const p = current[id]
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) {
      obstacles.push({ x: p.x, y: p.y })
    }
  }

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

  function ringCandidates(hubX, hubY, R) {
    const cand = []
    for (let i = 0; i < L; i++) {
      const a = L > 0 ? (i / L) * 2 * Math.PI - Math.PI / 2 : -Math.PI / 2
      cand.push({ x: hubX + R * Math.cos(a), y: hubY + R * Math.sin(a) })
    }
    return cand
  }

  const maxR = 3200
  const stepR = 26
  const result = {}
  let placed = false

  // Сдвигаем хаб наружу по оси связи и раскладываем кольцо вокруг него: d_new = f(R★, R, m).
  for (let R = baseR; R <= maxR && !placed; R += stepR) {
    const centerDistance = hubDistanceFromParentStar(d0, R_star, R, margin)
    const hubX = sx + dirX * centerDistance
    const hubY = sy + dirY * centerDistance
    const cand = ringCandidates(hubX, hubY, R)
    if (!candidatesPass(cand)) continue
    result[expandedNodeId] = { x: hubX, y: hubY }
    for (let i = 0; i < L; i++) {
      result[toPlace[i]] = cand[i]
    }
    placed = true
  }

  if (!placed) {
    const R = maxR
    const centerDistance = hubDistanceFromParentStar(d0, R_star, R, margin)
    const hubX = sx + dirX * centerDistance
    const hubY = sy + dirY * centerDistance
    result[expandedNodeId] = { x: hubX, y: hubY }
    const cand = ringCandidates(hubX, hubY, R)
    for (let i = 0; i < L; i++) {
      result[toPlace[i]] = cand[i]
    }
  }

  const nextLayouts = { ...current }
  Object.assign(nextLayouts, result)
  layouts.value = { nodes: nextLayouts }
  laidOutNodeIds.add(expandedNodeId)
  for (const id of toPlace) laidOutNodeIds.add(id)
  return true
}

/** @deprecated Используйте relayoutHubAroundNode(expandedNodeId, nodesToPlaceOnRing). */
function applyLayoutForAddedLevel(expandedNodeId, nodesToPlaceOnRing) {
  relayoutHubAroundNode(expandedNodeId, nodesToPlaceOnRing)
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
      laidOutNodeIds.add(revealed[i])
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

/** Кадр браузера: библиотека пересчитывает bbox и применяет fit асинхронно. */
function nextFrame() {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve())
    else setTimeout(resolve, 0)
  })
}

/**
 * Вписать граф в область (issue #125).
 * `fitToContents()` библиотеки асинхронный: если читать viewBox сразу после вызова,
 * сравнение и «минимальный экстент» работают по устаревшему состоянию и отменяют fit —
 * граф остаётся в слишком крупном масштабе. Поэтому ждём завершения fit и кадр отрисовки.
 * @param {{ reset?: boolean }} opts `reset` — вписать заново (раскладка/resize области);
 *   без него действует правило «только уменьшать масштаб» (раскрытие связей).
 */
async function fitToContents(opts = {}) {
  const g = graphRef.value
  if (!g) return
  const fit = g.fitToContents
  if (typeof fit !== 'function') return
  const getViewBox = typeof g.getViewBox === 'function' ? () => g.getViewBox() : null
  const setViewBox = typeof g.setViewBox === 'function' ? (box) => g.setViewBox(box) : null
  const reset = opts.reset === true
  const beforeBox = !reset && getViewBox ? getViewBox() : null
  await fit.call(g)
  await nextFrame()
  if (beforeBox && getViewBox && setViewBox) {
    const afterBox = getViewBox()
    const beforeW = beforeBox.right - beforeBox.left
    const beforeH = beforeBox.bottom - beforeBox.top
    const afterW = afterBox.right - afterBox.left
    const afterH = afterBox.bottom - afterBox.top
    if (afterW < beforeW || afterH < beforeH) {
      setViewBox(beforeBox)
    }
  }
  const MIN_VIEWBOX = (getConfig().GRAPH_VIEWBOX_MIN ?? 500) | 0
  if (getViewBox && setViewBox) {
    const box = getViewBox()
    const w = box.right - box.left
    const h = box.bottom - box.top
    if (w > 0 && h > 0 && (w < MIN_VIEWBOX || h < MIN_VIEWBOX)) {
      const scale = Math.max(MIN_VIEWBOX / w, MIN_VIEWBOX / h, 1)
      const nw = w * scale
      const nh = h * scale
      const cx = (box.left + box.right) / 2
      const cy = (box.top + box.bottom) / 2
      setViewBox({
        left: cx - nw / 2,
        right: cx + nw / 2,
        top: cy - nh / 2,
        bottom: cy + nh / 2,
      })
    }
  }
}

/**
 * Пересчёт вписывания при изменении области графа: смена вкладки, ширина панели,
 * ресайз окна. Иначе граф остаётся в масштабе, рассчитанном для прежнего размера.
 */
let sizeObserver = null
let sizeRaf = 0
function watchGraphAreaSize() {
  const el = graphWrapRef.value
  if (!el || typeof ResizeObserver === 'undefined' || typeof requestAnimationFrame !== 'function') return
  sizeObserver = new ResizeObserver(() => {
    if (sizeRaf) cancelAnimationFrame(sizeRaf)
    sizeRaf = requestAnimationFrame(() => {
      sizeRaf = 0
      // Авто-вписывание при изменении размера — только во встройке (вкладки форм, issue #125).
      // В анализаторе после первичного построения вьюпорт не трогаем (issue #134): ПКМ/выделение/ресайз
      // не должны сбрасывать масштаб и позицию, выбранные пользователем.
      if (isEmbed.value && Object.keys(props.nodes || {}).length) fitToContents({ reset: true })
    })
  })
  sizeObserver.observe(el)
}
onMounted(watchGraphAreaSize)
onBeforeUnmount(() => {
  if (sizeRaf) cancelAnimationFrame(sizeRaf)
  sizeObserver?.disconnect()
  sizeObserver = null
})

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
  relayoutHubAroundNode,
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
  height: 100%;
  min-height: 0;
}
.analyzer-wrap--embed .analyzer-graph-wrap {
  height: 420px;
  min-height: 280px;
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
.graph-legend,
.graph-relations {
  position: absolute;
  bottom: 10px;
  z-index: 6;
  max-height: 46%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
  font-size: 0.82rem;
  color: var(--ar-text);
}
.graph-legend {
  left: 10px;
  max-width: min(320px, 42vw);
}
.graph-relations {
  right: 10px;
  max-width: min(340px, 46vw);
}
.graph-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0.35rem 0.5rem;
  border-bottom: 1px solid var(--ar-border);
  background: var(--ar-table-head-bg);
}
.graph-panel-title {
  font-size: 0.74rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--ar-muted);
}
.graph-panel-close {
  border: none;
  background: none;
  padding: 0 0.2rem;
  font-size: 1rem;
  line-height: 1;
  color: var(--ar-muted);
  cursor: pointer;
}
.graph-panel-close:hover {
  color: var(--ar-text);
}
.graph-panel-body {
  padding: 8px 10px;
  overflow-y: auto;
  min-height: 0;
}
.graph-panel-empty {
  margin: 0;
  font-size: 0.82rem;
  color: var(--ar-muted);
}
.relation-actions {
  display: flex;
  gap: 6px;
  margin-bottom: 6px;
}
.relation-action {
  flex: 1;
  padding: 0.2rem 0.35rem;
  border: 1px solid var(--ar-border);
  border-radius: 4px;
  background: var(--ar-surface);
  color: var(--ar-text);
  font-size: 0.75rem;
  font-family: inherit;
  cursor: pointer;
}
.relation-action:hover:not(:disabled) {
  background: var(--ar-row-hover);
}
.relation-action:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.relation-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 0;
  cursor: pointer;
}
.relation-row input {
  margin: 0;
  accent-color: var(--ar-accent-hover);
}
.relation-label {
  flex: 1;
  line-height: 1.25;
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
.ctx-submenu {
  position: relative;
}
.ctx-item--submenu {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}
.ctx-caret {
  color: var(--ar-muted);
  font-size: 0.95em;
}
.ctx-submenu-panel {
  display: none;
  position: absolute;
  top: -0.25rem;
  left: calc(100% - 2px);
  min-width: 320px;
  max-width: 460px;
  background: var(--ar-surface);
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.14);
  padding: 0.25rem 0;
  z-index: 1001;
}
.ctx-submenu:hover .ctx-submenu-panel,
.ctx-submenu:focus-within .ctx-submenu-panel {
  display: block;
}
.ctx-submenu--flip .ctx-submenu-panel {
  left: auto;
  right: calc(100% - 2px);
}
.ctx-check {
  display: inline-block;
  width: 1.25rem;
  margin-right: 0.25rem;
  color: var(--ar-link);
}
.ctx-empty {
  padding: 0.35rem 0.75rem 0.4rem;
  font-size: 0.82rem;
  color: var(--ar-muted);
  white-space: nowrap;
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
.modal-card-wide {
  width: min(720px, 90vw);
}
.flows-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}
.flows-table th,
.flows-table td {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--ar-border);
  text-align: left;
  vertical-align: top;
}
.flows-table-action {
  white-space: nowrap;
  width: 1%;
}
.flows-table .muted {
  color: var(--ar-muted);
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

<!--
  Палитра свойств анализатора зависимостей (issue #116).
  Два блока: «Настройки» (каскад, легенда, топология) и «Свойства» (read-only key-value
  выбранного на схеме узла или связи). Идентификаторы разрешаются на клиенте —
  см. utils/analyzerProperties.js.
-->
<template>
  <aside class="palette" :class="{ 'palette--collapsed': collapsed }">
    <div class="palette-head">
      <span v-if="!collapsed" class="palette-head-title">Палитра свойств</span>
      <button
        type="button"
        class="palette-collapse"
        :title="collapsed ? 'Развернуть палитру' : 'Свернуть палитру'"
        :aria-expanded="!collapsed"
        @click="collapsed = !collapsed"
      >
        {{ collapsed ? '›' : '‹' }}
      </button>
    </div>

    <div v-if="!collapsed" class="palette-body">
      <section class="palette-block">
        <h3 class="palette-block-title">Настройки</h3>
        <dl class="palette-kv">
          <div class="palette-row">
            <dt>Связи каскадно</dt>
            <dd>
              <label
                class="palette-switch"
                :class="{ 'palette-switch--disabled': !cascadeAvailable }"
                :title="cascadeAvailable ? '' : 'Доступно, когда граф построен по одному объекту'"
              >
                <input
                  type="checkbox"
                  :checked="showAllEdgesCascade"
                  :disabled="!cascadeAvailable"
                  @change="emit('update:showAllEdgesCascade', $event.target.checked)"
                />
                <span>{{ showAllEdgesCascade ? 'Да' : 'Нет' }}</span>
              </label>
            </dd>
          </div>
          <div class="palette-row">
            <dt>Показать легенду</dt>
            <dd>
              <label class="palette-switch">
                <input
                  type="checkbox"
                  :checked="showLegend"
                  @change="emit('update:showLegend', $event.target.checked)"
                />
                <span>{{ showLegend ? 'Да' : 'Нет' }}</span>
              </label>
            </dd>
          </div>
          <div class="palette-row">
            <dt>Топология графа</dt>
            <dd>
              <select
                class="palette-select"
                :value="layoutType"
                title="Раскладка графа"
                @change="emit('layout', $event.target.value)"
              >
                <option v-for="opt in layoutOptions" :key="opt.type" :value="opt.type">{{ opt.label }}</option>
              </select>
            </dd>
          </div>
        </dl>
      </section>

      <section class="palette-block palette-block--props">
        <h3 class="palette-block-title">Свойства</h3>
        <div class="palette-props">
          <p v-if="!selectionKind" class="palette-empty">
            Выберите узел или связь на графе — ЛКМ или ПКМ.
          </p>
          <p v-else-if="selectionKind === 'node' && nodeLoading" class="palette-empty">Загрузка свойств…</p>
          <template v-else-if="selectionKind === 'node' && nodeError && !nodeData">
            <p class="palette-empty palette-error">{{ nodeError }}</p>
          </template>
          <template v-else-if="activeView">
            <p class="palette-object">{{ activeView.title }}</p>
            <p v-if="activeView.subtitle" class="palette-object-sub">{{ activeView.subtitle }}</p>
            <p v-if="selectionKind === 'node' && nodeError" class="palette-empty palette-error">{{ nodeError }}</p>
            <button
              v-if="activeView.bundledCount"
              type="button"
              class="btn btn-secondary btn-sm palette-flows"
              @click="emit('openFlows', activeView.edgeId)"
            >
              Список потоков ({{ activeView.bundledCount }})…
            </button>
            <table class="palette-table">
              <tbody>
                <tr v-for="row in activeView.rows" :key="row.key">
                  <th scope="row" :title="row.key">{{ row.label }}</th>
                  <td :class="{ 'palette-dim': row.kind === 'empty' }" :title="row.hint || row.key">
                    <pre v-if="row.kind === 'json'" class="palette-json">{{ row.text }}</pre>
                    <template v-else>{{ row.text }}</template>
                  </td>
                </tr>
              </tbody>
            </table>
            <p class="palette-hint">Данные только для просмотра (без изменения).</p>
          </template>
        </div>
      </section>
    </div>
  </aside>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { fetchEntity } from '../api/graphApi'
import { getEntityTypeConfig, parseNodeId } from '../utils/entityTypeConfig'
import { buildEdgePropertyView, buildNodePropertyView } from '../utils/analyzerProperties'

const props = defineProps({
  /** Значение переключателя «Связи каскадно» (v-model с родителем). */
  showAllEdgesCascade: { type: Boolean, default: false },
  /** Признак доступности каскада: граф построен по одному объекту (есть корень). */
  cascadeAvailable: { type: Boolean, default: true },
  /** Значение переключателя «Показать легенду». */
  showLegend: { type: Boolean, default: false },
  /** Текущая раскладка (совпадает с применённой в графе). */
  layoutType: { type: String, default: 'grid' },
  /** Список доступных раскладок: [{ type, label }]. */
  layoutOptions: { type: Array, default: () => [] },
  /** Активный узел (nodeId вида `system:12`) либо null. */
  selectedNodeId: { type: String, default: null },
  /** Активная связь (edgeId вида `rel-42`) либо null. */
  selectedEdgeId: { type: String, default: null },
  nodes: { type: Object, default: () => ({}) },
  edges: { type: Object, default: () => ({}) },
  relations: { type: Array, default: () => [] },
  relationTypes: { type: Array, default: () => [] },
})

const emit = defineEmits(['update:showAllEdgesCascade', 'update:showLegend', 'layout', 'openFlows'])

const collapsed = ref(false)
const nodeData = ref(null)
const nodeLoading = ref(false)
const nodeError = ref('')
/** Токен запроса: защищает от гонки при быстром переключении узлов. */
let loadToken = 0

const selectionKind = computed(() => {
  if (props.selectedNodeId) return 'node'
  if (props.selectedEdgeId) return 'edge'
  return ''
})

const activeEdge = computed(() => (props.selectedEdgeId ? props.edges[props.selectedEdgeId] || null : null))

/** Строка реестра связей для выбранного ребра (у пучка её нет — только объект ребра). */
const activeRelation = computed(() => {
  const edge = activeEdge.value
  if (!edge || edge.relationId == null) return null
  return (props.relations || []).find((r) => String(r && r.id) === String(edge.relationId)) || null
})

const activeView = computed(() => {
  if (props.selectedEdgeId) {
    if (!activeEdge.value) return null
    return buildEdgePropertyView({
      edgeId: props.selectedEdgeId,
      edge: activeEdge.value,
      relation: activeRelation.value,
      nodes: props.nodes,
      relationTypes: props.relationTypes,
    })
  }
  if (props.selectedNodeId && nodeData.value) {
    const p = parseNodeId(props.selectedNodeId)
    if (!p) return null
    return buildNodePropertyView({
      entityType: p.entityType,
      entityId: p.entityId,
      typeLabel: getEntityTypeConfig(p.entityType).label,
      data: nodeData.value,
      nodes: props.nodes,
      fallbackName: props.nodes?.[props.selectedNodeId]?.name,
    })
  }
  return null
})

/** Загрузка свойств узла: один GET detail-эндпоинта (как ПКМ → «Просмотр»). */
async function loadNode(nid) {
  const token = ++loadToken
  nodeData.value = null
  nodeError.value = ''
  if (!nid) {
    nodeLoading.value = false
    return
  }
  const p = parseNodeId(nid)
  if (!p) {
    nodeError.value = 'Некорректный идентификатор узла'
    nodeLoading.value = false
    return
  }
  nodeLoading.value = true
  try {
    const data = await fetchEntity(p.entityType, p.entityId)
    if (token !== loadToken) return
    nodeData.value = data || null
    if (data && data._error) nodeError.value = String(data._error)
  } catch (e) {
    if (token !== loadToken) return
    nodeError.value = (e && e.message) || 'Ошибка загрузки свойств'
  } finally {
    if (token === loadToken) nodeLoading.value = false
  }
}

watch(
  () => props.selectedNodeId,
  (nid) => {
    void loadNode(nid)
  },
  { immediate: true },
)
</script>

<style scoped>
.palette {
  display: flex;
  flex-direction: column;
  flex: 0 0 320px;
  width: 320px;
  min-width: 0;
  background: var(--ar-surface);
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius);
  overflow: hidden;
}
.palette--collapsed {
  flex-basis: 36px;
  width: 36px;
}
.palette-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.25rem;
  padding: 0.4rem 0.5rem;
  border-bottom: 1px solid var(--ar-border);
  background: var(--ar-table-head-bg);
}
.palette-head-title {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--ar-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.palette-collapse {
  border: 1px solid var(--ar-border);
  border-radius: 4px;
  background: var(--ar-surface);
  color: var(--ar-text);
  font-size: 0.85rem;
  line-height: 1;
  padding: 0.15rem 0.35rem;
  cursor: pointer;
}
.palette-collapse:hover {
  background: var(--ar-row-hover);
}
.palette-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.55rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.palette-block {
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  overflow: hidden;
}
.palette-block-title {
  margin: 0;
  padding: 0.35rem 0.5rem;
  background: var(--ar-table-head-bg);
  border-bottom: 1px solid var(--ar-border);
  font-size: 0.74rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--ar-muted);
}
.palette-kv {
  margin: 0;
  padding: 0.4rem 0.5rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.palette-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.84rem;
}
.palette-row dt {
  color: var(--ar-text);
}
.palette-row dd {
  margin: 0;
}
.palette-switch {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  cursor: pointer;
  font-size: 0.84rem;
  white-space: nowrap;
}
.palette-switch--disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.palette-select {
  max-width: 152px;
  padding: 0.2rem 0.3rem;
  border: 1px solid var(--ar-border);
  border-radius: 4px;
  background: var(--ar-surface);
  color: var(--ar-text);
  font-size: 0.82rem;
}
.palette-props {
  padding: 0.4rem 0.5rem 0.5rem;
}
.palette-object {
  margin: 0.1rem 0 0;
  font-size: 0.87rem;
  font-weight: 600;
  word-break: break-word;
}
.palette-object-sub {
  margin: 0.1rem 0 0.45rem;
  font-size: 0.77rem;
  color: var(--ar-muted);
  word-break: break-word;
}
.palette-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.79rem;
  table-layout: fixed;
}
.palette-table th,
.palette-table td {
  text-align: left;
  vertical-align: top;
  padding: 0.22rem 0.25rem;
  border-bottom: 1px solid var(--ar-border);
  overflow-wrap: anywhere;
}
.palette-table tr:last-child th,
.palette-table tr:last-child td {
  border-bottom: none;
}
.palette-table th {
  width: 44%;
  font-weight: 500;
  color: var(--ar-muted);
}
.palette-json {
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.72rem;
  white-space: pre-wrap;
  max-height: 220px;
  overflow: auto;
}
.palette-dim {
  color: var(--ar-muted);
}
.palette-empty {
  margin: 0.2rem 0;
  font-size: 0.82rem;
  color: var(--ar-muted);
}
.palette-error {
  color: var(--ar-danger);
}
.palette-flows {
  margin: 0 0 0.5rem;
}
.palette-hint {
  margin: 0.5rem 0 0;
  font-size: 0.72rem;
  color: var(--ar-muted);
}
</style>

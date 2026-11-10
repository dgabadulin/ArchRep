<template>
  <aside class="diagram-palette">
    <h3 class="palette-title">Состав решения</h3>
    <p class="palette-hint">
      Добавляйте системы и потоки — на схеме они появятся сразу. В реестры ничего не пишется
      до кнопки «Сохранить».
    </p>

    <p v-if="message" :class="['palette-notice', { error: !messageOk }]">{{ message }}</p>
    <div v-if="state.loadError" class="palette-error">{{ state.loadError }}</div>

    <!-- Системы -->
    <section class="palette-group">
      <h4>Системы</h4>
      <div class="palette-row">
        <select v-model="pickSystemId" class="palette-input">
          <option value="">— Существующая система —</option>
          <option v-for="s in state.systemCatalog" :key="s.id" :value="String(s.id)">
            {{ s.display_name || s.name }}
          </option>
        </select>
        <button type="button" class="btn btn-secondary btn-sm" :disabled="!pickSystemId" @click="addExistingSystem">
          Добавить
        </button>
      </div>
      <div class="palette-row">
        <button type="button" class="btn btn-secondary btn-sm" @click="openSystemForm">+ Новая система</button>
      </div>

      <ul class="palette-list">
        <li v-for="s in state.systems" :key="s.ref" :class="{ active: s.ref === activeSystemRef }">
          <span class="badge" :class="s.kind">{{ s.kind === 'new' ? 'новая' : 'репо' }}</span>
          <button type="button" class="link" :title="'Функции системы'" @click="selectSystem(s.ref)">
            {{ s.label || '—' }}
          </button>
          <select
            class="palette-status"
            :value="s.statusCode || null"
            @change="onStatusChange(s.ref, $event)"
          >
            <option :value="null">— статус —</option>
            <option v-for="st in state.systemStatuses" :key="st.code" :value="st.code">{{ st.name }}</option>
          </select>
          <button type="button" class="link danger" @click="removeEntity(s.ref)">Удалить</button>
        </li>
      </ul>
      <p v-if="!state.systems.length" class="palette-empty">Систем на схеме нет.</p>
    </section>

    <!-- Функции выбранной системы -->
    <section v-if="activeSystem" class="palette-group">
      <h4>Функции системы «{{ activeSystem.label || '—' }}»</h4>
      <p class="palette-sub">
        {{ (activeSystem.functions || []).map((f) => f.name).join(', ') || 'не выбраны' }}
      </p>
      <button type="button" class="btn btn-secondary btn-sm" @click="openFunctions">Изменить функции</button>
    </section>

    <!-- Потоки -->
    <section class="palette-group">
      <h4>Потоки (связи)</h4>
      <div class="palette-row">
        <select v-model="relFrom" class="palette-input">
          <option value="">Источник</option>
          <option v-for="s in state.systems" :key="s.ref" :value="s.ref">{{ s.label || s.ref }}</option>
        </select>
        <select v-model="relTo" class="palette-input">
          <option value="">Приёмник</option>
          <option v-for="s in state.systems" :key="s.ref" :value="s.ref">{{ s.label || s.ref }}</option>
        </select>
      </div>
      <div class="palette-row">
        <select v-model="relFlowId" class="palette-input" :disabled="!canAddRelation">
          <option value="">— Существующий поток —</option>
          <option v-for="f in relFlowOptions" :key="f.id" :value="String(f.id)">{{ f.label }}</option>
        </select>
      </div>
      <div class="palette-row">
        <button type="button" class="btn btn-secondary btn-sm" :disabled="!canAddRelation || !relFlowId" @click="addExistingRelation">
          В решение
        </button>
        <button type="button" class="btn btn-secondary btn-sm" :disabled="!canAddRelation" @click="openFlowForm">
          + Новый поток
        </button>
      </div>

      <ul class="palette-list">
        <li v-for="r in state.relations" :key="r.ref">
          <span class="badge" :class="r.flowId ? 'existing' : 'new'">{{ r.flowId ? 'репо' : 'новый' }}</span>
          <span class="palette-name">{{ relationLabel(r) }}</span>
          <select class="palette-status" :value="r.statusCode || null" @change="onStatusChange(r.ref, $event)">
            <option :value="null">— статус —</option>
            <option v-for="st in state.relationStatuses" :key="st.code" :value="st.code">{{ st.name }}</option>
          </select>
          <button type="button" class="link danger" @click="removeEntity(r.ref)">Удалить</button>
        </li>
      </ul>
      <p v-if="!state.relations.length" class="palette-empty">Связей нет.</p>
    </section>

    <div class="palette-actions">
      <button type="button" class="btn btn-secondary btn-sm" :disabled="state.saving" @click="refreshDiagram">
        Обновить диаграмму
      </button>
      <button type="button" class="btn btn-primary btn-sm" :disabled="state.saving" @click="save">
        {{ state.saving ? 'Сохранение…' : 'Сохранить' }}
      </button>
    </div>

    <DiagramDraftForm
      :show="draftForm.open"
      :kind="draftForm.kind"
      :title="draftForm.title"
      :initial="draftForm.initial"
      :status-options="draftStatusOptions"
      :flow-options="relFlowOptions"
      :errors="draftForm.errors"
      @submit="onDraftSubmit"
      @close="closeDraftForm"
    />

    <IncrementSystemFunctionsModal
      :show="functionsOpen"
      :system-name="activeSystem ? (activeSystem.label || '') : ''"
      :catalog="functionCatalog"
      :selected="selectedForModal"
      @close="functionsOpen = false"
      @save="onFunctionsSaved"
    />
  </aside>
</template>

<script setup>
/**
 * Палитра «Заполнить из диаграммы» — ввод состава решения вокруг редактора draw.io.
 *
 * Перенос панели модуля DrawIO Pro в ядро: системы/функции/потоки вводятся здесь и сразу
 * попадают на схему; в реестры ничего не пишется до кнопки «Сохранить» (см. `useDiagramDraft`).
 * Функции системы отображаются строками в теле узла — как рисует серверный генератор.
 */
import { ref, computed, onMounted } from 'vue'
import { api } from '../api/client'
import * as dm from '../utils/diagramModel'
import { useDiagramDraft } from '../composables/useDiagramDraft'
import DiagramDraftForm from './DiagramDraftForm.vue'
import IncrementSystemFunctionsModal from './IncrementSystemFunctionsModal.vue'

const props = defineProps({
  appliedId: { type: [Number, String], default: null },
  incrementId: { type: [Number, String], default: null },
  incrementName: { type: String, default: '' },
  orderIndex: { type: Number, default: 1 },
  /** Передать собранную схему в редактор: (xml) => void. */
  loadXml: { type: Function, default: null },
  /** Получить текущий xml с холста: () => Promise<string>. */
  getXml: { type: Function, default: null },
})

const emit = defineEmits(['saved'])

const draft = useDiagramDraft({
  appliedId: props.appliedId,
  incrementId: props.incrementId,
  incrementName: props.incrementName,
  orderIndex: props.orderIndex,
})
const state = draft.state

const pickSystemId = ref('')
const activeSystemRef = ref('')
const functionCatalog = ref([])
const functionsOpen = ref(false)
const relFrom = ref('')
const relTo = ref('')
const relFlowId = ref('')
const message = ref('')
const messageOk = ref(true)
const draftForm = ref({ open: false, kind: 'system', title: '', initial: null, errors: [] })

const activeSystem = computed(() => state.systems.find((s) => s.ref === activeSystemRef.value) || null)

const selectedForModal = computed(() => (activeSystem.value ? activeSystem.value.functions : []).map((f) => ({
  ar_system_functions_id: f.id,
  name: f.name,
  description: '',
  increment_sysfunc_status_code: f.statusCode,
})))

const canAddRelation = computed(() => Boolean(relFrom.value && relTo.value && relFrom.value !== relTo.value))

/** Потоки реестра: подпись «источник → приёмник», как на форме заключения. */
const relFlowOptions = computed(() => (state.flowCatalog || []).map((fl) => {
  const s = fl.source_display_name || fl.source_name || ''
  const t = fl.target_display_name || fl.target_name || ''
  return { id: fl.id, label: s || t ? `${s} → ${t}` : `Поток #${fl.id}` }
}))

const draftStatusOptions = computed(() => (draftForm.value.kind === 'flow'
  ? state.relationStatuses
  : state.systemStatuses))

function setMessage(text, ok = true) {
  message.value = text
  messageOk.value = ok
}

function relationLabel(r) {
  const from = state.systems.find((s) => s.ref === r.fromRef)
  const to = state.systems.find((s) => s.ref === r.toRef)
  const endpoints = `${from ? (from.label || from.ref) : '?'} → ${to ? (to.label || to.ref) : '?'}`
  return r.label ? `${endpoints}: ${r.label}` : endpoints
}

async function selectSystem(ref) {
  activeSystemRef.value = ref
  const sys = state.systems.find((s) => s.ref === ref)
  functionCatalog.value = []
  if (sys && sys.kind !== 'new' && sys.id != null) {
    functionCatalog.value = (await api.getSystemFunctions(sys.id).catch(() => [])) || []
  }
}

function addExistingSystem() {
  if (!pickSystemId.value) return
  const sys = draft.addExistingSystem({ id: pickSystemId.value })
  pickSystemId.value = ''
  if (sys) {
    activeSystemRef.value = sys.ref
    selectSystem(sys.ref)
  }
  refreshDiagram()
}

function openSystemForm() {
  draftForm.value = { open: true, kind: 'system', title: 'Новая система', initial: null, errors: [] }
}

function openFlowForm() {
  draftForm.value = {
    open: true,
    kind: 'flow',
    title: 'Новый поток',
    initial: { label: '', statusCode: 'ADR_INCR_REL_CREATING', flowId: null },
    errors: [],
  }
}

function closeDraftForm() {
  draftForm.value = { ...draftForm.value, open: false, errors: [] }
}

function onDraftSubmit(values) {
  if (draftForm.value.kind === 'system') {
    if (!String(values.label || '').trim()) {
      draftForm.value = { ...draftForm.value, errors: [{ field: 'label', message: 'Укажите наименование системы' }] }
      return
    }
    const sys = draft.addNewSystem({ label: String(values.label).trim(), statusCode: values.statusCode })
    if (sys && values.code) sys.code = String(values.code).trim()
    closeDraftForm()
    activeSystemRef.value = sys ? sys.ref : ''
    functionCatalog.value = []
    refreshDiagram()
    return
  }

  if (!String(values.label || '').trim()) {
    draftForm.value = { ...draftForm.value, errors: [{ field: 'label', message: 'Укажите передаваемые данные' }] }
    return
  }
  draft.addRelation({
    fromRef: relFrom.value,
    toRef: relTo.value,
    label: String(values.label).trim(),
    statusCode: values.statusCode,
    flowId: values.flowId,
  })
  closeDraftForm()
  refreshDiagram()
}

function addExistingRelation() {
  const flow = (state.flowCatalog || []).find((f) => String(f.id) === String(relFlowId.value))
  if (!flow) return
  const option = (relFlowOptions.value || []).find((f) => String(f.id) === String(flow.id))
  draft.addRelation({
    fromRef: relFrom.value,
    toRef: relTo.value,
    label: option ? option.label : `Поток #${flow.id}`,
    statusCode: 'ADR_INCR_REL_IN_USE',
    flowId: flow.id,
  })
  relFlowId.value = ''
  refreshDiagram()
}

function onStatusChange(ref, event) {
  draft.setStatus(ref, event.target.value || null)
  refreshDiagram()
}

function removeEntity(ref) {
  draft.remove(ref)
  if (activeSystemRef.value === ref) activeSystemRef.value = ''
  refreshDiagram()
}

async function openFunctions() {
  if (!activeSystem.value) return
  if (activeSystem.value.kind !== 'new' && activeSystem.value.id != null && !functionCatalog.value.length) {
    functionCatalog.value = (await api.getSystemFunctions(activeSystem.value.id).catch(() => [])) || []
  }
  functionsOpen.value = true
}

function onFunctionsSaved(list) {
  if (activeSystem.value) draft.setFunctions(activeSystem.value.ref, list)
  functionsOpen.value = false
  refreshDiagram()
}

/** Пересобрать схему из состава, сохранив позиции и маршруты с холста. */
async function refreshDiagram() {
  let current = ''
  if (typeof props.getXml === 'function') {
    try {
      current = await props.getXml()
    } catch (_) {
      current = ''
    }
  }
  const geometry = current ? dm.extractGeometry(current) : undefined
  const xml = draft.toMxfile({ geometry })
  if (typeof props.loadXml === 'function') props.loadXml(xml)
  return xml
}

async function save() {
  setMessage('')
  try {
    const xml = typeof props.getXml === 'function' ? await props.getXml() : draft.toMxfile()
    const result = await draft.save({ xml })
    setMessage('Сохранено: состав решения и файл .drawio записаны.', true)
    emit('saved', result)
  } catch (e) {
    const errs = (e && e.errors) || []
    setMessage(errs.length ? errs.map((x) => x.message).join('; ') : (e?.message || 'Ошибка сохранения'), false)
  }
}

onMounted(async () => {
  await draft.load(props.incrementId)
  // Пустой холст при непустом составе (схема ещё не формировалась) — рисуем состав.
  let current = ''
  if (typeof props.getXml === 'function') {
    try {
      current = await props.getXml()
    } catch (_) {
      current = ''
    }
  }
  const hasCells = /id=["'](?:draft-)?sys-\d+["']/.test(current || '')
  if (!hasCells && (state.systems.length || state.relations.length)) {
    await refreshDiagram()
  }
})
</script>

<style scoped>
.diagram-palette {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 21rem;
  min-width: 18rem;
  max-width: 26rem;
  overflow-y: auto;
  padding: 0.6rem 0.75rem 1rem;
  border-right: 1px solid var(--ar-border);
  background: var(--ar-surface);
  font-size: 0.9rem;
}
.palette-title { margin: 0; font-size: 1rem; }
.palette-hint { margin: 0; color: var(--ar-muted); font-size: 0.8rem; line-height: 1.35; }
.palette-group { border: 1px solid var(--ar-border); border-radius: var(--ar-radius); padding: 0.5rem 0.65rem; }
.palette-group h4 { margin: 0 0 0.45rem; font-size: 0.92rem; }
.palette-row { display: flex; gap: 0.35rem; align-items: center; margin-bottom: 0.4rem; flex-wrap: wrap; }
.palette-input {
  flex: 1 1 8rem;
  min-width: 6rem;
  padding: 0.3rem 0.4rem;
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  background: var(--ar-surface);
  font: inherit;
}
.palette-list { list-style: none; margin: 0.35rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.3rem; }
.palette-list li { display: flex; gap: 0.35rem; align-items: center; }
.palette-list li.active .link { font-weight: 600; }
.palette-name { flex: 1 1 auto; }
.palette-status {
  max-width: 8.5rem;
  padding: 0.15rem 0.25rem;
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  background: var(--ar-surface);
  font-size: 0.78rem;
}
.badge { padding: 0.05rem 0.35rem; border-radius: 4px; font-size: 0.7rem; white-space: nowrap; }
.badge.existing { background: #e3f2fd; color: #1565c0; }
.badge.new { background: #e8f5e9; color: #2e7d32; }
.link { background: none; border: none; color: var(--ar-accent); cursor: pointer; padding: 0; font: inherit; text-align: left; }
.link.danger { color: var(--ar-danger); }
.palette-empty { margin: 0.35rem 0 0; color: var(--ar-muted); font-size: 0.82rem; }
.palette-sub { margin: 0 0 0.45rem; color: var(--ar-muted); font-size: 0.82rem; }
.palette-actions { display: flex; gap: 0.5rem; justify-content: flex-end; }
.palette-notice { margin: 0; padding: 0.35rem 0.6rem; border-radius: 6px; background: #e8f5e9; color: #1a5d1a; font-size: 0.82rem; }
.palette-notice.error { background: #fdecea; color: var(--ar-danger); }
.palette-error { color: var(--ar-danger); font-size: 0.82rem; }
</style>

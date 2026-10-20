<template>
  <div v-if="show" class="modal-overlay" role="dialog" aria-modal="true">
    <div class="modal modal-relations">
      <h3>Интеграции в решении</h3>

      <div class="rel-pair">
        <div class="form-row">
          <label>Система-источник</label>
          <select v-model="fromKey" @change="onPairChange">
            <option :value="null">—</option>
            <optgroup label="Системы в решении">
              <option v-for="o in registryOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
            </optgroup>
            <optgroup v-if="draftOptions.length" label="Новые системы заключения">
              <option v-for="o in draftOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
            </optgroup>
          </select>
        </div>
        <div class="form-row">
          <label>Система-получатель</label>
          <select v-model="toKey" @change="onPairChange">
            <option :value="null">—</option>
            <optgroup label="Системы в решении">
              <option v-for="o in registryOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
            </optgroup>
            <optgroup v-if="draftOptions.length" label="Новые системы заключения">
              <option v-for="o in draftOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
            </optgroup>
          </select>
        </div>
      </div>
      <p class="modal-hint">
        Указывается направление <b>передачи данных</b> (источник → получатель), а не направление инициирующего вызова.
      </p>

      <div class="dual-grid">
        <div class="dual-col">
          <label class="dual-label">Существующие потоки данных</label>
          <div v-if="!pairFilled" class="dual-empty">Выберите источник и получателя.</div>
          <div v-else-if="pairSame" class="dual-empty">Источник и получатель должны различаться.</div>
          <div v-else-if="pairHasNew" class="dual-empty">Для новых систем потоков в реестре ещё нет — используйте «Создать».</div>
          <div v-else-if="flowsLoading" class="dual-empty">Загрузка…</div>
          <select v-else v-model="pickedFlowId" class="dual-select" size="10">
            <option :value="null">—</option>
            <option v-for="f in freeFlows" :key="f.id" :value="f.id">{{ flowRowLabel(f) }}</option>
          </select>
          <p v-if="pairReady && !pairHasNew && !flowsLoading && freeFlows.length === 0" class="dual-empty">
            В реестре отсутствуют потоки данных по заданным условиям — используйте кнопку «Создать».
          </p>
        </div>

        <div class="dual-btns">
          <button type="button" class="btn btn-secondary btn-sm" :disabled="!pairReady || !pickedFlowId" @click="useExisting">
            &gt;&gt; В решение
          </button>
          <button type="button" class="btn btn-secondary btn-sm" :disabled="!pairReady || !pickedRightKey" @click="removeRight">
            &lt;&lt; Убрать
          </button>
          <button type="button" class="btn btn-primary btn-sm" :disabled="!pairReady" @click="openCreate">Создать</button>
        </div>

        <div class="dual-col">
          <label class="dual-label">Интеграции в решении</label>
          <p v-if="!pairFilled" class="dual-empty">Выберите источник и получателя.</p>
          <p v-else-if="pairSame" class="dual-empty">Источник и получатель должны различаться.</p>
          <template v-else>
            <ul class="dual-right">
              <li
                v-for="r in rightFiltered"
                :key="r._key"
                class="dual-right-item"
                :class="{ 'is-active': pickedRightKey === r._key }"
                @click="pickedRightKey = r._key"
              >
                <span class="rel-data">{{ r.transferred_data || '—' }}</span>
                <span class="rel-status">{{ statusLabel(r) }}</span>
                <span v-if="r._local" class="dual-badge" title="Не сохранено в заключении">новая</span>
                <span v-else-if="r.ar_integration_flows_id" class="dual-badge" title="Существующий поток реестра">из реестра</span>
                <button type="button" class="btn-link btn-sm" @click.stop="openEdit(r)">Изменить</button>
              </li>
            </ul>
          </template>
        </div>
      </div>

      <div v-if="formError" class="error">{{ formError }}</div>
      <div class="modal-actions">
        <button type="button" class="btn btn-primary" @click="onSave">Сохранить</button>
        <button type="button" class="btn btn-secondary" @click="$emit('close')">Отмена</button>
      </div>
    </div>

    <div v-if="formOpen" class="modal-overlay modal-nested">
      <div class="modal modal-rel-form">
        <h4>{{ formTitle }}</h4>
        <div class="form-row">
          <label>Система-источник <span class="req">*</span></label>
          <select v-model="form.from_key">
            <option :value="null">—</option>
            <optgroup label="Системы в решении">
              <option v-for="o in registryOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
            </optgroup>
            <optgroup v-if="draftOptions.length" label="Новые системы заключения">
              <option v-for="o in draftOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
            </optgroup>
          </select>
        </div>
        <div class="form-row">
          <label>Система-получатель <span class="req">*</span></label>
          <select v-model="form.to_key">
            <option :value="null">—</option>
            <optgroup label="Системы в решении">
              <option v-for="o in registryOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
            </optgroup>
            <optgroup v-if="draftOptions.length" label="Новые системы заключения">
              <option v-for="o in draftOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
            </optgroup>
          </select>
        </div>
        <div class="form-row">
          <label>Тип инициирующего события</label>
          <select v-model="form.ar_integration_flow_event_types_id">
            <option :value="null">—</option>
            <option v-for="t in eventTypes" :key="t.id" :value="t.id">{{ t.name }}</option>
          </select>
        </div>
        <div class="form-row">
          <label>Периодичность</label>
          <input v-model="form.periodicity" type="text" placeholder="Напр. ежедневно, по требованию" />
        </div>
        <div class="form-row">
          <label>Передаваемые данные</label>
          <textarea v-model="form.transferred_data" rows="2"></textarea>
        </div>
        <div class="form-row">
          <label>Способ передачи</label>
          <input v-model="form.transfer_method" type="text" />
        </div>
        <div class="form-row">
          <label>Статус связи в заключении</label>
          <select v-model="form.ar_adr_increment_relation_statuses_id">
            <option :value="null">—</option>
            <option v-for="st in relationStatuses" :key="st.id" :value="st.id">{{ st.name }}</option>
          </select>
        </div>
        <p v-if="form.ar_integration_flows_id" class="modal-hint">
          Существующий поток реестра №{{ form.ar_integration_flows_id }}<template v-if="formFlowStatusLabel"> · текущий статус: {{ formFlowStatusLabel }}</template>
        </p>
        <div v-if="formError" class="error">{{ formError }}</div>
        <div class="modal-actions">
          <button type="button" class="btn btn-primary" @click="applyForm">Сохранить</button>
          <button type="button" class="btn btn-secondary" @click="formOpen = false">Отмена</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { api } from '../api/client'
import { getConfig } from '@/config/params'

const props = defineProps({
  show: { type: Boolean, default: false },
  /** Опции систем решения: реестровые (`s:<id>`). */
  registryOptions: { type: Array, default: () => [] },
  /** Опции новых (черновых) систем заключения (`n:<localId>`). */
  draftOptions: { type: Array, default: () => [] },
  /** Связи решения (рабочая копия). */
  relations: { type: Array, default: () => [] },
  relationStatuses: { type: Array, default: () => [] },
  eventTypes: { type: Array, default: () => [] },
  /**
   * Статус связи по умолчанию (id) для новых связей решения — из черновика ИИ (issue #78).
   * Приоритетнее встроенного дефолта модалки (параметры `ADR_INCR_REL_NEW_STATUS_CODE` для новой связи,
   * `ADR_INCR_REL_EXISTING_STATUS_CODE` для связи из реестра, issue #91): пользователь видит статус
   * в форме и может его изменить.
   */
  defaultRelationStatusId: { type: [Number, String], default: null },
})

const emit = defineEmits(['close', 'save'])

const fromKey = ref(null)
const toKey = ref(null)
const flows = ref([])
const flowsLoading = ref(false)
const pickedFlowId = ref(null)
const pickedRightKey = ref(null)

const rightList = ref([])
const formOpen = ref(false)
const formMode = ref('create')
const formError = ref('')
const form = ref(emptyForm())
let seq = 0

/**
 * Уникальный ключ локальной (ещё не в БД) связи.
 * `seq` сбрасывается в 0 при каждом открытии модалки, поэтому слепое ``l:${++seq}`` во второй
 * сессии снова вернуло бы `l:1` — ключ уже добавленной связи из `props.relations`; тогда
 * `applyForm` находит совпадение по `_key` и ПЕРЕЗАПИСЫВАЕТ первую связь вместо добавления второй.
 */
function nextLocalKey() {
  const used = new Set(rightList.value.map((r) => r._key))
  let key
  do {
    key = `l:${++seq}`
  } while (used.has(key))
  return key
}

function emptyForm() {
  return {
    _key: null,
    ar_integration_flows_id: null,
    from_key: null,
    to_key: null,
    ar_integration_flow_event_types_id: null,
    periodicity: '',
    transferred_data: '',
    transfer_method: '',
    ar_adr_increment_relation_statuses_id: null,
  }
}

const pairFilled = computed(() => !!(fromKey.value && toKey.value))
const pairSame = computed(() => !!(fromKey.value && toKey.value) && fromKey.value === toKey.value)
const pairReady = computed(() => pairFilled.value && !pairSame.value)
const pairHasNew = computed(() =>
  String(fromKey.value || '').startsWith('n:') || String(toKey.value || '').startsWith('n:')
)
/** Правая панель фильтруется по выбранной паре (issue #74). */
const rightFiltered = computed(() =>
  pairFilled.value
    ? rightList.value.filter((r) => r.from_key === fromKey.value && r.to_key === toKey.value)
    : []
)
const usedFlowIds = computed(() => {
  const s = new Set()
  for (const r of rightList.value) {
    const id = Number(r.ar_integration_flows_id)
    if (Number.isFinite(id) && id > 0) s.add(id)
  }
  return s
})
const freeFlows = computed(() => flows.value.filter((f) => !usedFlowIds.value.has(Number(f.id))))

async function onPairChange() {
  pickedFlowId.value = null
  pickedRightKey.value = null
  flows.value = []
  if (!pairReady.value || pairHasNew.value) return
  const src = Number(String(fromKey.value).slice(2))
  const tgt = Number(String(toKey.value).slice(2))
  if (!Number.isFinite(src) || !Number.isFinite(tgt)) return
  flowsLoading.value = true
  try {
    flows.value = (await api.getIntegrationFlows({ source_id: src, target_id: tgt })) || []
  } catch (_) {
    flows.value = []
  } finally {
    flowsLoading.value = false
  }
}

function flowRowLabel(f) {
  const parts = []
  if (f.event_type_name) parts.push(f.event_type_name)
  parts.push(f.transferred_data || '—')
  if (f.status_name) parts.push(f.status_name)
  return parts.join(' · ')
}

function statusLabel(r) {
  if (r.status_name) return r.status_name
  const st = (props.relationStatuses || []).find(
    (s) => Number(s.id) === Number(r.ar_adr_increment_relation_statuses_id)
  )
  return st ? st.name : '—'
}

function statusIdByCode(code) {
  const st = (props.relationStatuses || []).find((s) => String(s.code || '').trim() === code)
  return st ? st.id : null
}

/**
 * Код статуса связи для новой связи решения — параметр `ADR_INCR_REL_NEW_STATUS_CODE` (issue #91),
 * как в форме заключения: значения правит администратор, а не код.
 */
function relationNewStatusCode() {
  return String(getConfig().ADR_INCR_REL_NEW_STATUS_CODE || 'ADR_INCR_REL_CREATING')
}

/** Код статуса связи для уже существующего потока реестра — параметр `ADR_INCR_REL_EXISTING_STATUS_CODE`. */
function relationExistingStatusCode() {
  return String(getConfig().ADR_INCR_REL_EXISTING_STATUS_CODE || 'ADR_INCR_REL_IN_USE')
}

const formFlowStatusLabel = computed(() => {
  const id = form.value.ar_integration_flows_id
  if (!id) return ''
  const f = flows.value.find((x) => Number(x.id) === Number(id))
  if (f) return f.status_name || ''
  const r = (props.relations || []).find((x) => Number(x.ar_integration_flows_id) === Number(id))
  return r ? (r.flow_status_name || r.status_name || '') : ''
})

const formTitle = computed(() =>
  formMode.value === 'create' ? 'Новая интеграция' : formMode.value === 'link' ? 'Использовать существующий поток' : 'Изменить интеграцию'
)

function openCreate() {
  form.value = {
    ...emptyForm(),
    from_key: fromKey.value,
    to_key: toKey.value,
    ar_adr_increment_relation_statuses_id: props.defaultRelationStatusId ?? statusIdByCode(relationNewStatusCode()),
  }
  formMode.value = 'create'
  formError.value = ''
  formOpen.value = true
}

function useExisting() {
  const f = flows.value.find((x) => Number(x.id) === Number(pickedFlowId.value))
  if (!f) return
  form.value = {
    ...emptyForm(),
    ar_integration_flows_id: f.id,
    from_key: fromKey.value,
    to_key: toKey.value,
    ar_integration_flow_event_types_id: f.ar_integration_flow_event_types_id || null,
    periodicity: f.periodicity || '',
    transferred_data: f.transferred_data || '',
    transfer_method: f.transfer_method || '',
    ar_adr_increment_relation_statuses_id: props.defaultRelationStatusId ?? statusIdByCode(relationExistingStatusCode()),
  }
  formMode.value = 'link'
  formError.value = ''
  formOpen.value = true
}

function openEdit(r) {
  form.value = {
    _key: r._key,
    ar_integration_flows_id: r.ar_integration_flows_id || null,
    from_key: r.from_key,
    to_key: r.to_key,
    ar_integration_flow_event_types_id: r.ar_integration_flow_event_types_id || null,
    periodicity: r.periodicity || '',
    transferred_data: r.transferred_data || '',
    transfer_method: r.transfer_method || '',
    ar_adr_increment_relation_statuses_id: r.ar_adr_increment_relation_statuses_id || null,
  }
  formMode.value = 'edit'
  formError.value = ''
  formOpen.value = true
}

function applyForm() {
  formError.value = ''
  const f = form.value
  if (!f.from_key || !f.to_key) {
    formError.value = 'Укажите источник и получателя'
    return
  }
  if (f.from_key === f.to_key) {
    formError.value = 'Источник и получатель должны различаться'
    return
  }
  const st = (props.relationStatuses || []).find(
    (s) => Number(s.id) === Number(f.ar_adr_increment_relation_statuses_id)
  )
  const stCode = String(st?.code || '').trim()
  const needsFlow = ['ADR_INCR_REL_IN_USE', 'ADR_INCR_REL_MODIFYING', 'ADR_INCR_REL_REMOVING'].includes(stCode)
  if (needsFlow && !f.ar_integration_flows_id) {
    formError.value =
      'Для статуса «Используется», «Модифицируется» или «Удаляется» выберите существующий поток реестра.'
    return
  }
  const item = {
    _key: f._key || nextLocalKey(),
    _local: !f._key,
    ar_integration_flows_id: f.ar_integration_flows_id || null,
    from_key: f.from_key,
    to_key: f.to_key,
    transferred_data: (f.transferred_data || '').trim(),
    transfer_method: (f.transfer_method || '').trim(),
    periodicity: (f.periodicity || '').trim(),
    ar_integration_flow_event_types_id: f.ar_integration_flow_event_types_id || null,
    ar_adr_increment_relation_statuses_id: f.ar_adr_increment_relation_statuses_id || null,
    increment_relation_status_code: stCode || null,
    status_name: st ? st.name : '',
  }
  const list = [...rightList.value]
  const idx = list.findIndex((r) => r._key === item._key)
  if (idx >= 0) list[idx] = { ...list[idx], ...item }
  else list.push(item)
  rightList.value = list
  if (item.ar_integration_flows_id) pickedFlowId.value = null
  formOpen.value = false
}

function removeRight() {
  if (!pickedRightKey.value) return
  rightList.value = rightList.value.filter((r) => r._key !== pickedRightKey.value)
  pickedRightKey.value = null
}

function onSave() {
  const missing = rightList.value.filter((r) => !r.ar_adr_increment_relation_statuses_id)
  if (missing.length) {
    formError.value = 'Укажите статус для всех интеграций в решении.'
    return
  }
  emit('save', rightList.value.map((r) => ({ ...r })))
  emit('close')
}

watch(
  () => props.show,
  (v) => {
    if (!v) return
    seq = 0
    rightList.value = (props.relations || []).map((r) => ({ ...r }))
    fromKey.value = null
    toKey.value = null
    flows.value = []
    pickedFlowId.value = null
    pickedRightKey.value = null
    formOpen.value = false
    formError.value = ''
  }
)
</script>

<style scoped>
.modal-relations { max-width: 900px; width: 96%; }
.modal-rel-form { min-width: 360px; max-width: 560px; }
.rel-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.modal-hint { margin: 0 0 10px; font-size: 0.85rem; color: var(--ar-muted); }
.dual-grid { display: grid; grid-template-columns: 1fr auto 1.2fr; gap: 12px; align-items: start; }
.dual-label { display: block; font-weight: 600; margin-bottom: 6px; font-size: 0.9rem; }
.dual-select {
  width: 100%;
  min-height: 200px;
  padding: 6px;
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  background: var(--ar-surface);
}
.dual-btns { display: flex; flex-direction: column; gap: 8px; padding-top: 28px; }
.dual-right {
  list-style: none;
  margin: 0;
  padding: 6px;
  min-height: 200px;
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  background: var(--ar-table-head-bg);
}
.dual-right-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 6px;
  border-radius: 4px;
  cursor: pointer;
}
.dual-right-item:hover { background: var(--ar-row-hover); }
.dual-right-item.is-active { background: var(--ar-accent-muted); }
.rel-data { flex: 1; color: var(--ar-muted); }
.rel-status { flex: 0 0 auto; font-size: 0.85rem; }
.dual-badge {
  flex-shrink: 0;
  padding: 1px 6px;
  font-size: 0.72rem;
  border-radius: 999px;
  background: var(--ar-accent-muted);
  color: var(--ar-accent);
}
.dual-empty { margin: 8px; font-size: 0.9rem; color: var(--ar-muted); }
.modal-nested { z-index: 200; }
.error { color: var(--ar-danger); margin: 8px 0; white-space: pre-wrap; word-break: break-word; }
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(26, 29, 46, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 150;
}
.modal {
  background: var(--ar-surface);
  padding: 1.25rem;
  border-radius: var(--ar-radius-lg);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
  border: 1px solid var(--ar-border);
}
.modal h3 { margin: 0 0 0.75rem; font-size: 1.1rem; }
.modal h4 { margin: 0 0 0.75rem; font-size: 1rem; }
.modal-actions { margin-top: 1rem; display: flex; gap: 0.5rem; }
.form-row { margin-bottom: 0.75rem; }
.form-row label { display: block; margin-bottom: 0.25rem; font-size: 0.9rem; }
.form-row input,
.form-row select,
.form-row textarea {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  box-sizing: border-box;
  background: var(--ar-surface);
}
.req { color: var(--ar-danger); }
.btn-sm { padding: 0.35rem 0.65rem; min-width: 2.5rem; }
</style>

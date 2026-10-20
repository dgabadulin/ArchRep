<template>
  <div v-if="show" class="modal-overlay" role="dialog" aria-modal="true">
    <div class="modal modal-dual">
      <h3>Определение функций системы</h3>
      <p v-if="systemName" class="modal-sub">{{ systemName }}</p>
      <div v-if="loadError" class="error">{{ loadError }}</div>
      <template v-else>
        <div class="dual-grid">
          <div class="dual-col">
            <label class="dual-label">Функции системы</label>
            <select ref="leftSelectRef" multiple class="dual-select" size="12">
              <option v-for="f in leftPool" :key="f._key" :value="f._key">{{ f.name }}</option>
            </select>
          </div>
          <div class="dual-btns">
            <button type="button" class="btn btn-secondary btn-sm" title="Добавить в решение" @click="moveRight">&gt;&gt;</button>
            <button type="button" class="btn btn-secondary btn-sm" title="Убрать из решения" @click="moveLeft">&lt;&lt;</button>
            <button type="button" class="btn btn-primary btn-sm" @click="createOpen = true">Создать</button>
          </div>
          <div class="dual-col">
            <label class="dual-label">Функции в решении</label>
            <ul class="dual-right" @dragover.prevent @drop.prevent="onDropList">
              <li
                v-for="(f, idx) in rightList"
                :key="f._key"
                class="dual-right-item"
                :draggable="true"
                @dragstart="onDragStart($event, idx)"
                @dragover.prevent
                @drop.prevent="onDropItem(idx)"
              >
                <input v-model="pickedRemove" type="checkbox" :value="f._key" class="dual-cb" />
                <span class="dual-drag-hint" title="Перетащите для порядка">⠿</span>
                <span class="dual-name">{{ f.name }}</span>
                <span v-if="f.isNew" class="dual-badge" title="Будет создана при сохранении заключения">новая</span>
                <select
                  v-model="f.increment_sysfunc_status_code"
                  class="dual-status"
                  :class="{ 'is-invalid': !f.increment_sysfunc_status_code }"
                  title="Статус функции в решении"
                  @click.stop
                  @change="saveError = ''"
                >
                  <option :value="null">— статус —</option>
                  <option v-for="st in sysfuncStatuses" :key="st.code" :value="st.code">{{ st.name }}</option>
                </select>
              </li>
            </ul>
            <p v-if="rightList.length === 0" class="dual-empty">Нет выбранных функций</p>
          </div>
        </div>
        <p class="modal-hint">
          Новые функции сразу попадают в решение, статус обязателен. Изменения (включая новые функции)
          попадут в реестр только при сохранении архитектурного заключения.
        </p>
        <div v-if="saveError" class="error">{{ saveError }}</div>
        <div class="modal-actions">
          <button type="button" class="btn btn-primary" @click="onSave">Сохранить</button>
          <button type="button" class="btn btn-secondary" @click="onCancel">Отмена</button>
        </div>
      </template>
    </div>

    <div v-if="createOpen" class="modal-overlay modal-nested">
      <div class="modal modal-sm">
        <h4>Новая функция</h4>
        <div class="form-row">
          <label>Название функции</label>
          <input v-model="createName" type="text" class="modal-input" maxlength="500" @keyup.enter="createLocalFunction" />
        </div>
        <div class="form-row">
          <label>Примечание</label>
          <textarea v-model="createDesc" rows="2" class="modal-input"></textarea>
        </div>
        <div v-if="createError" class="error">{{ createError }}</div>
        <div class="modal-actions">
          <button type="button" class="btn btn-primary" @click="createLocalFunction">Сохранить</button>
          <button type="button" class="btn btn-secondary" @click="createOpen = false">Отмена</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { api } from '../api/client'

const props = defineProps({
  show: { type: Boolean, default: false },
  systemName: { type: String, default: '' },
  // Функции каталога системы (из реестра). Для новой (черновой) системы — пусто.
  catalog: { type: Array, default: () => [] },
  // Текущий выбор «функций в решении» (в памяти, issue #74).
  selected: { type: Array, default: () => [] },
})

const emit = defineEmits(['close', 'save'])

const loadError = ref('')
const saveError = ref('')
const rightList = ref([])
const pickedRemove = ref([])
const leftSelectRef = ref(null)
const sysfuncStatuses = ref([])

const createOpen = ref(false)
const createName = ref('')
const createDesc = ref('')
const createError = ref('')

let seq = 0
let dragFromIdx = null

const rightKeySet = computed(() => new Set(rightList.value.map((f) => f._key)))

/** Левый список — только функции каталога системы (реестр), которых нет в решении. */
const leftPool = computed(() => {
  return (props.catalog || [])
    .map((f) => ({ _key: `r:${f.id}`, id: Number(f.id), name: f.name || '' }))
    .filter((f) => !rightKeySet.value.has(f._key))
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ru'))
})

function resetState() {
  seq = 0
  rightList.value = (props.selected || []).map((f) => ({
    _key: f.ar_system_functions_id ? `r:${f.ar_system_functions_id}` : `n:${++seq}`,
    id: f.ar_system_functions_id ? Number(f.ar_system_functions_id) : null,
    name: f.name || '',
    description: f.description || '',
    isNew: !f.ar_system_functions_id,
    increment_sysfunc_status_code: f.increment_sysfunc_status_code || null,
  }))
  pickedRemove.value = []
  createOpen.value = false
  createName.value = ''
  createDesc.value = ''
  createError.value = ''
  loadError.value = ''
  saveError.value = ''
}

function selectedLeftKeys() {
  const el = leftSelectRef.value
  if (!el) return []
  return Array.from(el.selectedOptions || []).map((o) => String(o.value))
}

function moveRight() {
  const keys = selectedLeftKeys()
  if (!keys.length) return
  const byKey = new Map(leftPool.value.map((f) => [f._key, f]))
  const added = []
  for (const k of keys) {
    const f = byKey.get(k)
    if (f && !rightKeySet.value.has(k)) added.push({ ...f, isNew: false, increment_sysfunc_status_code: null })
  }
  if (added.length) rightList.value = [...rightList.value, ...added]
}

/** Вернуть отмеченные функции из решения. Новые (ещё не в реестре) при этом просто удаляются. */
function moveLeft() {
  const remove = new Set(pickedRemove.value.map(String))
  if (!remove.size) return
  rightList.value = rightList.value.filter((f) => !remove.has(f._key))
  pickedRemove.value = []
  saveError.value = ''
}

/** п.4: новая функция сразу попадает в решение (в реестр — при сохранении заключения). */
function createLocalFunction() {
  const name = (createName.value || '').trim()
  if (!name) {
    createError.value = 'Укажите название'
    return
  }
  rightList.value = [
    ...rightList.value,
    {
      _key: `n:${++seq}`,
      id: null,
      name,
      description: (createDesc.value || '').trim(),
      isNew: true,
      increment_sysfunc_status_code: null,
    },
  ]
  createName.value = ''
  createDesc.value = ''
  createError.value = ''
  createOpen.value = false
  saveError.value = ''
}

function onDragStart(ev, idx) {
  dragFromIdx = idx
  try {
    ev.dataTransfer.effectAllowed = 'move'
    ev.dataTransfer.setData('text/plain', String(idx))
  } catch (_) { /* */ }
}

function onDropItem(idx) {
  if (dragFromIdx === null || dragFromIdx === idx) return
  const arr = [...rightList.value]
  const [item] = arr.splice(dragFromIdx, 1)
  arr.splice(idx, 0, item)
  rightList.value = arr
  dragFromIdx = null
}

function onDropList() {
  dragFromIdx = null
}

/** п.3a: статус в решении обязателен для каждой функции. */
function onSave() {
  saveError.value = ''
  const missing = rightList.value.filter((f) => !f.increment_sysfunc_status_code)
  if (missing.length) {
    const names = missing.map((f) => `«${f.name}»`).join(', ')
    saveError.value = missing.length === 1
      ? `Укажите статус в решении для функции ${names}.`
      : `Укажите статус в решении для всех функций (не заполнено: ${names}).`
    return
  }
  const out = rightList.value.map((f) => ({
    ar_system_functions_id: f.id || null,
    name: f.name,
    description: f.description || undefined,
    increment_sysfunc_status_code: f.increment_sysfunc_status_code || null,
  }))
  emit('save', out)
  emit('close')
}

function onCancel() {
  emit('close')
}

watch(
  () => props.show,
  async (v) => {
    if (!v) return
    resetState()
    try {
      sysfuncStatuses.value = (await api.getAdrSystemFunctionStatuses()) || []
    } catch (e) {
      sysfuncStatuses.value = []
      loadError.value = e.body?.error || e.message || 'Ошибка загрузки статусов'
    }
  },
)
</script>

<style scoped>
.modal-dual { max-width: 720px; width: 95%; }
.modal-sub { margin: 0 0 12px; font-size: 0.95rem; color: var(--ar-muted); }
.modal-hint { margin: 8px 0 0; font-size: 0.85rem; color: var(--ar-muted); }
.dual-grid { display: grid; grid-template-columns: 1fr auto 1fr; gap: 12px; align-items: start; margin-bottom: 12px; }
.dual-label { display: block; font-weight: 600; margin-bottom: 6px; font-size: 0.9rem; }
.dual-select {
  width: 100%;
  min-height: 220px;
  padding: 6px;
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  background: var(--ar-surface);
}
.dual-select:focus,
.dual-select:focus-visible { outline: none; border-color: var(--ar-accent); box-shadow: 0 0 0 2px var(--ar-accent-muted); }
.dual-btns { display: flex; flex-direction: column; gap: 8px; padding-top: 28px; }
.dual-right {
  list-style: none;
  margin: 0;
  padding: 6px;
  min-height: 220px;
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  background: var(--ar-table-head-bg);
}
.dual-right-item { display: flex; align-items: center; gap: 6px; padding: 4px 6px; cursor: grab; border-radius: 4px; }
.dual-right-item:hover { background: var(--ar-row-hover); }
.dual-cb { flex-shrink: 0; }
.dual-drag-hint { color: var(--ar-muted); cursor: grab; user-select: none; }
.dual-name { flex: 1; }
.dual-badge {
  flex-shrink: 0;
  padding: 1px 6px;
  font-size: 0.72rem;
  border-radius: 999px;
  background: var(--ar-accent-muted);
  color: var(--ar-accent);
}
.dual-status {
  flex-shrink: 0;
  max-width: 150px;
  padding: 2px 4px;
  font-size: 0.82rem;
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  background: var(--ar-surface);
}
.dual-status.is-invalid { border-color: var(--ar-danger); }
.dual-empty { margin: 8px; font-size: 0.9rem; color: var(--ar-muted); }
.modal-nested { z-index: 200; }
.modal-sm { min-width: 320px; max-width: 400px; }
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
.modal h3 { margin: 0 0 0.5rem; font-size: 1.1rem; }
.modal h4 { margin: 0 0 0.75rem; font-size: 1rem; }
.modal-actions { margin-top: 1rem; display: flex; gap: 0.5rem; }
.form-row { margin-bottom: 0.75rem; }
.form-row label { display: block; margin-bottom: 0.25rem; font-size: 0.9rem; }
.modal-input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  box-sizing: border-box;
  background: var(--ar-surface);
}
.btn-sm { padding: 0.35rem 0.65rem; min-width: 2.5rem; }
</style>

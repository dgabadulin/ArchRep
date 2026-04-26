<template>
  <div v-if="show" class="modal-overlay" role="dialog" aria-modal="true">
    <div class="modal modal-dual">
      <h3>Определение функций системы</h3>
      <p v-if="systemName" class="modal-sub">{{ systemName }}</p>
      <div v-if="loadError" class="error">{{ loadError }}</div>
      <div v-else-if="loading" class="loading">Загрузка…</div>
      <template v-else>
        <div class="dual-grid">
          <div class="dual-col">
            <label class="dual-label">Функции системы</label>
            <select
              ref="leftSelectRef"
              multiple
              class="dual-select"
              size="12"
              @change="syncLeftSelection"
              @keyup="syncLeftSelection"
              @click="syncLeftSelection"
            >
              <option v-for="f in leftPool" :key="f.id" :value="f.id">{{ f.name }}</option>
            </select>
          </div>
          <div class="dual-btns">
            <button type="button" class="btn btn-secondary btn-sm" title="В решение" @click="moveRight">&gt;&gt;</button>
            <button type="button" class="btn btn-secondary btn-sm" title="В каталог" @click="moveLeft">&lt;&lt;</button>
            <button type="button" class="btn btn-primary btn-sm" @click="createOpen = true">Создать</button>
            <button
              type="button"
              class="btn btn-primary btn-sm"
              :disabled="!canDeleteLeft || deleteDeleting"
              @click="deleteSelectedCatalogFunctions"
            >
              {{ deleteDeleting ? 'Удаление…' : 'Удалить' }}
            </button>
          </div>
          <div class="dual-col">
            <label class="dual-label">Функции в решении</label>
            <ul class="dual-right" @dragover.prevent @drop.prevent="onDropList">
              <li
                v-for="(f, idx) in rightList"
                :key="f.id"
                class="dual-right-item"
                :draggable="true"
                @dragstart="onDragStart($event, idx)"
                @dragover.prevent="onDragOverItem(idx)"
                @drop.prevent="onDropItem(idx)"
              >
                <input v-model="pickedRemove" type="checkbox" :value="f.id" class="dual-cb" />
                <span class="dual-drag-hint" title="Перетащите для порядка">⠿</span>
                <span class="dual-name">{{ f.name }}</span>
              </li>
            </ul>
            <p v-if="rightList.length === 0" class="dual-empty">Нет выбранных функций</p>
          </div>
        </div>
        <div v-if="deleteError" class="error">{{ deleteError }}</div>
        <div v-if="saveError" class="error">{{ saveError }}</div>
        <div class="modal-actions">
          <button type="button" class="btn btn-primary" :disabled="saving" @click="onSave">{{ saving ? 'Сохранение…' : 'Сохранить' }}</button>
          <button type="button" class="btn btn-secondary" :disabled="saving" @click="onCancel">Отмена</button>
        </div>
      </template>
    </div>

    <div v-if="createOpen" class="modal-overlay modal-nested">
      <div class="modal modal-sm">
        <h4>Новая функция</h4>
        <div class="form-row">
          <label>Название функции</label>
          <input v-model="createName" type="text" class="modal-input" maxlength="500" />
        </div>
        <div class="form-row">
          <label>Примечание</label>
          <textarea v-model="createDesc" rows="2" class="modal-input"></textarea>
        </div>
        <div v-if="createError" class="error">{{ createError }}</div>
        <div class="modal-actions">
          <button type="button" class="btn btn-primary" :disabled="createSaving" @click="saveNewFunction">Сохранить</button>
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
  rowId: { type: [Number, String], default: null },
  systemId: { type: [Number, String], default: null },
  systemName: { type: String, default: '' },
})

const emit = defineEmits(['close', 'saved'])

const loading = ref(false)
const loadError = ref('')
const saveError = ref('')
const saving = ref(false)
const catalog = ref([])
const rightList = ref([])
const pickedRemove = ref([])
const leftSelectRef = ref(null)

const createOpen = ref(false)
const createName = ref('')
const createDesc = ref('')
const createError = ref('')
const createSaving = ref(false)

const canDeleteLeft = ref(false)
const deleteDeleting = ref(false)
const deleteError = ref('')

const rightIdSet = computed(() => new Set(rightList.value.map((f) => Number(f.id))))

const leftPool = computed(() => {
  const rows = catalog.value.filter((f) => !rightIdSet.value.has(Number(f.id)))
  return [...rows].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ru'))
})

let dragFromIdx = null

function onDragStart(ev, idx) {
  dragFromIdx = idx
  try {
    ev.dataTransfer.effectAllowed = 'move'
    ev.dataTransfer.setData('text/plain', String(idx))
  } catch (_) { /* */ }
}

function onDragOverItem(idx) {
  /* drop target highlight optional */
}

function onDropItem(idx) {
  if (dragFromIdx === null || dragFromIdx === idx) return
  const from = dragFromIdx
  const arr = [...rightList.value]
  const [item] = arr.splice(from, 1)
  arr.splice(idx, 0, item)
  rightList.value = arr
  dragFromIdx = null
}

function onDropList() {
  dragFromIdx = null
}

function selectedLeftIds() {
  const el = leftSelectRef.value
  if (!el) return []
  return Array.from(el.selectedOptions || [])
    .map((o) => Number(o.value))
    .filter((n) => Number.isFinite(n))
}

function syncLeftSelection() {
  canDeleteLeft.value = selectedLeftIds().length > 0
}

function moveRight() {
  const ids = selectedLeftIds()
  const byId = new Map(catalog.value.map((f) => [Number(f.id), f]))
  for (const id of ids) {
    const f = byId.get(id)
    if (f && !rightIdSet.value.has(id)) rightList.value = [...rightList.value, { ...f }]
  }
  syncLeftSelection()
}

function moveLeft() {
  const remove = new Set(pickedRemove.value.map(Number))
  if (!remove.size) return
  rightList.value = rightList.value.filter((f) => !remove.has(Number(f.id)))
  pickedRemove.value = []
}

async function loadState() {
  loadError.value = ''
  loading.value = true
  try {
    const data = await api.getIncrementSystemFunctionSelection(props.rowId)
    catalog.value = data.catalog || []
    rightList.value = (data.selected_ordered || []).map((f) => ({ ...f }))
    deleteError.value = ''
    canDeleteLeft.value = false
  } catch (e) {
    loadError.value = e.body?.error || e.message || 'Ошибка загрузки'
  } finally {
    loading.value = false
  }
}

async function deleteSelectedCatalogFunctions() {
  const ids = selectedLeftIds()
  if (!ids.length || !props.systemId) return
  const n = ids.length
  const msg =
    n === 1
      ? 'Удалить выбранную функцию из каталога системы? (Если она указана в заключении ADR, сервер отклонит удаление и покажет, в каких ADR.)'
      : `Удалить ${n} выбранных функций из каталога системы? (Если какая-либо указана в ADR, удаление будет отклонено с перечнем заключений.)`
  if (!confirm(msg)) return
  deleteError.value = ''
  deleteDeleting.value = true
  try {
    await api.deleteSystemFunctions(props.systemId, ids)
    const removed = new Set(ids.map(Number))
    catalog.value = catalog.value.filter((f) => !removed.has(Number(f.id)))
    rightList.value = rightList.value.filter((f) => !removed.has(Number(f.id)))
    pickedRemove.value = pickedRemove.value.filter((rid) => !removed.has(Number(rid)))
    syncLeftSelection()
  } catch (e) {
    const b = e.body || {}
    if (e.status === 409 && (Array.isArray(b.usages) || b.adr_codes)) {
      const parts = [b.message, b.error].filter(Boolean)
      if (Array.isArray(b.usages) && b.usages.length) {
        const lines = b.usages.slice(0, 12).map((u) => {
          const inc = u.increment_name ? `, инкремент «${u.increment_name}»` : ''
          return `${u.adr_code}: «${u.function_name}»${inc}`
        })
        parts.push(lines.join('; '))
        if (b.usages.length > 12) parts.push(`… и ещё ${b.usages.length - 12}`)
      }
      deleteError.value = parts.join(' ')
    } else {
      deleteError.value = b.error || e.message || 'Ошибка удаления'
    }
  } finally {
    deleteDeleting.value = false
  }
}

async function onSave() {
  saveError.value = ''
  saving.value = true
  try {
    const ordered_function_ids = rightList.value.map((f) => Number(f.id))
    await api.putIncrementSystemFunctionSelection(props.rowId, { ordered_function_ids })
    emit('saved')
    emit('close')
  } catch (e) {
    saveError.value = e.body?.error || e.message || 'Ошибка сохранения'
  } finally {
    saving.value = false
  }
}

function onCancel() {
  if (!saving.value) emit('close')
}

async function saveNewFunction() {
  createError.value = ''
  const name = (createName.value || '').trim()
  if (!name) {
    createError.value = 'Укажите название'
    return
  }
  createSaving.value = true
  try {
    const row = await api.createSystemFunction(props.systemId, {
      name,
      description: (createDesc.value || '').trim() || undefined,
    })
    catalog.value = [...catalog.value, row].sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || ''), 'ru'),
    )
    createName.value = ''
    createDesc.value = ''
    createOpen.value = false
  } catch (e) {
    createError.value = e.body?.error || e.message || 'Ошибка'
  } finally {
    createSaving.value = false
  }
}

watch(
  () => props.show,
  (v) => {
    if (v && props.rowId && props.systemId) {
      loadState()
      saveError.value = ''
      deleteError.value = ''
      pickedRemove.value = []
      createOpen.value = false
    }
  },
)
</script>

<style scoped>
.modal-dual {
  max-width: 720px;
  width: 95%;
}
.modal-sub {
  margin: 0 0 12px;
  font-size: 0.95rem;
  color: var(--ar-muted);
}
.dual-grid {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 12px;
  align-items: start;
  margin-bottom: 12px;
}
.dual-label {
  display: block;
  font-weight: 600;
  margin-bottom: 6px;
  font-size: 0.9rem;
}
.dual-select {
  width: 100%;
  min-height: 220px;
  padding: 6px;
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  background: var(--ar-surface);
}
.dual-select:focus,
.dual-select:focus-visible {
  outline: none;
  border-color: var(--ar-accent);
  box-shadow: 0 0 0 2px var(--ar-accent-muted);
}
.dual-btns {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 28px;
}
.dual-right {
  list-style: none;
  margin: 0;
  padding: 6px;
  min-height: 220px;
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  background: var(--ar-table-head-bg);
}
.dual-right-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  cursor: grab;
  border-radius: 4px;
}
.dual-right-item:hover {
  background: var(--ar-row-hover);
}
.dual-cb {
  flex-shrink: 0;
}
.dual-drag-hint {
  color: var(--ar-muted);
  cursor: grab;
  user-select: none;
}
.dual-name {
  flex: 1;
}
.dual-empty {
  margin: 8px;
  font-size: 0.9rem;
  color: var(--ar-muted);
}
.modal-nested {
  z-index: 200;
}
.modal-sm {
  min-width: 320px;
  max-width: 400px;
}
.error {
  color: var(--ar-danger);
  margin: 8px 0;
  white-space: pre-wrap;
  word-break: break-word;
}
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
.modal h3 {
  margin: 0 0 0.5rem;
  font-size: 1.1rem;
}
.modal h4 {
  margin: 0 0 0.75rem;
  font-size: 1rem;
}
.modal-actions {
  margin-top: 1rem;
  display: flex;
  gap: 0.5rem;
}
.form-row {
  margin-bottom: 0.75rem;
}
.form-row label {
  display: block;
  margin-bottom: 0.25rem;
  font-size: 0.9rem;
}
.modal-input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  box-sizing: border-box;
  background: var(--ar-surface);
}
.btn-sm {
  padding: 0.35rem 0.65rem;
  min-width: 2.5rem;
}
.loading {
  padding: 1rem;
}
</style>

<template>
  <div class="page">
    <div class="page-head">
      <h1>Архитектурные принципы</h1>
      <div class="head-actions">
        <button
          v-if="canWrite"
          type="button"
          class="btn btn-primary"
          @click="openForm()"
        >
          Добавить принцип
        </button>
        <div class="head-buttons-row">
          <button
            v-if="canExport"
            type="button"
            class="btn btn-excel btn-same"
            :disabled="excelLoading"
            @click="exportExcel"
          >
            {{ excelLoading ? 'Выгрузка...' : 'Экспорт в Excel' }}
          </button>
          <div class="col-picker-wrap" v-click-outside="() => colPickerOpen = false">
            <button type="button" class="btn btn-secondary btn-same" @click.stop="colPickerOpen = !colPickerOpen">Вид</button>
            <div v-if="colPickerOpen" class="col-picker-dropdown">
              <label v-for="col in principleColumns" :key="col.key" class="col-picker-item">
                <input type="checkbox" :checked="visibleCols.includes(col.key)" @change="toggleCol(col.key)" />
                {{ col.label || col.key }}
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>

    <TableToolbar
      v-model:search="search"
      search-placeholder="Поиск по всем полям таблицы..."
    />

    <div v-if="loading" class="loading">Загрузка...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else class="card table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th
              v-for="key in visibleCols"
              :key="key"
              :class="{ sortable: key !== 'actions' }"
              @click="key !== 'actions' && toggleSort(key)"
            >
              {{ colLabel(key) }}
              <span v-if="key !== 'actions' && sortKey === key" class="sort-indicator">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in sortedList" :key="r.id">
            <td v-for="key in visibleCols" :key="key">
              <template v-if="key === 'actions'">
                <button
                  v-if="canRead"
                  type="button"
                  class="btn-link"
                  @click="openForm(r)"
                >
                  {{ canWrite ? 'Изменить' : 'Открыть' }}
                </button>
                <button
                  v-if="canDelete"
                  type="button"
                  class="btn-link danger"
                  @click="remove(r.id)"
                >
                  Удалить
                </button>
              </template>
              <template v-else-if="key === 'statement'">{{ (r.statement || '—').slice(0, 80) }}{{ (r.statement && r.statement.length > 80) ? '…' : '' }}</template>
              <template v-else-if="key === 'is_approved'">{{ r.is_approved ? 'Да' : 'Нет' }}</template>
              <template v-else>{{ r[key] ?? '—' }}</template>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="sortedList.length === 0" class="empty">Нет записей</p>
    </div>

    <div v-if="form" class="modal-overlay">
      <div class="modal modal-wide">
        <h3>{{ formTitle }}</h3>
        <fieldset class="form-fieldset" :disabled="!canWrite">
          <div class="form-row"><label>Наименование *</label><input v-model="form.name" required /></div>
          <div class="form-row"><label>Утверждение</label><textarea v-model="form.statement" rows="2"></textarea></div>
          <div class="form-row"><label>Обоснование</label><textarea v-model="form.rationale" rows="2"></textarea></div>
          <div class="form-row"><label>Применение</label><textarea v-model="form.implications" rows="2"></textarea></div>
          <div class="form-row"><label>Утверждён</label><input v-model="form.is_approved" type="checkbox" /></div>
          <div class="form-row"><label>Документ утверждения</label><input v-model="form.approve_document" /></div>
        </fieldset>
        <div class="modal-actions">
          <button v-if="canWrite" type="button" class="btn btn-primary" @click="save">Сохранить</button>
          <button type="button" class="btn btn-secondary" @click="form = null">
            {{ canWrite ? 'Отмена' : 'Закрыть' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { api } from '../api/client'
import TableToolbar from '../components/TableToolbar.vue'
import { downloadBlob } from '../utils/downloadBlob'
import { getVisibleColumns, setVisibleColumns, getSortPref, setSortPref } from '../utils/tableColumns'
import { usePermissions } from '../composables/usePermissions'

const { canRead, canWrite, canExport, canDelete } = usePermissions('principle')

const principleColumns = [
  { key: 'id', label: 'ID', defaultVisible: false },
  { key: 'name', label: 'Наименование', defaultVisible: true },
  { key: 'statement', label: 'Утверждение', defaultVisible: true },
  { key: 'rationale', label: 'Обоснование', defaultVisible: false },
  { key: 'implications', label: 'Применение', defaultVisible: false },
  { key: 'is_approved', label: 'Утверждён', defaultVisible: true },
  { key: 'approve_document', label: 'Документ утверждения', defaultVisible: false },
  { key: 'actions', label: '', defaultVisible: true },
]

const list = ref([])
const search = ref('')
const visibleCols = ref(getVisibleColumns('principles', principleColumns))
const colPickerOpen = ref(false)
const loading = ref(true)
const error = ref('')
const excelLoading = ref(false)
const form = ref(null)
const sortPref = getSortPref('principles', 'name', 'asc', principleColumns)
const sortKey = ref(sortPref.sortKey)
const sortOrder = ref(sortPref.sortOrder)

const sortedList = computed(() => {
  const rows = [...list.value]
  const key = sortKey.value
  const order = sortOrder.value
  rows.sort((a, b) => {
    const va = cellVal(a, key)
    const vb = cellVal(b, key)
    if (va === vb) return 0
    const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true })
    return order === 'asc' ? cmp : -cmp
  })
  return rows
})

const formTitle = computed(() => {
  if (!form.value?.id) return 'Новый принцип'
  return canWrite.value ? 'Изменить принцип' : 'Просмотр принципа'
})

function cellVal(r, key) {
  if (key === 'statement') return r.statement ?? ''
  if (key === 'is_approved') return r.is_approved ? 'Да' : 'Нет'
  return r[key] ?? ''
}

function toggleSort(key) {
  if (key === 'actions') return
  if (sortKey.value === key) sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  else { sortKey.value = key; sortOrder.value = 'asc' }
  setSortPref('principles', sortKey.value, sortOrder.value)
}

function colLabel(key) {
  return principleColumns.find(c => c.key === key)?.label || key
}
function toggleCol(key) {
  const idx = visibleCols.value.indexOf(key)
  let next
  if (idx >= 0) {
    if (visibleCols.value.length <= 1) return
    next = visibleCols.value.filter(k => k !== key)
  } else {
    const order = principleColumns.map(c => c.key)
    const current = [...visibleCols.value]
    const keyIdx = order.indexOf(key)
    const insertAt = current.findIndex(k => order.indexOf(k) > keyIdx)
    next = insertAt < 0 ? [...current, key] : current.slice(0, insertAt).concat(key, current.slice(insertAt))
  }
  visibleCols.value = next
  setVisibleColumns('principles', next)
}

const vClickOutside = {
  mounted(el, binding) {
    el._clickOutside = (e) => { if (!el.contains(e.target)) binding.value() }
    document.addEventListener('click', el._clickOutside)
  },
  unmounted(el) { document.removeEventListener('click', el._clickOutside) },
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    list.value = await api.getPrinciples({ search: search.value || undefined })
  } catch (e) {
    error.value = e.message || 'Ошибка загрузки'
  } finally {
    loading.value = false
  }
}

watch(search, load)
onMounted(load)

async function exportExcel() {
  excelLoading.value = true
  try {
    const blob = await api.getPrinciples({ search: search.value || undefined, excel: true })
    downloadBlob(blob, 'principles.xlsx')
  } catch (e) {
    error.value = e.message || 'Ошибка выгрузки'
  } finally {
    excelLoading.value = false
  }
}

function openForm(r) {
  if (!r && !canWrite.value) return
  if (r && !canRead.value) return
  form.value = r
    ? { id: r.id, name: r.name, statement: r.statement ?? '', rationale: r.rationale ?? '', implications: r.implications ?? '', is_approved: !!r.is_approved, approve_document: r.approve_document ?? '' }
    : { name: '', statement: '', rationale: '', implications: '', is_approved: false, approve_document: '' }
}

async function save() {
  if (!canWrite.value || !form.value?.name) return
  try {
    if (form.value.id) await api.updatePrinciple(form.value.id, form.value)
    else await api.createPrinciple(form.value)
    form.value = null
    await load()
  } catch (e) {
    alert(e.message || 'Ошибка')
  }
}

async function remove(id) {
  if (!canDelete.value) return
  if (!confirm('Удалить принцип?')) return
  try {
    await api.deletePrinciple(id)
    await load()
  } catch (e) {
    error.value = e.message || 'Ошибка удаления'
  }
}
</script>

<style scoped>
.head-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5rem;
}
.head-buttons-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.btn-same {
  min-width: 140px;
}
.col-picker-wrap {
  position: relative;
}
.col-picker-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 2px;
  background: var(--ar-surface);
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  box-shadow: var(--ar-shadow-card);
  padding: 0.5rem;
  min-width: 160px;
  z-index: 50;
}
.col-picker-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0;
  cursor: pointer;
  font-size: 0.9rem;
}
.btn-link:not(.danger) {
  color: var(--ar-link);
  margin-right: 0.5rem;
}
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(26, 29, 46, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.modal {
  background: var(--ar-surface);
  padding: 1.5rem;
  border-radius: var(--ar-radius-lg);
  min-width: 400px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
  border: 1px solid var(--ar-border);
}
.modal-wide {
  max-width: 560px;
}
.modal h3 {
  margin: 0 0 1rem;
  font-size: 1.1rem;
  color: var(--ar-text);
}
.form-fieldset {
  border: 0;
  margin: 0;
  padding: 0;
  min-width: 0;
}
.form-row {
  margin-bottom: 0.75rem;
}
.form-row label {
  display: block;
  margin-bottom: 0.25rem;
  font-size: 0.9rem;
  color: var(--ar-muted);
  font-weight: 600;
}
.form-row input,
.form-row textarea {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  background: var(--ar-surface);
}
.modal-actions {
  margin-top: 1rem;
  display: flex;
  gap: 0.5rem;
}
.modal-actions .btn {
  min-height: 40px;
  padding: 0.6rem 1rem;
}
</style>

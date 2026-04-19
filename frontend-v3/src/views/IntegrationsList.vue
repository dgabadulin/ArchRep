<template>
  <div class="page">
    <div class="page-head">
      <h1>Интеграционные потоки</h1>
      <div class="head-actions">
        <router-link to="/integrations/new" class="btn btn-primary">Добавить поток</router-link>
        <div class="head-buttons-row">
          <button type="button" class="btn btn-excel btn-same" :disabled="excelLoading" @click="exportExcel">
            {{ excelLoading ? 'Выгрузка...' : 'Экспорт в Excel' }}
          </button>
          <div class="col-picker-wrap" v-click-outside="() => colPickerOpen = false">
            <button type="button" class="btn btn-secondary btn-same" @click.stop="colPickerOpen = !colPickerOpen">Вид</button>
            <div v-if="colPickerOpen" class="col-picker-dropdown">
              <label v-for="col in columns" :key="col.key" class="col-picker-item">
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
          <tr v-for="row in sortedRows" :key="row.id">
            <td v-for="key in visibleCols" :key="key">
              <template v-if="key === 'source'">
                <router-link v-if="row.source_ar_systems_id" :to="`/systems/${row.source_ar_systems_id}/edit`" class="link">{{ row.source_name ?? '—' }}</router-link>
                <span v-else>—</span>
              </template>
              <template v-else-if="key === 'target'">
                <router-link v-if="row.target_ar_systems_id" :to="`/systems/${row.target_ar_systems_id}/edit`" class="link">{{ row.target_name ?? '—' }}</router-link>
                <span v-else>—</span>
              </template>
              <template v-else-if="key === 'actions'">
                <router-link :to="`/integrations/${row.id}/edit`" class="link">Изменить</router-link>
              </template>
              <template v-else>{{ cellValue(row, key) }}</template>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="sortedRows.length === 0" class="empty">Нет записей</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { api } from '../api/client'
import TableToolbar from '../components/TableToolbar.vue'
import { downloadBlob } from '../utils/downloadBlob'
import { getVisibleColumns, setVisibleColumns, getSortPref, setSortPref } from '../utils/tableColumns'

const columns = [
  { key: 'source', label: 'Система источник', defaultVisible: true },
  { key: 'target', label: 'Система получатель', defaultVisible: true },
  { key: 'event_type_name', label: 'Тип инициирующего события', defaultVisible: true },
  { key: 'periodicity', label: 'Периодичность', defaultVisible: true },
  { key: 'transferred_data', label: 'Передаваемые данные', defaultVisible: true },
  { key: 'transfer_method', label: 'Способ передачи', defaultVisible: true },
  { key: 'status_name', label: 'Статус потока', defaultVisible: true },
  { key: 'created_at', label: 'Создано', defaultVisible: false },
  { key: 'actions', label: '', defaultVisible: true },
]

const rows = ref([])
const search = ref('')
const visibleCols = ref(getVisibleColumns('integrations', columns))
const colPickerOpen = ref(false)
const loading = ref(true)
const error = ref('')
const excelLoading = ref(false)
const sortPref = getSortPref('integrations', 'source_name', 'asc')
const sortKey = ref(sortPref.sortKey)
const sortOrder = ref(sortPref.sortOrder)

const sortedRows = computed(() => {
  const list = [...rows.value]
  const key = sortKey.value
  const order = sortOrder.value
  list.sort((a, b) => {
    const va = cellValue(a, key)
    const vb = cellValue(b, key)
    if (va === vb) return 0
    const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true })
    return order === 'asc' ? cmp : -cmp
  })
  return list
})

function toggleSort(key) {
  if (key === 'actions') return
  const sortField = key === 'source' ? 'source_name' : key === 'target' ? 'target_name' : key
  if (sortKey.value === sortField) sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  else { sortKey.value = sortField; sortOrder.value = 'asc' }
  setSortPref('integrations', sortKey.value, sortOrder.value)
}

function colLabel(key) {
  return columns.find(c => c.key === key)?.label || key
}

function cellValue(row, key) {
  if (key === 'source' || key === 'target') return row[key === 'source' ? 'source_name' : 'target_name'] ?? '—'
  const v = row[key]
  if (v && (key === 'created_at' || key === 'updated_at')) return new Date(v).toLocaleString()
  return v ?? '—'
}

function toggleCol(key) {
  const idx = visibleCols.value.indexOf(key)
  let next
  if (idx >= 0) {
    if (visibleCols.value.length <= 1) return
    next = visibleCols.value.filter(k => k !== key)
  } else {
    const order = columns.map(c => c.key)
    const current = [...visibleCols.value]
    const keyIdx = order.indexOf(key)
    const insertAt = current.findIndex(k => order.indexOf(k) > keyIdx)
    if (insertAt < 0) current.push(key)
    else current.splice(insertAt, 0, key)
    next = current
  }
  visibleCols.value = next
  setVisibleColumns('integrations', next)
}

const vClickOutside = {
  mounted(el, binding) {
    el._clickOutside = (e) => { if (!el.contains(e.target)) binding.value() }
    document.addEventListener('click', el._clickOutside)
  },
  unmounted(el) {
    document.removeEventListener('click', el._clickOutside)
  },
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    rows.value = await api.getIntegrationFlows({ search: search.value || undefined })
  } catch (e) {
    error.value = e.message || 'Ошибка загрузки'
  } finally {
    loading.value = false
  }
}

watch(search, () => { load() })
onMounted(load)

async function exportExcel() {
  excelLoading.value = true
  try {
    const blob = await api.getIntegrationFlows({ search: search.value || undefined, excel: true })
    downloadBlob(blob, 'integration-flows.xlsx')
  } catch (e) {
    error.value = e.message || 'Ошибка выгрузки'
  } finally {
    excelLoading.value = false
  }
}
</script>

<style scoped>
.page-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; }
.page-head h1 { margin: 0; font-size: 1.35rem; color: #2d2a26; }
.head-actions { display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem; }
.head-buttons-row { display: flex; align-items: center; gap: 0.5rem; }
.btn-same { min-width: 140px; padding: 0.5rem 1rem; font-size: 0.9rem; }
.btn { padding: 0.5rem 1rem; border-radius: 6px; text-decoration: none; font-size: 0.9rem; border: none; cursor: pointer; display: inline-block; text-align: center; }
.btn-primary { background: #cb997e; color: #fff; }
.btn-primary:hover { background: #b8866b; }
.btn-excel { background: #2d5a27; color: #f5f0e8; }
.btn-excel:hover:not(:disabled) { background: #3d7a37; }
.btn-excel:disabled { opacity: 0.7; cursor: not-allowed; }
.btn-secondary { background: #e5dccf; color: #2d2a26; }
.col-picker-wrap { position: relative; }
.col-picker-dropdown { position: absolute; top: 100%; right: 0; margin-top: 2px; background: #fff; border: 1px solid #d4c4b0; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); padding: 0.5rem; min-width: 180px; z-index: 50; }
.col-picker-item { display: flex; align-items: center; gap: 0.5rem; padding: 0.35rem 0; cursor: pointer; font-size: 0.9rem; }
.card { background: #fff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); border: 1px solid #e5dccf; overflow: hidden; }
.table-wrap { padding: 0; }
.table { width: 100%; border-collapse: collapse; }
.table th { padding: 0.5rem 0.75rem; text-align: left; border-bottom: 1px solid #e5dccf; background: #faf8f5; font-weight: 600; color: #5c5349; }
.table th.sortable { cursor: pointer; user-select: none; }
.table th.sortable:hover { background: #f0e6dc; }
.sort-indicator { margin-left: 0.25rem; font-size: 0.8em; color: #cb997e; }
.table td { padding: 0.75rem 1rem; border-bottom: 1px solid #e5dccf; }
.table tbody tr:hover { background: #faf8f5; }
.link { color: #8b6914; text-decoration: none; }
.link:hover { text-decoration: underline; }
.loading, .error, .empty { padding: 1rem; }
.error { color: #b91c1c; }
</style>

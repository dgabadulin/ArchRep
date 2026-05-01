<template>
  <div class="page">
    <div class="page-head">
      <h1>Каталог ИС</h1>
      <div class="head-actions">
        <router-link to="/systems/new" class="btn btn-primary">Добавить систему</router-link>
        <div class="head-buttons-row">
          <button type="button" class="btn btn-excel btn-same" :disabled="excelLoading" @click="exportExcel">
            {{ excelLoading ? 'Выгрузка...' : 'Экспорт в Excel' }}
          </button>
          <div class="col-picker-wrap" v-click-outside="() => colPickerOpen = false">
            <button type="button" class="btn btn-secondary btn-same" @click.stop="colPickerOpen = !colPickerOpen">Вид</button>
            <div v-if="colPickerOpen" class="col-picker-dropdown">
              <label v-for="col in systemColumns" :key="col.key" class="col-picker-item">
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
          <tr v-for="row in sortedSystems" :key="row.id">
            <td v-for="key in visibleCols" :key="key">
              <template v-if="key === 'actions'">
                <router-link :to="`/systems/${row.id}/edit`" class="link">Изменить</router-link>
              </template>
              <template v-else>{{ cellValue(row, key) }}</template>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="sortedSystems.length === 0" class="empty">Нет записей</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { api } from '../api/client'
import TableToolbar from '../components/TableToolbar.vue'
import { downloadBlob } from '../utils/downloadBlob'
import { getVisibleColumns, setVisibleColumns, getSortPref, setSortPref } from '../utils/tableColumns'

const systemColumns = [
  { key: 'code', label: 'Код', defaultVisible: true },
  { key: 'name', label: 'Наименование', defaultVisible: true },
  { key: 'fullname', label: 'Полное наименование', defaultVisible: false },
  { key: 'parent_name', label: 'Родитель', defaultVisible: false },
  { key: 'external_system', label: 'Внешняя система', defaultVisible: true },
  { key: 'status', label: 'Статус', defaultVisible: true },
  { key: 'vendor', label: 'Вендор', defaultVisible: true },
  { key: 'supplier', label: 'Поставщик', defaultVisible: false },
  { key: 'supporter', label: 'Партнёр по поддержке', defaultVisible: false },
  { key: 'owner', label: 'Владелец', defaultVisible: true },
  { key: 'hosting', label: 'Тип хостинга', defaultVisible: false },
  { key: 'description', label: 'Описание', defaultVisible: false },
  { key: 'it_lead_employee_name', label: 'Ответственный от ИТ', defaultVisible: false },
  { key: 'business_lead_employee_name', label: 'Владелец системы (бизнес)', defaultVisible: false },
  { key: 'comment', label: 'Примечание', defaultVisible: false },
  { key: 'actions', label: '', defaultVisible: true },
]

const systems = ref([])
const search = ref('')
const visibleCols = ref(getVisibleColumns('systems', systemColumns))
const colPickerOpen = ref(false)
const loading = ref(true)
const error = ref('')
const excelLoading = ref(false)
const sortPref = getSortPref('systems', 'name', 'asc', systemColumns)
const sortKey = ref(sortPref.sortKey)
const sortOrder = ref(sortPref.sortOrder)

const sortedSystems = computed(() => {
  const list = [...systems.value]
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
  if (sortKey.value === key) sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  else { sortKey.value = key; sortOrder.value = 'asc' }
  setSortPref('systems', sortKey.value, sortOrder.value)
}

function colLabel(key) {
  return systemColumns.find(c => c.key === key)?.label || key
}

function cellValue(row, key) {
  if (key === 'external_system') return row.external_system ? 'Да' : 'Нет'
  const v = row[key]
  return v ?? '—'
}

function toggleCol(key) {
  const idx = visibleCols.value.indexOf(key)
  let next
  if (idx >= 0) {
    if (visibleCols.value.length <= 1) return
    next = visibleCols.value.filter(k => k !== key)
  } else {
    const order = systemColumns.map(c => c.key)
    const current = [...visibleCols.value]
    const keyIdx = order.indexOf(key)
    const insertAt = current.findIndex(k => order.indexOf(k) > keyIdx)
    if (insertAt < 0) current.push(key)
    else current.splice(insertAt, 0, key)
    next = current
  }
  visibleCols.value = next
  setVisibleColumns('systems', next)
}

const vClickOutside = {
  mounted(el, binding) {
    el._clickOutside = (e) => {
      if (!el.contains(e.target)) binding.value()
    }
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
    systems.value = await api.getSystems({ search: search.value || undefined })
  } catch (e) {
    error.value = e.message || 'Ошибка загрузки'
  } finally {
    loading.value = false
  }
}

watch(search, () => { load() })
onMounted(async () => {
  await load()
})

async function exportExcel() {
  excelLoading.value = true
  try {
    const blob = await api.getSystems({ search: search.value || undefined, excel: true })
    downloadBlob(blob, 'systems.xlsx')
  } catch (e) {
    error.value = e.message || 'Ошибка выгрузки'
  } finally {
    excelLoading.value = false
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
</style>

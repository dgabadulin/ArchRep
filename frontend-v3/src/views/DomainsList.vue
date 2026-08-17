<template>
  <div class="page">
    <div class="page-head">
      <h1>Реестр доменов</h1>
      <div class="head-actions">
        <router-link
          v-if="canWrite"
          :to="linkTo('/domains/new')"
          class="btn btn-primary"
        >
          Добавить запись
        </router-link>
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
              <label v-for="col in domainColumns" :key="col.key" class="col-picker-item">
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
          <tr v-for="row in sortedList" :key="row.id">
            <td v-for="key in visibleCols" :key="key">
              <template v-if="key === 'actions'">
                <router-link
                  v-if="canRead"
                  :to="linkTo(`/domains/${row.id}/edit`)"
                  class="link"
                >
                  {{ canWrite ? 'Изменить' : 'Открыть' }}
                </router-link>
                <button
                  v-if="canDelete"
                  type="button"
                  class="btn-link danger"
                  @click="remove(row.id)"
                >
                  Удалить
                </button>
              </template>
              <template v-else>{{ cellValue(row, key) }}</template>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="sortedList.length === 0" class="empty">Нет записей</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { api } from '../api/client'
import TableToolbar from '../components/TableToolbar.vue'
import { downloadBlob } from '../utils/downloadBlob'
import { getVisibleColumns, setVisibleColumns, getSortPref, setSortPref } from '../utils/tableColumns'
import { useListSearch } from '../composables/useListSearch'
import { usePermissions } from '../composables/usePermissions'

const { search, linkTo } = useListSearch()
const { canRead, canWrite, canExport, canDelete } = usePermissions('domain')

const domainColumns = [
  { key: 'id', label: 'ID', defaultVisible: false },
  { key: 'name', label: 'Домен', defaultVisible: true },
  { key: 'status_name', label: 'Статус', defaultVisible: true },
  { key: 'registrar_name', label: 'Регистратор', defaultVisible: true },
  { key: 'registered_at', label: 'Дата регистрации', defaultVisible: true },
  { key: 'expires_at', label: 'Дата окончания', defaultVisible: true },
  { key: 'purpose', label: 'Назначение', defaultVisible: true },
  { key: 'company_name', label: 'Компания', defaultVisible: true },
  { key: 'business_owner_name', label: 'Владелец от бизнеса', defaultVisible: true },
  { key: 'actions', label: '', defaultVisible: true },
]

const list = ref([])
const visibleCols = ref(getVisibleColumns('domains', domainColumns))
const colPickerOpen = ref(false)
const loading = ref(true)
const error = ref('')
const excelLoading = ref(false)
const sortPref = getSortPref('domains', 'name', 'asc', domainColumns)
const sortKey = ref(sortPref.sortKey)
const sortOrder = ref(sortPref.sortOrder)

const sortedList = computed(() => {
  const rows = [...list.value]
  const key = sortKey.value
  const order = sortOrder.value
  rows.sort((a, b) => {
    const va = cellValue(a, key)
    const vb = cellValue(b, key)
    if (va === vb) return 0
    const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true })
    return order === 'asc' ? cmp : -cmp
  })
  return rows
})

function toggleSort(key) {
  if (key === 'actions') return
  if (sortKey.value === key) sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  else { sortKey.value = key; sortOrder.value = 'asc' }
  setSortPref('domains', sortKey.value, sortOrder.value)
}

function colLabel(key) {
  return domainColumns.find((c) => c.key === key)?.label || key
}

function cellValue(row, key) {
  if (key === 'registered_at' || key === 'expires_at') {
    const d = row[key]
    if (!d) return '—'
    const x = new Date(d)
    return isNaN(x.getTime()) ? d : x.toLocaleDateString('ru-RU')
  }
  if (key === 'purpose') {
    const v = row[key]
    if (!v) return '—'
    const s = String(v)
    return s.length > 80 ? s.slice(0, 80) + '…' : s
  }
  const v = row[key]
  return v ?? '—'
}

function toggleCol(key) {
  const idx = visibleCols.value.indexOf(key)
  let next
  if (idx >= 0) {
    if (visibleCols.value.length <= 1) return
    next = visibleCols.value.filter((k) => k !== key)
  } else {
    const order = domainColumns.map((c) => c.key)
    const current = [...visibleCols.value]
    const keyIdx = order.indexOf(key)
    const insertAt = current.findIndex((k) => order.indexOf(k) > keyIdx)
    if (insertAt < 0) current.push(key)
    else current.splice(insertAt, 0, key)
    next = current
  }
  visibleCols.value = next
  setVisibleColumns('domains', next)
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
    list.value = await api.getDomains({ search: search.value || undefined })
  } catch (e) {
    error.value = e.message || 'Ошибка загрузки'
    list.value = []
  } finally {
    loading.value = false
  }
}

async function remove(id) {
  if (!confirm('Удалить запись?')) return
  try {
    await api.deleteDomain(id)
    await load()
  } catch (e) {
    alert(e.message || 'Ошибка удаления')
  }
}

async function exportExcel() {
  excelLoading.value = true
  try {
    const blob = await api.getDomains({ search: search.value || undefined, excel: true })
    downloadBlob(blob, 'domains.xlsx')
  } catch (e) {
    alert(e.message || 'Ошибка выгрузки')
  } finally {
    excelLoading.value = false
  }
}

watch(search, load)
onMounted(load)
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
.link {
  margin-right: 0.5rem;
}
</style>

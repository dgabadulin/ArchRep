<template>
  <div class="page" v-click-outside="onFilterClickOutside">
    <div class="page-head">
      <h1>Реестр функций ИС</h1>
      <div class="head-actions">
        <router-link v-if="canWrite" :to="linkTo('/system-functions/new')" class="btn btn-primary">
          Добавить функцию
        </router-link>
        <div class="head-buttons-row">
          <button
            v-if="canExport"
            type="button"
            class="btn btn-excel btn-same"
            :disabled="excelLoading || displayRows.length === 0"
            :title="displayRows.length === 0 ? 'Нет данных для выгрузки' : ''"
            @click="exportExcel"
          >
            {{ excelLoading ? 'Выгрузка...' : 'Экспорт в Excel' }}
          </button>
          <RegistryColumnPicker
            :columns="columns"
            :visible-cols="visibleCols"
            :open="colPickerOpen"
            @toggle="colPickerOpen = !colPickerOpen"
            @close="colPickerOpen = false"
            @toggle-col="toggleCol"
          />
        </div>
      </div>
    </div>

    <TableToolbar
      v-model:search="search"
      search-placeholder="Поиск по функции, системе или коду..."
    >
      <template #extra>
        <select v-if="systems.length" v-model="filterSystemId" class="registry-filter" title="Фильтр по системе">
          <option value="">Все системы</option>
          <option v-for="s in systems" :key="s.id" :value="String(s.id)">{{ s.display_name || s.name }}</option>
        </select>
        <select v-if="statuses.length" v-model="filterStatusId" class="registry-filter" title="Фильтр по статусу">
          <option value="">Все статусы</option>
          <option v-for="st in statuses" :key="st.id" :value="String(st.id)">{{ st.display_name || st.name }}</option>
        </select>
      </template>
    </TableToolbar>

    <div v-if="loading" class="loading">Загрузка...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <RegistryDataTable
      v-else
      :visible-cols="visibleCols"
      :rows="displayRows"
      :sort-order="sortOrder"
      :open-filter-key="openFilterKey"
      :col-label="colLabel"
      :filter-type-for="filterTypeFor"
      :is-sorted="isSorted"
      :toggle-sort="toggleSort"
      :column-filter-active="columnFilterActive"
      :toggle-filter-menu="toggleFilterMenu"
      :get-text-filter="getTextFilter"
      :get-enum-checked-for-menu="getEnumCheckedForMenu"
      :distinct-for-column="distinctForColumn"
      :apply-filter-from-menu="applyFilterFromMenu"
      :cancel-filter-menu="cancelFilterMenu"
    >
      <template #cell="{ row, columnKey }">
        <template v-if="columnKey === 'actions'">
          <router-link v-if="canRead" :to="linkTo(`/system-functions/${row.id}/edit`, { focus: row.id })" class="link">
            {{ canWrite ? 'Изменить' : 'Открыть' }}
          </router-link>
        </template>
        <template v-else-if="columnKey === 'system_name'">
          {{ row.system_name || '—' }}
          <span v-if="row.system_is_module" class="module-badge" title="Функция принадлежит модулю системы">модуль</span>
        </template>
        <template v-else>{{ cellValue(row, columnKey) }}</template>
      </template>
    </RegistryDataTable>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { api } from '../api/client'
import TableToolbar from '../components/TableToolbar.vue'
import RegistryDataTable from '../components/RegistryDataTable.vue'
import RegistryColumnPicker from '../components/RegistryColumnPicker.vue'
import { useListSearch } from '../composables/useListSearch'
import { useRegistryTable } from '../composables/useRegistryTable'
import { usePermissions } from '../composables/usePermissions'
import { applyRegistryFilters } from '../utils/registryColumnFilters'
import { vClickOutside } from '../directives/clickOutside'

const { search, linkTo } = useListSearch()
const { canRead, canWrite, canExport } = usePermissions('system_function')

const columns = applyRegistryFilters([
  { key: 'name', label: 'Функция', defaultVisible: true },
  { key: 'system_name', label: 'Система', defaultVisible: true },
  { key: 'system_code', label: 'Код ИС', defaultVisible: false },
  { key: 'status_name', label: 'Статус в реестре', defaultVisible: true },
  { key: 'description', label: 'Примечание', defaultVisible: true },
  { key: 'actions', label: '', defaultVisible: true },
])

const rows = ref([])
const systems = ref([])
const statuses = ref([])
const filterSystemId = ref('')
const filterStatusId = ref('')
const loading = ref(true)
const error = ref('')
const excelLoading = ref(false)

function cellValue(row, key) {
  return row[key] ?? '—'
}

const {
  visibleCols,
  colPickerOpen,
  sortOrder,
  displayRows,
  openFilterKey,
  toggleSort,
  isSorted,
  colLabel,
  filterTypeFor,
  toggleCol,
  onFilterClickOutside,
  resetFilters,
  toggleFilterMenu,
  cancelFilterMenu,
  distinctForColumn,
  columnFilterActive,
  getTextFilter,
  getEnumCheckedForMenu,
  applyFilterFromMenu,
  exportExcel: exportTableExcel,
} = useRegistryTable({
  tableId: 'system-functions',
  columns,
  rows,
  cellValue,
  defaultSortKey: 'system_name',
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    rows.value = await api.getSystemFunctionsGlobal({
      search: search.value || undefined,
      system_id: filterSystemId.value || undefined,
      status_id: filterStatusId.value || undefined,
    })
  } catch (e) {
    error.value = e.message || 'Ошибка загрузки'
  } finally {
    loading.value = false
  }
}

/** Справочники для серверных фильтров: без прав — списки пусты, фильтры скрыты. */
async function loadFilterOptions() {
  const [sys, st] = await Promise.allSettled([api.getSystems(), api.getSystemFunctionStatuses()])
  if (sys.status === 'fulfilled') systems.value = sys.value || []
  if (st.status === 'fulfilled') statuses.value = st.value || []
}

watch(search, (newVal, oldVal) => {
  if (oldVal !== undefined && newVal !== oldVal) resetFilters()
  load()
})
watch([filterSystemId, filterStatusId], load)

onMounted(() => {
  loadFilterOptions()
  load()
})

async function exportExcel() {
  excelLoading.value = true
  try {
    await exportTableExcel({ sheetName: 'Функции ИС', filename: 'system-functions.xlsx' })
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
  flex-wrap: wrap;
  justify-content: flex-end;
}
.btn-same {
  min-width: 140px;
}
.registry-filter {
  min-width: 180px;
  max-width: 320px;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  background: var(--ar-surface);
  color: var(--ar-text);
  font-size: 0.9rem;
}
.module-badge {
  margin-left: 0.4rem;
  padding: 1px 6px;
  font-size: 0.7rem;
  border-radius: 999px;
  background: var(--ar-accent-muted);
  color: var(--ar-accent);
  white-space: nowrap;
}
</style>


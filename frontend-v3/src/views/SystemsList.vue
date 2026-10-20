<template>
  <div class="page" v-click-outside="onFilterClickOutside">
    <div class="page-head">
      <h1>Каталог ИС</h1>
      <div class="head-actions">
        <router-link
          v-if="canWrite"
          :to="linkTo('/systems/new')"
          class="btn btn-primary"
        >
          Добавить систему
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
      search-placeholder="Поиск по всем полям таблицы..."
    />

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
          <router-link
            v-if="canRead"
            :to="linkTo(`/systems/${row.id}/edit`)"
            class="link"
          >
            {{ canWrite ? 'Изменить' : 'Открыть' }}
          </router-link>
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
const { canRead, canWrite, canExport } = usePermissions('system')

const columns = applyRegistryFilters([
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
])

const systems = ref([])
const loading = ref(true)
const error = ref('')
const excelLoading = ref(false)

function cellValue(row, key) {
  if (key === 'external_system') return row.external_system ? 'Да' : 'Нет'
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
  tableId: 'systems',
  columns,
  rows: systems,
  cellValue,
  defaultSortKey: 'name',
})

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

watch(search, (newVal, oldVal) => {
  if (oldVal !== undefined && newVal !== oldVal) resetFilters()
  load()
})
onMounted(load)

async function exportExcel() {
  excelLoading.value = true
  try {
    await exportTableExcel({ sheetName: 'Системы', filename: 'systems.xlsx' })
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
</style>

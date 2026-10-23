<template>
  <div class="page" v-click-outside="onFilterClickOutside">
    <div class="page-head">
      <h1>Интеграционные потоки</h1>
      <div class="head-actions">
        <router-link
          v-if="canWrite"
          :to="linkTo('/integrations/new')"
          class="btn btn-primary"
        >
          Добавить поток
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
        <template v-if="columnKey === 'source'">
          <router-link
            v-if="row.source_ar_systems_id && canReadSystem"
            :to="`/systems/${row.source_ar_systems_id}/edit`"
            class="link"
          >{{ row.source_name ?? '—' }}</router-link>
          <span v-else>{{ row.source_name ?? '—' }}</span>
        </template>
        <template v-else-if="columnKey === 'target'">
          <router-link
            v-if="row.target_ar_systems_id && canReadSystem"
            :to="`/systems/${row.target_ar_systems_id}/edit`"
            class="link"
          >{{ row.target_name ?? '—' }}</router-link>
          <span v-else>{{ row.target_name ?? '—' }}</span>
        </template>
        <template v-else-if="columnKey === 'actions'">
          <router-link
            v-if="canRead"
            :to="linkTo(`/integrations/${row.id}/edit`)"
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
const { canRead, canWrite, canExport } = usePermissions('integration_flow')
const { canRead: canReadSystem } = usePermissions('system')

const columns = applyRegistryFilters([
  { key: 'source', label: 'Система источник', defaultVisible: true, sortField: 'source_name' },
  { key: 'target', label: 'Система получатель', defaultVisible: true, sortField: 'target_name' },
  { key: 'event_type_name', label: 'Тип инициирующего события', defaultVisible: true },
  { key: 'periodicity', label: 'Периодичность', defaultVisible: true },
  { key: 'transferred_data', label: 'Передаваемые данные', defaultVisible: true },
  { key: 'transfer_method', label: 'Способ передачи', defaultVisible: true },
  { key: 'status_name', label: 'Статус потока', defaultVisible: true },
  { key: 'created_at', label: 'Создано', defaultVisible: false, sortType: 'datetime' },
  { key: 'actions', label: '', defaultVisible: true },
])

const rows = ref([])
const loading = ref(true)
const error = ref('')
const excelLoading = ref(false)

function cellValue(row, key) {
  if (key === 'source') return row.source_name ?? '—'
  if (key === 'target') return row.target_name ?? '—'
  const v = row[key]
  if (v && key === 'created_at') return new Date(v).toLocaleString()
  return v ?? '—'
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
  tableId: 'integrations',
  columns,
  rows,
  cellValue,
  defaultSortKey: 'source_name',
})

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

watch(search, (newVal, oldVal) => {
  if (oldVal !== undefined && newVal !== oldVal) resetFilters()
  load()
})
onMounted(load)

async function exportExcel() {
  excelLoading.value = true
  try {
    await exportTableExcel({ sheetName: 'Интеграционные потоки', filename: 'integration-flows.xlsx' })
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
</style>

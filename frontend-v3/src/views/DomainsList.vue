<template>
  <div class="page" v-click-outside="onFilterClickOutside">
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
const { canRead, canWrite, canExport, canDelete } = usePermissions('domain')

const columns = applyRegistryFilters([
  { key: 'id', label: 'ID', defaultVisible: false },
  { key: 'name', label: 'Домен', defaultVisible: true },
  { key: 'status_name', label: 'Статус', defaultVisible: true },
  { key: 'registrar_name', label: 'Регистратор', defaultVisible: true },
  { key: 'registered_at', label: 'Дата регистрации', defaultVisible: true, sortType: 'date' },
  { key: 'expires_at', label: 'Дата окончания', defaultVisible: true, sortType: 'date' },
  { key: 'purpose', label: 'Назначение', defaultVisible: true },
  { key: 'company_name', label: 'Компания', defaultVisible: true },
  { key: 'business_owner_name', label: 'Владелец от бизнеса', defaultVisible: true },
  { key: 'actions', label: '', defaultVisible: true },
])

const list = ref([])
const loading = ref(true)
const error = ref('')
const excelLoading = ref(false)

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
  tableId: 'domains',
  columns,
  rows: list,
  cellValue,
  defaultSortKey: 'name',
})

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

watch(search, (newVal, oldVal) => {
  if (oldVal !== undefined && newVal !== oldVal) resetFilters()
  load()
})
onMounted(load)

async function exportExcel() {
  excelLoading.value = true
  try {
    await exportTableExcel({ sheetName: 'Домены', filename: 'domains.xlsx' })
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
.link {
  margin-right: 0.5rem;
}
</style>

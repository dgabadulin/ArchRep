<template>
  <div class="page" v-click-outside="onFilterClickOutside">
    <div class="page-head">
      <h1>Связи объектов управления</h1>
      <div class="head-actions">
        <router-link
          v-if="canWrite"
          :to="linkTo('/metamodel-relations/new')"
          class="btn btn-primary"
        >
          Добавить связь
        </router-link>
        <div class="head-buttons-row">
          <button
            v-if="canExport"
            type="button"
            class="btn btn-excel btn-same"
            disabled
            title="Экспорт в Excel для раздела пока не реализован"
          >
            Экспорт в Excel
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
            :to="linkTo(`/metamodel-relations/${row.id}/edit`)"
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
import { togafApi } from '../api'
import { relationDisplayName } from '../api/graphApi'
import TableToolbar from '../components/TableToolbar.vue'
import RegistryDataTable from '../components/RegistryDataTable.vue'
import RegistryColumnPicker from '../components/RegistryColumnPicker.vue'
import { useListSearch } from '../composables/useListSearch'
import { useRegistryTable } from '../composables/useRegistryTable'
import { usePermissions } from '../composables/usePermissions'
import { applyRegistryFilters } from '../utils/registryColumnFilters'
import { vClickOutside } from '../directives/clickOutside'

const { search, linkTo } = useListSearch()
const { canRead, canWrite, canExport } = usePermissions('metamodel_relation')

const columns = applyRegistryFilters([
  { key: 'from_type', label: 'Тип объекта «От»', defaultVisible: true },
  { key: 'from_name', label: 'Объект «От»', defaultVisible: true },
  { key: 'relation_type', label: 'Тип связи', defaultVisible: true },
  { key: 'source', label: 'Источник', filter: 'enum', defaultVisible: true },
  { key: 'to_type', label: 'Тип объекта «К»', defaultVisible: true },
  { key: 'to_name', label: 'Объект «К»', defaultVisible: true },
  { key: 'name', label: 'Название', defaultVisible: true },
  { key: 'actions', label: '', defaultVisible: true },
])

const list = ref([])
const entityTypes = ref([])
const loading = ref(true)
const error = ref('')

/** Подпись типа сущности: display_name (DISP_META_ENTITY_TYPE_TEMPLATE) без кода. */
function entityTypeLabel(code) {
  const found = entityTypes.value.find((et) => et.code === code)
  return found?.display_name || found?.name || code || '—'
}

/** Наименование объекта-конца; без подписи (нет прав/объект удалён) — #id. */
function objectLabel(row, side) {
  const name = side === 'from' ? row.from_entity_name : row.to_entity_name
  if (name) return name
  const id = side === 'from' ? row.from_entity_id : row.to_entity_id
  return id != null && id !== '' ? `#${id}` : '—'
}

function cellValue(row, key) {
  if (key === 'from_type') return entityTypeLabel(row.from_entity_type)
  if (key === 'to_type') return entityTypeLabel(row.to_entity_type)
  if (key === 'from_name') return objectLabel(row, 'from')
  if (key === 'to_name') return objectLabel(row, 'to')
  if (key === 'relation_type') {
    return row.relation_type_display_name || row.relation_type_name || row.relation_type || '—'
  }
  if (key === 'source') return row.relation_type_managed ? 'Автоматически' : 'Вручную'
  if (key === 'name') return relationDisplayName(row) || '—'
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
} = useRegistryTable({
  tableId: 'metamodel-relations-v2',
  columns,
  rows: list,
  cellValue,
  defaultSortKey: 'relation_type',
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [rows, types] = await Promise.all([
      togafApi.relations({
        ...(search.value ? { search: search.value } : {}),
        with_labels: '1',
      }),
      togafApi.entityTypes().catch(() => []),
    ])
    list.value = rows || []
    if (Array.isArray(types) && types.length) entityTypes.value = types
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

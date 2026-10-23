<template>
  <div class="page" v-click-outside="onFilterClickOutside">
    <div class="page-head">
      <h1>Каталог инфраструктуры</h1>
      <div class="head-actions">
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

    <p class="lead">
      Серверы и виртуальные машины из Netbox. Реестр доступен только для просмотра; связь с ИС
      определяется тегом <code>IS:&lt;код системы&gt;</code> и обновляется заданием синхронизации.
    </p>

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
        <template v-if="columnKey === 'name'">
          <a
            v-if="row.netbox_url"
            :href="row.netbox_url"
            target="_blank"
            rel="noopener noreferrer"
            class="link"
            :title="`Открыть ${row.name} в Netbox`"
          >
            {{ row.name }}
          </a>
          <span v-else>{{ row.name }}</span>
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
import { applyRegistryFilters } from '../utils/registryColumnFilters'
import { vClickOutside } from '../directives/clickOutside'

const { search } = useListSearch()

const columns = applyRegistryFilters([
  { key: 'id', label: 'ID', defaultVisible: false },
  { key: 'type_name', label: 'Тип', defaultVisible: true },
  { key: 'name', label: 'Наименование', defaultVisible: true },
  { key: 'description', label: 'Описание', defaultVisible: false },
  { key: 'external_id', label: 'ID в Netbox', defaultVisible: false },
  { key: 'system_names', label: 'ИС', defaultVisible: true },
  { key: 'status', label: 'Статус', defaultVisible: true },
  { key: 'site', label: 'Площадка', defaultVisible: true },
  { key: 'cluster', label: 'Кластер', defaultVisible: true },
  { key: 'platform', label: 'Платформа', defaultVisible: true },
  { key: 'tenant', label: 'Арендатор', defaultVisible: false },
  { key: 'primary_ip', label: 'IP', defaultVisible: true },
  { key: 'vcpus', label: 'vCPU', defaultVisible: true },
  { key: 'memory_gb', label: 'RAM, ГБ', defaultVisible: true },
  { key: 'disk_gb', label: 'Диск, ГБ', defaultVisible: true },
  { key: 'netbox_updated_at', label: 'Изменён в Netbox', defaultVisible: false, sortType: 'datetime' },
  { key: 'synced_at', label: 'Синхронизирован', defaultVisible: true, sortType: 'datetime' },
])

const list = ref([])
const loading = ref(true)
const error = ref('')

function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  return isNaN(d.getTime()) ? String(value) : d.toLocaleString('ru-RU')
}

function formatResource(value) {
  if (value == null || value === '') return '—'
  const n = Number(value)
  if (!Number.isFinite(n)) return String(value)
  return n.toLocaleString('ru-RU', { maximumFractionDigits: 2 })
}

function cellValue(row, key) {
  if (key === 'description') {
    const v = row.description
    if (!v) return '—'
    const s = String(v)
    return s.length > 100 ? `${s.slice(0, 100)}…` : s
  }
  if (key === 'system_names') {
    if (row.system_names) return row.system_names
    const codes = Array.isArray(row.tag_codes) ? row.tag_codes : []
    if (codes.length) return `${codes.map((c) => `IS:${c}`).join(', ')} — ИС не найдена`
    return '—'
  }
  if (key === 'netbox_updated_at' || key === 'synced_at') return formatDateTime(row[key])
  if (key === 'vcpus' || key === 'memory_gb' || key === 'disk_gb') return formatResource(row[key])
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
  tableId: 'infrastructure',
  columns,
  rows: list,
  cellValue,
  defaultSortKey: 'name',
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    list.value = await api.getInfrastructure({ search: search.value || undefined })
  } catch (e) {
    error.value = e.message || 'Ошибка загрузки'
    list.value = []
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
.lead {
  color: var(--ar-muted);
  margin: 0 0 1rem;
  line-height: 1.45;
  font-size: 0.95rem;
}
.lead code {
  font-size: 0.85em;
  background: var(--ar-table-head-bg);
  padding: 0.1em 0.35em;
  border-radius: 4px;
}
.head-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.link {
  color: var(--ar-accent, #1565c0);
  text-decoration: none;
}
.link:hover {
  text-decoration: underline;
}
</style>

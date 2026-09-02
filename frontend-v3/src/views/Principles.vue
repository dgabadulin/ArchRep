<template>
  <div class="page" v-click-outside="onFilterClickOutside">
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
          <button
            v-if="canRead"
            type="button"
            class="btn-link"
            @click="openForm(row)"
          >
            {{ canWrite ? 'Изменить' : 'Открыть' }}
          </button>
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
import RegistryDataTable from '../components/RegistryDataTable.vue'
import RegistryColumnPicker from '../components/RegistryColumnPicker.vue'
import { useRegistryTable } from '../composables/useRegistryTable'
import { usePermissions } from '../composables/usePermissions'
import { applyRegistryFilters } from '../utils/registryColumnFilters'
import { vClickOutside } from '../directives/clickOutside'

const { canRead, canWrite, canExport, canDelete } = usePermissions('principle')

const columns = applyRegistryFilters([
  { key: 'id', label: 'ID', defaultVisible: false },
  { key: 'name', label: 'Наименование', defaultVisible: true },
  { key: 'statement', label: 'Утверждение', defaultVisible: true },
  { key: 'rationale', label: 'Обоснование', defaultVisible: false },
  { key: 'implications', label: 'Применение', defaultVisible: false },
  { key: 'is_approved', label: 'Утверждён', defaultVisible: true },
  { key: 'approve_document', label: 'Документ утверждения', defaultVisible: false },
  { key: 'actions', label: '', defaultVisible: true },
])

const list = ref([])
const search = ref('')
const loading = ref(true)
const error = ref('')
const excelLoading = ref(false)
const form = ref(null)

function cellValue(row, key) {
  if (key === 'statement') {
    const v = row.statement
    if (!v) return '—'
    return v.length > 80 ? v.slice(0, 80) + '…' : v
  }
  if (key === 'is_approved') return row.is_approved ? 'Да' : 'Нет'
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
  tableId: 'principles',
  columns,
  rows: list,
  cellValue,
  defaultSortKey: 'name',
})

const formTitle = computed(() => {
  if (!form.value?.id) return 'Новый принцип'
  return canWrite.value ? 'Изменить принцип' : 'Просмотр принципа'
})

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

watch(search, (newVal, oldVal) => {
  if (oldVal !== undefined && newVal !== oldVal) resetFilters()
  load()
})
onMounted(load)

async function exportExcel() {
  excelLoading.value = true
  try {
    await exportTableExcel({ sheetName: 'Принципы', filename: 'principles.xlsx' })
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

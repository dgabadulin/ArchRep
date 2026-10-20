<template>
  <div class="card table-wrap">
    <table class="table">
      <thead>
        <tr>
          <th
            v-for="key in visibleCols"
            :key="key"
            :ref="(el) => setHeaderRef(key, el)"
            :class="{ 'th-with-filter': !!filterTypeFor(key) }"
          >
            <TableHeaderCell
              :label="colLabel(key)"
              :sortable="key !== 'actions'"
              :is-sorted="isSorted(key)"
              :sort-order="sortOrder"
              :filter-type="filterTypeFor(key)"
              :filter-active="columnFilterActive(key)"
              @sort="toggleSort(key)"
              @toggle-filter="toggleFilterMenu(key)"
            />
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row[rowKey] ?? row.id">
          <td v-for="key in visibleCols" :key="key">
            <slot name="cell" :row="row" :column-key="key">
              {{ cellValue(row, key) }}
            </slot>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="rows.length === 0" class="empty">{{ emptyText }}</p>
    <ColumnFilterMenu
      v-if="openFilterKey && filterTypeFor(openFilterKey)"
      :key="openFilterKey"
      :filter-type="filterTypeFor(openFilterKey)"
      :initial-text="getTextFilter(openFilterKey)"
      :initial-checked="getEnumCheckedForMenu(openFilterKey)"
      :distinct-values="distinctForColumn(openFilterKey)"
      :anchor="headerRefs[openFilterKey]"
      @ok="applyFilterFromMenu(openFilterKey, $event)"
      @cancel="cancelFilterMenu"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import TableHeaderCell from './TableHeaderCell.vue'
import ColumnFilterMenu from './ColumnFilterMenu.vue'

const headerRefs = ref({})

function setHeaderRef(key, el) {
  if (el) headerRefs.value[key] = el
  else delete headerRefs.value[key]
}

defineProps({
  visibleCols: { type: Array, required: true },
  rows: { type: Array, required: true },
  rowKey: { type: String, default: 'id' },
  emptyText: { type: String, default: 'Нет записей' },
  sortOrder: { type: String, default: 'asc' },
  openFilterKey: { type: [String, null], default: null },
  colLabel: { type: Function, required: true },
  filterTypeFor: { type: Function, required: true },
  isSorted: { type: Function, required: true },
  toggleSort: { type: Function, required: true },
  columnFilterActive: { type: Function, required: true },
  toggleFilterMenu: { type: Function, required: true },
  getTextFilter: { type: Function, required: true },
  getEnumCheckedForMenu: { type: Function, required: true },
  distinctForColumn: { type: Function, required: true },
  applyFilterFromMenu: { type: Function, required: true },
  cancelFilterMenu: { type: Function, required: true },
  cellValue: { type: Function, default: null },
})
</script>

<template>
  <div ref="rootEl" class="card table-wrap">
    <table class="table">
      <thead>
        <tr>
          <th
            v-for="key in visibleCols"
            :key="key"
            :ref="(el) => setHeaderRef(key, el)"
            :class="{ 'th-with-filter': !!filterTypeFor(key), 'col-actions': key === 'actions' }"
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
        <tr
          v-for="row in pagedRows"
          :key="row[rowKey] ?? row.id"
          :data-row-id="row[rowKey] ?? row.id"
          :class="{ 'row-focus': String(row[rowKey] ?? row.id) === focusedRowId }"
        >
          <td v-for="key in visibleCols" :key="key" :class="{ 'col-actions': key === 'actions' }">
            <slot name="cell" :row="row" :column-key="key">
              {{ cellValue(row, key) }}
            </slot>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="rows.length === 0" class="empty">{{ emptyText }}</p>
    <div v-if="paginate && rows.length > 0" class="table-pager">
      <span class="table-pager__info">
        Показано {{ rangeStart }}–{{ rangeEnd }} из {{ rows.length }} · строк на странице: {{ effectivePageSize }}
      </span>
      <div class="table-pager__controls">
        <button type="button" class="table-pager__btn" :disabled="currentPage <= 1" @click="goPage(currentPage - 1)">
          ← Назад
        </button>
        <span class="table-pager__page">Стр. {{ currentPage }} из {{ pageCount }}</span>
        <button
          type="button"
          class="table-pager__btn"
          :disabled="currentPage >= pageCount"
          @click="goPage(currentPage + 1)"
        >
          Вперёд →
        </button>
      </div>
    </div>
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
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TableHeaderCell from './TableHeaderCell.vue'
import ColumnFilterMenu from './ColumnFilterMenu.vue'
import { getConfig } from '@/config/params'
import { pageFromQuery, focusFromQuery, searchFromQuery } from '../utils/listSearchQuery'

const route = useRoute()
const router = useRouter()
const rootEl = ref(null)
/** Путь реестра фиксируем при монтировании: при уходе в карточку route.path уже другой. */
const listPath = route.path
let listSearchValue = searchFromQuery(route.query)

const headerRefs = ref({})

function setHeaderRef(key, el) {
  if (el) headerRefs.value[key] = el
  else delete headerRefs.value[key]
}

const props = defineProps({
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
  /** false — отключить клиентскую пагинацию (например для маленькой встроенной таблицы). */
  paginate: { type: Boolean, default: true },
  /** 0/пусто — взять ARR_TABLE_PAGE_SIZE из /api/config (issue #114). */
  pageSize: { type: Number, default: 0 },
})

/**
 * Клиентская пагинация табличных реестров (issue #114).
 *
 * `rows` — уже отфильтрованные и отсортированные строки (useRegistryTable); таблица режет их
 * на страницы только для отображения. Экспорт и колоночные фильтры продолжают работать по
 * полному набору строк, поэтому в `useRegistryTable` пагинация не дублируется.
 *
 * Текущая страница хранится в URL (`?page=`), чтобы возврат из карточки приводил на ту же
 * страницу реестра (issue #135).
 */
const currentPage = ref(pageFromQuery(route.query))

/**
 * Якорь прокрутки реестра (issue #135): при уходе из реестра запоминаем первую видимую строку,
 * при возврате делаем её первой. Состояние эфемерное (не для ссылок), поэтому sessionStorage,
 * а не query: ключ — путь реестра, значение — { topId, page, search }.
 */
const VIEWPORT_STORAGE_PREFIX = 'ar:registry-viewport:'
function viewportStorageKey() {
  return VIEWPORT_STORAGE_PREFIX + listPath
}
function readSavedViewport() {
  try {
    const raw = sessionStorage.getItem(viewportStorageKey())
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
function clearSavedViewport() {
  try {
    sessionStorage.removeItem(viewportStorageKey())
  } catch {
    /* приватный режим — якорь не сохраняется */
  }
}
const savedViewport = readSavedViewport()
const pendingTopRowId = ref(
  savedViewport && savedViewport.page === currentPage.value && savedViewport.search === listSearchValue
    ? String(savedViewport.topId || '')
    : '',
)
const pendingTopOffset = ref(
  savedViewport && savedViewport.page === currentPage.value && savedViewport.search === listSearchValue
    ? Math.round(Number(savedViewport.offset) || 0)
    : 0,
)
if (savedViewport && !pendingTopRowId.value) clearSavedViewport()
const effectivePageSize = computed(() => {
  const configured = props.pageSize > 0 ? props.pageSize : Number(getConfig().ARR_TABLE_PAGE_SIZE)
  const size = Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : 50
  return Math.min(500, Math.max(5, size))
})
const pageCount = computed(() => Math.max(1, Math.ceil(props.rows.length / effectivePageSize.value)))
const pagedRows = computed(() => {
  if (!props.paginate) return props.rows
  const start = (currentPage.value - 1) * effectivePageSize.value
  return props.rows.slice(start, start + effectivePageSize.value)
})
const rangeStart = computed(() =>
  props.rows.length === 0 ? 0 : (currentPage.value - 1) * effectivePageSize.value + 1,
)
const rangeEnd = computed(() => Math.min(props.rows.length, currentPage.value * effectivePageSize.value))

function goPage(page) {
  const next = Number(page)
  if (!Number.isFinite(next)) return
  currentPage.value = Math.min(Math.max(1, Math.trunc(next)), pageCount.value)
}

// Фильтрация/поиск уменьшили набор — не оставляем пользователя на пустой странице.
watch(
  () => [props.rows.length, pageCount.value],
  () => {
    if (currentPage.value > pageCount.value) currentPage.value = pageCount.value
    if (currentPage.value < 1) currentPage.value = 1
  },
)

// Страница реестра — в URL (`?page=`): возврат из карточки открывает ту же страницу (issue #135).
let syncingPageFromUrl = false
watch(
  () => route.query.page,
  () => {
    syncingPageFromUrl = true
    currentPage.value = pageFromQuery(route.query)
    syncingPageFromUrl = false
  },
)
watch(currentPage, (page) => {
  if (syncingPageFromUrl) return
  const next = { ...route.query }
  if (page > 1) next.page = String(page)
  else delete next.page
  if (String(next.page || '') === String(route.query.page || '')) return
  router.replace({ query: next })
})

// Новый поиск — с первой страницы (иначе можно остаться на «пустой» странице).
watch(
  () => route.query.search,
  () => {
    listSearchValue = searchFromQuery(route.query)
    pendingTopRowId.value = ''
    pendingTopOffset.value = 0
    clearSavedViewport()
    if (currentPage.value !== 1) currentPage.value = 1
  },
)

/**
 * Возврат в реестр (issue #135): якорь — первая видимая строка, сохранённая при уходе из реестра.
 * При возврате она становится первой (`scrollIntoView` block:'start'); запись, из которой вернулись
 * (`?focus=`), подсвечивается. Если якоря нет — прокручиваем к записи по центру (старое поведение).
 */
const focusedRowId = ref('')
const positionRestoredKey = ref('')
const rowIdOf = (row) => String(row?.[props.rowKey] ?? row?.id ?? '')

/** Ближайший действительно прокручиваемый по вертикали предок таблицы (в LayoutV3 прокрутка внутренняя, не window). */
function scrollParentOf(el) {
  let node = el?.parentElement
  while (node && node !== document.body) {
    const style = window.getComputedStyle(node)
    // Порог отсекает горизонтальный скроллбар у .table-wrap (overflow-y там auto, но вертикальной прокрутки нет).
    if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight - node.clientHeight > 32) return node
    node = node.parentElement
  }
  return null
}

/** Первая видимая строка и её смещение относительно верха прокручиваемой области. */
function viewportAnchor() {
  const rowsEls = rootEl.value?.querySelectorAll('tbody tr[data-row-id]')
  if (!rowsEls?.length) return null
  const scroller = scrollParentOf(rowsEls[0])
  const top = scroller ? scroller.getBoundingClientRect().top : 0
  for (const tr of rowsEls) {
    const rect = tr.getBoundingClientRect()
    if (rect.bottom > top + 1) {
      return { topId: tr.getAttribute('data-row-id') || '', offset: Math.round(rect.top - top) }
    }
  }
  return null
}

function saveViewportAnchor() {
  const anchor = viewportAnchor()
  if (!anchor?.topId) return
  try {
    sessionStorage.setItem(viewportStorageKey(), JSON.stringify({
      topId: anchor.topId,
      offset: anchor.offset,
      page: currentPage.value,
      search: listSearchValue,
    }))
  } catch {
    /* приватный режим — якорь не сохраняется */
  }
}

async function restoreListPosition() {
  const focus = focusFromQuery(route.query)
  let topId = pendingTopRowId.value
  if (topId && !props.rows.some((row) => rowIdOf(row) === topId)) {
    topId = ''
    pendingTopRowId.value = ''
    clearSavedViewport()
  }
  const anchorId = topId || focus
  if (!anchorId) {
    focusedRowId.value = ''
    positionRestoredKey.value = ''
    return
  }
  // Ищем по всему набору строк: локальная сортировка могла сместить запись на другую страницу.
  const index = props.rows.findIndex((row) => rowIdOf(row) === anchorId)
  if (index < 0) return
  if (props.paginate) {
    const targetPage = Math.floor(index / effectivePageSize.value) + 1
    if (targetPage !== currentPage.value) {
      currentPage.value = targetPage
      return
    }
  }
  const restoreKey = `${anchorId}|${topId ? 'top' : 'focus'}`
  if (positionRestoredKey.value === restoreKey) return
  positionRestoredKey.value = restoreKey

  if (focus) {
    focusedRowId.value = focus
    setTimeout(() => {
      if (focusedRowId.value === focus) focusedRowId.value = ''
    }, 2500)
  }

  await nextTick()
  const escaped = anchorId.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  const el = rootEl.value?.querySelector(`tbody tr[data-row-id="${escaped}"]`)
  if (!el) return
  if (topId) {
    // Возвращаем сохранённый вид: первая видимая строка — на том же месте (если была первой — становится первой).
    const offset = pendingTopOffset.value
    const scroller = scrollParentOf(el)
    if (scroller) {
      const delta = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top - offset
      scroller.scrollTo({ top: Math.max(0, scroller.scrollTop + delta), behavior: 'smooth' })
    } else {
      window.scrollTo({
        top: Math.max(0, window.scrollY + el.getBoundingClientRect().top - offset),
        behavior: 'smooth',
      })
    }
    pendingTopRowId.value = ''
    pendingTopOffset.value = 0
    clearSavedViewport()
  } else {
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }
}

watch(
  [pagedRows, () => focusFromQuery(route.query)],
  () => { restoreListPosition() },
  { flush: 'post' },
)
onMounted(() => { restoreListPosition() })
onBeforeUnmount(() => { saveViewportAnchor() })

// При смене страницы разрешаем повторное позиционирование (якорь ещё не применён или запись на другой странице).
watch(currentPage, () => {
  positionRestoredKey.value = ''
})
</script>

<style scoped>
/* Возврат к записи (issue #135): подсветка строки, к которой вернулись из карточки. */
.table tbody tr.row-focus td {
  background: var(--ar-row-hover);
  transition: background-color 0.4s ease;
}
/* Якорь возврата (issue #135): строка-якорь встаёт первой с небольшим отступом. */
.table tbody tr {
  scroll-margin-top: 0.5rem;
}
.table-pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 1rem;
  padding: 0.6rem 1rem;
  border-top: 1px solid var(--ar-border);
  font-size: 0.85rem;
  color: var(--ar-muted);
  background: var(--ar-surface);
}
.table-pager__info {
  white-space: nowrap;
}
.table-pager__controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
}
.table-pager__page {
  min-width: 96px;
  text-align: center;
  white-space: nowrap;
}
.table-pager__btn {
  padding: 0.35rem 0.7rem;
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  background: var(--ar-surface);
  color: var(--ar-text);
  font-size: 0.85rem;
  cursor: pointer;
}
.table-pager__btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.table-pager__btn:not(:disabled):hover {
  background: var(--ar-row-hover);
}
</style>

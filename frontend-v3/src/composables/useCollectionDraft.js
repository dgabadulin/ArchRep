import { computed, ref } from 'vue'

/** Счётчик временных ключей: локальные строки не должны совпадать с `id` из БД. */
let localSeq = 0

/**
 * Локальная (ещё не записанная) коллекция связей для вкладок формы (issue #94).
 *
 * Зачем: пока основная запись не сохранена, у неё нет `id`, а операции вкладок в API
 * адресуются именно по нему (`POST /api/systems-technologies` требует `systems_id`).
 * Коллекция держит изменения в памяти, а `diff()` отдаёт набор операций, который форма
 * применяет сразу после создания/обновления основной записи.
 *
 * Формат строки: существующая из API — `{ id, ... }`;
 * локально добавленная — `{ id: 'local:N', _local: true, ... }`.
 */
export function useCollectionDraft() {
  const items = ref([])
  const added = ref([])
  const removedIds = ref([])
  const original = ref([])

  const isDirty = computed(() => added.value.length > 0 || removedIds.value.length > 0)
  const dirtyCount = computed(() => added.value.length + removedIds.value.length)

  /** Перечитать коллекцию из API (сбрасывает неприменённые изменения). */
  function reset(rows = []) {
    const list = Array.isArray(rows) ? rows.map((row) => ({ ...row })) : []
    original.value = list.map((row) => ({ ...row }))
    items.value = list
    added.value = []
    removedIds.value = []
  }

  /** Добавить строку в память: в API она попадёт только после сохранения формы. */
  function add(row) {
    localSeq += 1
    const local = { ...row, id: `local:${localSeq}`, _local: true }
    items.value = [...items.value, local]
    added.value = [...added.value, local]
    return local
  }

  /** Убрать строку: локальную — просто забыть, существующую — пометить на удаление в API. */
  function remove(item) {
    if (!item) return
    if (item._local) {
      items.value = items.value.filter((row) => row.id !== item.id)
      added.value = added.value.filter((row) => row.id !== item.id)
      return
    }
    if (!removedIds.value.includes(item.id)) removedIds.value = [...removedIds.value, item.id]
    items.value = items.value.filter((row) => row.id !== item.id)
  }

  /** Откатить неприменённые изменения к состоянию последнего `reset()`. */
  function revert() {
    items.value = original.value.map((row) => ({ ...row }))
    added.value = []
    removedIds.value = []
  }

  /** Что применить к API после сохранения основной записи. */
  function diff() {
    return {
      added: added.value.map((row) => ({ ...row })),
      removedIds: [...removedIds.value],
    }
  }

  return { items, added, removedIds, isDirty, dirtyCount, reset, add, remove, revert, diff }
}

import { onBeforeUnmount, ref, watch } from 'vue'

/** Сколько держится отметка «Сохранено ✓» в панели сохранения. */
const SAVED_MARK_MS = 2500

/**
 * Состояние сохранения экранной формы для `SaveBar` (issue #94).
 *
 * Одинаково на всех формах: «идёт сохранение» блокирует кнопки, «сохранено» показывается
 * короткой отметкой, ошибка выводится в самой панели и не мешает повторить сохранение.
 *
 * Пример:
 *   const { saving, savedOk, submitError, startSaving, markSaved, markError } =
 *     useSaveStatus({ dirty: isDirty })
 *
 * @param {object} [options]
 * @param {import('vue').Ref<boolean>} [options.dirty] — «есть изменения»: любая правка снимает отметку ✓
 * @param {number} [options.savedMs] — сколько показывать «Сохранено ✓»
 * @returns {{
 *   saving: import('vue').Ref<boolean>,
 *   savedOk: import('vue').Ref<boolean>,
 *   submitError: import('vue').Ref<string>,
 *   startSaving: () => void,
 *   markSaved: () => void,
 *   markError: (message?: string) => void,
 * }}
 */
export function useSaveStatus({ dirty = null, savedMs = SAVED_MARK_MS } = {}) {
  const saving = ref(false)
  const savedOk = ref(false)
  const submitError = ref('')
  let timer = null

  /** Начало сохранения: ошибка прошлой попытки сбрасывается, кнопки блокируются. */
  function startSaving() {
    submitError.value = ''
    savedOk.value = false
    saving.value = true
  }

  /** Сохранение прошло успешно: короткая отметка «Сохранено ✓». */
  function markSaved() {
    saving.value = false
    savedOk.value = true
    clearTimeout(timer)
    timer = setTimeout(() => { savedOk.value = false }, savedMs)
  }

  /** Сохранение не удалось: текст ошибки остаётся в панели, кнопки снова активны. */
  function markError(message) {
    saving.value = false
    savedOk.value = false
    submitError.value = message || 'Ошибка сохранения'
  }

  if (dirty) {
    // Новая правка после сохранения: отметка «Сохранено ✓» больше не соответствует форме.
    watch(dirty, (value) => {
      if (value) savedOk.value = false
    })
  }

  onBeforeUnmount(() => clearTimeout(timer))

  return { saving, savedOk, submitError, startSaving, markSaved, markError }
}

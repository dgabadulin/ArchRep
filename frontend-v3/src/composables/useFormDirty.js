import { computed, ref } from 'vue'

/**
 * Отслеживание несохранённых изменений экранной формы (issue #94).
 *
 * Форма правит локальную копию записи, поэтому «есть изменения» определяется сравнением
 * снимка полей с последним сохранённым/загруженным состоянием. `markSaved()` вызывается
 * в двух местах: после загрузки записи (снимок-база) и после успешного сохранения.
 *
 * Пример:
 *   const { isDirty, markSaved } = useFormDirty(() => form.value)
 *
 * @param {() => object|null} getForm — объект формы: `() => form.value` (ref) или `() => form` (reactive)
 * @param {object} [options]
 * @param {() => object|null} [options.snapshot] — какие поля сравниваем (по умолчанию весь объект формы)
 * @param {() => boolean} [options.enabled] — дополнительное условие (например, «загрузка завершена»)
 * @returns {{ isDirty: import('vue').ComputedRef<boolean>, markSaved: () => void }}
 */
export function useFormDirty(getForm, { snapshot = null, enabled = null } = {}) {
  /** Снимок-база: пустая строка означает «запись ещё не загружена», тогда изменений нет. */
  const savedSnapshot = ref('')

  function currentSnapshot() {
    const value = snapshot ? snapshot() : getForm()
    return JSON.stringify(value ?? null)
  }

  const isDirty = computed(() => {
    if (enabled && !enabled()) return false
    if (!savedSnapshot.value) return false
    return currentSnapshot() !== savedSnapshot.value
  })

  /** Зафиксировать текущее состояние как сохранённое (после загрузки и после сохранения). */
  function markSaved() {
    savedSnapshot.value = currentSnapshot()
  }

  return { isDirty, markSaved }
}

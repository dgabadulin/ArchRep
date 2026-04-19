import { onBeforeRouteLeave } from 'vue-router'

/**
 * При уходе со страницы, если есть несохранённые изменения, показывает запрос:
 * сохранить перед переходом или уйти без сохранения (отмена = остаться).
 * @param {import('vue').Ref<boolean>} isDirtyRef - реактивная ссылка на флаг «форма изменена»
 * @param {() => Promise<void>} saveFn - функция сохранения (без перехода), возвращает Promise
 */
export function useUnsavedGuard(isDirtyRef, saveFn) {
  onBeforeRouteLeave((to, from, next) => {
    if (!isDirtyRef.value) return next()
    if (confirm('Есть несохранённые изменения. Сохранить перед переходом?')) {
      saveFn()
        .then(() => next())
        .catch(() => next(false))
    } else {
      next()
    }
  })
}

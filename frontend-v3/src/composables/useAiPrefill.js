/**
 * Черновик ИИ-архитектора в экранной форме (issue #78, docs/ai-architect.md §7).
 *
 * Новый контракт не вводится: используется тот же `?payload=<base64>`, что и в переходе
 * «архитектурное заключение → новая система» (см. DecisionAppliedForm.vue) и что формирует
 * серверный инструмент `prefill_form` (`backend/ai/tools.js`):
 *
 *   payload = base64(encodeURIComponent(JSON.stringify({ form: { <поле>: '<строка>' } })))
 *
 * Правила:
 *  - применяются только поля из белого списка `fields` (совпадает с `prefillFields` в tools.js);
 *  - данные НЕ сохраняются: пользователь проверяет поля и сохраняет форму сам;
 *  - параметр `payload` удаляется из адресной строки, чтобы F5 не применял черновик повторно;
 *  - прочие query-параметры (`returnTo`, `appliedId`, `search`, …) сохраняются — это чужие сценарии.
 */
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AI_PREFILL_FIELD_LABELS } from '../config/aiActions'

const asText = (value) => String(value == null ? '' : value).trim()

/** Разбор `?payload=` в объект черновика (`{ form: {...} }`); `null`, если payload нет или он битый. */
export function decodeAiPrefillPayload(raw) {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value) return null
  try {
    const data = JSON.parse(decodeURIComponent(atob(String(value))))
    const draft = data && typeof data.form === 'object' && data.form ? data.form : null
    return draft
  } catch {
    return null
  }
}

/** Приведение значения черновика к типу поля формы; `null` — значение не применимо. */
function coerce(type, raw) {
  if (type === 'boolean') {
    const s = asText(raw).toLowerCase()
    if (s === 'true' || s === 'false') return s === 'true'
    return null
  }
  if (type === 'number') {
    const n = Number.parseInt(asText(raw), 10)
    return Number.isFinite(n) ? n : null
  }
  const s = asText(raw)
  return s ? s : null
}

/**
 * @param {object} options
 * @param {string} [options.entity] подпись сущности для уведомления («Технология»)
 * @param {() => object|null} options.target объект формы (reactive-объект или `form.value`); `null`, если форма ещё не готова
 * @param {Record<string, 'string'|'boolean'|'number'>} [options.fields] белый список полей: имя поля → тип
 * @param {Record<string, string>} [options.manualHints] поля, которые форма принимает, но заполнять их нужно вручную (связи)
 * @param {string[]} [options.extraParts] дополнительные пояснения к уведомлению
 * @param {string|(() => string)} [options.unsavedHint] замена стандартной финальной подсказки «данные не
 *   сохранены»: нужна формам, где важно пояснить, что проверять перед сохранением (обязательный код и т.п.)
 * @returns {{ prefillNotice: import('vue').Ref<string>, applyAiPrefill: () => boolean, clearPrefillQuery: () => void }}
 */
export function useAiPrefill({
  entity = 'запись',
  target,
  fields = {},
  manualHints = {},
  extraParts = [],
  unsavedHint = null,
} = {}) {
  const route = useRoute()
  const router = useRouter()
  const prefillNotice = ref('')

  function clearPrefillQuery() {
    if (!route.query.payload) return
    const rest = { ...route.query }
    delete rest.payload
    router.replace({ path: route.path, query: rest })
  }

  /**
   * Применяет черновик к форме. Вызывать ПОСЛЕ загрузки записи (и после снятия снимка формы),
   * чтобы форма корректно помечалась как изменённая и сработал guard несохранённых данных.
   * @returns {boolean} применён ли черновик
   */
  function applyAiPrefill() {
    if (prefillNotice.value) return false
    const draft = decodeAiPrefillPayload(route.query.payload)
    if (!draft) return false
    const form = typeof target === 'function' ? target() : target
    if (!form || typeof form !== 'object') return false

    const applied = []
    for (const [key, type] of Object.entries(fields)) {
      const value = coerce(type, draft[key])
      if (value == null) continue
      form[key] = value
      applied.push(key)
    }
    const hints = Object.entries(manualHints)
      .filter(([key]) => asText(draft[key]))
      // Подсказка может быть функцией от значения черновика (`(value) => 'текст'`).
      .map(([key, hint]) => (typeof hint === 'function' ? hint(asText(draft[key])) : hint))
      .filter(Boolean)
    if (!applied.length && !hints.length) return false

    const parts = []
    if (applied.length) {
      parts.push(
        `Черновик ИИ-архитектора применён: ${applied
          .map((k) => AI_PREFILL_FIELD_LABELS[k] || k)
          .join(', ')}.`,
      )
    }
    parts.push(...extraParts, ...hints)
    const tail = typeof unsavedHint === 'function' ? unsavedHint() : unsavedHint
    parts.push(tail || `Данные не сохранены: проверьте поля в форме «${entity}» и сохраните её сами.`)
    prefillNotice.value = parts.join(' ')
    clearPrefillQuery()
    return true
  }

  return { prefillNotice, applyAiPrefill, clearPrefillQuery }
}

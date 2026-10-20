/**
 * Русские сообщения об ошибках API (RBAC 403 и пр.).
 */

/**
 * @param {{ missing_permissions?: string[], required_permissions?: string[], error?: string, message?: string }|null} body
 * @param {number} [status]
 * @returns {string|null} null — если не 403 / не удалось сформировать
 */
export function formatForbiddenMessage(body, status) {
  if (status != null && status !== 403) return null
  const missing = Array.isArray(body?.missing_permissions)
    ? body.missing_permissions.filter(Boolean)
    : []
  const required = Array.isArray(body?.required_permissions)
    ? body.required_permissions.filter(Boolean)
    : []
  const codes = missing.length ? missing : required
  if (codes.length === 1) {
    return `Недостаточно привилегий. Требуемое разрешение: ${codes[0]}. Обратитесь к администратору.`
  }
  if (codes.length > 1) {
    return `Недостаточно привилегий. Требуемые разрешения: ${codes.join(', ')}. Обратитесь к администратору.`
  }
  if (status === 403 || body?.error === 'Forbidden' || /forbidden/i.test(String(body?.error || ''))) {
    return 'Недостаточно привилегий. Обратитесь к администратору.'
  }
  return null
}

/** Технические тексты 404 от бэкенда → понятные русские сообщения. */
const NOT_FOUND_TEXTS = {
  'not found': 'Запись не найдена: возможно, она была удалена, или ссылка устарела.',
  'increment not found': 'Решение (инкремент) не найдено: возможно, оно было удалено, или ссылка устарела.',
}

/**
 * Русское сообщение для ответа 404: бэкенд отдаёт техническое «Not found»,
 * которое не должно попадать в интерфейс как есть.
 * @param {{ error?: string, message?: string }|string|null} body
 * @param {number} [status]
 * @returns {string|null} null — если это не 404
 */
export function formatNotFoundMessage(body, status) {
  if (status !== 404) return null
  const raw = body && typeof body === 'object' ? body.error ?? body.message : ''
  const text = String(raw ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
  return NOT_FOUND_TEXTS[text] || NOT_FOUND_TEXTS['not found']
}

/**
 * Сообщение для throw Error из API-клиента.
 */
export function messageFromApiError(status, body, fallbackStatusText) {
  const forbidden = formatForbiddenMessage(body, status)
  if (forbidden) return forbidden
  const notFound = formatNotFoundMessage(body, status)
  if (notFound) return notFound
  if (body && typeof body.error === 'string' && body.error.trim()) return body.error
  if (body && typeof body.message === 'string' && body.message.trim()) return body.message
  return fallbackStatusText || 'Ошибка запроса'
}

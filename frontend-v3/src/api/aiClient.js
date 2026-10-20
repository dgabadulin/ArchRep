/**
 * Клиент API ИИ-архитектора (issue #78, docs/ai-architect.md §3.2/§7).
 *
 * Только транспорт: REST-вызовы истории диалогов и SSE-стрим `POST /api/ai/chat`.
 * События SSE: `meta` / `delta` / `tool` / `action` / `notice` / `reset` / `done` / `error`
 * (см. backend/ai/aiRoutes.js, backend/ai/aiService.js).
 */
import { getToken, clearToken } from '../auth/session'
import { messageFromApiError } from '../utils/apiErrors'

const API_BASE = import.meta.env.VITE_API_URL || ''

function authHeaders() {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export class AiApiError extends Error {
  constructor(message, { status = 0, code = '', body = null } = {}) {
    super(message)
    this.name = 'AiApiError'
    this.status = status
    this.code = code
    this.body = body
  }
}

function handleUnauthorized() {
  clearToken()
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    const redirect = encodeURIComponent(window.location.pathname + window.location.search)
    window.location.assign(`/login?redirect=${redirect}`)
  }
}

async function toError(res) {
  const text = await res.text().catch(() => '')
  let body = text || null
  try {
    body = JSON.parse(text)
  } catch {
    /* тело не JSON — оставляем текстом */
  }
  const code = body && typeof body === 'object' ? String(body.code || '') : ''
  const message = messageFromApiError(res.status, body, res.statusText || 'Ошибка ИИ-архитектора')
  return new AiApiError(message, { status: res.status, code, body })
}

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(options.headers || {}) },
  })
  if (!res.ok) {
    if (res.status === 401) handleUnauthorized()
    throw await toError(res)
  }
  if (res.status === 204) return null
  return res.json()
}

/** Разбор одного SSE-фрейма (`event:` / `data:`; строки `: ping` — heartbeat). */
export function parseSseFrame(frame) {
  const lines = String(frame || '').split(/\r?\n/)
  let event = 'message'
  const dataLines = []
  for (const line of lines) {
    if (!line || line.startsWith(':')) continue
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
  }
  if (!dataLines.length) return null
  const raw = dataLines.join('\n')
  let data = raw
  try {
    data = JSON.parse(raw)
  } catch {
    /* текстовый data без JSON */
  }
  return { event, data }
}

/**
 * Потоковый вызов агента. `onEvent({ event, data })` — на каждое SSE-событие.
 * @returns {Promise<void>}
 */
export async function aiChatStream({ message, conversationId = null, onEvent, signal } = {}) {
  const res = await fetch(`${API_BASE}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', ...authHeaders() },
    body: JSON.stringify({ message, conversation_id: conversationId }),
    signal,
  })
  if (!res.ok) {
    if (res.status === 401) handleUnauthorized()
    throw await toError(res)
  }
  if (!res.body || typeof res.body.getReader !== 'function') {
    throw new AiApiError('Браузер не поддерживает потоковый ответ (SSE).')
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')
      let idx = buffer.indexOf('\n\n')
      while (idx !== -1) {
        const parsed = parseSseFrame(buffer.slice(0, idx))
        buffer = buffer.slice(idx + 2)
        if (parsed && typeof onEvent === 'function') onEvent(parsed)
        idx = buffer.indexOf('\n\n')
      }
    }
    const tail = parseSseFrame(buffer)
    if (tail && typeof onEvent === 'function') onEvent(tail)
  } finally {
    try {
      reader.releaseLock()
    } catch {
      /* поток уже закрыт */
    }
  }
}

export const aiApi = {
  getStatus: () => request('/api/ai/status'),
  listConversations: (limit = 30) => request(`/api/ai/conversations?limit=${encodeURIComponent(limit)}`),
  createConversation: (title) => request('/api/ai/conversations', { method: 'POST', body: JSON.stringify({ title }) }),
  getConversation: (id) => request(`/api/ai/conversations/${encodeURIComponent(id)}`),
  deleteConversation: (id) => request(`/api/ai/conversations/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  chatStream: aiChatStream,
}

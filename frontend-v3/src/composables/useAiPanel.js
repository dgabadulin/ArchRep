/**
 * Состояние и логика панели ИИ-архитектора (issue #78, docs/ai-architect.md §3.2/§7).
 *
 * Синглтон уровня модуля: панель смонтирована в `LayoutV3.vue` и переживает переходы
 * между разделами, а кнопка в футере левого меню открывает/закрывает ту же панель.
 */
import { computed, reactive } from 'vue'
import { getConfig } from '../config/params'
import { authStore } from '../auth/authStore'
import { aiApi } from '../api/aiClient'
import { limitsFromConfig, readAttachment, toPayload, toMeta, totalChars } from '../utils/aiAttachments'

const STORAGE_KEY = 'ar-ai-panel-v1'
const MIN_WIDTH = 360
const MAX_WIDTH = 760
const DEFAULT_WIDTH = 420
const MAX_MESSAGE_CHARS = 8000

function readStored() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function clampWidth(value) {
  const num = Number.parseInt(value, 10)
  if (Number.isFinite(num)) return Math.min(Math.max(num, MIN_WIDTH), MAX_WIDTH)
  const cfg = Number.parseInt(getConfig().SYS_AI_PANEL_WIDTH, 10)
  if (Number.isFinite(cfg)) return Math.min(Math.max(cfg, MIN_WIDTH), MAX_WIDTH)
  return DEFAULT_WIDTH
}

function toConversationId(value) {
  const id = Number.parseInt(value, 10)
  return Number.isFinite(id) ? id : null
}

const stored = readStored()

const state = reactive({
  open: stored.open === true,
  width: clampWidth(stored.width),
  conversationId: toConversationId(stored.conversationId),
  messages: [],
  conversations: [],
  draft: '',
  /** Вложения текущего сообщения (issue #95): живут в памяти до отправки. */
  attachments: [],
  attaching: false,
  attachError: '',
  historyOpen: false,
  streaming: false,
  loadingHistory: false,
  notice: '',
  error: '',
})

let abortController = null
let seq = 0

function nextId() {
  seq += 1
  return `ai-${seq}`
}

function persist() {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ open: state.open, width: state.width, conversationId: state.conversationId }),
    )
  } catch {
    /* приватный режим или квота — состояние просто не сохранится */
  }
}

function pushMessage(message) {
  const item = { id: nextId(), ...message }
  state.messages.push(item)
  return item
}

/** История из БД → локальные элементы чата (assistant + карточки действий из payload.actions). */
function mapStoredMessages(rows) {
  const out = []
  for (const row of Array.isArray(rows) ? rows : []) {
    const role = String((row && row.role) || '')
    const text = String((row && row.content) || '')
    if (role === 'user') {
      const attachments = row && row.payload && Array.isArray(row.payload.attachments) ? row.payload.attachments : []
      out.push({ id: nextId(), role: 'user', text, attachments })
    } else if (role === 'assistant') {
      out.push({ id: nextId(), role: 'assistant', text })
      const actions = row && row.payload && Array.isArray(row.payload.actions) ? row.payload.actions : []
      for (const action of actions) out.push({ id: nextId(), role: 'action', action })
    } else if (role === 'tool') {
      const payload = (row && row.payload) || {}
      const result = payload && typeof payload.result === 'object' && payload.result ? payload.result : {}
      out.push({
        id: nextId(),
        role: 'tool',
        toolName: String((row && row.tool_name) || ''),
        ok: !result.error,
        summary: text,
        error: result.error ? String(result.error) : '',
      })
    }
  }
  return out
}

/** Обработка одного SSE-события агентного цикла (см. backend/ai/aiRoutes.js). */
function applyEvent({ event, data }, assistant) {
  switch (event) {
    case 'meta':
      if (data && data.conversation_id != null) {
        state.conversationId = toConversationId(data.conversation_id)
        persist()
      }
      break
    case 'delta':
      if (data && data.text) assistant.text += String(data.text)
      break
    case 'tool':
      pushMessage({
        role: 'tool',
        toolName: (data && data.name) || '',
        ok: !(data && data.ok === false),
        summary: (data && data.summary) || '',
        error: (data && data.error) || '',
      })
      break
    case 'action':
      pushMessage({ role: 'action', action: data || {} })
      break
    case 'notice':
      state.notice = (data && data.message) || ''
      break
    case 'reset':
      assistant.text = ''
      break
    case 'done':
      if (data && data.conversation_id != null) state.conversationId = toConversationId(data.conversation_id)
      if (data && data.message && !assistant.text) assistant.text = String(data.message)
      if (data && data.finish_reason === 'limit') state.notice = 'Достигнут лимит шагов агента — ответ может быть неполным.'
      persist()
      break
    case 'error':
      state.error = (data && data.message) || 'Ошибка обращения к модели'
      break
    default:
      break
  }
}

const available = computed(() => getConfig().SYS_AI_ENABLED === true && authStore.hasPermission('ai_architect:use'))
const aiTitle = computed(() => String(getConfig().SYS_AI_TITLE || 'ИИ-архитектор'))
const panelWidth = computed(() => `${state.width}px`)
const hasMessages = computed(() => state.messages.length > 0)
const attachmentLimits = computed(() => limitsFromConfig())
const canAttach = computed(() => attachmentLimits.value.enabled && !state.streaming)
const canSend = computed(
  () => !state.streaming && (String(state.draft || '').trim().length > 0 || state.attachments.length > 0),
)

/** Добавить файлы: чтение в браузере + лимиты (сервер проверит повторно). */
async function addFiles(files) {
  const list = Array.from(files || [])
  if (!list.length || state.streaming) return
  const limits = limitsFromConfig()
  if (!limits.enabled) {
    state.attachError = 'Вложения отключены администратором (SYS_AI_ATTACHMENTS_ENABLED=false).'
    return
  }
  state.attachError = ''
  state.attaching = true
  try {
    const room = limits.maxFiles - state.attachments.length
    if (room <= 0) {
      state.attachError = `Не более ${limits.maxFiles} вложений на сообщение.`
      return
    }
    if (list.length > room) {
      state.attachError = `Добавлены первые ${room}: лимит ${limits.maxFiles} вложений на сообщение.`
    }
    for (const file of list.slice(0, room)) {
      const item = await readAttachment(file, limits)
      state.attachments.push(item)
      if (totalChars(state.attachments) > limits.maxChars) {
        state.attachError = `Текст вложений больше ${limits.maxChars} символов — сервер обрежет его при отправке.`
      }
    }
  } catch (err) {
    state.attachError = (err && err.message) || 'Не удалось прикрепить файл'
  } finally {
    state.attaching = false
  }
}

function removeAttachment(index) {
  const i = Number(index)
  if (!Number.isInteger(i) || i < 0) return
  state.attachments.splice(i, 1)
  state.attachError = ''
}

function clearAttachments() {
  state.attachments = []
  state.attachError = ''
}

function toggle() {
  state.open = !state.open
  persist()
  if (state.open) void init()
}

function openPanel() {
  state.open = true
  persist()
  void init()
}

function closePanel() {
  state.open = false
  persist()
}

function setWidth(px) {
  state.width = clampWidth(px)
  persist()
}

function toggleHistory() {
  state.historyOpen = !state.historyOpen
}

function startNewConversation() {
  cancelStream()
  state.conversationId = null
  state.messages = []
  state.draft = ''
  state.attachments = []
  state.attachError = ''
  state.notice = ''
  state.error = ''
  state.historyOpen = false
  persist()
}

async function loadConversations(limit = 30) {
  if (!available.value) return
  state.loadingHistory = true
  try {
    state.conversations = (await aiApi.listConversations(limit)) || []
  } catch (err) {
    state.error = (err && err.message) || 'Не удалось загрузить историю диалогов'
  } finally {
    state.loadingHistory = false
  }
}

async function openConversation(id) {
  const convId = toConversationId(id)
  if (!Number.isFinite(convId)) return
  state.loadingHistory = true
  state.error = ''
  state.notice = ''
  try {
    const data = await aiApi.getConversation(convId)
    state.conversationId = convId
    state.messages = mapStoredMessages(data && data.messages)
    state.historyOpen = false
    persist()
  } catch (err) {
    if (err && err.status === 404) {
      startNewConversation()
      return
    }
    state.error = (err && err.message) || 'Не удалось открыть диалог'
  } finally {
    state.loadingHistory = false
  }
}

async function deleteConversation(id) {
  const convId = toConversationId(id)
  if (!Number.isFinite(convId)) return
  try {
    await aiApi.deleteConversation(convId)
    if (state.conversationId === convId) startNewConversation()
    await loadConversations()
  } catch (err) {
    state.error = (err && err.message) || 'Не удалось удалить диалог'
  }
}

function cancelStream() {
  if (abortController) {
    abortController.abort()
    abortController = null
  }
}

/**
 * Отправка реплики: SSE-поток, накопление ответа, карточки инструментов и действий.
 * Вложения (issue #95) уходят вместе с сообщением; сервер проверяет их повторно.
 */
async function sendMessage(rawText) {
  const text = String(rawText == null ? state.draft : rawText).trim()
  if (state.streaming) return
  const pending = Array.isArray(state.attachments) ? [...state.attachments] : []
  if (!text && !pending.length) return
  if (!available.value) {
    state.error = 'ИИ-архитектор недоступен: функция выключена или нет права ai_architect:use.'
    return
  }
  if (text.length > MAX_MESSAGE_CHARS) {
    state.error = `Сообщение слишком длинное (максимум ${MAX_MESSAGE_CHARS} символов).`
    return
  }

  state.error = ''
  state.notice = ''
  state.draft = ''
  state.attachments = []
  state.attachError = ''
  const shownText = text || 'Проанализируй вложение.'
  pushMessage({ role: 'user', text: shownText, attachments: toMeta(pending) })
  const assistant = pushMessage({ role: 'assistant', text: '', streaming: true })

  const controller = new AbortController()
  abortController = controller
  state.streaming = true
  try {
    await aiApi.chatStream({
      message: text,
      conversationId: state.conversationId,
      attachments: toPayload(pending),
      signal: controller.signal,
      onEvent: (evt) => applyEvent(evt, assistant),
    })
  } catch (err) {
    // Вложения возвращаем в композер, чтобы можно было повторить отправку.
    if (pending.length && !state.attachments.length) state.attachments = pending
    if (err && (err.name === 'AbortError' || err.code === 'AI_ABORTED')) {
      state.notice = 'Запрос прерван.'
      if (!assistant.text) assistant.text = '(ответ прерван)'
    } else {
      state.error = (err && err.message) || 'Ошибка обращения к ИИ-архитектору'
      assistant.failed = true
    }
  } finally {
    assistant.streaming = false
    state.streaming = false
    abortController = null
    await loadConversations()
  }
}

/** Первичная инициализация панели: история + восстановление последнего диалога. */
async function init() {
  if (!available.value) return
  await loadConversations()
  if (state.conversationId != null && !state.messages.length) {
    await openConversation(state.conversationId)
  }
}

export function useAiPanel() {
  return {
    state,
    available,
    aiTitle,
    panelWidth,
    hasMessages,
    canSend,
    canAttach,
    attachmentLimits,
    addFiles,
    removeAttachment,
    clearAttachments,
    toggle,
    openPanel,
    closePanel,
    setWidth,
    toggleHistory,
    startNewConversation,
    loadConversations,
    openConversation,
    deleteConversation,
    sendMessage,
    cancelStream,
    init,
  }
}


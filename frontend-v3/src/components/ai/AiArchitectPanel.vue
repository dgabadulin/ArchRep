<template>
  <div v-if="state.open && overlay" class="ai-backdrop" @click="closePanel"></div>
  <aside
    v-if="state.open"
    class="ai-panel"
    :class="{ 'ai-panel--overlay': overlay }"
    :style="{ width: panelWidth }"
    role="complementary"
    aria-label="ИИ-архитектор"
    @keydown.esc="closePanel"
  >
    <div
      class="ai-resize"
      role="separator"
      aria-orientation="vertical"
      title="Перетащите, чтобы изменить ширину панели"
      @mousedown.prevent="startResize"
    ></div>

    <header class="ai-header">
      <div class="ai-header-title">
        <Sparkles :size="16" :stroke-width="1.9" />
        <span>{{ aiTitle }}</span>
      </div>
      <div class="ai-header-actions">
        <button type="button" class="ai-icon-btn" title="Новый диалог" :disabled="state.streaming" @click="startNewConversation">
          <Plus :size="16" />
        </button>
        <button
          type="button"
          class="ai-icon-btn"
          :class="{ active: state.historyOpen }"
          title="История диалогов"
          @click="toggleHistory"
        >
          <History :size="16" />
        </button>
        <button type="button" class="ai-icon-btn" title="Закрыть панель" @click="closePanel">
          <X :size="16" />
        </button>
      </div>
    </header>

    <div v-if="state.historyOpen" class="ai-history">
      <div class="ai-history-head">
        <span>История диалогов</span>
        <button type="button" class="ai-icon-btn" title="Обновить список" @click="loadConversations()">
          <RefreshCw :size="14" />
        </button>
      </div>
      <p v-if="state.loadingHistory" class="ai-muted">Загрузка…</p>
      <p v-else-if="!state.conversations.length" class="ai-muted">Сохранённых диалогов нет.</p>
      <ul v-else class="ai-history-list">
        <li v-for="conv in state.conversations" :key="conv.id">
          <button
            type="button"
            class="ai-history-item"
            :class="{ active: conv.id === state.conversationId }"
            @click="openConversation(conv.id)"
          >
            <span class="ai-history-title">{{ conv.title || 'Новый диалог' }}</span>
            <span class="ai-history-date">{{ formatDate(conv.updated_at) }}</span>
          </button>
          <button type="button" class="ai-icon-btn ai-history-del" title="Удалить диалог" @click.stop="deleteConversation(conv.id)">
            <Trash2 :size="14" />
          </button>
        </li>
      </ul>
    </div>

    <div v-if="state.notice" class="ai-notice">{{ state.notice }}</div>
    <div v-if="state.error" class="ai-error" role="alert">{{ state.error }}</div>

    <div ref="scrollRef" class="ai-thread">
      <div v-if="!hasMessages" class="ai-empty">
        <Sparkles :size="22" :stroke-width="1.6" />
        <p>
          Спросите про системы, архитектурные заключения, технологии или архитектурный долг.
          Агент отвечает только по данным реестра, которые доступны вашим правам.
        </p>
        <ul class="ai-suggestions">
          <li v-for="text in SUGGESTIONS" :key="text">
            <button type="button" class="ai-suggestion" :disabled="state.streaming" @click="sendMessage(text)">
              {{ text }}
            </button>
          </li>
        </ul>
      </div>

      <template v-for="msg in state.messages" :key="msg.id">
        <div v-if="msg.role === 'user'" class="ai-msg ai-msg--user">{{ msg.text }}</div>

        <div v-else-if="msg.role === 'assistant'" class="ai-msg ai-msg--assistant">
          <div v-if="msg.text" class="help-markdown ai-markdown" v-html="renderMarkdown(msg.text)"></div>
          <div v-else-if="msg.streaming" class="ai-typing"><span></span><span></span><span></span></div>
          <p v-else-if="msg.failed" class="ai-muted">Ответ не получен.</p>
        </div>

        <div v-else-if="msg.role === 'tool'" class="ai-tool" :class="{ 'ai-tool--error': !msg.ok }">
          <component :is="msg.ok ? CheckCircle2 : AlertCircle" :size="13" />
          <span class="ai-tool-name">{{ msg.toolName }}</span>
          <span class="ai-tool-summary">{{ msg.error || msg.summary }}</span>
        </div>

        <AiActionCard v-else-if="msg.role === 'action'" :action="msg.action" @open="openAction(msg.action)" />
      </template>
    </div>

    <form class="ai-composer" @submit.prevent="submit">
      <textarea
        v-model="state.draft"
        class="ai-input"
        rows="2"
        maxlength="8000"
        placeholder="Вопрос к ИИ-архитектору… (Enter — отправить, Shift+Enter — новая строка)"
        :disabled="state.streaming"
        @keydown.enter.exact.prevent="submit"
      ></textarea>
      <div class="ai-composer-actions">
        <button v-if="state.streaming" type="button" class="btn btn-secondary btn-sm" @click="cancelStream">
          Остановить
        </button>
        <button v-else type="submit" class="btn btn-primary btn-sm" :disabled="!canSend">Отправить</button>
      </div>
    </form>
  </aside>
</template>

<script setup>
/**
 * Панель ИИ-архитектора (issue #78, docs/ai-architect.md §7).
 * Монтируется в LayoutV3.vue, состояние живёт в composables/useAiPanel.js.
 */
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { AlertCircle, CheckCircle2, History, Plus, RefreshCw, Sparkles, Trash2, X } from 'lucide-vue-next'
import { marked } from 'marked'
import AiActionCard from './AiActionCard.vue'
import { useAiPanel } from '../../composables/useAiPanel'
import { canUseAiAction, resolveAiActionLocation } from '../../config/aiActions'

marked.setOptions({ gfm: true, breaks: true })

const SUGGESTIONS = [
  'Какие информационные системы есть в реестре? Покажи краткую сводку.',
  'Покажи последние архитектурные заключения и их решения.',
  'Какие технологии используются чаще всего?',
  'Есть ли архитектурный долг по критичным системам?',
  'Найди системы без владельца и без интеграций.',
]

const router = useRouter()
const {
  state,
  aiTitle,
  panelWidth,
  hasMessages,
  canSend,
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
} = useAiPanel()

const scrollRef = ref(null)
const overlay = ref(false)
let mediaQuery = null
let resizing = false

function renderMarkdown(text) {
  try {
    return marked.parse(String(text || ''))
  } catch {
    return String(text || '')
  }
}

function formatDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function submit() {
  if (!canSend.value) return
  void sendMessage()
}

/**
 * UI-действие агента: переход в существующую форму (запись или черновик по `?payload=`)
 * либо в реестр — `open_view`: фильтр приходит как `?search=` и подхватывается списком
 * через `useListSearch` (`config/aiActions.js` → `utils/listSearchQuery.js`).
 */
function openAction(action) {
  if (!canUseAiAction(action)) return
  const location = resolveAiActionLocation(action)
  if (!location) return
  // Повторный клик по действию, которое ведёт в текущий экран (`open_view` того же реестра), — no-op.
  if (router.resolve(location).fullPath === router.currentRoute.value.fullPath) {
    // Раньше это было «молчаливым»: пользователю казалось, что кнопка не нажимается. Сообщаем явно.
    state.notice = 'Этот экран уже открыт — ссылка действия совпадает с текущей страницей.'
    return
  }
  state.notice = ''
  router.push(location)
  if (overlay.value) closePanel()
}

function onMouseMove(event) {
  if (!resizing) return
  setWidth(window.innerWidth - event.clientX)
}

function stopResize() {
  resizing = false
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', stopResize)
  document.body.classList.remove('ai-resizing')
}

function startResize() {
  resizing = true
  document.body.classList.add('ai-resizing')
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', stopResize)
}

function applyViewport() {
  overlay.value = mediaQuery ? mediaQuery.matches : window.innerWidth < 1200
}

function scrollToBottom() {
  const el = scrollRef.value
  if (el) el.scrollTop = el.scrollHeight
}

watch(
  () => state.messages.map((m) => `${m.id}:${String(m.text || '').length}`).join('|'),
  () => {
    void nextTick(scrollToBottom)
  },
)

onMounted(() => {
  mediaQuery = window.matchMedia('(max-width: 1199px)')
  applyViewport()
  mediaQuery.addEventListener('change', applyViewport)
  void init()
})

onBeforeUnmount(() => {
  stopResize()
  if (mediaQuery) mediaQuery.removeEventListener('change', applyViewport)
})
</script>

<style scoped>
.ai-panel {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  height: 100%;
  position: relative;
  background: var(--ar-surface);
  border-left: 1px solid var(--ar-border);
  box-shadow: -1px 0 4px rgba(0, 0, 0, 0.04);
}
.ai-panel--overlay {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  height: auto;
  z-index: 60;
  box-shadow: -6px 0 24px rgba(0, 0, 0, 0.18);
}
.ai-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 17, 23, 0.28);
  z-index: 55;
}
.ai-resize {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 5px;
  cursor: col-resize;
  z-index: 2;
}
.ai-panel--overlay .ai-resize {
  display: none;
}
.ai-resize:hover {
  background: var(--ar-accent-muted);
}
:global(body.ai-resizing) {
  cursor: col-resize;
  user-select: none;
}

.ai-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.6rem 0.7rem;
  border-bottom: 1px solid var(--ar-border);
  background: var(--ar-table-head-bg);
  flex-shrink: 0;
}
.ai-header-title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--ar-text);
}
.ai-header-actions {
  display: flex;
  align-items: center;
  gap: 0.15rem;
}
.ai-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem;
  border: none;
  border-radius: var(--ar-radius-sm);
  background: none;
  color: var(--ar-muted);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.ai-icon-btn:hover:not(:disabled) {
  background: var(--ar-accent-soft);
  color: var(--ar-link);
}
.ai-icon-btn.active {
  background: var(--ar-accent-muted);
  color: var(--ar-link);
}
.ai-icon-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ai-history {
  flex-shrink: 0;
  max-height: 40%;
  overflow-y: auto;
  padding: 0.5rem 0.6rem;
  border-bottom: 1px solid var(--ar-border);
  background: var(--ar-table-head-bg);
}
.ai-history-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--ar-muted);
  margin-bottom: 0.3rem;
}
.ai-history-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.ai-history-list li {
  display: flex;
  align-items: center;
  gap: 0.15rem;
}
.ai-history-item {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  padding: 0.35rem 0.45rem;
  border: none;
  border-radius: var(--ar-radius-sm);
  background: none;
  cursor: pointer;
  text-align: left;
  font-size: 0.82rem;
  color: var(--ar-text);
}
.ai-history-item:hover {
  background: var(--ar-accent-soft);
}
.ai-history-item.active {
  background: var(--ar-accent-muted);
  font-weight: 600;
}
.ai-history-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ai-history-date {
  font-size: 0.7rem;
  color: var(--ar-muted);
}
.ai-history-del:hover {
  color: var(--ar-danger);
}

.ai-notice {
  flex-shrink: 0;
  padding: 0.35rem 0.7rem;
  font-size: 0.75rem;
  background: var(--ar-accent-soft);
  color: var(--ar-link);
  border-bottom: 1px solid var(--ar-border);
}
.ai-error {
  flex-shrink: 0;
  padding: 0.35rem 0.7rem;
  font-size: 0.78rem;
  background: rgba(185, 28, 28, 0.08);
  color: var(--ar-danger);
  border-bottom: 1px solid var(--ar-border);
}
.ai-thread {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.7rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  background: var(--ar-surface);
}
.ai-empty {
  color: var(--ar-muted);
  font-size: 0.82rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0.2rem;
}
.ai-empty p {
  margin: 0;
}
.ai-suggestions {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.ai-suggestion {
  width: 100%;
  text-align: left;
  padding: 0.4rem 0.55rem;
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  background: var(--ar-surface);
  color: var(--ar-text);
  font-size: 0.8rem;
  cursor: pointer;
  transition: border-color 0.12s, background 0.12s;
}
.ai-suggestion:hover:not(:disabled) {
  border-color: var(--ar-accent);
  background: var(--ar-accent-soft);
}
.ai-msg {
  border-radius: var(--ar-radius);
  padding: 0.5rem 0.65rem;
  font-size: 0.85rem;
  word-break: break-word;
}
.ai-msg--user {
  align-self: flex-end;
  max-width: 92%;
  background: var(--ar-accent-muted);
  color: var(--ar-text);
  white-space: pre-wrap;
}
.ai-msg--assistant {
  align-self: stretch;
  padding-left: 0.15rem;
  padding-right: 0.15rem;
  color: var(--ar-text);
}
.ai-markdown :deep(p) {
  margin: 0.35rem 0;
}
.ai-markdown :deep(ul),
.ai-markdown :deep(ol) {
  margin: 0.35rem 0;
  padding-left: 1.2rem;
}
.ai-markdown :deep(pre) {
  background: var(--ar-table-head-bg);
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  padding: 0.5rem;
  overflow-x: auto;
  font-size: 0.78rem;
}
.ai-markdown :deep(code) {
  background: var(--ar-table-head-bg);
  border-radius: 4px;
  padding: 0.05rem 0.25rem;
  font-size: 0.8rem;
}
.ai-markdown :deep(table) {
  border-collapse: collapse;
  font-size: 0.78rem;
}
.ai-markdown :deep(th),
.ai-markdown :deep(td) {
  border: 1px solid var(--ar-border);
  padding: 0.2rem 0.4rem;
}
.ai-typing {
  display: flex;
  gap: 0.2rem;
  padding: 0.35rem 0.15rem;
}
.ai-typing span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ar-accent);
  opacity: 0.4;
  animation: ai-blink 1.1s infinite ease-in-out;
}
.ai-typing span:nth-child(2) {
  animation-delay: 0.18s;
}
.ai-typing span:nth-child(3) {
  animation-delay: 0.36s;
}
@keyframes ai-blink {
  0%,
  80%,
  100% {
    opacity: 0.25;
  }
  40% {
    opacity: 1;
  }
}
.ai-tool {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  padding: 0.2rem 0.4rem;
  border-radius: var(--ar-radius-sm);
  background: var(--ar-table-head-bg);
  color: var(--ar-muted);
  font-size: 0.72rem;
}
.ai-tool--error {
  background: rgba(185, 28, 28, 0.08);
  color: var(--ar-danger);
}
.ai-tool-name {
  font-weight: 600;
  flex-shrink: 0;
}
.ai-tool-summary {
  overflow: hidden;
  text-overflow: ellipsis;
}
.ai-muted {
  color: var(--ar-muted);
  font-size: 0.78rem;
  margin: 0.2rem 0;
}

.ai-composer {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.6rem 0.7rem;
  border-top: 1px solid var(--ar-border);
  background: var(--ar-table-head-bg);
}
.ai-input {
  width: 100%;
  resize: none;
  padding: 0.45rem 0.55rem;
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  font-size: 0.85rem;
  color: var(--ar-text);
  background: var(--ar-surface);
  font-family: inherit;
}
.ai-input:focus {
  outline: none;
  border-color: var(--ar-accent);
  box-shadow: 0 0 0 2px var(--ar-accent-muted);
}
.ai-composer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.4rem;
}
.ai-msg--failed {
  color: var(--ar-danger);
}

</style>




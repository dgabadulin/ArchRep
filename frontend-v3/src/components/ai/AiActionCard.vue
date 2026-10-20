<template>
  <div class="ai-action" :class="{ 'ai-action--blocked': !allowed }">
    <div class="ai-action-head">
      <component :is="iconComponent" :size="15" :stroke-width="1.9" class="ai-action-icon" />
      <span class="ai-action-title">{{ title }}</span>
    </div>
    <div class="ai-action-meta">
      <span class="ai-action-badge">{{ modeLabel }}</span>
      <span v-if="action.entityId" class="ai-action-id">#{{ action.entityId }}</span>
      <span v-if="action.type === 'prefill_form'" class="ai-action-hint">черновик, сохранение — вручную</span>
      <span v-if="action.type === 'open_view' && action.search" class="ai-action-hint">фильтр «{{ action.search }}»</span>
      <span v-if="focusHint" class="ai-action-hint">{{ focusHint }}</span>
    </div>
    <ul v-if="draftEntries.length" class="ai-action-draft">
      <li v-for="entry in draftEntries" :key="entry.key">
        <span class="ai-action-draft-label">{{ entry.label }}:</span>
        <span class="ai-action-draft-value">{{ truncate(entry.value) }}</span>
      </li>
    </ul>
    <ul v-if="noticeLines.length" class="ai-action-notice">
      <li v-for="(line, index) in noticeLines" :key="index">{{ line }}</li>
    </ul>
    <div class="ai-action-buttons">
      <button
        type="button"
        class="btn btn-primary btn-sm"
        :disabled="!allowed"
        :title="buttonTitle"
        @click="emit('open')"
      >
        {{ buttonLabel }}
      </button>
      <span v-if="!allowed" class="ai-action-denied">Нужно право {{ permissionCode || 'на изменение записи' }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { getMenuIconComponent } from '../../config/icons'
import {
  aiActionDraftEntries,
  aiActionIconKey,
  aiActionPermission,
  aiActionTitle,
  aiActionTypeLabel,
  canUseAiAction,
  getAiActionTarget,
  resolveAiActionLocation,
} from '../../config/aiActions'

const props = defineProps({
  action: { type: Object, required: true },
})

const emit = defineEmits(['open'])

const title = computed(() => aiActionTitle(props.action))
const modeLabel = computed(() => aiActionTypeLabel(props.action))
const draftEntries = computed(() => aiActionDraftEntries(props.action))
/**
 * Замечания к черновику (`warnings` сервера + поля, которые сервер отбросил): пользователь должен видеть,
 * что часть предложения не попала в черновик, — иначе он будет искать её в форме.
 */
const noticeLines = computed(() => {
  const action = props.action || {}
  const lines = (Array.isArray(action.warnings) ? action.warnings : []).map((w) => String(w))
  const ignored = (Array.isArray(action.ignoredFields) ? action.ignoredFields : []).map((f) => String(f))
  if (ignored.length) lines.push(`Не поддержано формой и не применено: ${ignored.join(', ')}.`)
  return lines
})
const permissionCode = computed(() => aiActionPermission(props.action))
// Иконка — из раздела меню того же пути (`config/menu.js`), без карты «тип → иконка» в этом компоненте.
const iconComponent = computed(() => getMenuIconComponent(aiActionIconKey(props.action)))
/** Реестр из `AI_ACTION_TARGETS`; иначе `open_view` — экран (analytics/dashboards/tech_radar). */
const isRegistryView = computed(() => Boolean(getAiActionTarget(props.action.entityType)))

/** Положительные id из `?ids=<csv>` — тот же разбор, что в `views/AnalyticsView.vue`. */
function parseFocusIds(raw) {
  const out = []
  for (const part of String(raw == null ? '' : raw).split(',')) {
    const n = Number.parseInt(part.trim(), 10)
    if (Number.isInteger(n) && n > 0 && !out.includes(n)) out.push(n)
  }
  return out
}

/**
 * Фокус графа у экрана: `open_view` с фокусом открывает «Анализ зависимостей» с уже построенным графом
 * (`views/AnalyticsView.vue`), поэтому в карточке показываем объект фокуса.
 *
 * Источник подписи — тот же `query`, что уходит в переход (`?entity=&ids=`): подсказка и ссылка не могут
 * разойтись, даже если сервер прислал только `query`. `focusIds`/`focusLabel` используются, когда есть.
 */
const focusHint = computed(() => {
  const action = props.action || {}
  const raw = Array.isArray(action.focusIds) && action.focusIds.length ? action.focusIds : parseFocusIds(action.query && action.query.ids)
  const ids = raw.map((id) => String(id))
  if (!ids.length) return ''
  return `граф по «${action.focusLabel || 'фокус'}» #${ids.join(', ')}`
})

/** Кнопка активна только если право есть и маршрут формы существует. */
const allowed = computed(() => canUseAiAction(props.action) && Boolean(resolveAiActionLocation(props.action)))

const buttonLabel = computed(() => {
  if (props.action.type === 'prefill_form') return 'Открыть форму с черновиком'
  if (props.action.type === 'open_view') {
    if (!isRegistryView.value) return focusHint.value ? 'Открыть раздел с графом' : 'Открыть раздел'
    return props.action.search ? 'Показать результаты в реестре' : 'Открыть реестр'
  }
  const mode = props.action.mode || 'view'
  if (mode === 'new') return 'Открыть форму создания'
  if (mode === 'edit') return 'Открыть форму изменения'
  return 'Открыть запись'
})

/** Подсказка кнопки: у каждого типа действия свой сценарий подтверждения. */
const buttonTitle = computed(() => {
  if (!allowed.value) return 'Недостаточно привилегий для этого действия'
  if (props.action.type === 'prefill_form') return 'Открыть форму: данные проверит и сохранит пользователь'
  if (props.action.type === 'open_view') {
    if (isRegistryView.value) return 'Открыть реестр: фильтр подставится в строку поиска списка'
    return focusHint.value
      ? 'Открыть раздел: граф построится по указанным объектам, данные ИИ не изменяет'
      : 'Открыть раздел интерфейса: ИИ только переходит на экран, данные не изменяет'
  }
  return 'Открыть форму записи'
})

function truncate(value, max = 140) {
  const text = String(value == null ? '' : value)
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}
</script>

<style scoped>
.ai-action {
  border: 1px solid var(--ar-border);
  border-left: 3px solid var(--ar-accent);
  border-radius: var(--ar-radius);
  background: var(--ar-surface);
  padding: 0.6rem 0.7rem;
  margin: 0.5rem 0;
}
.ai-action--blocked {
  border-left-color: var(--ar-muted);
  opacity: 0.85;
}
.ai-action-head {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 600;
  font-size: 0.88rem;
  color: var(--ar-text);
}
.ai-action-icon {
  flex-shrink: 0;
  color: var(--ar-link);
}
.ai-action-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.3rem;
  font-size: 0.72rem;
  color: var(--ar-muted);
}
.ai-action-badge {
  background: var(--ar-accent-muted);
  color: var(--ar-link);
  border-radius: 999px;
  padding: 0.05rem 0.45rem;
  font-weight: 600;
}
.ai-action-id {
  font-family: 'Consolas', 'Menlo', monospace;
}
.ai-action-draft {
  list-style: none;
  margin: 0.45rem 0 0;
  padding: 0.35rem 0.5rem;
  background: var(--ar-table-head-bg);
  border-radius: var(--ar-radius-sm);
  font-size: 0.78rem;
}
.ai-action-draft li + li {
  margin-top: 0.2rem;
}
.ai-action-draft-label {
  color: var(--ar-muted);
  margin-right: 0.3rem;
}
.ai-action-draft-value {
  color: var(--ar-text);
  word-break: break-word;
}
/* Замечания к черновику: предупреждения сервера и отброшенные поля — тише основного текста. */
.ai-action-notice {
  list-style: none;
  margin: 0.35rem 0 0;
  padding: 0;
  font-size: 0.74rem;
  color: var(--ar-muted);
}
.ai-action-notice li + li {
  margin-top: 0.2rem;
}
.ai-action-notice li::before {
  content: '•';
  margin-right: 0.35rem;
}
.ai-action-buttons {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
  flex-wrap: wrap;
}
.ai-action-denied {
  font-size: 0.72rem;
  color: var(--ar-danger);
}
</style>

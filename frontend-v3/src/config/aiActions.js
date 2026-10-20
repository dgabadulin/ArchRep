/**
 * Реестр UI-действий ИИ-архитектора (issue #78, docs/ai-architect.md §7).
 *
 * Сервер (`backend/ai/tools.js`) возвращает типизированное действие
 * `{ type: 'open_form' | 'prefill_form' | 'open_view', entityType, entityLabel, entityId, mode, path, payload, draft, search, permission }`.
 * Фронт обязан:
 *  1) перепроверить право через `authStore` (сервер — не единственная защита);
 *  2) смапить `entityType` на маршруты существующих форм (`src/router/index.js`).
 *
 * `listPath` — «чистый» путь реестра (списка) для `open_view`: ссылки-переходы строятся по пути,
 * чтобы не дублировать имена маршрутов. Фильтр списка передаётся query-параметром
 * `LIST_SEARCH_QUERY_KEY` (`utils/listSearchQuery.js`) — списки читают его через `useListSearch`.
 * Если сервер прислал только готовую ссылку (`action.path` = `/systems?search=…`), путь и фильтр
 * разбираются из неё тем же разбором (`searchFromQuery`) — имя ключа не дублируется.
 */
import { authStore } from '../auth/authStore'
import { listRoute, searchFromQuery } from '../utils/listSearchQuery'
import { menuIconKeyByPath } from './menu'

/**
 * Дополнительные query-параметры перехода `open_view` (белый список).
 *
 * Единственный потребитель — экран «Анализ зависимостей»: он принимает фокус графа
 * `?entity=<код типа>&ids=<csv id>` (`views/AnalyticsView.vue`). Реестры этот набор не читают,
 * поэтому посторонние ключи в переход не попадают — список читает только `search` (`useListSearch`).
 */
const AI_VIEW_EXTRA_QUERY_KEYS = ['entity', 'ids']

export function aiActionViewExtraQuery(action) {
  const q = action && action.query
  if (!q || typeof q !== 'object') return {}
  const out = {}
  for (const key of AI_VIEW_EXTRA_QUERY_KEYS) {
    const v = q[key]
    if (typeof v === 'string' && v.trim()) out[key] = v.trim()
  }
  return out
}

export const AI_ACTION_TARGETS = {
  system: {
    label: 'Информационная система',
    readPermission: 'system:read',
    writePermission: 'system:write',
    listRoute: { name: 'systems' },
    listPath: '/systems',
    newRoute: { name: 'system-new' },
    editRoute: { name: 'system-edit' },
    viewRoute: { name: 'system-edit' },
    prefill: true,
  },
  adr_applied: {
    label: 'Архитектурное заключение',
    readPermission: 'adr_applied:read',
    writePermission: 'adr_applied:write',
    listRoute: { name: 'decisions-applied' },
    listPath: '/decisions/applied',
    newRoute: { name: 'decision-applied-new' },
    editRoute: { name: 'decision-applied-edit' },
    viewRoute: { name: 'decision-applied-edit' },
    prefill: true,
  },
  adr_principle: {
    label: 'Принципиальное архитектурное решение',
    readPermission: 'adr_principle:read',
    writePermission: 'adr_principle:write',
    listRoute: { name: 'decisions-principle' },
    listPath: '/decisions/principle',
    newRoute: { name: 'decision-principle-new' },
    editRoute: { name: 'decision-principle-edit' },
    viewRoute: { name: 'decision-principle-edit' },
    prefill: true,
  },
  technology: {
    label: 'Технология',
    readPermission: 'technology:read',
    writePermission: 'technology:write',
    listRoute: { name: 'technologies' },
    listPath: '/technologies',
    newRoute: { name: 'technology-new' },
    editRoute: { name: 'technology-edit' },
    viewRoute: { name: 'technology-edit' },
    prefill: true,
  },
  integration_flow: {
    label: 'Интеграционный поток',
    readPermission: 'integration_flow:read',
    writePermission: 'integration_flow:write',
    listRoute: { name: 'integrations' },
    listPath: '/integrations',
    newRoute: { name: 'integration-new' },
    editRoute: { name: 'integration-edit' },
    viewRoute: { name: 'integration-edit' },
    prefill: true,
  },
  gap: {
    label: 'Архитектурный долг',
    readPermission: 'gap:read',
    writePermission: 'gap:write',
    listRoute: { name: 'architecture-debt' },
    listPath: '/architecture-debt',
    newRoute: { name: 'gap-new' },
    editRoute: { name: 'gap-edit' },
    viewRoute: { name: 'gap-edit' },
    prefill: true,
  },
  actor: {
    label: 'Заинтересованное лицо',
    readPermission: 'actor:read',
    writePermission: 'actor:write',
    listRoute: { name: 'actors' },
    listPath: '/actors',
    newRoute: { name: 'actor-new' },
    editRoute: { name: 'actor-edit' },
    viewRoute: { name: 'actor-edit' },
    prefill: true,
  },
  /**
   * Реестр «Связи объектов управления» (`/metamodel-relations`) — рёбра метамодели, из которых фронт
   * строит граф «Анализа зависимостей». Предзаполнение не поддерживается (концы задаются парой тип+id).
   */
  metamodel_relation: {
    label: 'Связь объектов управления',
    readPermission: 'metamodel_relation:read',
    writePermission: 'metamodel_relation:write',
    listRoute: { name: 'metamodel-relations' },
    listPath: '/metamodel-relations',
    newRoute: { name: 'metamodel-relation-new' },
    editRoute: { name: 'metamodel-relation-edit' },
    viewRoute: { name: 'metamodel-relation-edit' },
    prefill: false,
  },
  /**
   * Реестры, добавленные агенту (issue #91): каталог метамодели знал о них, а ИИ — нет.
   * `listRoute`/`newRoute`/`editRoute` берутся из `src/router/index.js`; `prefill` — только там, где форма
   * читает `?payload=` (`useAiPrefill`), иначе черновик молча не применится (docs/ai-architect.md §7).
   * У `principle`, `employee`, `partner` отдельного маршрута формы нет (форма — модалка внутри страницы),
   * поэтому задан только список. У `system_function` экранного реестра нет вовсе — записи в этой карте нет
   * (агенту доступны только search_entities и get_entity).
   */
  principle: {
    label: 'Архитектурный принцип',
    readPermission: 'principle:read',
    writePermission: 'principle:write',
    listRoute: { name: 'principles' },
    listPath: '/principles',
    prefill: false,
  },
  organization_unit: {
    label: 'Организационная единица',
    readPermission: 'organization_unit:read',
    writePermission: 'organization_unit:write',
    listRoute: { name: 'organization-units' },
    listPath: '/organization-units',
    newRoute: { name: 'organization-unit-new' },
    editRoute: { name: 'organization-unit-edit' },
    viewRoute: { name: 'organization-unit-edit' },
    prefill: false,
  },
  business_service: {
    label: 'Бизнес-сервис (продукт)',
    readPermission: 'business_service:read',
    writePermission: 'business_service:write',
    listRoute: { name: 'business-services' },
    listPath: '/business-services',
    newRoute: { name: 'business-service-new' },
    editRoute: { name: 'business-service-edit' },
    viewRoute: { name: 'business-service-edit' },
    prefill: false,
  },
  business_function: {
    label: 'Бизнес-способность',
    readPermission: 'business_function:read',
    writePermission: 'business_function:write',
    listRoute: { name: 'business-functions' },
    listPath: '/business-functions',
    newRoute: { name: 'business-function-new' },
    editRoute: { name: 'business-function-edit' },
    viewRoute: { name: 'business-function-edit' },
    prefill: false,
  },
  subsystem: {
    label: 'Модуль системы',
    readPermission: 'system:read',
    writePermission: 'system:write',
    listRoute: { name: 'systems' },
    listPath: '/systems',
    newRoute: { name: 'system-new' },
    editRoute: { name: 'system-edit' },
    viewRoute: { name: 'system-edit' },
    // Форма системы применяет ИИ-черновик (`useAiPrefill` в `SystemForm.vue`).
    prefill: true,
  },
  web_resource: {
    label: 'Веб-ресурс',
    readPermission: 'web_resource:read',
    writePermission: 'web_resource:write',
    listRoute: { name: 'web-resources' },
    listPath: '/web-resources',
    newRoute: { name: 'web-resource-new' },
    editRoute: { name: 'web-resource-edit' },
    viewRoute: { name: 'web-resource-edit' },
    prefill: false,
  },
  domain: {
    label: 'Домен',
    readPermission: 'domain:read',
    writePermission: 'domain:write',
    listRoute: { name: 'domains' },
    listPath: '/domains',
    newRoute: { name: 'domain-new' },
    editRoute: { name: 'domain-edit' },
    viewRoute: { name: 'domain-edit' },
    prefill: false,
  },
  certificate: {
    label: 'Сертификат',
    readPermission: 'certificate:read',
    writePermission: 'certificate:write',
    listRoute: { name: 'certificates' },
    listPath: '/certificates',
    newRoute: { name: 'certificate-new' },
    editRoute: { name: 'certificate-edit' },
    viewRoute: { name: 'certificate-edit' },
    prefill: false,
  },
  employee: {
    label: 'Сотрудник',
    readPermission: 'employee:read',
    writePermission: 'employee:write',
    // Отдельного маршрута формы нет: сотрудники правятся в модалке вкладки «Сотрудники» («Справочники»).
    listRoute: { name: 'references' },
    listPath: '/references',
    prefill: false,
  },
  partner: {
    label: 'Партнёр',
    readPermission: 'partner:read',
    writePermission: 'partner:write',
    // Отдельного маршрута формы нет: партнёры правятся в модалке вкладки «Партнёры» («Справочники»).
    listRoute: { name: 'references' },
    listPath: '/references',
    prefill: false,
  },
}

/** Подписи полей черновика (`prefill_form`) — совпадают с `prefillFields` в backend/ai/tools.js. */
export const AI_PREFILL_FIELD_LABELS = {
  name: 'Краткое наименование',
  fullname: 'Полное наименование',
  description: 'Описание',
  comment: 'Комментарий',
  external_system: 'Внешняя система',
  technologies: 'Технологии',
  task_name: 'Задача',
  task_link: 'Ссылка на задачу',
  conclusion: 'Заключение',
  increment_system_status_code: 'Статус систем в решении (код)',
  increment_relation_status_code: 'Статус связей в решении (код)',
  status_code: 'Статус заключения (код)',
  increments: 'Состав заключения (решения, системы, связи)',
  context: 'Контекст',
  decision: 'Решение',
  consequences: 'Последствия',
  transferred_data: 'Передаваемые данные',
  transfer_method: 'Способ передачи',
  periodicity: 'Периодичность',
  approve_document: 'Документ согласования',
  remediation_effort: 'Трудоёмкость устранения',
  responsible_person: 'Ответственный',
  source: 'Источник',
}

export const AI_ACTION_MODE_LABELS = { view: 'Открыть', edit: 'Изменить', new: 'Создать' }

/**
 * Подписи типов действий: у `open_view` и `prefill_form` нет `mode`,
 * поэтому в карточке действия они важнее режима.
 */
export const AI_ACTION_TYPE_LABELS = { open_view: 'Реестр', prefill_form: 'Предзаполнение' }

export function getAiActionTarget(entityType) {
  return AI_ACTION_TARGETS[String(entityType || '')] || null
}

/** Право, которое требует действие: сервер присылает `permission`, иначе выводим из режима. */
export function aiActionPermission(action) {
  if (action && action.permission) return String(action.permission)
  const target = getAiActionTarget(action && action.entityType)
  if (!target) return ''
  // `open_view` и режим просмотра формы — только чтение.
  const readOnly = (action && action.type === 'open_view') || (action && action.mode) === 'view'
  return readOnly ? target.readPermission : target.writePermission
}

export function canUseAiAction(action) {
  const code = aiActionPermission(action)
  if (!code) return false
  return authStore.hasPermission(code)
}

export function aiActionTitle(action) {
  const target = getAiActionTarget(action && action.entityType)
  return (
    (action && (action.entityTitle || action.entityLabel || action.label)) ||
    (target && target.label) ||
    (action && action.entityType) ||
    'Действие'
  )
}

export function aiActionModeLabel(action) {
  return AI_ACTION_MODE_LABELS[(action && action.mode) || 'view'] || 'Открыть'
}

/** Подпись действия для карточки: специфичные типы (`open_view`, `prefill_form`) важнее `mode`. */
export function aiActionTypeLabel(action) {
  const type = String((action && action.type) || '')
  return AI_ACTION_TYPE_LABELS[type] || aiActionModeLabel(action)
}

/**
 * Ключ иконки карточки действия (см. `config/icons.js`).
 *
 * Источник — раздел меню с тем же путём (`menuIconKeyByPath`): иконка реестра/экрана задаётся один раз
 * в `config/menu.js`, поэтому новая сущность не требует правок ни здесь, ни в `AiActionCard.vue`.
 * Нет раздела в меню — нейтральная иконка `file`.
 */
export function aiActionIconKey(action) {
  if (!action) return 'file'
  const target = getAiActionTarget(action.entityType)
  const path = action.listPath || (target && target.listPath) || ''
  return menuIconKeyByPath(path) || 'file'
}

/**
 * Сводка массива черновика: структурное поле (`increments`) — это решения → системы → связи, и в карточке нужен
 * объём предложения, а не JSON (`String([{...}])` дал бы `[object Object]`). Массив не-объектов — как строка.
 */
function draftArraySummary(list) {
  const objects = list.filter((v) => v && typeof v === 'object' && !Array.isArray(v))
  if (objects.length !== list.length) return list.map((v) => String(v == null ? '' : v)).join(', ')
  const pickList = (o, key) => (Array.isArray(o[key]) ? o[key] : [])
  const systems = objects.reduce((n, o) => n + pickList(o, 'systems').length, 0)
  const functions = objects.reduce(
    (n, o) => n + pickList(o, 'systems').reduce((m, s) => m + pickList(s, 'functions').length, 0),
    0
  )
  const relations = objects.reduce((n, o) => n + pickList(o, 'relations').length, 0)
  const parts = [`решений — ${objects.length}`]
  if (systems) parts.push(`систем — ${systems}`)
  if (functions) parts.push(`функций — ${functions}`)
  if (relations) parts.push(`связей — ${relations}`)
  return parts.join(', ')
}

/** Строки черновика для карточки действия: [{ key, label, value }]. */
export function aiActionDraftEntries(action) {
  const draft = action && action.draft
  if (!draft || typeof draft !== 'object') return []
  return Object.entries(draft).map(([key, value]) => ({
    key,
    label: AI_PREFILL_FIELD_LABELS[key] || key,
    value: Array.isArray(value) ? draftArraySummary(value) : String(value == null ? '' : value),
  }))
}

function locationWithId(route, id) {
  return { ...route, params: { ...(route.params || {}), id: String(id) } }
}

/**
 * Маршрут (vue-router location) для действия или `null`, если тип неизвестен.
 * `prefill_form` открывает **новую** форму с черновиком через существующий контракт `?payload=<base64>`.
 */
export function resolveAiActionLocation(action) {
  if (!action) return null
  const target = getAiActionTarget(action.entityType)
  const id = Number.parseInt(action.entityId, 10)
  const hasId = Number.isFinite(id)

  // `open_view` — переход в реестр (список) или на экран: путь берём из действия (`listPath` от сервера),
  // фильтр реестра передаём тем же query-ключом, который читает `useListSearch` (`?search=`), а фокус
  // экрана — параметрами `?entity=&ids=` (`AnalyticsView.vue`).
  // Нужно только право чтения, поэтому тип может отсутствовать в `AI_ACTION_TARGETS`
  // (в этом случае право берётся из `action.permission`).
  if (action.type === 'open_view') {
    let path = action.listPath ? String(action.listPath) : (target && target.listPath) || ''
    let search = action.search == null ? '' : String(action.search)
    let extra = aiActionViewExtraQuery(action)
    // Резерв: если пришла только готовая ссылка (`result.path` = `/systems?search=…`),
    // берём путь и фильтр из неё — ключ фильтра разбирает общий `searchFromQuery`.
    if (!path && action.path) {
      const [rawPath, rawQuery] = String(action.path).split('?')
      path = rawPath || ''
      const parsed = rawQuery ? Object.fromEntries(new URLSearchParams(rawQuery)) : {}
      if (!search) search = searchFromQuery(parsed)
      if (!Object.keys(extra).length) extra = aiActionViewExtraQuery({ query: parsed })
    }
    if (!path) return null
    return listRoute(path, search, extra)
  }

  if (action.type === 'prefill_form') {
    if (action.payload) {
      const base = action.path ? { path: String(action.path) } : target && target.newRoute ? { ...target.newRoute } : null
      if (!base) return null
      return { ...base, query: { ...(base.query || {}), payload: String(action.payload) } }
    }
    if (target && target.newRoute) return { ...target.newRoute }
    return hasId && target && target.editRoute ? locationWithId(target.editRoute, id) : null
  }

  if (!target) return null
  const mode = ['view', 'edit', 'new'].includes(action.mode) ? action.mode : 'view'
  if (mode === 'new') return target.newRoute ? { ...target.newRoute } : null
  if (hasId) {
    const route = mode === 'view' ? target.viewRoute || target.editRoute : target.editRoute
    if (route) return locationWithId(route, id)
  }
  return target.listRoute ? { ...target.listRoute } : null
}

'use strict';

const { hasAllPermissions } = require('../auth/userPermissions');
const { buildHomeStats } = require('../homeDashboard');
const { getParam } = require('../settingsParams');

/**
 * Инструменты ИИ-архитектора (issue #78, docs/ai-architect.md §6).
 *
 * Жёсткие правила:
 *  - только чтение через белый список SQL из `queries.js` (модель не генерирует SQL);
 *  - на каждый вызов повторно проверяются права пользователя (`hasAllPermissions`);
 *  - запись в БД невозможна: единственные UI-эффекты — действия
 *    `open_form` / `prefill_form` / `open_view`, которые пользователь подтверждает на фронте.
 */

function clampInt(value, min, max, def) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(Math.max(n, min), max);
}

function truncate(value, max = 600) {
  const s = String(value == null ? '' : value);
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/** Компактный срез строки БД: только непустые поля из белого списка, значения обрезаны. */
function pick(row, keys, maxLen = 400) {
  const out = {};
  if (!row) return out;
  for (const k of keys) {
    const v = row[k];
    if (v == null) continue;
    if (typeof v === 'string') {
      if (!v.trim()) continue;
      out[k] = truncate(v, maxLen);
    } else {
      out[k] = v;
    }
  }
  return out;
}

const SYSTEM_BRIEF_FIELDS = ['id', 'code', 'name', 'fullname', 'status', 'owner', 'vendor', 'hosting', 'parent_name'];

/** Ключ query-параметра фильтра реестра — синхронизирован с `frontend-v3/src/utils/listSearchQuery.js`. */
const LIST_SEARCH_QUERY_KEY = 'search';

/** Ключи query-параметров фокуса экрана — синхронизированы с диплинком `AnalyticsView.vue`. */
const SCREEN_FOCUS_QUERY_KEYS = { entityType: 'entity', ids: 'ids' };

/**
 * Максимум id в фокусе экрана по умолчанию: код параметра `SYS_AI_FOCUS_MAX_IDS` (используется
 * ИИ-архитектором при открытии экрана с фокусом); синхронизирован с `DEEPLINK_MAX_IDS` во фронте.
 */
const SCREEN_FOCUS_MAX_IDS_DEFAULT = 50;

/**
 * Ограничения структурного черновика `prefill_form` (решения заключения, см. docs/ai-architect.md §7).
 *
 * Черновик открывается в форме ссылкой (`?payload=`), поэтому модель может предложить больше, чем помещается
 * в обозримый черновик: сервер отбрасывает лишнее и возвращает предупреждения (`warnings`) — черновик остаётся
 * компактным, а пользователь видит, что часть предложения не поместилась и её нужно доделать руками.
 *
 * Значения — параметры `SYS_AI_PREFILL_MAX_*` (группа «ИИ-архитектор»); используются ИИ-архитектором при
 * генерации ADR и читаются на каждом вызове (`prefillCaps()`), поэтому расходиться с описанием инструмента
 * не могут: описание собирается из тех же значений. Константы ниже — только дефолты, они совпадают
 * с официальными сидами в DB/scripts.
 */
const PREFILL_CAP_DEFAULTS = {
  increments: 10,
  systems: 30,
  functions: 20,
  relations: 30,
  jsonChars: 5000,
};

/**
 * Лимиты структурного черновика: параметр БД → дефолт в коде (`SYS_AI_PREFILL_MAX_*`).
 * Верхние границы clamp — защита от опечатки в параметре (ссылка формы режется HTTP-сервером).
 */
function prefillCaps() {
  const d = PREFILL_CAP_DEFAULTS;
  return {
    increments: clampInt(getParam('SYS_AI_PREFILL_MAX_INCREMENTS', d.increments), 1, 50, d.increments),
    systems: clampInt(getParam('SYS_AI_PREFILL_MAX_SYSTEMS', d.systems), 1, 200, d.systems),
    functions: clampInt(getParam('SYS_AI_PREFILL_MAX_FUNCTIONS', d.functions), 1, 100, d.functions),
    relations: clampInt(getParam('SYS_AI_PREFILL_MAX_RELATIONS', d.relations), 1, 200, d.relations),
    jsonChars: clampInt(getParam('SYS_AI_PREFILL_MAX_JSON_CHARS', d.jsonChars), 1000, 40000, d.jsonChars),
  };
}

/** Максимум id в фокусе экрана `open_view`: параметр `SYS_AI_FOCUS_MAX_IDS` → дефолт в коде. */
function screenFocusMaxIds() {
  return clampInt(
    getParam('SYS_AI_FOCUS_MAX_IDS', SCREEN_FOCUS_MAX_IDS_DEFAULT),
    1,
    200,
    SCREEN_FOCUS_MAX_IDS_DEFAULT,
  );
}

/** Код статуса новой системы в решении — параметр `ADR_INCR_SYS_NEW_STATUS_CODE` (как в форме и backend/index.js). */
function adrNewSystemStatusCode() {
  const def = 'ADR_INCR_SYS_CREATING';
  return String(getParam('ADR_INCR_SYS_NEW_STATUS_CODE', def) || def).trim() || def;
}


/** Код статуса «Черновик» по умолчанию — как `DEFAULT_DRAFT_STATUS_CODE` в `backend/index.js`. */
const DEFAULT_ADR_DRAFT_STATUS_CODE = 'ADR_STATUS_DRAFT';

/** Ключ новой системы решения: без ':' (связи ссылаются на систему как `n:<key>`), не чисто числовой. */
const ADR_SYSTEM_KEY_RE = /^[A-Za-z][A-Za-z0-9_.-]{0,39}$/;

/**
 * JSON-схема структурного поля черновика `adr_applied.increments` (docs/ai-architect.md §7).
 *
 * Функция, а не константа: лимиты — параметры `SYS_AI_PREFILL_MAX_*`, и описание модели должно совпадать
 * с фактическим разбором (`normalizeAppliedIncrementsDraft`) на момент запроса.
 * Схема попадает в описание инструмента через `ENTITY_TYPES.adr_applied.prefillStructure`, поэтому подсказка
 * модели, белый список полей и разбор в `runPrefillForm` не расходятся. Соглашения: статусы — **коды**
 * справочников поставки, а не id; существующая система — по `ar_systems_id` из `search_entities`; новая
 * система — `kind:"new"` с `key` (на ключ ссылаются связи), `code` и `name`; функции система получает только
 * новые — реестровых функций системы инструментам не видно (у реестра функций своё право).
 * @param {{increments:number,systems:number,functions:number,relations:number,jsonChars:number}} [caps]
 */
function appliedIncrementsSchema(caps = prefillCaps()) {
  return {
  type: 'array',
  description:
    `Решения заключения (не более ${caps.increments}) с системами, функциями и связями — ` +
    'массив объектов, а не строка. Решение: order_index, name, ar_adr_increment_types_id (id из ' +
    'list_adr_increment_statuses, раздел incrementTypes). Система реестра: ar_systems_id из search_entities ' +
    '(при необходимости increment_system_status_code, comment). Новая система: kind:"new" + key + code + name. ' +
    'Связь решения: from/to — "s:<ar_systems_id>" (система реестра) или "n:<key>" (новая система этого же решения).',
  items: {
    type: 'object',
    properties: {
      order_index: {
        type: 'integer',
        description: 'Порядковый номер решения; если не указан — по порядку в массиве.',
      },
      name: {
        type: 'string',
        description: 'Наименование решения, напр. «Временное решение — Инкремент 1».',
      },
      ar_adr_increment_types_id: {
        type: 'integer',
        description: 'id типа решения из list_adr_increment_statuses (incrementTypes).',
      },
      systems: {
        type: 'array',
        description: `Системы решения (не более ${caps.systems}).`,
        items: {
          type: 'object',
          properties: {
            kind: {
              type: 'string',
              enum: ['existing', 'new'],
              description: 'existing (по умолчанию) — система реестра; new — новая система, создаётся при сохранении.',
            },
            ar_systems_id: {
              type: 'integer',
              description: 'id системы реестра (kind=existing) — из search_entities.',
            },
            key: {
              type: 'string',
              description: 'Ключ новой системы внутри решения (kind=new); связи ссылаются на неё как "n:<key>".',
            },
            code: { type: 'string', description: 'Код новой системы (kind=new).' },
            name: { type: 'string', description: 'Наименование системы (обязательно для kind=new).' },
            fullname: { type: 'string', description: 'Полное наименование новой системы.' },
            increment_system_status_code: {
              type: 'string',
              description: 'Код статуса системы в решении (ADR_INCR_SYS_*); у новой системы всегда «Создаётся».',
            },
            comment: { type: 'string', description: 'Комментарий (для системы реестра).' },
            functions: {
              type: 'array',
              description:
                `Функции системы в решении (не более ${caps.functions}); при сохранении ` +
                'создаются в реестре как новые функции системы.',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Название функции.' },
                  description: { type: 'string', description: 'Описание функции.' },
                  increment_sysfunc_status_code: {
                    type: 'string',
                    description: 'Код статуса функции в решении (ADR_INCR_SYSFUNC_*).',
                  },
                },
                required: ['name'],
              },
            },
          },
        },
      },
      relations: {
        type: 'array',
        description:
          `Связи (интеграции) между системами решения (не более ${caps.relations}); ` +
          'концы — "s:<ar_systems_id>" и/или "n:<key>".',
        items: {
          type: 'object',
          properties: {
            from: { type: 'string', description: 'Источник: "s:<ar_systems_id>" или "n:<key>".' },
            to: { type: 'string', description: 'Приёмник: "s:<ar_systems_id>" или "n:<key>".' },
            transferred_data: { type: 'string', description: 'Передаваемые данные.' },
            transfer_method: { type: 'string', description: 'Способ передачи.' },
            periodicity: { type: 'string', description: 'Периодичность.' },
            increment_relation_status_code: {
              type: 'string',
              description: 'Код статуса связи в решении (ADR_INCR_REL_*).',
            },
          },
          required: ['from', 'to'],
        },
      },
    },
  },
  };
}

/**
 * Бюджет структурной части черновика по размеру JSON. `?payload=` — base64 от percent-encoded JSON (≈+40 %
 * к размеру), а слишком длинную строку запроса HTTP-сервер режет, поэтому размер ограничен с запасом:
 * так черновик гарантированно доезжает до формы, а не теряется по дороге.
 * `fit()` возвращает false, когда очередной элемент уже не помещается. Лимит — `SYS_AI_PREFILL_MAX_JSON_CHARS`.
 * @param {string[]} warnings — накопитель предупреждений
 * @param {{jsonChars:number}} caps — лимиты черновика (`prefillCaps()`)
 */
function draftBudget(warnings, caps = prefillCaps()) {
  let used = 0;
  let warned = false;
  return {
    fit(item) {
      const cost = JSON.stringify(item).length + 2;
      if (used + cost > caps.jsonChars) {
        if (!warned) {
          warned = true;
          warnings.push(
            'Структурная часть черновика обрезана: остальное не помещается в ссылку формы — доделайте это в форме.',
          );
        }
        return false;
      }
      used += cost;
      return true;
    },
  };
}

/** Строки справочника по коду: `Map(код → строка)`. Кода нет в справочнике — код модели отбрасывается. */
function catalogRowsByCode(rows) {
  const map = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const code = String(row && row.code != null ? row.code : '').trim();
    if (code) map.set(code, row);
  }
  return map;
}

/** Первое непустое значение: конец связи модель может назвать `from`, `from_key` или как в контракте `full`. */
function firstPresent(...values) {
  for (const value of values) {
    if (value == null) continue;
    if (typeof value === 'string' && !value.trim()) continue;
    return value;
  }
  return null;
}

/** Значение для текста предупреждения: модель может прислать объект вместо кода или ссылки. */
function warningValue(value) {
  const text = typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value == null ? '' : value);
  return truncate(text, 60);
}

/** Ключ новой системы решения: ключ модели, если он пригоден и не занят; иначе сгенерированный `sys<N>`. */
function uniqueSystemKey(raw, used) {
  const candidate = String(raw == null ? '' : raw).trim();
  if (ADR_SYSTEM_KEY_RE.test(candidate) && !used.has(candidate)) {
    used.add(candidate);
    return candidate;
  }
  let i = used.size + 1;
  while (used.has(`sys${i}`)) i += 1;
  used.add(`sys${i}`);
  return `sys${i}`;
}

/**
 * Нормализовать конец связи черновика в `s:<ar_systems_id>` | `n:<key>`.
 * Принимаются оба написания: `"s:12"` / `"n:newKey"` и голый id системы реестра (`12`).
 * Ссылка на систему, которой в этом решении нет, — `null` (связь отбрасывается с предупреждением).
 */
function normalizeStructureEndpoint(value, sysIds, newKeys) {
  const raw = String(value == null ? '' : value).trim();
  if (!raw) return null;
  const prefixed = /^([sn]):(.+)$/.exec(raw);
  const kind = prefixed ? prefixed[1].toLowerCase() : /^\d+$/.test(raw) ? 's' : null;
  const body = prefixed ? prefixed[2].trim() : raw;
  if (kind === 's') {
    const id = Number.parseInt(body, 10);
    return Number.isFinite(id) && sysIds.has(id) ? `s:${id}` : null;
  }
  if (kind === 'n') return newKeys.has(body) ? `n:${body}` : null;
  return null;
}

/**
 * Функции системы в черновике: без названия отбрасываются, чужой код статуса — `null` (дефолт формы).
 * @param {*} raw — значение `systems[].functions[]` из аргументов модели
 * @param {Map<string, any>} fnStatusByCode — справочник статусов функций по коду
 * @param {string[]} warnings — накопитель предупреждений
 * @param {{fit:(item:any)=>boolean}} budget — бюджет размера структурной части черновика
 * @param {{functions:number}} caps — лимиты черновика (`prefillCaps()`)
 */
function normalizeDraftFunctions(raw, fnStatusByCode, warnings, budget, caps = prefillCaps()) {
  const list = Array.isArray(raw) ? raw : [];
  if (list.length > caps.functions) {
    warnings.push(`У системы черновика больше ${caps.functions} функций — лишние отброшены.`);
  }
  const out = [];
  for (const item of list.slice(0, caps.functions)) {
    const fn = item && typeof item === 'object' && !Array.isArray(item) ? item : {};
    const name = truncate(fn.name, 500).trim();
    if (!name) continue;
    const code = String(fn.increment_sysfunc_status_code == null ? '' : fn.increment_sysfunc_status_code).trim();
    if (code && !fnStatusByCode.has(code)) {
      warnings.push(`Неизвестный код статуса функции «${code}» — функция «${name}» добавлена без статуса.`);
    }
    const row = {
      name,
      description: truncate(fn.description, 1000).trim() || null,
      increment_sysfunc_status_code: fnStatusByCode.has(code) ? code : null,
    };
    if (!budget.fit(row)) break;
    out.push(row);
  }
  return out;
}

/**
 * Нормализовать структурный черновик `increments` (docs/ai-architect.md §7).
 *
 * Слой доверия: id и коды проверяются по справочникам и лимитам, а не принимаются на веру.
 *  - решения / системы / функции / связи ограничены `SYS_AI_PREFILL_MAX_*` и бюджетом размера — лишнее
 *    отбрасывается с предупреждением (`warnings` уходят и в карточку действия, и в текст результата);
 *  - тип решения — только id из справочника `incrementTypes`; коды статусов — только из справочников контура;
 *  - система реестра — по `ar_systems_id` (существование id проверяет форма по загруженному реестру);
 *  - новая система — `kind:'new'` + `key`/`code`/`name`, статус всегда по параметру `ADR_INCR_SYS_NEW_STATUS_CODE`;
 *  - связи на системы, которых нет в этом решении, и петли (`from === to`) отбрасываются.
 *
 * Формат результата — тот же, что форма собирает в `buildIncrementsPayload` при сохранении структуры, поэтому
 * `DecisionAppliedForm.vue` применяет черновик своей же гидратацией (черновик → правки пользователя → payload).
 *
 * @param {*} raw — значение поля `increments` из аргументов модели
 * @param {{incrementTypes:any[],systemStatuses:any[],systemFunctionStatuses:any[],relationStatuses:any[]}} catalogs
 * @param {string[]} warnings — накопитель предупреждений
 * @param {{increments:number,systems:number,functions:number,relations:number,jsonChars:number}} [caps] — лимиты черновика
 * @returns {any[]} решения черновика
 */
function normalizeAppliedIncrementsDraft(raw, catalogs, warnings, caps = prefillCaps()) {
  if (!Array.isArray(raw)) {
    warnings.push('Структурную часть черновика (increments) не удалось применить: ожидался массив решений.');
    return [];
  }
  if (!raw.length) return [];
  const typeIds = new Set((catalogs.incrementTypes || []).map((row) => Number(row.id)));
  const systemStatusByCode = catalogRowsByCode(catalogs.systemStatuses);
  const fnStatusByCode = catalogRowsByCode(catalogs.systemFunctionStatuses);
  const relStatusByCode = catalogRowsByCode(catalogs.relationStatuses);
  const budget = draftBudget(warnings, caps);
  // Статус новой системы — параметр `ADR_INCR_SYS_NEW_STATUS_CODE` (тот же, что подставляет форма).
  const newSysStatusCode = adrNewSystemStatusCode();
  if (raw.length > caps.increments) {
    warnings.push(`В черновике больше ${caps.increments} решений — лишние отброшены.`);
  }
  const out = [];
  for (const item of raw.slice(0, caps.increments)) {
    const src = item && typeof item === 'object' && !Array.isArray(item) ? item : {};
    const increment = {
      order_index: clampInt(src.order_index, 1, 999, out.length + 1),
      name: truncate(src.name, 500).trim(),
      ar_adr_increment_types_id: null,
      systems: [],
      relations: [],
    };
    const typeId = Number.parseInt(src.ar_adr_increment_types_id, 10);
    if (Number.isFinite(typeId)) {
      if (typeIds.has(typeId)) increment.ar_adr_increment_types_id = typeId;
      else {
        warnings.push(
          `Неизвестный тип решения #${typeId} — решение «${increment.name || increment.order_index}» добавлено без типа.`,
        );
      }
    }
    const rawSystems = Array.isArray(src.systems) ? src.systems : [];
    if (rawSystems.length > caps.systems) {
      warnings.push(
        `В решении «${increment.name || increment.order_index}» больше ${caps.systems} систем — лишние отброшены.`,
      );
    }
    const usedKeys = new Set();
    const sysIds = new Set();
    for (const rawSys of rawSystems.slice(0, caps.systems)) {
      const sys = rawSys && typeof rawSys === 'object' && !Array.isArray(rawSys) ? rawSys : {};
      const kind = String(sys.kind == null ? '' : sys.kind).trim().toLowerCase();
      const isNew = kind === 'new' || (kind !== 'existing' && sys.ar_systems_id == null && (sys.name || sys.code));
      if (isNew) {
        const name = truncate(sys.name, 255).trim();
        if (!name) {
          warnings.push('Новая система черновика без наименования отброшена.');
          continue;
        }
        const key = uniqueSystemKey(sys.key, usedKeys);
        if (!ADR_SYSTEM_KEY_RE.test(String(sys.key == null ? '' : sys.key).trim())) {
          warnings.push(`У новой системы «${name}» не задан key — связи ссылаются на неё как "n:${key}".`);
        }
        const newStatusCode = String(
          sys.increment_system_status_code == null ? '' : sys.increment_system_status_code,
        ).trim();
        if (newStatusCode && newStatusCode !== newSysStatusCode) {
          warnings.push(`Новая система «${name}» в решении всегда «Создаётся» — код ${newStatusCode} проигнорирован.`);
        }
        const newRow = {
          kind: 'new',
          key,
          code: truncate(sys.code, 64).trim(),
          name,
          fullname: truncate(sys.fullname, 500).trim() || null,
          increment_system_status_code: newSysStatusCode,
          functions: normalizeDraftFunctions(sys.functions, fnStatusByCode, warnings, budget, caps),
        };
        if (!budget.fit(newRow)) continue;
        increment.systems.push(newRow);
        continue;
      }
      const sysId = Number.parseInt(sys.ar_systems_id, 10);
      if (!Number.isFinite(sysId)) {
        warnings.push('Система черновика без ar_systems_id отброшена: нужен id из search_entities или kind:"new".');
        continue;
      }
      if (sysIds.has(sysId)) continue;
      sysIds.add(sysId);
      const statusCode = String(
        sys.increment_system_status_code == null ? '' : sys.increment_system_status_code,
      ).trim();
      if (statusCode && !systemStatusByCode.has(statusCode)) {
        warnings.push(`Неизвестный код статуса системы «${statusCode}» — у системы #${sysId} статус не задан.`);
      }
      const sysRow = {
        kind: 'existing',
        ar_systems_id: sysId,
        increment_system_status_code: systemStatusByCode.has(statusCode) ? statusCode : null,
        comment: truncate(sys.comment, 2000).trim() || null,
        functions: normalizeDraftFunctions(sys.functions, fnStatusByCode, warnings, budget, caps),
      };
      if (!budget.fit(sysRow)) continue;
      increment.systems.push(sysRow);
    }
    const rawRelations = Array.isArray(src.relations) ? src.relations : [];
    if (rawRelations.length > caps.relations) {
      warnings.push(
        `В решении «${increment.name || increment.order_index}» больше ${caps.relations} связей — лишние отброшены.`,
      );
    }
    for (const rawRel of rawRelations.slice(0, caps.relations)) {
      const rel = rawRel && typeof rawRel === 'object' && !Array.isArray(rawRel) ? rawRel : {};
      const fromRaw = firstPresent(rel.from, rel.from_key, rel.from_ar_systems_id, rel.from_new_key);
      const toRaw = firstPresent(rel.to, rel.to_key, rel.to_ar_systems_id, rel.to_new_key);
      const from = normalizeStructureEndpoint(fromRaw, sysIds, usedKeys);
      const to = normalizeStructureEndpoint(toRaw, sysIds, usedKeys);
      if (!from || !to) {
        warnings.push(
          `Связь черновика (${warningValue(fromRaw)} → ${warningValue(toRaw)}) отброшена: концы — ` +
            '"s:<ar_systems_id>" или "n:<key>" систем этого решения.',
        );
        continue;
      }
      if (from === to) {
        warnings.push(`Связь черновика ${from} → ${to} отброшена: источник и приёмник совпадают.`);
        continue;
      }
      const relStatusCode = String(
        rel.increment_relation_status_code == null ? '' : rel.increment_relation_status_code,
      ).trim();
      if (relStatusCode && !relStatusByCode.has(relStatusCode)) {
        warnings.push(`Неизвестный код статуса связи «${relStatusCode}» — у связи ${from} → ${to} статус не задан.`);
      }
      const relRow = {
        from,
        to,
        transferred_data: truncate(rel.transferred_data, 1000).trim(),
        transfer_method: truncate(rel.transfer_method, 500).trim(),
        periodicity: truncate(rel.periodicity, 200).trim(),
        increment_relation_status_code: relStatusByCode.has(relStatusCode) ? relStatusCode : null,
      };
      if (!budget.fit(relRow)) break;
      increment.relations.push(relRow);
    }
    if (
      !increment.systems.length &&
      !increment.relations.length &&
      !increment.name &&
      increment.ar_adr_increment_types_id == null
    ) {
      warnings.push(`Решение #${increment.order_index} черновика пропущено: нет ни наименования, ни систем, ни связей.`);
      continue;
    }
    out.push(increment);
  }
  return out;
}

/**
 * Реестры, доступные ИИ-архитектору.
 * `form` — маршруты существующих форм (issue #78 §7): только у сущностей с формой в UI.
 * `listPath` — путь реестра (списка) для действия `open_view`; совпадает с `listRoute` в
 * `frontend-v3/src/config/aiActions.js`.
 * `prefillFields` — белый список полей черновика (`prefill_form`); имена полей совпадают с ключами
 * форм фронта и с `AI_PREFILL_FIELD_LABELS` в `frontend-v3/src/config/aiActions.js`.
 * `prefillStructure` — структурное поле черновика (`{ field, schema, hint }`): значение не строка, а дерево
 * (у `adr_applied` — состав заключения); схема и подсказка уходят в описание инструмента `prefill_form`.
 * `schema`/`hint` могут быть функциями от лимитов (`prefillCaps()`): лимиты — параметры `SYS_AI_PREFILL_MAX_*`,
 * и описание инструмента обязано совпадать с фактическим разбором черновика на момент запроса.
 */
const ENTITY_TYPES = {
  system: {
    label: 'Информационная система',
    plural: 'Информационные системы',
    readPermission: 'system:read',
    writePermission: 'system:write',
    select: 'systems_select',
    search: 'systems_select_search',
    get: 'systems_get',
    labelOf: (r) => [r.code, r.name].filter(Boolean).join(' — ') || `#${r.id}`,
    brief: (r) => pick(r, SYSTEM_BRIEF_FIELDS),
    form: {
      new: () => '/systems/new',
      edit: (id) => `/systems/${id}/edit`,
      // В UI отдельного маршрута просмотра нет: та же форма показывает режим просмотра без права записи.
      view: (id) => `/systems/${id}/edit`,
    },
    listPath: '/systems',
    prefillFields: ['name', 'fullname', 'description', 'comment', 'technologies', 'external_system'],
  },
  technology: {
    label: 'Технология',
    plural: 'Технологии',
    readPermission: 'technology:read',
    writePermission: 'technology:write',
    select: 'technologies_select',
    search: 'technologies_select_search',
    get: 'technologies_get',
    labelOf: (r) => r.name || `#${r.id}`,
    brief: (r) => pick(r, ['id', 'name', 'approve_document', 'radar_include_flag', 'domestic_flag', 'description']),
    form: {
      new: () => '/technologies/new',
      edit: (id) => `/technologies/${id}/edit`,
      view: (id) => `/technologies/${id}/edit`,
    },
    listPath: '/technologies',
    prefillFields: ['name', 'description', 'approve_document'],
  },
  adr_applied: {
    label: 'Архитектурное заключение',
    plural: 'Архитектурные заключения',
    readPermission: 'adr_applied:read',
    writePermission: 'adr_applied:write',
    select: 'adrs_applied_select',
    search: 'adrs_applied_select_search',
    get: 'adrs_applied_get',
    labelOf: (r) => [r.code, r.task_name].filter(Boolean).join(' — ') || `#${r.id}`,
    brief: (r) => pick(r, ['id', 'code', 'task_name', 'task_link', 'status_name', 'author']),
    form: {
      new: () => '/decisions/applied/new',
      edit: (id) => `/decisions/applied/${id}/edit`,
      view: (id) => `/decisions/applied/${id}/edit`,
    },
    listPath: '/decisions/applied',
    // Статусы контура инкремента задаются кодами справочников (`list_adr_increment_statuses`), а не id:
    // id зависят от БД, коды (ADR_INCR_SYS_* / ADR_INCR_REL_*) модель называет и проверяет по справочнику.
    // `increments` — структурное поле: значение не строка, а состав заключения (решения → системы → связи);
    // `schema` и `hint` — функции от лимитов (`SYS_AI_PREFILL_MAX_*`), поэтому описание инструмента и разбор
    // в `runPrefillForm` считают по одним и тем же значениям параметров (docs/ai-architect.md §7).
    prefillFields: [
      'task_name',
      'task_link',
      'conclusion',
      'increment_system_status_code',
      'increment_relation_status_code',
      'increments',
    ],
    prefillStructure: {
      field: 'increments',
      schema: appliedIncrementsSchema,
      hint: (caps) =>
        'состав заключения: решения, их системы (реестровые по id и новые) с функциями и связи между системами ' +
        `решения (не более ${caps.increments} решений, ${caps.systems} систем ` +
        `и ${caps.relations} связей в решении); статусы — коды из list_adr_increment_statuses`,
    },
  },
  adr_principle: {
    label: 'Принципиальное архитектурное решение',
    plural: 'Реестр принципиальных решений (ADR)',
    readPermission: 'adr_principle:read',
    writePermission: 'adr_principle:write',
    select: 'adrs_principle_select',
    search: 'adrs_principle_select_search',
    get: 'adrs_principle_get',
    labelOf: (r) => [r.code, r.name].filter(Boolean).join(' — ') || `#${r.id}`,
    brief: (r) => pick(r, ['id', 'code', 'name', 'status_name', 'author']),
    form: {
      new: () => '/decisions/principle/new',
      edit: (id) => `/decisions/principle/${id}/edit`,
      view: (id) => `/decisions/principle/${id}/edit`,
    },
    listPath: '/decisions/principle',
    prefillFields: ['name', 'context', 'decision', 'consequences'],
  },
  integration_flow: {
    label: 'Интеграционный поток',
    plural: 'Интеграционные потоки',
    readPermission: 'integration_flow:read',
    writePermission: 'integration_flow:write',
    select: 'integration_flows_select',
    search: 'integration_flows_select_search',
    get: 'integration_flows_get',
    labelOf: (r) =>
      [r.source_display_name || r.source_name, r.target_display_name || r.target_name].filter(Boolean).join(' → ') ||
      `#${r.id}`,
    brief: (r) =>
      pick(r, [
        'id',
        'source_display_name',
        'target_display_name',
        'event_type_name',
        'status_name',
        'transferred_data',
        'transfer_method',
        'periodicity',
      ]),
    form: {
      new: () => '/integrations/new',
      edit: (id) => `/integrations/${id}/edit`,
      view: (id) => `/integrations/${id}/edit`,
    },
    listPath: '/integrations',
    prefillFields: ['transferred_data', 'transfer_method', 'periodicity'],
  },
  /**
   * Реестр «Связи объектов управления» (/metamodel-relations) — рёбра метамодели.
   * Он же источник «Анализа зависимостей»: граф на экране /analytics строится фронтом
   * из этих связей (`frontend-v3/src/api/graphApi.js`), поэтому без этого типа ИИ
   * отрицал существование реестра связей и не мог отвечать про зависимости.
   * Предзаполнение не поддерживается: концы ребра задаются парой (тип, id), черновик от
   * модели с числовыми id был бы недостоверным (docs/ai-architect.md §7).
   */
  metamodel_relation: {
    label: 'Связь объектов управления',
    plural: 'Связи объектов управления',
    readPermission: 'metamodel_relation:read',
    writePermission: 'metamodel_relation:write',
    select: 'metamodel_relations_select',
    search: 'metamodel_relations_select_search',
    get: 'metamodel_relations_get',
    labelOf: (r) => [r.displayed_name || r.name, r.relation_type_name || r.relation_type].filter(Boolean).join(' — ') || `#${r.id}`,
    brief: (r) =>
      pick(r, [
        'id',
        'relation_type',
        'relation_type_name',
        'displayed_name',
        'name',
        'from_entity_type',
        'from_entity_id',
        'to_entity_type',
        'to_entity_id',
        'reference_to_baserow',
      ]),
    form: {
      new: () => '/metamodel-relations/new',
      edit: (id) => `/metamodel-relations/${id}/edit`,
      view: (id) => `/metamodel-relations/${id}/edit`,
    },
    listPath: '/metamodel-relations',
    prefillFields: [],
  },
  actor: {
    label: 'Заинтересованное лицо',
    plural: 'Заинтересованные лица',
    readPermission: 'actor:read',
    writePermission: 'actor:write',
    select: 'togaf_actors_select',
    search: 'togaf_actors_select_search',
    get: 'togaf_actors_get',
    labelOf: (r) => r.name || `#${r.id}`,
    brief: (r) => pick(r, ['id', 'name', 'actor_type_name', 'organization_unit_name', 'description']),
    form: {
      new: () => '/actors/new',
      edit: (id) => `/actors/${id}/edit`,
      view: (id) => `/actors/${id}/edit`,
    },
    listPath: '/actors',
    prefillFields: ['name', 'description'],
  },
  gap: {
    label: 'Архитектурный долг (разрыв)',
    plural: 'Реестр архитектурных разрывов',
    readPermission: 'gap:read',
    writePermission: 'gap:write',
    select: 'gaps_select',
    search: 'gaps_select_search',
    get: 'gaps_get',
    labelOf: (r) => [r.code, r.name].filter(Boolean).join(' — ') || `#${r.id}`,
    brief: (r) =>
      pick(r, ['id', 'code', 'name', 'gap_state_name', 'impact_level_name', 'gap_type_name', 'target_date', 'responsible_person']),
    form: {
      new: () => '/architecture-debt/new',
      edit: (id) => `/architecture-debt/${id}/edit`,
      view: (id) => `/architecture-debt/${id}/edit`,
    },
    listPath: '/architecture-debt',
    prefillFields: [
      'name',
      'description',
      'consequences',
      'remediation_effort',
      'responsible_person',
      'source',
    ],
  },
  /**
   * Реестры, добавленные агенту после разбора «сущности без инструментов»: каталог метамодели
   * (`ar_metamodel_entity_types`) о них знал, а у агента инструментов не было — `list_entity_types`
   * показывал `aiRegistry:false`, и спросить о содержимом реестра было нельзя.
   *
   * Правила записи:
   *  - `form` — только там, где в UI есть отдельный маршрут формы (иначе `open_form` не предлагается);
   *  - `prefillFields` задаётся ВСЕГДА (пусть пустым): у типов с `form` его читают `toolDefinitions`
   *    (описание `prefill_form`) и `runPrefillForm`; само предзаполнение включается лишь там, где форма
   *    читает `?payload=` через `useAiPrefill`, иначе поле молча не применится (docs/ai-architect.md §7);
   *  - `listPath` отсутствует у типов, у которых нет экранного списка (`open_view` вернёт понятную ошибку);
   *  - `subsystem` — это модуль системы (`ar_systems` с `parent_ar_systems_id`). Отдельного SQL «только
   *    модули» нет, поэтому он читает общий каталог ИС; модуль виден модели по `parent_name`.
   */
  principle: {
    label: 'Архитектурный принцип',
    plural: 'Архитектурные принципы',
    readPermission: 'principle:read',
    writePermission: 'principle:write',
    select: 'principles_select',
    search: 'principles_select_search',
    get: 'principles_get',
    labelOf: (r) => r.name || `#${r.id}`,
    brief: (r) => pick(r, ['id', 'name', 'statement', 'rationale', 'is_approved', 'approve_document']),
    // Отдельного маршрута формы нет: форма принципа — модалка внутри `Principles.vue`.
    listPath: '/principles',
    prefillFields: [],
  },
  organization_unit: {
    label: 'Организационная единица',
    plural: 'Организационные единицы',
    readPermission: 'organization_unit:read',
    writePermission: 'organization_unit:write',
    select: 'togaf_organization_units_select',
    search: 'togaf_organization_units_select_search',
    get: 'togaf_organization_units_get',
    labelOf: (r) => [r.name, r.fullname].filter(Boolean).join(' — ') || `#${r.id}`,
    brief: (r) => pick(r, ['id', 'name', 'fullname', 'category_name', 'parent_name', 'leader']),
    form: {
      new: () => '/organization-units/new',
      edit: (id) => `/organization-units/${id}/edit`,
      view: (id) => `/organization-units/${id}/edit`,
    },
    listPath: '/organization-units',
    prefillFields: [],
  },
  business_service: {
    label: 'Бизнес-сервис (продукт)',
    plural: 'Бизнес-сервисы (продукты)',
    readPermission: 'business_service:read',
    writePermission: 'business_service:write',
    select: 'togaf_business_services_select',
    search: 'togaf_business_services_select_search',
    get: 'togaf_business_services_get',
    labelOf: (r) => [r.name, r.fullname].filter(Boolean).join(' — ') || `#${r.id}`,
    brief: (r) => pick(r, ['id', 'name', 'fullname', 'status_name', 'owner_name']),
    form: {
      new: () => '/business-services/new',
      edit: (id) => `/business-services/${id}/edit`,
      view: (id) => `/business-services/${id}/edit`,
    },
    listPath: '/business-services',
    prefillFields: [],
  },
  business_function: {
    label: 'Бизнес-способность',
    plural: 'Бизнес-способности',
    readPermission: 'business_function:read',
    writePermission: 'business_function:write',
    select: 'togaf_business_functions_select',
    search: 'togaf_business_functions_select_search',
    get: 'togaf_business_functions_get',
    labelOf: (r) => r.name || `#${r.id}`,
    brief: (r) => pick(r, ['id', 'name', 'parent_name', 'owner_name']),
    form: {
      new: () => '/business-functions/new',
      edit: (id) => `/business-functions/${id}/edit`,
      view: (id) => `/business-functions/${id}/edit`,
    },
    listPath: '/business-functions',
    prefillFields: [],
  },
  subsystem: {
    label: 'Модуль системы',
    plural: 'Модули систем',
    readPermission: 'system:read',
    writePermission: 'system:write',
    select: 'systems_select',
    search: 'systems_select_search',
    get: 'systems_get',
    labelOf: (r) => [r.code, r.name].filter(Boolean).join(' — ') || `#${r.id}`,
    brief: (r) => pick(r, SYSTEM_BRIEF_FIELDS),
    form: {
      new: () => '/systems/new',
      edit: (id) => `/systems/${id}/edit`,
      view: (id) => `/systems/${id}/edit`,
    },
    listPath: '/systems',
    // Форма системы уже применяет ИИ-черновик (`useAiPrefill` в `SystemForm.vue`) — предзаполнение поддержано.
    prefillFields: ['name', 'fullname', 'description', 'comment', 'technologies', 'external_system'],
  },
  web_resource: {
    label: 'Веб-ресурс',
    plural: 'Реестр веб-ресурсов',
    readPermission: 'web_resource:read',
    writePermission: 'web_resource:write',
    select: 'web_resources_select',
    search: 'web_resources_select_search',
    get: 'web_resources_get',
    labelOf: (r) => [r.code, r.short_name].filter(Boolean).join(' — ') || `#${r.id}`,
    brief: (r) =>
      pick(r, ['id', 'code', 'short_name', 'purpose', 'publication_url', 'status_name', 'category_name', 'system_name', 'domain_name']),
    form: {
      new: () => '/web-resources/new',
      edit: (id) => `/web-resources/${id}/edit`,
      view: (id) => `/web-resources/${id}/edit`,
    },
    listPath: '/web-resources',
    prefillFields: [],
  },
  domain: {
    label: 'Домен',
    plural: 'Реестр доменов',
    readPermission: 'domain:read',
    writePermission: 'domain:write',
    select: 'domains_select',
    search: 'domains_select_search',
    get: 'domains_get',
    labelOf: (r) => r.name || `#${r.id}`,
    brief: (r) => pick(r, ['id', 'name', 'status_name', 'expires_at', 'registrar_name', 'company_name', 'business_owner_name']),
    form: {
      new: () => '/domains/new',
      edit: (id) => `/domains/${id}/edit`,
      view: (id) => `/domains/${id}/edit`,
    },
    listPath: '/domains',
    prefillFields: [],
  },
  certificate: {
    label: 'Сертификат',
    plural: 'Реестр сертификатов',
    readPermission: 'certificate:read',
    writePermission: 'certificate:write',
    select: 'certificates_select',
    search: 'certificates_select_search',
    get: 'certificates_get',
    labelOf: (r) => [r.code, r.domain_name].filter(Boolean).join(' — ') || `#${r.id}`,
    brief: (r) =>
      pick(r, ['id', 'code', 'domain_name', 'ca_name', 'issued_at', 'expires_at', 'wildcard_flag', 'placement_url', 'responsible_name']),
    form: {
      new: () => '/certificates/new',
      edit: (id) => `/certificates/${id}/edit`,
      view: (id) => `/certificates/${id}/edit`,
    },
    listPath: '/certificates',
    prefillFields: [],
  },
  employee: {
    label: 'Сотрудник',
    plural: 'Сотрудники',
    readPermission: 'employee:read',
    writePermission: 'employee:write',
    select: 'employees_select',
    search: 'employees_select_search',
    get: 'employees_get',
    labelOf: (r) => r.full_name || `#${r.id}`,
    brief: (r) => pick(r, ['id', 'full_name', 'employee_number', 'email', 'active', 'status']),
    // Отдельного маршрута формы нет: сотрудники правятся в модалке вкладки «Сотрудники» («Справочники»).
    listPath: '/references',
    prefillFields: [],
  },
  partner: {
    label: 'Партнёр',
    plural: 'Партнёры (вендоры, интеграторы, поддержка)',
    readPermission: 'partner:read',
    writePermission: 'partner:write',
    select: 'partners_select',
    search: 'partners_select_search',
    get: 'partners_get',
    labelOf: (r) => r.name || `#${r.id}`,
    brief: (r) => pick(r, ['id', 'name']),
    // Отдельного маршрута формы нет: партнёры правятся в модалке вкладки «Партнёры» («Справочники»).
    listPath: '/references',
    prefillFields: [],
  },
  system_function: {
    label: 'Функция ИС',
    plural: 'Функции ИС',
    readPermission: 'system_function:read',
    writePermission: 'system_function:write',
    select: 'system_functions_select',
    search: 'system_functions_select_search',
    get: 'system_functions_get_by_id',
    labelOf: (r) => r.name || `#${r.id}`,
    brief: (r) => pick(r, ['id', 'ar_systems_id', 'name', 'description', 'status_name']),
    // Экранного реестра нет (функции правятся внутри формы системы) — только поиск и карточка.
    prefillFields: [],
  },
  /**
   * Каталог инфраструктуры из Netbox (read-only): формы нет, предзаполнение не поддерживается.
   * Связи «ИС → сервер» создаются заданием infrastructure_sync по тегам IS:<код>.
   */
  infrastructure_object: {
    label: 'Сервер инфраструктуры',
    plural: 'Каталог инфраструктуры',
    readPermission: 'infrastructure:read',
    select: 'infrastructure_objects_select',
    search: 'infrastructure_objects_select_search',
    get: 'infrastructure_objects_get',
    labelOf: (r) => r.name || `#${r.id}`,
    brief: (r) =>
      pick(r, [
        'id',
        'name',
        'type_name',
        'system_names',
        'status',
        'site',
        'primary_ip',
        'vcpus',
        'memory_gb',
        'disk_gb',
      ]),
    listPath: '/infrastructure',
    prefillFields: [],
  },
};

const ENTITY_TYPE_CODES = Object.keys(ENTITY_TYPES);

/** Типы сущностей, у которых есть существующая форма UI. */
const FORM_ENTITY_TYPE_CODES = ENTITY_TYPE_CODES.filter((c) => ENTITY_TYPES[c].form);

/**
 * Синонимы кодов типов сущностей: код каталога метамодели (`ar_metamodel_entity_types.code`) → код агента
 * (`ENTITY_TYPES`).
 *
 * Каталог метамодели и реестр агента исторически называют одну и ту же сущность по-разному: ADRA в каталоге —
 * `applied` (таблица `ar_adrs_applied`; этим кодом её пишут связи `ar_metamodel_relations` и тип связи
 * `adr_applied_adr_principle`), а в агенте и во всём приложении (права `adr_applied:*`, маршруты
 * `/decisions/applied`) — `adr_applied`. Код каталога не переименовываем (это данные и отдельная миграция),
 * поэтому сопоставление живёт здесь: иначе `list_entity_types` показывал бы «нет инструментов» (`aiRegistry:false`)
 * у типа, который агент читает, а код, увиденный моделью в том же инструменте, отбрасывался бы как неизвестный
 * в `search_entities`/`get_entity`/`open_view`.
 *
 * НЕ синонимы: `principle` ↔ `adr_principle` — это РАЗНЫЕ реестры (`ar_principles` — принципы TOGAF,
 * `ar_adrs_principle` — прикладные арх. решения); совпадает только часть имени, объединять их нельзя.
 */
const ENTITY_TYPE_ALIASES = {
  applied: 'adr_applied',
};

/**
 * Код типа в реестре агента (`ENTITY_TYPES`) для кода каталога метамодели / аргумента инструмента.
 * Кода нет в карте синонимов — возвращается он же (поведение без изменений).
 */
function agentEntityType(code) {
  const key = String(code == null ? '' : code).trim();
  return ENTITY_TYPE_ALIASES[key] || key;
}

/**
 * Справочники контура инкремента заключения (ADR): типы решений и статусы систем / функций / связей.
 *
 * Те же данные отдают lookup-маршруты формы заключения (`/api/adr-increment-types`, `/api/adr-system-statuses`,
 * `/api/adr-system-function-statuses`, `/api/adr-relation-statuses`), и все они закрыты одним правом
 * `adr_applied:read` (`backend/auth/routePermissions.js`), поэтому у инструмента контура ровно одно право —
 * право чтения заключений.
 *
 * `key` — имя раздела в ответе инструмента; `fields` — белый список колонок для модели; `prefillField` — поле
 * черновика `prefill_form` у `adr_applied` (поле шапки формы или поле внутри структуры `increments`), которое
 * принимает код строки (docs/ai-architect.md §7). Добавили справочник в этот список — он автоматически
 * появится и в описании инструмента, и в ответе.
 */
const ADR_INCREMENT_CATALOGS = [
  {
    key: 'incrementTypes',
    label: 'Типы инкрементов (решений)',
    select: 'adr_increment_types_select',
    fields: ['id', 'name', 'description'],
    prefillField: null,
    note: 'Тип выбирается при создании решения в форме заключения; кода у справочника нет — только id.',
  },
  {
    key: 'systemStatuses',
    label: 'Статусы систем в решении',
    select: 'adr_increment_system_statuses_select',
    fields: ['id', 'code', 'name', 'description'],
    prefillField: 'increment_system_status_code',
    note:
      'Код принимают поле черновика increment_system_status_code (статус по умолчанию для новых систем) и системы ' +
      'структуры черновика (increments[].systems[].increment_system_status_code).',
  },
  {
    key: 'systemFunctionStatuses',
    label: 'Статусы функций систем в решении',
    select: 'adr_increment_system_function_statuses_select',
    fields: ['id', 'code', 'name', 'description'],
    prefillField: 'increment_sysfunc_status_code',
    note: 'Код принимает функция в структуре черновика (increments[].systems[].functions[].increment_sysfunc_status_code).',
  },
  {
    key: 'relationStatuses',
    label: 'Статусы связей в решении',
    select: 'adr_increment_relation_statuses_select',
    fields: ['id', 'code', 'name', 'description'],
    prefillField: 'increment_relation_status_code',
    note:
      'Код принимают поле черновика increment_relation_status_code (статус по умолчанию для новых связей) и связи ' +
      'структуры черновика (increments[].relations[].increment_relation_status_code).',
  },
];

/** Право чтения всего контура инкремента: справочники статусов + структура заключения. */
const ADR_INCREMENT_READ_PERMISSION = 'adr_applied:read';

/**
 * Экраны, которые `open_view` умеет открывать, хотя это не реестры: собственных данных они не отдают —
 * граф «Анализа зависимостей» фронт строит из связей метамодели (`GET /api/togaf/relations`,
 * `frontend-v3/src/api/graphApi.js`). Нужны, чтобы ИИ не отрицал существование этих разделов
 * (docs/ai-architect.md §6.2/§7).
 *
 * `focus: true` — экран принимает фокус графа: `open_view` с `focusEntityType`/`focusIds` собирает ссылку
 * `?entity=<код типа>&ids=<csv id>`, которую читает `frontend-v3/src/views/AnalyticsView.vue`. Наличие
 * фокуса определяется данными (промпт и описание инструмента выводятся отсюда), а не текстом правил.
 */
const SCREEN_TARGETS = {
  analytics: {
    label: 'Анализ зависимостей',
    plural: 'Анализ зависимостей',
    listPath: '/analytics',
    readPermission: 'analytics:read',
    focus: true,
  },
  dashboards: {
    label: 'Дашборды',
    plural: 'Дашборды',
    listPath: '/dashboards',
    readPermission: 'dashboard:read',
  },
  tech_radar: {
    label: 'Технологический радар',
    plural: 'Технологический радар',
    listPath: '/tech-radar',
    readPermission: 'tech_radar:read',
  },
};

const SCREEN_CODES = Object.keys(SCREEN_TARGETS);

/** Типы действия `open_view`: реестры (`ENTITY_TYPES`) + экраны (`SCREEN_TARGETS`). */
const VIEW_TARGET_CODES = [...ENTITY_TYPE_CODES, ...SCREEN_CODES];

/**
 * Разрешение подписи конца связи: код типа сущности метамодели → запрос карточки + право чтения.
 * Рёбра `ar_metamodel_relations` хранят только (тип, id), поэтому без этой карты модель получала бы
 * «id без названия» и начинала выдумывать подписи. Типов нет в карте → `{ entityType, id, label: null }`.
 */
const RELATION_END_META = {
  system: { get: 'systems_get', readPermission: 'system:read' },
  subsystem: { get: 'systems_get', readPermission: 'system:read' },
  technology: { get: 'technologies_get', readPermission: 'technology:read' },
  integration_flow: { get: 'integration_flows_get', readPermission: 'integration_flow:read' },
  actor: { get: 'togaf_actors_get', readPermission: 'actor:read' },
  gap: { get: 'gaps_get', readPermission: 'gap:read' },
  adr_principle: { get: 'adrs_principle_get', readPermission: 'adr_principle:read' },
  adr_applied: { get: 'adrs_applied_get', readPermission: 'adr_applied:read' },
  principle: { get: 'principles_get', readPermission: 'principle:read' },
  web_resource: { get: 'web_resources_get', readPermission: 'web_resource:read' },
  domain: { get: 'domains_get', readPermission: 'domain:read' },
  certificate: { get: 'certificates_get', readPermission: 'certificate:read' },
  employee: { get: 'employees_get', readPermission: 'employee:read' },
  partner: { get: 'partners_get', readPermission: 'partner:read' },
  system_function: { get: 'system_functions_get_by_id', readPermission: 'system_function:read' },
  infrastructure_object: { get: 'infrastructure_objects_get', readPermission: 'infrastructure:read' },
  organization_unit: { get: 'togaf_organization_units_get', readPermission: 'organization_unit:read' },
  business_service: { get: 'togaf_business_services_get', readPermission: 'business_service:read' },
  business_function: { get: 'togaf_business_functions_get', readPermission: 'business_function:read' },
};

const RELATION_END_CODES = Object.keys(RELATION_END_META);

/** Подпись строки-сущности для конца связи: у реестров разные колонки с названием. */
function endLabel(row) {
  if (!row) return null;
  for (const key of ['displayed_name', 'full_name', 'fullname', 'name', 'short_name', 'code']) {
    const v = row[key];
    if (v != null && String(v).trim()) return truncate(String(v), 200);
  }
  return null;
}

/** Подпись ребра: displayed_name → name → имя типа связи из справочника → код типа. */
function relationLabel(row) {
  if (!row) return '';
  const parts = [row.displayed_name, row.name, row.relation_type_name, row.relation_type];
  return parts.map((v) => String(v == null ? '' : v).trim()).find((v) => v) || '';
}

/** Описания инструментов в формате OpenAI function-calling. */
function toolDefinitions() {
  const typeEnum = ENTITY_TYPE_CODES;
  const formEnum = FORM_ENTITY_TYPE_CODES;
  // `open_view` работает и по реестрам, и по экранам (аналитика/дашборды/радар).
  const viewEnum = VIEW_TARGET_CODES;
  const relationEndEnum = RELATION_END_CODES;
  const prefillEnum = FORM_ENTITY_TYPE_CODES.filter((c) => ENTITY_TYPES[c].prefillFields.length);
  // Лимиты черновика — параметры `SYS_AI_PREFILL_MAX_*`: описание инструмента собирается из тех же значений,
  // что и разбор в `runPrefillForm`/`normalizeAppliedIncrementsDraft`.
  const caps = prefillCaps();
  const focusMaxIds = screenFocusMaxIds();
  // Подсказка о разрешённых полях черновика строится из ENTITY_TYPES — не расходится с белым списком.
  const prefillHint = prefillEnum
    .map((c) => `${c} (${ENTITY_TYPES[c].prefillFields.join(', ')})`)
    .join('; ');
  // Структурные поля черновика (`increments`): значение — не строка, а дерево. Схема и подсказка берутся из
  // `prefillStructure` того же каталога, поэтому описание инструмента и разбор в `runPrefillForm` не расходятся.
  const prefillStructureProps = {};
  const prefillStructureHint = prefillEnum
    .filter((c) => ENTITY_TYPES[c].prefillStructure)
    .map((c) => {
      const spec = ENTITY_TYPES[c].prefillStructure;
      prefillStructureProps[spec.field] = typeof spec.schema === 'function' ? spec.schema(caps) : spec.schema;
      const hint = typeof spec.hint === 'function' ? spec.hint(caps) : spec.hint;
      return `${c}.${spec.field} — ${hint}`;
    });
  return [
    {
      type: 'function',
      function: {
        name: 'search_entities',
        description:
          'Поиск по реестрам архитектуры по подстроке (код, название, описание и т.п.). ' +
          'Возвращает id и краткие карточки. Вызывай перед открытием формы, чтобы получить id.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Подстрока для поиска (минимум 2 символа).' },
            types: {
              type: 'array',
              items: { type: 'string', enum: typeEnum },
              description: 'Ограничить типы сущностей; если не указано — поиск по всем доступным реестрам.',
            },
            limit: { type: 'integer', description: 'Максимум результатов на тип (1–20, по умолчанию 5).' },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_entities',
        description: 'Вывести первые записи реестра без поисковой строки. Для обзоров и проверки объёма данных.',
        parameters: {
          type: 'object',
          properties: {
            entityType: { type: 'string', enum: typeEnum, description: 'Тип сущности.' },
            limit: { type: 'integer', description: 'Сколько записей вернуть (1–50, по умолчанию 10).' },
          },
          required: ['entityType'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_entity',
        description:
          'Получить карточку сущности по числовому id (используй id из search_entities). ' +
          'Для adr_applied дополнительно отдаёт контур инкремента (incrementContour): решения → системы и связи ' +
          'со статусами их справочников. Для деталей статусов есть list_adr_increment_statuses.',
        parameters: {
          type: 'object',
          properties: {
            entityType: { type: 'string', enum: typeEnum, description: 'Тип сущности.' },
            id: { type: 'integer', description: 'Числовой идентификатор записи.' },
          },
          required: ['entityType', 'id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_home_stats',
        description: 'KPI и объём каталога с главной страницы (число систем, технологий, разрывов и т.п.).',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'open_view',
        description:
          'Открыть реестр (список) или экран (analytics — «Анализ зависимостей», dashboards, tech_radar) в UI, ' +
          'при необходимости — с фильтром поиска. Ничего не изменяет. Используй, когда пользователь просит ' +
          '«показать/открыть реестр/раздел», а когда спрашивает про зависимости конкретной сущности — сначала ' +
          'ответь по get_relations, затем открой экран analytics с фокусом (focusEntityType + focusIds): ' +
          'граф построится сразу вокруг этих объектов.',
        parameters: {
          type: 'object',
          properties: {
            entityType: {
              type: 'string',
              enum: viewEnum,
              description: 'Тип сущности (её реестр) или код экрана: analytics, dashboards, tech_radar.',
            },
            search: {
              type: 'string',
              description:
                'Строка фильтра списка (≥ 2 символов); необязательна — без неё откроется полный реестр. ' +
                'У экранов (analytics/dashboards/tech_radar) фильтр не поддерживается и игнорируется.',
            },
            focusEntityType: {
              type: 'string',
              enum: typeEnum,
              description:
                'Только для экрана analytics: тип сущности, вокруг которой построить граф зависимостей ' +
                '(обычно system). Экран откроется с выбранным типом и готовым графом по связям метамодели. ' +
                'У реестров и остальных экранов параметр игнорируется.',
            },
            focusIds: {
              type: 'array',
              items: { type: 'integer' },
              maxItems: focusMaxIds,
              description:
                `Только для экрана analytics: id объектов фокуса (получи их через search_entities) — до ${focusMaxIds}. ` +
                'Те же рёбра в чате показывает get_relations, поэтому числа зависимостей приводи из его ответа.',
            },
          },
          required: ['entityType'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'open_form',
        // Перечень реестров с формой строится из ENTITY_TYPES.form — при добавлении сущности описание не устаревает.
        description:
          `Открыть существующую форму UI (реестры с формой: ${formEnum.join(', ')}). Для view/edit обязателен id. ` +
          'Действие выполняется только после подтверждения пользователя.',
        parameters: {
          type: 'object',
          properties: {
            entityType: { type: 'string', enum: formEnum, description: 'Тип сущности, у которой есть форма в UI.' },
            id: { type: 'integer', description: 'Идентификатор записи (не нужен для режима new).' },
            mode: {
              type: 'string',
              enum: ['view', 'edit', 'new'],
              description: 'view — просмотр, edit — редактирование, new — создание новой записи.',
            },
          },
          required: ['entityType', 'mode'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'prefill_form',
        description:
          'Открыть форму с предзаполненными полями (черновик). Данные не сохраняются — пользователь проверяет и сохраняет сам. ' +
          'Черновик заключения открывается в статусе «Черновик» (в другом статусе структуру не сохранить) и может ' +
          `содержать весь состав заключения. Разрешённые поля по типам: ${prefillHint}.` +
          (prefillStructureHint.length ? ` Структурные поля черновика: ${prefillStructureHint.join('; ')}.` : ''),
        parameters: {
          type: 'object',
          properties: {
            entityType: { type: 'string', enum: prefillEnum, description: 'Тип сущности, форма которой поддерживает черновик.' },
            id: { type: 'integer', description: 'Идентификатор записи для режима edit (не нужен для new).' },
            mode: { type: 'string', enum: ['new', 'edit'], description: 'Режим формы, по умолчанию new.' },
            fields: {
              type: 'object',
              description: 'Значения полей формы (только разрешённые для этого типа).',
              additionalProperties: { type: 'string' },
              // Структурные поля (`increments`) описываются явно: на ключи из `properties` правило
              // `additionalProperties: string` не распространяется, поэтому дерево принимается по своей схеме.
              ...(prefillStructureHint.length ? { properties: prefillStructureProps } : {}),
            },
          },
          required: ['entityType', 'fields'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_relations',
        description:
          'Связи и зависимости сущности по её типу и id: что зависит от неё (direction=to), от чего зависит она (from) ' +
          'или обе стороны (both, по умолчанию). Возвращает рёбра метамодели с подписями концов (id без подписи — ' +
          'нет права на реестр этого типа). Используй для «анализа зависимостей», «от чего зависит», «кто зависит», ' +
          '«с чем интегрировано», «влияние системы» вместо догадок.',
        parameters: {
          type: 'object',
          properties: {
            entityType: { type: 'string', enum: relationEndEnum, description: 'Код типа сущности метамодели.' },
            id: { type: 'integer', description: 'Числовой id сущности (получите через search_entities или get_entity).' },
            direction: {
              type: 'string',
              enum: ['from', 'to', 'both'],
              description: 'from — исходящие связи, to — входящие, both — все (по умолчанию).',
            },
            relationType: {
              type: 'string',
              description: 'Код типа связи для фильтра (см. list_relation_types), например integration_flow, system_technology.',
            },
            limit: { type: 'integer', description: 'Сколько связей вернуть (1–20, по умолчанию 10).' },
          },
          required: ['entityType', 'id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'search_relations',
        description:
          'Поиск связей метамодели по строке (тип связи, подпись, описание). Подписи концов уточняй через get_relations ' +
          'по конкретной сущности — у связей хранятся только (тип, id) концов.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Строка поиска (не менее 2 символов).' },
            limit: { type: 'integer', description: 'Сколько связей вернуть (1–10, по умолчанию 5).' },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'rank_relations',
        description:
          'Рейтинг сущностей по количеству связей — топ «где больше всего» (сервер с наибольшим числом систем, ' +
          'система с максимумом функций и т.п.). ОДИН вызов вместо перебора сущностей через get_relations. ' +
          'groupBy — по какому концу связи считать (to — входящие, from — исходящие), entityType — тип считаемой ' +
          'сущности, relationTypes — коды типов связей для фильтра (см. list_relation_types); возвращает count, ' +
          'totalGroups и totalRelations.',
        parameters: {
          type: 'object',
          properties: {
            groupBy: {
              type: 'string',
              enum: ['to', 'from'],
              description: 'to — входящие связи (по умолчанию), from — исходящие.',
            },
            entityType: {
              type: 'string',
              enum: relationEndEnum,
              description: 'Код типа сущности, по которой строится рейтинг (например infrastructure_object).',
            },
            relationTypes: {
              type: 'array',
              items: { type: 'string' },
              description:
                'Коды типов связей для фильтра (см. list_relation_types), например ' +
                '[system_infrastructure, subsystem_infrastructure]. Без фильтра считаются все типы.',
            },
            limit: { type: 'integer', description: 'Сколько строк рейтинга вернуть (1–20, по умолчанию 10).' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_relation_types',
        description:
          'Справочник типов связей метамодели: код, название, описание, допустимые типы концов. Используй, чтобы ' +
          'использовать корректные коды связей (например integration_flow, system_technology), а не придумывать их.',
        parameters: {
          type: 'object',
          properties: {
            search: { type: 'string', description: 'Необязательный фильтр по коду, названию, описанию и типам концов.' },
            limit: { type: 'integer', description: 'Сколько типов вернуть (1–50, по умолчанию 25).' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_entity_types',
        description:
          'Справочник типов сущностей метамодели с признаком, доступен ли тип тебе как реестр (search_entities/open_view). ' +
          'Используй, чтобы не выдумывать типы сущностей и понимать, из чего состоит модель.',
        parameters: {
          type: 'object',
          properties: {
            limit: { type: 'integer', description: 'Сколько типов вернуть (1–50, по умолчанию 30).' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_adr_increment_statuses',
        description:
          'Справочники контура инкремента заключения: типы инкрементов (решений) и статусы систем, функций и связей ' +
          'в решении (коды ADR_INCR_SYS_*, ADR_INCR_SYSFUNC_*, ADR_INCR_REL_*). Используй, чтобы не выдумывать коды: ' +
          'коды статусов отсюда принимает prefill_form для adr_applied (increment_system_status_code, ' +
          'increment_relation_status_code), а состав заключения отдаёт get_entity с entityType=adr_applied. ' +
          'Статусы реестров при утверждении заключения берутся из параметров ADR_SYSTEM_STATUS_MAP, ' +
          'ADR_SYSFUNC_STATUS_MAP и ADR_FLOW_STATUS_MAP: новый или переименованный код статуса нужно внести ' +
          'в них («Настройки → Параметры»), иначе статус реестра не изменится.',
        parameters: {
          type: 'object',
          properties: {
            search: { type: 'string', description: 'Необязательный фильтр по коду, названию и описанию.' },
            limit: { type: 'integer', description: 'Сколько записей вернуть в каждом справочнике (1–50, по умолчанию 25).' },
          },
        },
      },
    },
  ];
}

/** Полный срез строки с ограничением длины строковых значений. */
function fullRow(row, maxLen = 2000) {
  const out = {};
  if (!row) return out;
  for (const [k, v] of Object.entries(row)) {
    if (v == null) continue;
    out[k] = typeof v === 'string' ? truncate(v, maxLen) : v;
  }
  return out;
}

/**
 * Раннер инструментов для конкретного пользователя: права проверяются на каждый вызов.
 * @param {{ pool: object, queries: object, permissions: string[] }} ctx
 */
function createToolRunner({ pool, queries, permissions }) {
  const permSet = new Set(permissions || []);
  const wildcard = permSet.has('*');

  function can(permission) {
    if (!permission) return true;
    if (wildcard) return true;
    return permSet.has(permission);
  }

  function splitTypes(requested) {
    const list = Array.isArray(requested) && requested.length ? requested.map(String) : ENTITY_TYPE_CODES;
    // Код каталога метамодели (`applied`) приводим к коду агента (`adr_applied`) ДО проверки: модель видит коды
    // каталога в `list_entity_types`, и они не должны попадать в «неизвестные». Дубли схлопываем.
    const known = [...new Set(list.map(agentEntityType).filter((t) => ENTITY_TYPES[t]))];
    return {
      allowed: known.filter((t) => can(ENTITY_TYPES[t].readPermission)),
      denied: known.filter((t) => !can(ENTITY_TYPES[t].readPermission)),
      unknown: list.filter((t) => !ENTITY_TYPES[agentEntityType(t)]),
    };
  }

  async function readRows(sqlKey, params) {
    const sql = queries[sqlKey];
    if (!sql) throw new Error(`SQL «${sqlKey}» недоступен`);
    const res = await pool.query(sql, params);
    return res.rows || [];
  }

  function describeRow(type, row) {
    return { entityType: type, id: row.id, label: ENTITY_TYPES[type].labelOf(row), ...ENTITY_TYPES[type].brief(row) };
  }

  /** Кэш подписей концов связей в рамках одного запуска (повторные пары (тип, id) не перезапрашиваются). */
  const labelCache = new Map();

  /**
   * Подпись сущности по (тип, id) для концов связи. `null` — типа нет в карте подписей
   * (`RELATION_END_META`) или у пользователя нет права чтения этого реестра: тогда возвращаем только id,
   * без домыслов — модель не должна придумывать названия.
   */
  async function resolveEntityLabel(entityType, id) {
    const meta = RELATION_END_META[entityType];
    if (!meta || !Number.isFinite(id)) return null;
    if (!can(meta.readPermission)) return null;
    const key = `${entityType}:${id}`;
    if (labelCache.has(key)) return labelCache.get(key);
    let label = null;
    try {
      const rows = await readRows(meta.get, [id]);
      label = rows.length ? endLabel(rows[0]) : null;
    } catch (e) {
      label = null;
    }
    labelCache.set(key, label);
    return label;
  }

  /** Ребро метамодели → компактный объект с подписями концов (`payload` модели не нужен). */
  async function describeRelation(row) {
    const fromType = String(row.from_entity_type || '');
    const toType = String(row.to_entity_type || '');
    const fromId = Number.parseInt(row.from_entity_id, 10);
    const toId = Number.parseInt(row.to_entity_id, 10);
    return {
      id: row.id,
      relationType: row.relation_type || null,
      relationTypeName: row.relation_type_name || null,
      title: relationLabel(row) || null,
      from: {
        entityType: fromType,
        id: Number.isFinite(fromId) ? fromId : row.from_entity_id,
        label: await resolveEntityLabel(fromType, fromId),
      },
      to: {
        entityType: toType,
        id: Number.isFinite(toId) ? toId : row.to_entity_id,
        label: await resolveEntityLabel(toType, toId),
      },
      ...(row.reference_to_baserow != null ? { sourceId: row.reference_to_baserow } : {}),
    };
  }

  async function runSearch(args) {
    const query = String(args.query == null ? '' : args.query).trim();
    if (query.length < 2) return { ok: false, error: 'Укажите строку поиска длиной не менее 2 символов (args.query).' };
    const limit = clampInt(args.limit, 1, 20, 5);
    const { allowed, denied, unknown } = splitTypes(args.types);
    if (!allowed.length) {
      return {
        ok: false,
        error: `Нет доступа к запрошенным реестрам${denied.length ? `: ${denied.join(', ')}` : ''}.`,
      };
    }
    const results = [];
    for (const type of allowed) {
      const rows = await readRows(ENTITY_TYPES[type].search || ENTITY_TYPES[type].select, [`%${query}%`]);
      results.push({
        entityType: type,
        entityLabel: ENTITY_TYPES[type].plural,
        total: rows.length,
        items: rows.slice(0, limit).map((r) => describeRow(type, r)),
      });
    }
    return {
      ok: true,
      result: {
        query,
        results,
        ...(denied.length ? { deniedTypes: denied } : {}),
        ...(unknown.length ? { unknownTypes: unknown } : {}),
        hint: 'Для открытия формы используйте id из items и инструмент open_form (или prefill_form); показать реестр — open_view.',
      },
    };
  }

  async function runList(args) {
    const type = agentEntityType(args.entityType);
    const meta = ENTITY_TYPES[type];
    if (!meta) return { ok: false, error: `Неизвестный тип сущности «${type}». Доступно: ${ENTITY_TYPE_CODES.join(', ')}.` };
    if (!can(meta.readPermission)) return { ok: false, error: `Нет доступа к реестру «${meta.plural}» (${meta.readPermission}).` };
    const limit = clampInt(args.limit, 1, 50, 10);
    const rows = await readRows(meta.select, []);
    return {
      ok: true,
      result: { entityType: type, entityLabel: meta.plural, total: rows.length, items: rows.slice(0, limit).map((r) => describeRow(type, r)) },
    };
  }

  async function runGet(args) {
    const type = agentEntityType(args.entityType);
    const meta = ENTITY_TYPES[type];
    if (!meta) return { ok: false, error: `Неизвестный тип сущности «${type}». Доступно: ${ENTITY_TYPE_CODES.join(', ')}.` };
    if (!can(meta.readPermission)) return { ok: false, error: `Нет доступа к реестру «${meta.plural}» (${meta.readPermission}).` };
    const id = Number.parseInt(args.id, 10);
    if (!Number.isFinite(id)) return { ok: false, error: 'Укажите числовой id (args.id).' };
    const rows = await readRows(meta.get, [id]);
    if (!rows.length) return { ok: false, error: `Запись ${type} #${id} не найдена.` };
    const row = rows[0];
    // Карточка заключения не содержит контура инкремента (решения → системы/связи и их статусы), а он нужен,
    // чтобы модель не выдумывала статусы ADR_INCR_* и не отрицала их существование. Право `adr_applied:read`
    // уже проверено выше — те же данные отдают lookup-маршруты формы заключения.
    let incrementContour = null;
    let incrementContourError = null;
    if (type === 'adr_applied') {
      try {
        incrementContour = await describeAppliedContour(id);
      } catch (e) {
        // Безопасная деградация: карточка заключения остаётся полезной и без контура, а модель получает причину.
        incrementContourError = e.message;
      }
    }
    return {
      ok: true,
      result: {
        entityType: type,
        id,
        label: meta.labelOf(row),
        data: fullRow(row),
        ...(incrementContour ? { incrementContour } : {}),
        ...(incrementContourError ? { incrementContourError } : {}),
      },
    };
  }

  /**
   * Контур инкремента заключения: решения → системы и связи со статусами их справочников.
   *
   * Форма заключения живёт на этом контуре (issue #74, `POST/PUT /api/decisions/applied/full`), но в карточке
   * ADR его не видно, поэтому без контура модель не знала, какие системы и связи уже есть в решении и в каком
   * они статусе. Запросы — только из белого списка `queries.js`, новых SQL не требуется.
   */
  async function describeAppliedContour(appliedId) {
    const increments = [];
    const rows = await readRows('adr_increments_by_applied', [appliedId]);
    for (const inc of rows) {
      const [systems, relations] = await Promise.all([
        readRows('adr_increment_systems_by_increment', [inc.id]),
        readRows('adr_increment_relations_by_increment', [inc.id]),
      ]);
      increments.push({
        id: inc.id,
        orderIndex: inc.order_index == null ? null : inc.order_index,
        name: inc.name || null,
        typeId: inc.ar_adr_increment_types_id || null,
        typeName: inc.type_name || null,
        systems: systems.map((s) =>
          pick(
            { ...s, increment_system_status_code: s.status_code },
            ['id', 'ar_systems_id', 'system_code', 'system_name', 'status_name', 'increment_system_status_code', 'comment'],
          ),
        ),
        relations: relations.map((r) =>
          pick(r, [
            'id',
            'from_code',
            'from_name',
            'to_code',
            'to_name',
            'status_name',
            'increment_relation_status_code',
            'ar_integration_flows_id',
            'flow_status_name',
            'transferred_data',
            'transfer_method',
            'periodicity',
          ]),
        ),
      });
    }
    return {
      hint:
        'typeId — id из справочника типов инкрементов (list_adr_increment_statuses, раздел incrementTypes). ' +
        'Статусы систем и связей — коды тех же справочников; для черновика формы используй поля ' +
        'increment_system_status_code и increment_relation_status_code.',
      total: increments.length,
      increments,
    };
  }

  async function runHomeStats() {
    if (!can('dashboard:read')) return { ok: false, error: 'Нет доступа к KPI главной страницы (dashboard:read).' };
    const data = (await buildHomeStats(pool)) || {};
    return {
      ok: true,
      result: {
        kpiTiles: Array.isArray(data.kpiTiles)
          ? data.kpiTiles.map((t) => pick({ title: t.title, value: t.value, footer: t.footer }, ['title', 'value', 'footer']))
          : [],
        accordion: Array.isArray(data.accordion)
          ? data.accordion.slice(0, 20).map((a) => pick(a, ['title', 'value', 'count', 'label'], 200))
          : [],
      },
    };
  }
  /**
   * `get_relations` — связи конкретной сущности (направление + подписи концов).
   * Источник «анализа зависимостей»: те же рёбра, из которых фронт строит граф `/analytics`.
   */
  async function runGetRelations(args) {
    if (!can('metamodel_relation:read')) {
      return { ok: false, error: 'Нет доступа к связям объектов управления (metamodel_relation:read).' };
    }
    const entityType = String(args.entityType || '');
    if (!RELATION_END_META[entityType]) {
      return { ok: false, error: `Неизвестный тип сущности «${entityType}». Допустимые: ${RELATION_END_CODES.join(', ')}.` };
    }
    const id = Number.parseInt(args.id, 10);
    if (!Number.isFinite(id)) return { ok: false, error: 'Укажите числовой id сущности (args.id).' };
    const direction = ['from', 'to', 'both'].includes(String(args.direction)) ? String(args.direction) : 'both';
    const relationType = String(args.relationType == null ? '' : args.relationType).trim().toLowerCase();
    const limit = clampInt(args.limit, 1, 20, 10);

    const collected = [];
    for (const dir of direction === 'both' ? ['from', 'to'] : [direction]) {
      const sqlKey = dir === 'from' ? 'metamodel_relations_by_from' : 'metamodel_relations_by_to';
      const rows = await readRows(sqlKey, [entityType, id]);
      for (const row of rows) collected.push({ dir, row });
    }
    const filtered = relationType
      ? collected.filter((x) => String(x.row.relation_type || '').toLowerCase() === relationType)
      : collected;

    const items = [];
    for (const entry of filtered.slice(0, limit)) {
      items.push({ direction: entry.dir, ...(await describeRelation(entry.row)) });
    }
    const entityLabel = await resolveEntityLabel(entityType, id);
    return {
      ok: true,
      result: {
        entity: { entityType, id, label: entityLabel },
        direction,
        relationType: relationType || null,
        total: filtered.length,
        shown: items.length,
        items,
        ...(filtered.length > items.length ? { truncated: true } : {}),
        ...(items.length
          ? {}
          : {
              hint:
                'Связей по этим условиям нет. Проверьте направление (direction), код связи через list_relation_types ' +
                'или наличие записи в реестре «Связи объектов управления» (/metamodel-relations).',
            }),
      },
    };
  }

  /** `search_relations` — поиск рёбер метамодели по строке (тип связи, подпись, описание). */
  async function runSearchRelations(args) {
    if (!can('metamodel_relation:read')) {
      return { ok: false, error: 'Нет доступа к связям объектов управления (metamodel_relation:read).' };
    }
    const query = String(args.query == null ? '' : args.query).trim();
    if (query.length < 2) return { ok: false, error: 'Укажите строку поиска длиной не менее 2 символов (args.query).' };
    const limit = clampInt(args.limit, 1, 10, 5);
    const rows = await readRows('metamodel_relations_select_search', [`%${query}%`]);
    const items = [];
    for (const row of rows.slice(0, limit)) items.push(await describeRelation(row));
    return {
      ok: true,
      result: {
        query,
        total: rows.length,
        shown: items.length,
        items,
        ...(rows.length > items.length ? { truncated: true } : {}),
        hint:
          'Связь хранит только пару (тип, id) концов: label = null означает, что тип не входит в доступные тебе ' +
          'реестры — используй get_relations по конкретной сущности.',
      },
    };
  }

  /**
   * `rank_relations` — рейтинг сущностей по числу связей (docs/ai-architect.md §6.2).
   *
   * Закрывает вопрос «где больше всего»: без него модель перебирает сущности через `get_relations`
   * (десятки вызовов) и упирается в лимит шагов, как это было на вопросе «сервер с наибольшим числом систем».
   * Агрегат считается в SQL (`metamodel_relations_rank_to` / `_from`), подписи — теми же карточками реестров,
   * что и у `get_relations` (`RELATION_END_META`), поэтому модель не видит данных, которых нет у пользователя.
   */
  async function runRankRelations(args) {
    if (!can('metamodel_relation:read')) {
      return { ok: false, error: 'Нет доступа к связям метамодели (metamodel_relation:read).' };
    }
    // `groupBy` только выбирает готовый запрос из белого списка (SQL из аргументов не собирается).
    const side = String(args.groupBy == null ? 'to' : args.groupBy).trim().toLowerCase() === 'from' ? 'from' : 'to';
    const limit = clampInt(args.limit, 1, 20, 10);
    const entityType = String(args.entityType == null ? '' : args.entityType).trim() || null;
    // Принимаем и массив `relationTypes`, и одиночный `relationType`: модели присылают оба варианта.
    const rawTypes = Array.isArray(args.relationTypes)
      ? args.relationTypes
      : args.relationTypes != null
        ? [args.relationTypes]
        : Array.isArray(args.relationType)
          ? args.relationType
          : args.relationType != null
            ? [args.relationType]
            : [];
    const relationTypes = [...new Set(rawTypes.map((t) => String(t == null ? '' : t).trim()).filter(Boolean))];
    const rows = await readRows(side === 'from' ? 'metamodel_relations_rank_from' : 'metamodel_relations_rank_to', [
      entityType,
      relationTypes.length ? relationTypes : null,
      limit,
    ]);
    const items = [];
    // SQL уже ограничивает выборку (`LIMIT $3`); slice — страховка контракта «не больше limit строк»,
    // чтобы ответ не зависел от того, применил ли драйвер/заглушка LIMIT.
    for (const row of rows.slice(0, limit)) {
      const id = Number.parseInt(row.entity_id, 10);
      items.push({
        entityType: row.entity_type,
        id: Number.isFinite(id) ? id : row.entity_id,
        label: await resolveEntityLabel(row.entity_type, id),
        count: Number(row.cnt) || 0,
      });
    }
    const totalGroups = rows.length ? Number(rows[0].total_groups) || 0 : 0;
    const totalRelations = rows.length ? Number(rows[0].total_relations) || 0 : 0;
    return {
      ok: true,
      result: {
        groupBy: side,
        ...(entityType ? { entityType } : {}),
        ...(relationTypes.length ? { relationTypes } : {}),
        totalGroups,
        totalRelations,
        shown: items.length,
        items,
        ...(totalGroups > items.length ? { truncated: true } : {}),
        hint:
          'count — сколько связей у сущности, рейтинг отсортирован по убыванию; label = null — нет права чтения ' +
          'реестра этого типа (id остаётся).' +
          (totalRelations
            ? ''
            : ' Связей не найдено: проверьте коды типов связей (list_relation_types) и типы сущностей (list_entity_types).'),
      },
    };
  }

  /** `list_relation_types` — справочник типов связей: коды для фильтра `relationType`. */
  async function runListRelationTypes(args) {
    if (!can('metamodel_catalog:read')) {
      return { ok: false, error: 'Нет доступа к справочнику типов связей метамодели (metamodel_catalog:read).' };
    }
    const search = String(args.search == null ? '' : args.search).trim().toLowerCase();
    const limit = clampInt(args.limit, 1, 50, 25);
    const rows = await readRows('metamodel_relation_types_select', []);
    const filtered = search
      ? rows.filter((r) =>
          [r.code, r.name, r.description, r.from_entity_type_code, r.to_entity_type_code]
            .map((v) => String(v == null ? '' : v).toLowerCase())
            .some((v) => v.includes(search)),
        )
      : rows;
    return {
      ok: true,
      result: {
        total: filtered.length,
        shown: Math.min(filtered.length, limit),
        items: filtered.slice(0, limit).map((r) =>
          pick(
            r,
            ['code', 'name', 'description', 'from_entity_type_code', 'from_entity_type_name', 'to_entity_type_code', 'to_entity_type_name'],
            200,
          ),
        ),
        ...(filtered.length > limit ? { truncated: true } : {}),
      },
    };
  }

  /** `list_entity_types` — справочник типов сущностей метамодели + признак доступности как реестра. */
  async function runListEntityTypes(args) {
    if (!can('metamodel_catalog:read')) {
      return { ok: false, error: 'Нет доступа к справочнику типов сущностей метамодели (metamodel_catalog:read).' };
    }
    const limit = clampInt(args.limit, 1, 50, 30);
    const rows = await readRows('metamodel_entity_types_select', []);
    return {
      ok: true,
      result: {
        total: rows.length,
        shown: Math.min(rows.length, limit),
        items: rows.slice(0, limit).map((r) => {
          // Код каталога → код агента (синонимы, `ENTITY_TYPE_ALIASES`): у ADRA это `applied` → `adr_applied`,
          // иначе флаг `aiRegistry` врал бы для типа, который агент читает.
          const meta = ENTITY_TYPES[agentEntityType(r.code)];
          return {
            code: r.code,
            name: r.name || null,
            tableName: r.table_name || null,
            description: r.description ? truncate(r.description, 200) : null,
            aiRegistry: Boolean(meta),
            aiAccess: meta ? can(meta.readPermission) : false,
          };
        }),
        ...(rows.length > limit ? { truncated: true } : {}),
      },
    };
  }

  /**
   * `list_adr_increment_statuses` — справочники контура инкремента: типы решений и статусы систем, функций и связей.
   * Источник кодов для черновика `prefill_form` у `adr_applied`: полей шапки (`increment_system_status_code`,
   * `increment_relation_status_code`) и статусов внутри структуры (`increments[].systems[]...`) — модель не должна
   * выдумывать коды статусов и id типов решений.
   */
  async function runListAdrIncrementStatuses(args) {
    if (!can(ADR_INCREMENT_READ_PERMISSION)) {
      return { ok: false, error: `Нет доступа к контуру инкремента заключений (${ADR_INCREMENT_READ_PERMISSION}).` };
    }
    const search = String(args.search == null ? '' : args.search).trim().toLowerCase();
    const limit = clampInt(args.limit, 1, 50, 25);
    const catalogs = {};
    const summary = [];
    for (const cat of ADR_INCREMENT_CATALOGS) {
      const rows = await readRows(cat.select, []);
      // Фильтр — по белому списку колонок справочника (тем же, что увидит модель): иначе фильтр работал бы
      // по данным, которых в ответе нет.
      const filtered = search
        ? rows.filter((r) =>
            cat.fields
              .map((f) => String(r[f] == null ? '' : r[f]).toLowerCase())
              .some((v) => v.includes(search)),
          )
        : rows;
      catalogs[cat.key] = {
        label: cat.label,
        total: filtered.length,
        shown: Math.min(filtered.length, limit),
        items: filtered.slice(0, limit).map((r) => pick(r, cat.fields, 300)),
        ...(cat.prefillField ? { prefillField: cat.prefillField } : {}),
        note: cat.note,
        ...(filtered.length > limit ? { truncated: true } : {}),
      };
      summary.push(`${cat.label}: ${filtered.length}`);
    }
    return {
      ok: true,
      result: {
        search: search || null,
        catalogs,
        summary: summary.join('; '),
        hint: search
          ? 'Фильтр применён к коду, названию и описанию каждого справочника.'
          : 'Коды для черновика заключения бери отсюда: incrementTypes — типы решений (поле ar_adr_increment_types_id ' +
            'в increments), systemStatuses — статусы систем (increment_system_status_code), systemFunctionStatuses — ' +
            'статусы функций (increment_sysfunc_status_code), relationStatuses — статусы связей ' +
            '(increment_relation_status_code). Готовый состав заключения (решения → системы и связи со статусами) ' +
            'отдаёт get_entity с entityType=adr_applied.',
      },
    };
  }

  async function run(name, args) {
    const a = args && typeof args === 'object' && !Array.isArray(args) ? args : {};
    try {
      switch (name) {
        case 'search_entities':
          return await runSearch(a);
        case 'list_entities':
          return await runList(a);
        case 'get_entity':
          return await runGet(a);
        case 'get_home_stats':
          return await runHomeStats();
        case 'get_relations':
          return await runGetRelations(a);
        case 'search_relations':
          return await runSearchRelations(a);
        case 'rank_relations':
          return await runRankRelations(a);
        case 'list_relation_types':
          return await runListRelationTypes(a);
        case 'list_entity_types':
          return await runListEntityTypes(a);
        case 'list_adr_increment_statuses':
          return await runListAdrIncrementStatuses(a);
        case 'open_form':
          return await runOpenForm(a);
        case 'open_view':
          return await runOpenView(a);
        case 'prefill_form':
          return await runPrefillForm(a);
        default:
          return { ok: false, error: `Инструмент «${name}» недоступен.` };
      }
    } catch (e) {
      return { ok: false, error: `Ошибка выполнения «${name}»: ${e.message}` };
    }
  }

  return {
    definitions: toolDefinitions(),
    run,
    can,
    entityTypes: ENTITY_TYPES,
    allowedTypes: () => ENTITY_TYPE_CODES.filter((t) => can(ENTITY_TYPES[t].readPermission)),
  };

  async function runPrefillForm(args) {
    const type = agentEntityType(args.entityType);
    const meta = ENTITY_TYPES[type];
    if (!meta) {
      return { ok: false, error: `Неизвестный тип сущности «${type}». Формы доступны для: ${FORM_ENTITY_TYPE_CODES.join(', ')}.` };
    }
    if (!meta.form || !meta.prefillFields.length) {
      return { ok: false, error: `Для реестра «${meta.plural}» предзаполнение формы не поддерживается.` };
    }
    if (!can(meta.writePermission)) {
      return { ok: false, error: `Нет права на изменение «${meta.plural}» (${meta.writePermission}).` };
    }
    const mode = String(args.mode || 'new') === 'edit' ? 'edit' : 'new';
    const rawFields = args.fields && typeof args.fields === 'object' && !Array.isArray(args.fields) ? args.fields : {};
    const structureField = meta.prefillStructure ? meta.prefillStructure.field : null;
    // Заключение из ИИ всегда открывается в статусе «Черновик»: только в этом статусе форма разрешает править
    // решения/системы/связи, а согласованное заключение ИИ предлагать не должен (код — как в `backend/index.js`).
    const draftStatusCode = String(
      getParam('ADR_DRAFT_STATUS_CODE', DEFAULT_ADR_DRAFT_STATUS_CODE) || DEFAULT_ADR_DRAFT_STATUS_CODE,
    ).trim();
    // Лимиты черновика — параметры `SYS_AI_PREFILL_MAX_*` (используются ИИ-архитектором при генерации ADR);
    // те же значения, что и в описании инструмента `prefill_form`.
    const caps = prefillCaps();
    const draft = {};
    const ignored = [];
    const warnings = [];
    let rawStructure = null;
    for (const [key, value] of Object.entries(rawFields)) {
      if (!meta.prefillFields.includes(key)) {
        ignored.push(key);
        continue;
      }
      // Структурное поле (`increments`) — не строка: его разбирает `normalizeAppliedIncrementsDraft` ниже
      // (сверка со справочниками, лимиты, бюджет размера).
      if (key === structureField) {
        rawStructure = value;
        continue;
      }
      const val = truncate(String(value == null ? '' : value), 4000).trim();
      if (val) draft[key] = val;
    }
    if (!Object.keys(draft).length && rawStructure == null) {
      return { ok: false, error: `Нет допустимых полей для предзаполнения. Разрешены: ${meta.prefillFields.join(', ')}.` };
    }
    let entityId = null;
    if (mode === 'edit') {
      const id = Number.parseInt(args.id, 10);
      if (!Number.isFinite(id)) return { ok: false, error: 'Для режима edit нужен id изменяемой записи.' };
      const rows = await readRows(meta.get, [id]);
      if (!rows.length) return { ok: false, error: `Запись ${type} #${id} не найдена — форма не открыта.` };
      entityId = id;
      // Состав заключения сервер сохраняет только у черновика (`PUT /full`: в другом статусе пишется одна шапка),
      // поэтому чужой статус — не повод открыть форму с составом, которого в БД не окажется.
      if (rawStructure != null && String(rows[0].status_code || '').trim() !== draftStatusCode) {
        warnings.push(
          `Состав заключения не добавлен: запись не в статусе «Черновик» (${rows[0].status_code || 'статус не задан'}) — ` +
            'сервер сохранит только шапку.',
        );
        rawStructure = null;
      }
    }
    // Структуру проверяем по справочникам контура (те же lookup-маршруты, что у `list_adr_increment_statuses`):
    // id типов решений и коды статусов берутся из поставки, а не из ответа модели.
    if (rawStructure != null) {
      const catalogs = { incrementTypes: [], systemStatuses: [], systemFunctionStatuses: [], relationStatuses: [] };
      if (can(ADR_INCREMENT_READ_PERMISSION)) {
        for (const cat of ADR_INCREMENT_CATALOGS) catalogs[cat.key] = await readRows(cat.select, []);
      } else {
        warnings.push(
          `Справочники контура недоступны (${ADR_INCREMENT_READ_PERMISSION}): состав предложен без типов решений и статусов.`,
        );
      }
      const increments = normalizeAppliedIncrementsDraft(rawStructure, catalogs, warnings, caps);
      if (increments.length) draft.increments = increments;
    }
    // Статус черновика задаёт сервер (модель его не выбирает): в другом статусе структура не сохранится.
    draft.status_code = draftStatusCode;
    const basePath = mode === 'new' ? meta.form.new() : meta.form.edit(entityId);
    // Контракт `?payload=` — как в DecisionAppliedForm.vue: base64 от percent-encoded JSON
    // (`btoa(encodeURIComponent(JSON.stringify({ form: draft })))`). Порядок обязателен:
    // формы читают значение как `JSON.parse(decodeURIComponent(atob(payload)))`, поэтому
    // base64 обязан содержать `%XX`, а не сами байты UTF-8.
    const payload = Buffer.from(encodeURIComponent(JSON.stringify({ form: draft })), 'utf8').toString('base64');
    // Сводка структуры — в текст результата: модель должна знать, сколько состава реально попало в черновик
    // (лимиты и бюджет могли отсечь часть предложения).
    const incrementsDraft = Array.isArray(draft.increments) ? draft.increments : [];
    const structureSummary = incrementsDraft.length
      ? ` Состав заключения: решений — ${incrementsDraft.length}, систем — ${incrementsDraft.reduce(
          (n, inc) => n + (inc.systems || []).length,
          0,
        )}, связей — ${incrementsDraft.reduce((n, inc) => n + (inc.relations || []).length, 0)}; статус черновика — «${draftStatusCode}».`
      : '';
    return {
      ok: true,
      result: {
        message:
          'Черновик подготовлен: данные НЕ сохраняются, проверьте поля и сохраните форму сами.' +
          structureSummary +
          (warnings.length ? ` Предупреждений: ${warnings.length}.` : ''),
        // В query-строке payload кодируется: '+'/'=' из base64 иначе ломают разбор `?payload=`.
        path: `${basePath}?payload=${encodeURIComponent(payload)}`,
        draft,
        ...(ignored.length ? { ignoredFields: ignored } : {}),
        ...(warnings.length ? { warnings } : {}),
      },
      action: {
        type: 'prefill_form',
        entityType: type,
        entityLabel: meta.label,
        entityId,
        mode,
        path: basePath,
        payload,
        draft,
        ...(ignored.length ? { ignoredFields: ignored } : {}),
        ...(warnings.length ? { warnings } : {}),
        permission: meta.writePermission,
      },
    };
  }

  /**
   * Фокус экрана для `open_view` — сейчас только у `analytics` (`SCREEN_TARGETS.analytics.focus`).
   *
   * Превращает `focusEntityType`/`focusIds` в query экрана (`?entity=<код типа>&ids=<csv id>`) — тот же
   * контракт, что читает `frontend-v3/src/views/AnalyticsView.vue`. Безопасная деградация: экран без
   * поддержки фокуса, неизвестный тип, нет права чтения типа или битые id — фокус опускается, а модель
   * получает `warning` в тексте результата (переход всё равно доступен, фокус не выдаётся за выполненный).
   * Само построение графа делает фронт из связей метамодели — сервер данные не отдаёт.
   */
  function resolveScreenFocus(screen, args) {
    const empty = { query: null, focusIds: [], focusLabel: '', note: '', warning: '' };
    const focusType = String(args.focusEntityType == null ? '' : args.focusEntityType).trim();
    const rawIds = Array.isArray(args.focusIds) ? args.focusIds : [];
    if (!focusType && !rawIds.length) return empty;
    if (!screen.focus) {
      return { ...empty, warning: `Фокус не применён: экран «${screen.plural}» его не поддерживает.` };
    }
    const meta = ENTITY_TYPES[focusType];
    if (!meta) {
      return {
        ...empty,
        warning: `Фокус не применён: неизвестный тип сущности «${focusType}». Доступно: ${ENTITY_TYPE_CODES.join(', ')}.`,
      };
    }
    if (!can(meta.readPermission)) {
      return { ...empty, warning: `Фокус не применён: нет права чтения «${meta.plural}» (${meta.readPermission}).` };
    }
    const focusIds = [];
    for (const raw of rawIds) {
      const n = Number.parseInt(raw, 10);
      if (Number.isFinite(n) && n > 0 && !focusIds.includes(n)) focusIds.push(n);
      if (focusIds.length >= screenFocusMaxIds()) break;
    }
    if (!focusIds.length) {
      return { ...empty, warning: 'Фокус не применён: нужен хотя бы один корректный id (args.focusIds).' };
    }
    const query = {
      [SCREEN_FOCUS_QUERY_KEYS.entityType]: focusType,
      [SCREEN_FOCUS_QUERY_KEYS.ids]: focusIds.join(','),
    };
    return {
      query,
      focusIds,
      focusLabel: meta.label,
      warning: '',
      note:
        `Экран откроется с фокусом на «${meta.label}» (#${focusIds.join(', ')}): фронт выберет эти объекты ` +
        'и сразу построит граф по связям метамодели. Фильтр поиска этим экраном не поддерживается.',
    };
  }

  /**
   * `open_view` — открытие реестра (списка) с необязательным фильтром поиска, а также экранов
   * `analytics` («Анализ зависимостей»), `dashboards`, `tech_radar`. Ссылка для реестра собирается
   * фронтом из `listPath` + `search` (см. `frontend-v3/src/utils/listSearchQuery.js`); сервер валидирует
   * только право чтения — данных пользователю не раскрывается больше, чем в реестре. У экранов фильтр
   * не поддерживается (их данные строит фронт из связей метамодели, см. `get_relations`); экран с
   * `focus: true` принимает фокус графа (`focusEntityType` + `focusIds`) — см. `resolveScreenFocus`.
   */
  async function runOpenView(args) {
    // Код приводим к реестру агента: код каталога `applied` должен открывать реестр заключений, а коды экранов
    // (`analytics`/`dashboards`/`tech_radar`) синонимов не имеют — вернутся как есть.
    const type = agentEntityType(args.entityType);
    const screen = SCREEN_TARGETS[type];
    if (screen) {
      if (!can(screen.readPermission)) {
        return { ok: false, error: `Нет доступа к экрану «${screen.plural}» (${screen.readPermission}).` };
      }
      const focus = resolveScreenFocus(screen, args);
      // `URLSearchParams` кодирует запятую как `%2C`; в диплинке оставляем её как есть (docs §7),
      // значения фокуса — код типа и цифры, экранировать там нечего.
      const path = focus.query
        ? `${screen.listPath}?${new URLSearchParams(focus.query).toString().replace(/%2C/gi, ',')}`
        : screen.listPath;
      const message = [
        focus.note ||
          `Экран «${screen.plural}» подготовлен — подтвердите переход в панели. ` +
            'Фильтр поиска этим экраном не поддерживается; данные зависимостей — через get_relations.',
        focus.warning,
      ]
        .filter(Boolean)
        .join(' ');
      return {
        ok: true,
        result: {
          message,
          path,
          ...(focus.query ? { focus: { entityType: focus.query.entity, ids: focus.focusIds } } : {}),
        },
        action: {
          type: 'open_view',
          entityType: type,
          entityLabel: screen.plural,
          listPath: screen.listPath,
          path,
          ...(focus.query ? { query: focus.query } : {}),
          ...(focus.focusIds.length ? { focusIds: focus.focusIds, focusLabel: focus.focusLabel } : {}),
          permission: screen.readPermission,
        },
      };
    }
    const meta = ENTITY_TYPES[type];
    if (!meta) {
      return { ok: false, error: `Неизвестный тип сущности «${type}». Доступно: ${VIEW_TARGET_CODES.join(', ')}.` };
    }
    // У части реестров экранного списка нет (например `system_function` — функции правятся внутри формы ИС):
    // без `listPath` ссылка была бы «undefined», поэтому отвечаем явно и подсказываем доступные инструменты.
    if (!meta.listPath) {
      return {
        ok: false,
        error: `У реестра «${meta.plural}» нет экранного списка — доступны search_entities и get_entity.`,
      };
    }
    if (!can(meta.readPermission)) return { ok: false, error: `Нет доступа к реестру «${meta.plural}» (${meta.readPermission}).` };
    const search = String(args.search == null ? '' : args.search).trim();
    if (search && search.length < 2) {
      return {
        ok: false,
        error: 'Фильтр реестра слишком короткий — укажите не менее 2 символов (args.search) либо не задавайте его.',
      };
    }
    const path = search ? `${meta.listPath}?${LIST_SEARCH_QUERY_KEY}=${encodeURIComponent(search)}` : meta.listPath;
    return {
      ok: true,
      result: {
        message: `Реестр «${meta.plural}»${search ? ` с фильтром «${search}»` : ''} подготовлен — подтвердите переход в панели.`,
        path,
        ...(search ? { search } : {}),
      },
      action: {
        type: 'open_view',
        entityType: type,
        entityLabel: meta.plural,
        listPath: meta.listPath,
        ...(search ? { search } : {}),
        path,
        permission: meta.readPermission,
      },
    };
  }

  async function runOpenForm(args) {
    const type = agentEntityType(args.entityType);
    const meta = ENTITY_TYPES[type];
    if (!meta) {
      return { ok: false, error: `Неизвестный тип сущности «${type}». Формы доступны для: ${FORM_ENTITY_TYPE_CODES.join(', ')}.` };
    }
    if (!meta.form) {
      return { ok: false, error: `Для реестра «${meta.plural}» форма в UI не предусмотрена — доступно только чтение.` };
    }
    const rawMode = String(args.mode || 'view');
    const mode = ['view', 'edit', 'new'].includes(rawMode) ? rawMode : 'view';
    if (!can(meta.readPermission)) return { ok: false, error: `Нет доступа к реестру «${meta.plural}» (${meta.readPermission}).` };
    if (mode !== 'view' && !can(meta.writePermission)) {
      return { ok: false, error: `Нет права на изменение «${meta.plural}» (${meta.writePermission}).` };
    }
    let entityId = null;
    let label = null;
    if (mode !== 'new') {
      const id = Number.parseInt(args.id, 10);
      if (!Number.isFinite(id)) {
        return { ok: false, error: 'Для режима view/edit нужен id записи (получите его через search_entities).' };
      }
      const rows = await readRows(meta.get, [id]);
      if (!rows.length) return { ok: false, error: `Запись ${type} #${id} не найдена — форма не открыта.` };
      entityId = id;
      label = meta.labelOf(rows[0]);
    }
    const path = mode === 'new' ? meta.form.new() : meta.form[mode](entityId);
    return {
      ok: true,
      result: { message: `Форма «${label || meta.label}» (${mode}) подготовлена — подтвердите открытие в панели.`, path },
      action: {
        type: 'open_form',
        entityType: type,
        entityLabel: meta.label,
        entityId,
        entityTitle: label,
        mode,
        path,
        permission: mode === 'view' ? meta.readPermission : meta.writePermission,
      },
    };
  }
}

module.exports = {
  ENTITY_TYPES,
  ENTITY_TYPE_CODES,
  ENTITY_TYPE_ALIASES,
  FORM_ENTITY_TYPE_CODES,
  SCREEN_TARGETS,
  SCREEN_CODES,
  VIEW_TARGET_CODES,
  RELATION_END_META,
  RELATION_END_CODES,
  createToolRunner,
  toolDefinitions,
};



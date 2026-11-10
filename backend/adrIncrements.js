'use strict';

/**
 * Нормализация payload архитектурного заключения (issue #74; модульный слой удалён в v4.0.0).
 *
 * Ядро принимает **две** формы ссылок на черновые объекты:
 *   - свои имена: `local_key` (система), `from_new_key` / `to_new_key` (связь);
 *   - имена модуля DrawIO Pro v0.1.0: `client_ref` (система/функция/связь), `from_ref` / `to_ref`.
 *
 * Нормализация выполняется **до** `resolveRelationEndpoint()`, поэтому в транзакцию
 * попадают только ядровые имена, а модуль не нужно патчить (адаптер в ядре).
 */

const DEFAULT_MXFILE_MAX_MB = 5;
const MXFILE_ROOT_RE = /<(mxfile|mxGraphModel)[\s>]/i;

function isPresent(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function firstPresent(...values) {
  for (const value of values) {
    if (isPresent(value)) return value;
  }
  return null;
}

function isNumericId(value) {
  if (!isPresent(value)) return false;
  return /^\d+$/.test(String(value).trim());
}

/** Система: `client_ref` (модуль) → `local_key` (ядро). */
function normalizeSystemEntry(system) {
  if (!system || typeof system !== 'object') return system;
  return { ...system, local_key: firstPresent(system.local_key, system.client_ref) };
}

/**
 * Связь: `from_ref`/`to_ref` (модуль) → `from_new_key`/`to_new_key` (ядро).
 * Если в `from_ar_systems_id` пришла нечисловая ссылка на черновую систему,
 * она тоже переносится в ключ (устойчивость к разным версиям модуля).
 */
function normalizeRelationEntry(relation) {
  if (!relation || typeof relation !== 'object') return relation;
  const out = { ...relation };

  if (isPresent(out.from_ar_systems_id) && !isNumericId(out.from_ar_systems_id)) {
    out.from_new_key = firstPresent(out.from_new_key, out.from_ar_systems_id);
    out.from_ar_systems_id = null;
  }
  if (isPresent(out.to_ar_systems_id) && !isNumericId(out.to_ar_systems_id)) {
    out.to_new_key = firstPresent(out.to_new_key, out.to_ar_systems_id);
    out.to_ar_systems_id = null;
  }

  out.from_new_key = firstPresent(out.from_new_key, out.from_ref);
  out.to_new_key = firstPresent(out.to_new_key, out.to_ref);
  out.local_key = firstPresent(out.local_key, out.client_ref);
  return out;
}

/** Функция системы: `description` поддерживается моделью (createFunctionFromNew). */
function normalizeFunctionEntry(fn) {
  if (!fn || typeof fn !== 'object') return fn;
  return { ...fn, local_key: firstPresent(fn.local_key, fn.client_ref) };
}

/**
 * Привести `increments[]` к ядровой форме. Никогда не бросает: не-массивы → [].
 * @param {Array<object>|undefined|null} increments
 * @returns {Array<object>}
 */
function normalizeIncrementPayload(increments) {
  if (!Array.isArray(increments)) return [];
  return increments.map((inc) => {
    if (!inc || typeof inc !== 'object') return inc;
    const systems = Array.isArray(inc.systems) ? inc.systems : [];
    const relations = Array.isArray(inc.relations) ? inc.relations : [];
    return {
      ...inc,
      systems: systems.map((s) => {
        if (!s || typeof s !== 'object') return s;
        const normalized = normalizeSystemEntry(s);
        return {
          ...normalized,
          functions: Array.isArray(s.functions) ? s.functions.map(normalizeFunctionEntry) : [],
        };
      }),
      relations: relations.map(normalizeRelationEntry),
    };
  });
}

/**
 * Частичное обновление шапки заключения (`PUT .../full` с телом `{ increments }`):
 * отсутствующие в теле поля берутся из текущей записи, а **не** затираются пустыми строками.
 *
 * @param {object} body — тело запроса
 * @param {object} currentRow — текущая строка `ar_adrs_applied`
 */
function mergeAppliedHeader(body, currentRow) {
  const b = body && typeof body === 'object' ? body : {};
  const cur = currentRow || {};
  const pick = (key, fallback) => {
    if (Object.prototype.hasOwnProperty.call(b, key) && b[key] !== undefined) return b[key];
    return fallback;
  };
  return {
    task_name: pick('task_name', cur.task_name ?? ''),
    task_link: pick('task_link', cur.task_link ?? ''),
    conclusion: pick('conclusion', cur.conclusion ?? ''),
    author: pick('author', cur.author ?? ''),
    ar_adr_statuses_id: pick('ar_adr_statuses_id', cur.ar_adr_statuses_id ?? null),
  };
}

/** Достать mxfile из тела запроса (`POST /api/increments/:id/diagrams`). */
function extractMxfile(body) {
  const raw = body && body.mxfile;
  if (raw == null || raw === '') return { xml: null, error: null };
  if (typeof raw !== 'string') return { xml: null, error: 'Поле mxfile должно быть строкой XML' };
  return { xml: raw, error: null };
}

/**
 * Лимит размера mxfile: параметр `DRAWIO_MXFILE_MAX_MB` (по умолчанию 5 МБ).
 * @param {(code:string, def:any)=>any} [getParam]
 */
function mxfileMaxBytes(getParam) {
  const raw = typeof getParam === 'function' ? getParam('DRAWIO_MXFILE_MAX_MB', DEFAULT_MXFILE_MAX_MB) : null;
  const mb = Number(raw);
  const safeMb = Number.isFinite(mb) && mb > 0 ? mb : DEFAULT_MXFILE_MAX_MB;
  return Math.round(safeMb * 1024 * 1024);
}

/**
 * Валидация клиентского mxfile перед сохранением новой версии схемы.
 * @param {string} xml
 * @param {{maxBytes?:number}} [opts]
 * @returns {{ok:boolean, error?:string, bytes?:number}}
 */
function validateMxfile(xml, opts = {}) {
  const maxBytes = Number(opts.maxBytes) > 0 ? Number(opts.maxBytes) : mxfileMaxBytes();
  if (typeof xml !== 'string' || !xml.trim()) {
    return { ok: false, error: 'mxfile пуст' };
  }
  const bytes = Buffer.byteLength(xml, 'utf8');
  if (bytes > maxBytes) {
    return { ok: false, error: `mxfile превышает лимит ${Math.round(maxBytes / 1024 / 1024)} МБ`, bytes };
  }
  const head = xml.slice(0, 4096);
  if (/<!DOCTYPE/i.test(head)) {
    return { ok: false, error: 'mxfile не должен содержать DOCTYPE' };
  }
  if (!MXFILE_ROOT_RE.test(head)) {
    return { ok: false, error: 'mxfile не содержит корневого элемента <mxfile> или <mxGraphModel>' };
  }
  return { ok: true, bytes };
}

/**
 * Тело ответа `POST/PUT .../full` для палитры диаграммы: клиенту нужны `increment_id`
 * (куда сохранять `.drawio`) и соответствие «локальный ключ → id» для перекодирования
 * черновых ячеек `draft-sys-*` / `draft-rel-*` в `sys-{id}` / `rel-{id}` перед сохранением схемы.
 *
 * @param {{appliedId:number|string, code?:string|null,
 *   increments?:Array<{id:number, order_index?:number, name?:string}>,
 *   systems?:Array<{local_key:string, id:number}>,
 *   relations?:Array<{local_key:string, id:number}>}} data
 */
function buildFullSaveResponse({ appliedId, code = null, increments = [], systems = [], relations = [] }) {
  const list = Array.isArray(increments) ? increments : [];
  const keyed = (rows) => (Array.isArray(rows) ? rows : [])
    .filter((row) => row && row.local_key != null && row.id != null)
    .map((row) => ({ local_key: String(row.local_key).trim(), id: row.id }));
  return {
    id: appliedId,
    code,
    increment_id: list.length ? list[0].id : null,
    increments: list.map((inc) => ({ id: inc.id, order_index: inc.order_index, name: inc.name })),
    systems: keyed(systems),
    relations: keyed(relations),
  };
}

module.exports = {
  DEFAULT_MXFILE_MAX_MB,
  isPresent,
  firstPresent,
  isNumericId,
  normalizeSystemEntry,
  normalizeRelationEntry,
  normalizeFunctionEntry,
  normalizeIncrementPayload,
  mergeAppliedHeader,
  extractMxfile,
  mxfileMaxBytes,
  validateMxfile,
  buildFullSaveResponse,
};

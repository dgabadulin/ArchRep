'use strict';

/**
 * Тип интерфейса ИС (issue #129): общая логика для формы карточки и Excel-импорта.
 *
 * Модель: справочник `ar_system_interface_types` + связь M:N
 * `ar_system_interface_type_links`. Единая точка синхронизации связей
 * (`syncSystemInterfaceTypes`) — чтобы UI и импорт не расходились.
 */

const { HttpError } = require('./dbTx');
const { normName } = require('./importLib/common');

/**
 * Нормализовать список id типов из тела запроса.
 * Принимает массив (числа/строки) или строку с `;`/`,`; дубликаты убираются,
 * результат отсортирован по возрастанию id (стабильный снимок формы → `useFormDirty`).
 *
 * @param {unknown} raw
 * @returns {number[]}
 */
function normalizeInterfaceTypeIds(raw) {
  let values;
  if (Array.isArray(raw)) values = raw;
  else if (raw == null || raw === '') values = [];
  else values = String(raw).split(/[;,]/);

  const out = [];
  for (const value of values) {
    const s = String(value == null ? '' : value).trim();
    if (!s) continue;
    if (!/^\d+$/.test(s)) {
      throw new HttpError(400, `Некорректный идентификатор типа интерфейса: «${s}»`);
    }
    const id = Number(s);
    if (Number.isSafeInteger(id) && id > 0 && !out.includes(id)) out.push(id);
  }
  return out.sort((a, b) => a - b);
}

/**
 * Разобрать ячейку Excel «Типы интерфейса»: значения через `;` или `,`,
 * пустые элементы и дубликаты отбрасываются, порядок сохраняется.
 *
 * @param {unknown} raw
 * @returns {string[]}
 */
function parseInterfaceTypeNames(raw) {
  const seen = new Set();
  const out = [];
  for (const part of String(raw == null ? '' : raw).split(/[;,]/)) {
    const name = part.trim().replace(/\s+/g, ' ');
    if (!name) continue;
    const key = normName(name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

/**
 * Разрешить названия типов интерфейса в id по индексу `buildNameIndex`.
 * Неизвестное или неоднозначное название — ошибка строки импорта (`status = 400`),
 * как у остальных справочников (см. `importLib/common.resolveOne`).
 *
 * @param {string[]} names
 * @param {Map<string, object[]>} index — индекс по наименованию
 * @param {string} [label]
 * @returns {number[]}
 */
function resolveInterfaceTypeIds(names, index, label = 'Типы интерфейса') {
  const out = [];
  for (const name of names || []) {
    const hits = index.get(normName(name)) || [];
    if (hits.length === 0) {
      const err = new Error(`${label}: не найдено «${name}»`);
      err.status = 400;
      throw err;
    }
    if (hits.length > 1) {
      const err = new Error(`${label}: неоднозначное имя «${name}» (${hits.length})`);
      err.status = 400;
      throw err;
    }
    const id = Number(hits[0].id);
    if (!out.includes(id)) out.push(id);
  }
  return out.sort((a, b) => a - b);
}

/**
 * Синхронизировать связи «система ↔ типы интерфейса».
 * Вызывается внутри транзакции (форма) или в общем потоке импорта:
 * удаление всех связей системы + вставка актуального набора.
 *
 * @param {{ query: Function }} db — client (транзакция) или pool
 * @param {object} queries
 * @param {number|string} systemId
 * @param {number[]} ids — уже нормализованный список
 */
async function syncSystemInterfaceTypes(db, queries, systemId, ids) {
  await db.query(queries.system_interface_type_links_delete, [systemId]);
  const list = Array.isArray(ids) ? ids : [];
  if (list.length === 0) return;
  await db.query(queries.system_interface_type_links_insert, [systemId, list]);
}

module.exports = {
  normalizeInterfaceTypeIds,
  parseInterfaceTypeNames,
  resolveInterfaceTypeIds,
  syncSystemInterfaceTypes,
};

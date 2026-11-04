/**
 * Маркеры функций систем на схеме решения (issue #93).
 *
 * Маркер стоит перед названием функции в теле узла draw.io и в денормализованном
 * поле `ar_adr_increment_systems.comment`:
 *   +  — функция создаётся в решении       (ADR_INCR_SYSFUNC_CREATING)
 *   •  — функция модифицируется             (ADR_INCR_SYSFUNC_MODIFYING, U+2022)
 *   ✓  — существующая функция используется  (ADR_INCR_SYSFUNC_IN_USE, U+2713)
 *   -  — функция выводится из эксплуатации  (ADR_INCR_SYSFUNC_DECOMMISSIONING)
 *   ?  — статус не задан (легаси-строки)    (UNKNOWN_SYSFUNC_MARKER)
 *
 * Соответствие «код статуса → маркер» — данные, а не хардкод: параметр
 * `DRAWIO_SYSFUNC_MARKERS` в `archrep.ar_settings_parameters` (`value_type = json`).
 * Префикс `DRAWIO_` — параметр относится только к схеме draw.io (как `DRAWIO_NODE_STYLE`).
 * Сид: DB/scripts/migrate_20261102120000_drawio_sysfunc_markers_parameter.sql.
 */

/** Значения по умолчанию (совпадают с сидом в DB/scripts). */
const DEFAULT_SYSFUNC_MARKERS = {
  ADR_INCR_SYSFUNC_CREATING: '+',
  ADR_INCR_SYSFUNC_MODIFYING: '\u2022',
  ADR_INCR_SYSFUNC_IN_USE: '\u2713',
  ADR_INCR_SYSFUNC_DECOMMISSIONING: '-',
};

/** Маркер функции без статуса (легаси-строки до issue #74). */
const UNKNOWN_SYSFUNC_MARKER = '?';

function isPlainObject(x) {
  return x != null && typeof x === 'object' && !Array.isArray(x);
}

/**
 * Карта «код статуса функции → маркер» из параметра `DRAWIO_SYSFUNC_MARKERS`.
 * Пустые значения игнорируются (остаётся дефолт для этого кода); неизвестные
 * коды в параметре сохраняются как есть.
 *
 * @param {(code: string, def: any) => any} [getParam] — как в settingsParams
 * @returns {Record<string, string>}
 */
function resolveSysFuncMarkers(getParam) {
  const raw = typeof getParam === 'function' ? getParam('DRAWIO_SYSFUNC_MARKERS', null) : null;
  const out = { ...DEFAULT_SYSFUNC_MARKERS };
  if (!isPlainObject(raw)) return out;
  for (const [code, value] of Object.entries(raw)) {
    const marker = value == null ? '' : String(value).trim();
    if (marker) out[String(code).trim()] = marker;
  }
  return out;
}

/**
 * Маркер конкретной функции по коду статуса в заключении.
 * @param {string|null|undefined} code — `increment_sysfunc_status_code`
 * @param {Record<string, string>} [markers] — результат resolveSysFuncMarkers
 * @returns {string}
 */
function sysFuncMarker(code, markers) {
  const map = isPlainObject(markers) ? markers : DEFAULT_SYSFUNC_MARKERS;
  const key = code == null ? '' : String(code).trim();
  if (!key) return UNKNOWN_SYSFUNC_MARKER;
  return map[key] || UNKNOWN_SYSFUNC_MARKER;
}

/**
 * Строки тела узла: `<маркер><название>;` в порядке выбранных функций.
 *
 * @param {Array<{ name?: string, increment_sysfunc_status_code?: string|null }>} entries
 * @param {Record<string, string>} [markers]
 * @returns {string[]}
 */
function formatSysFuncLines(entries, markers) {
  const list = Array.isArray(entries) ? entries : [];
  const lines = [];
  for (const entry of list) {
    const name = String((entry && entry.name) || '').trim();
    if (!name) continue;
    const marker = sysFuncMarker(entry && entry.increment_sysfunc_status_code, markers);
    lines.push(`${marker}${name};`);
  }
  return lines;
}

/**
 * Денормализованное поле «Функции» строки системы в решении (issue #52/#74/#93).
 * Формат прежний по разделителям (`\r\n`, завершающая `;`), меняется только маркер.
 *
 * @param {Array<{ name?: string, increment_sysfunc_status_code?: string|null }>} entries
 * @param {(code: string, def: any) => any} [getParam]
 * @returns {string}
 */
function formatSysFuncComment(entries, getParam) {
  const lines = formatSysFuncLines(entries, resolveSysFuncMarkers(getParam));
  return lines.join('\r\n');
}

module.exports = {
  DEFAULT_SYSFUNC_MARKERS,
  UNKNOWN_SYSFUNC_MARKER,
  resolveSysFuncMarkers,
  sysFuncMarker,
  formatSysFuncLines,
  formatSysFuncComment,
};

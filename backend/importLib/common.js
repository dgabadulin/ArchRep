function normName(s) {
  return String(s || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function buildNameIndex(rows, nameFn) {
  const map = new Map();
  for (const r of rows) {
    const key = normName(nameFn(r));
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  }
  return map;
}

function resolveOne(index, rawName, label, { allowEmpty = false } = {}) {
  const key = normName(rawName);
  if (!key) {
    if (allowEmpty) return null;
    const err = new Error(`${label}: пустое значение`);
    err.status = 400;
    throw err;
  }
  const hits = index.get(key) || [];
  if (hits.length === 0) {
    const err = new Error(`${label}: не найдено «${rawName}»`);
    err.status = 400;
    throw err;
  }
  if (hits.length > 1) {
    const err = new Error(`${label}: неоднозначное имя «${rawName}» (${hits.length})`);
    err.status = 400;
    throw err;
  }
  return hits[0];
}

function resolveOptional(index, rawName, label) {
  if (!(rawName || '').trim()) return null;
  return resolveOne(index, rawName, label);
}

function parseBool(raw, fallback = false) {
  const s = String(raw == null ? '' : raw)
    .trim()
    .toLowerCase();
  if (!s) return fallback;
  if (['1', 'true', 'yes', 'y', 'да', 'д', 'x', '+'].includes(s)) return true;
  if (['0', 'false', 'no', 'n', 'нет', '-'].includes(s)) return false;
  const err = new Error(`Некорректное логическое значение: «${raw}» (ожидается да/нет)`);
  err.status = 400;
  throw err;
}

function cellStr(v) {
  const XLSX = require('xlsx');
  if (v == null || v === '') return '';
  if (v instanceof Date && !isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    try {
      const parsed = XLSX.SSF.parse_date_code(v);
      if (parsed) {
        const mm = String(parsed.m).padStart(2, '0');
        const dd = String(parsed.d).padStart(2, '0');
        return `${parsed.y}-${mm}-${dd}`;
      }
    } catch (_) { /* ignore */ }
  }
  return String(v).trim();
}

function pgId(v) {
  if (v == null || v === '') return '';
  return String(v);
}

function makeCatalog(fields, entityCode, templateVersion) {
  function headerFor(f) {
    return `${f.label} (${f.field})`;
  }
  function leadFields() {
    return fields.filter((f) => f.zone === 'lead');
  }
  function leftFields() {
    return fields.filter((f) => f.zone === 'left');
  }
  function rightFields() {
    return fields.filter((f) => f.zone === 'right');
  }
  function orderedFields() {
    return [...leadFields(), ...leftFields(), ...rightFields()];
  }
  function allHeaders() {
    return orderedFields().map(headerFor);
  }
  function parseHeaderField(header) {
    const s = String(header || '').trim();
    const m = s.match(/\(([^)]+)\)\s*$/);
    return m ? m[1].trim() : null;
  }
  return {
    ENTITY_CODE: entityCode,
    TEMPLATE_VERSION: templateVersion,
    fields,
    leadFields,
    leftFields,
    rightFields,
    orderedFields,
    allHeaders,
    headerFor,
    parseHeaderField,
  };
}

module.exports = {
  normName,
  buildNameIndex,
  resolveOne,
  resolveOptional,
  parseBool,
  cellStr,
  pgId,
  makeCatalog,
};

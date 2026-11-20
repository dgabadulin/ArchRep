'use strict';

/**
 * Полная синхронизация справочника сотрудников из CSV (issue #122).
 *
 * Контракт и правила: docs/employee-directory-import.md.
 * Ключ — табельный номер. Отсутствующие в полном файле сотрудники с непустым
 * номером переводятся в active=false; строки без номера в БД не меняются.
 */

const { withTransaction } = require('./dbTx');

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const LARGE_DEACTIVATION_RATIO = 0.5;

const HEADERS = [
  {
    field: 'employee_number',
    label: 'Табельный номер',
    aliases: ['employee_number', 'табельный номер', 'табельный №', 'табельный номер сотрудника'],
  },
  {
    field: 'full_name',
    label: 'Сотрудник',
    aliases: ['full_name', 'фио', 'полное имя', 'сотрудник'],
  },
  {
    field: 'email',
    label: 'Служебный адрес электронной почты',
    aliases: ['email', 'e-mail', 'почта', 'служебный адрес электронной почты'],
  },
  { field: 'position', label: 'Должность', aliases: ['position', 'должность'] },
  { field: 'department', label: 'Подразделение', aliases: ['department', 'подразделение'] },
];

const FIELD_LIMITS = {
  employee_number: 64,
  full_name: 512,
  email: 255,
  position: 255,
  department: 512,
};

class EmployeeImportError extends Error {
  constructor(statusCode, message, extra = {}) {
    super(message);
    this.name = 'EmployeeImportError';
    this.statusCode = statusCode;
    Object.assign(this, extra);
  }
}

function normalizeHeader(value) {
  return String(value == null ? '' : value)
    .replace(/\u00a0/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function normalizeNumber(value) {
  return String(value == null ? '' : value).trim().toLowerCase();
}

function normalizeEmail(value) {
  return String(value == null ? '' : value).trim().toLowerCase();
}

function validEmail(value) {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Разбор CSV с кавычками, "" и переносами внутри поля. */
function parseCsv(text, delimiter) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"' && field === '') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim() !== '') || '';
  let commas = 0;
  let semicolons = 0;
  let inQuotes = false;
  for (let i = 0; i < firstLine.length; i += 1) {
    const ch = firstLine[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch === ',') commas += 1;
    else if (!inQuotes && ch === ';') semicolons += 1;
  }
  return semicolons > commas ? ';' : ',';
}

function headerIndex(table) {
  return table.findIndex((row) => row.some((cell) => String(cell || '').trim() !== ''));
}

function buildHeaderMap(headerRow) {
  const aliases = new Map();
  for (const def of HEADERS) {
    aliases.set(normalizeHeader(def.label), def.field);
    for (const alias of def.aliases) aliases.set(normalizeHeader(alias), def.field);
  }
  const map = {};
  headerRow.forEach((cell, index) => {
    const field = aliases.get(normalizeHeader(cell));
    if (field && map[field] == null) map[field] = index;
  });
  return map;
}

function parseEmployeeCsv(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new EmployeeImportError(400, 'Файл пуст');
  }
  if (buffer.length > MAX_FILE_BYTES) {
    throw new EmployeeImportError(400, `Файл больше ${MAX_FILE_BYTES / 1024 / 1024} МБ`);
  }
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
  if (!text.trim()) throw new EmployeeImportError(400, 'Файл пуст');

  const delimiter = detectDelimiter(text);
  const table = parseCsv(text, delimiter);
  const hIndex = headerIndex(table);
  if (hIndex < 0) throw new EmployeeImportError(400, 'Не найдена строка заголовков');

  const headerMap = buildHeaderMap(table[hIndex]);
  const missing = HEADERS.filter((def) => headerMap[def.field] == null).map((def) => def.label);
  if (missing.length) {
    throw new EmployeeImportError(400, `В CSV нет обязательных колонок: ${missing.join(', ')}`);
  }

  const rows = [];
  for (let i = hIndex + 1; i < table.length; i += 1) {
    const raw = table[i];
    if (!raw || raw.every((cell) => String(cell || '').trim() === '')) continue;
    const row = {
      row_no: i + 1,
      employee_number: String(raw[headerMap.employee_number] || '').trim(),
      full_name: String(raw[headerMap.full_name] || '').trim(),
      email: normalizeEmail(raw[headerMap.email]),
      position: String(raw[headerMap.position] || '').trim(),
      department: String(raw[headerMap.department] || '').trim(),
      status: '',
      errors: [],
    };
    if (!row.employee_number) row.errors.push('Пустой табельный номер');
    if (!row.full_name) row.errors.push('Пустое ФИО');
    if (!validEmail(row.email)) row.errors.push(`Некорректный email: ${row.email}`);
    for (const [field, limit] of Object.entries(FIELD_LIMITS)) {
      if (row[field].length > limit) row.errors.push(`Слишком длинное значение ${field} (> ${limit})`);
    }
    rows.push(row);
  }
  if (rows.length === 0) throw new EmployeeImportError(400, 'В файле нет строк с данными');
  return rows;
}

const EMPLOYEES_SELECT = `
  SELECT id, employee_number, full_name, email, position, department, active
  FROM archrep.ar_employees
`;

function countBy(rows, getKey) {
  const counts = new Map();
  for (const row of rows) {
    const key = getKey(row);
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function buildTemplateCsv() {
  return `\uFEFF${HEADERS.map((def) => def.label).join(';')}\n001234;Иванов Иван Иванович;ivanov@example.ru;Ведущий архитектор;Управление архитектуры\n`;
}

async function validateEmployeeImport(pool, buffer) {
  const rows = parseEmployeeCsv(buffer);
  const db = await pool.query(EMPLOYEES_SELECT);
  const employees = db.rows || [];
  const byNumber = new Map();
  const byEmail = new Map();

  for (const employee of employees) {
    const number = normalizeNumber(employee.employee_number);
    const email = normalizeEmail(employee.email);
    if (number) byNumber.set(number, employee);
    if (email) byEmail.set(email, employee);
  }

  const numberCounts = countBy(rows, (row) => normalizeNumber(row.employee_number));
  const emailCounts = countBy(rows, (row) => normalizeEmail(row.email));
  const summary = {
    rows: rows.length,
    would_create: 0,
    would_update: 0,
    would_reactivate: 0,
    would_deactivate: 0,
    errors: 0,
    untouched_without_number: 0,
    active_with_number: 0,
    deactivate_ratio: 0,
    requiresLargeDeactivationConfirm: false,
  };

  for (const row of rows) {
    const numberKey = normalizeNumber(row.employee_number);
    const emailKey = normalizeEmail(row.email);
    if (numberCounts.get(numberKey) > 1) row.errors.push('Дубль табельного номера в файле');
    if (emailKey && emailCounts.get(emailKey) > 1) row.errors.push('Дубль email в файле');

    const existing = numberKey ? byNumber.get(numberKey) : null;
    if (existing) row.existing_id = existing.id;

    if (emailKey) {
      const owner = byEmail.get(emailKey);
      if (owner && (!existing || owner.id !== existing.id)) {
        row.errors.push(`Email уже занят сотрудником: ${owner.full_name}`);
      }
    }

    if (row.errors.length > 0) {
      row.status = 'error';
      summary.errors += 1;
      continue;
    }

    if (existing) {
      if (existing.active) {
        row.status = 'would_update';
        summary.would_update += 1;
      } else {
        row.status = 'would_reactivate';
        summary.would_reactivate += 1;
      }
    } else {
      row.status = 'would_create';
      summary.would_create += 1;
    }
  }

  const fileNumbers = new Set(
    rows.map((row) => normalizeNumber(row.employee_number)).filter(Boolean),
  );
  const deactivate = [];
  let activeWithNumber = 0;

  for (const employee of employees) {
    const number = normalizeNumber(employee.employee_number);
    if (!number) {
      summary.untouched_without_number += 1;
      continue;
    }
    if (employee.active) activeWithNumber += 1;
    if (employee.active && !fileNumbers.has(number)) {
      deactivate.push({
        id: employee.id,
        employee_number: employee.employee_number,
        full_name: employee.full_name,
      });
    }
  }

  summary.would_deactivate = deactivate.length;
  summary.active_with_number = activeWithNumber;
  summary.deactivate_ratio = activeWithNumber > 0
    ? Number((deactivate.length / activeWithNumber).toFixed(4))
    : 0;
  summary.requiresLargeDeactivationConfirm = (
    deactivate.length > 0 && summary.deactivate_ratio > LARGE_DEACTIVATION_RATIO
  );

  return { summary, rows, deactivate };
}

async function applyEmployeeImport(pool, buffer, opts = {}) {
  const plan = await validateEmployeeImport(pool, buffer);
  const { summary, rows, deactivate } = plan;

  if (summary.errors > 0) {
    throw new EmployeeImportError(
      400,
      'В файле есть ошибки строк. Исправьте их и повторите проверку — применение заблокировано.',
      { summary, rows },
    );
  }
  if (summary.would_deactivate > 0 && !opts.confirmDeactivate) {
    throw new EmployeeImportError(
      400,
      `В файле отсутствуют ${summary.would_deactivate} сотрудник(ов). Подтвердите увольнение.`,
      { summary, rows, deactivate },
    );
  }
  if (
    opts.expectedDeactivateCount != null &&
    Number(opts.expectedDeactivateCount) !== summary.would_deactivate
  ) {
    throw new EmployeeImportError(
      409,
      `Количество увольняемых изменилось: было ${opts.expectedDeactivateCount}, сейчас ${summary.would_deactivate}. Повторите проверку.`,
      { summary, rows, deactivate },
    );
  }
  if (summary.requiresLargeDeactivationConfirm && !opts.allowLargeDeactivation) {
    throw new EmployeeImportError(
      400,
      `Массовое увольнение: ${summary.would_deactivate} из ${summary.active_with_number} активных. Требуется отдельное подтверждение.`,
      { summary, rows, deactivate },
    );
  }

  return withTransaction(pool, async (client) => {
    let created = 0;
    let updated = 0;
    let reactivated = 0;
    for (const row of rows) {
      if (row.existing_id) {
        await client.query(
          `UPDATE archrep.ar_employees
              SET employee_number = NULLIF(trim($1), ''),
                  full_name = $2,
                  email = NULLIF(lower(trim($3)), ''),
                  position = NULLIF(trim($4), ''),
                  department = NULLIF(trim($5), ''),
                  active = true,
                  updated_at = current_timestamp
            WHERE id = $6`,
          [
            row.employee_number,
            row.full_name,
            row.email,
            row.position,
            row.department,
            row.existing_id,
          ],
        );
        if (row.status === 'would_reactivate') reactivated += 1;
        else updated += 1;
      } else {
        await client.query(
          `INSERT INTO archrep.ar_employees
             (employee_number, full_name, email, position, department, active)
           VALUES (NULLIF(trim($1), ''), $2, NULLIF(lower(trim($3)), ''),
                   NULLIF(trim($4), ''), NULLIF(trim($5), ''), true)`,
          [row.employee_number, row.full_name, row.email, row.position, row.department],
        );
        created += 1;
      }
    }

    if (deactivate.length > 0) {
      await client.query(
        `UPDATE archrep.ar_employees
            SET active = false, updated_at = current_timestamp
          WHERE id = ANY($1::bigint[])`,
        [deactivate.map((employee) => employee.id)],
      );
    }

    return {
      summary: {
        ...summary,
        created,
        updated,
        reactivated,
        deactivated: deactivate.length,
      },
      rows,
      deactivate,
    };
  }, { stage: 'employee-import' });
}

module.exports = {
  MAX_FILE_BYTES,
  LARGE_DEACTIVATION_RATIO,
  HEADERS,
  EmployeeImportError,
  normalizeNumber,
  normalizeEmail,
  parseCsv,
  parseEmployeeCsv,
  buildTemplateCsv,
  validateEmployeeImport,
  applyEmployeeImport,
};



'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseCsv,
  parseEmployeeCsv,
  validateEmployeeImport,
  applyEmployeeImport,
  buildTemplateCsv,
} = require('../employeeImport');

const HEADER = 'Табельный номер;Сотрудник;Служебный адрес электронной почты;Должность;Подразделение';

function fakePool(rows) {
  return {
    query: async () => ({ rows }),
    connect: async () => ({
      query: async () => ({ rows, rowCount: 1 }),
      release: () => {},
    }),
  };
}

test('employee import: CSV с кавычками и разделителем ;', () => {
  const rows = parseCsv('a;"b;c";"d""e"\r\n1;2;3', ';');
  assert.deepEqual(rows, [['a', 'b;c', 'd"e'], ['1', '2', '3']]);
});

test('employee import: заголовки можно менять местами и использовать алиасы', () => {
  const csv = Buffer.from(
    'Сотрудник,Табельный номер,Должность,Подразделение,Email\n'
    + 'Иванов Иван,001234,Архитектор,Управление,ivanov@example.ru',
    'utf8',
  );
  const rows = parseEmployeeCsv(csv);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].employee_number, '001234');
  assert.equal(rows[0].full_name, 'Иванов Иван');
  assert.equal(rows[0].email, 'ivanov@example.ru');
});

test('employee import: без обязательных колонок — ошибка файла', () => {
  const csv = Buffer.from('Табельный номер;Сотрудник\n1;Иванов', 'utf8');
  assert.throws(() => parseEmployeeCsv(csv), /обязательных колонок/);
});

test('employee import: полная синхронизация считает create/update/deactivate', async () => {
  const csv = Buffer.from(
    `${HEADER}\n001;Иванов;ivanov@example.ru;Архитектор;Управление\n003;Петров;petrov@example.ru;Аналитик;Аналитика`,
    'utf8',
  );
  const pool = fakePool([
    { id: 1, employee_number: '001', full_name: 'Иванов', email: 'ivanov@example.ru', active: true },
    { id: 2, employee_number: '002', full_name: 'Сидоров', email: 'sidorov@example.ru', active: true },
    { id: 3, employee_number: null, full_name: 'Без номера', email: null, active: true },
  ]);
  const result = await validateEmployeeImport(pool, csv);
  assert.equal(result.summary.would_update, 1);
  assert.equal(result.summary.would_create, 1);
  assert.equal(result.summary.would_deactivate, 1);
  assert.equal(result.summary.untouched_without_number, 1);
  assert.deepEqual(result.deactivate.map((r) => r.employee_number), ['002']);
});

test('employee import: дубли номера в файле — ошибки строк', async () => {
  const csv = Buffer.from(
    `${HEADER}\n001;Иванов;ivanov@example.ru;Архитектор;Управление\n001;Петров;petrov@example.ru;Аналитик;Аналитика`,
    'utf8',
  );
  const result = await validateEmployeeImport(fakePool([]), csv);
  assert.equal(result.summary.errors, 2);
  assert.match(result.rows[0].errors.join(';'), /Дубль табельного номера/);
});

test('employee import: apply обновляет, создаёт и деактивирует отсутствующих', async () => {
  const csv = Buffer.from(
    `${HEADER}\n001;Иванов;ivanov@example.ru;Архитектор;Управление\n003;Петров;petrov@example.ru;Аналитик;Аналитика`,
    'utf8',
  );
  const calls = [];
  const pool = {
    query: async () => ({
      rows: [
        { id: 1, employee_number: '001', full_name: 'Иванов', email: 'ivanov@example.ru', active: true },
        { id: 2, employee_number: '002', full_name: 'Сидоров', email: 'sidorov@example.ru', active: true },
      ],
    }),
    connect: async () => ({
      query: async (sql) => {
        calls.push(sql);
        return { rows: [], rowCount: 1 };
      },
      release: () => {},
    }),
  };
  const result = await applyEmployeeImport(pool, csv, {
    confirmDeactivate: true,
    expectedDeactivateCount: 1,
  });
  assert.equal(result.summary.created, 1);
  assert.equal(result.summary.updated, 1);
  assert.equal(result.summary.deactivated, 1);
  assert.ok(calls.some((sql) => /active = false/.test(sql)));
});

test('employee import: шаблон CSV содержит BOM и заголовки', () => {
  const text = buildTemplateCsv();
  assert.ok(text.startsWith('\uFEFF'));
  assert.match(text, /Табельный номер;Сотрудник;Служебный адрес электронной почты;Должность;Подразделение/);
});

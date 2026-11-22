'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeInterfaceTypeIds,
  parseInterfaceTypeNames,
  resolveInterfaceTypeIds,
  syncSystemInterfaceTypes,
} = require('../systemInterfaceTypes.js');

test('normalizeInterfaceTypeIds: массив, строки, дубликаты → отсортированные числа', () => {
  assert.deepEqual(normalizeInterfaceTypeIds([3, '1', 3, '2']), [1, 2, 3]);
  assert.deepEqual(normalizeInterfaceTypeIds('4; 2, 4'), [2, 4]);
  assert.deepEqual(normalizeInterfaceTypeIds(null), []);
  assert.deepEqual(normalizeInterfaceTypeIds(''), []);
});

test('normalizeInterfaceTypeIds: нечисловой id — ошибка 400', () => {
  assert.throws(
    () => normalizeInterfaceTypeIds(['1', 'web']),
    (err) => err.statusCode === 400 && /web/.test(err.message),
  );
});

test('parseInterfaceTypeNames: разделители ; и , с обрезкой и дедупликацией', () => {
  assert.deepEqual(parseInterfaceTypeNames('Web; Mobile,Desktop'), ['Web', 'Mobile', 'Desktop']);
  assert.deepEqual(parseInterfaceTypeNames(' web ;; WEB ; '), ['web']);
  assert.deepEqual(parseInterfaceTypeNames(''), []);
  assert.deepEqual(parseInterfaceTypeNames(null), []);
});

test('resolveInterfaceTypeIds: названия → id по индексу, порядок по id', () => {
  const index = new Map([
    ['web', [{ id: 1, name: 'Web' }]],
    ['mobile', [{ id: 3, name: 'Mobile' }]],
    ['терминал', [{ id: 4, name: 'Терминал' }]],
  ]);
  assert.deepEqual(resolveInterfaceTypeIds(['Mobile', 'Web', 'Терминал'], index), [1, 3, 4]);
});

test('resolveInterfaceTypeIds: неизвестное и неоднозначное название — ошибка строки (400)', () => {
  const index = new Map([['web', [{ id: 1 }, { id: 2 }]]]);
  assert.throws(
    () => resolveInterfaceTypeIds(['Desktop'], index),
    (err) => err.status === 400 && /Desktop/.test(err.message),
  );
  assert.throws(
    () => resolveInterfaceTypeIds(['Web'], index),
    (err) => err.status === 400 && /неоднозначное/.test(err.message),
  );
});

test('syncSystemInterfaceTypes: удаляет связи и вставляет актуальный набор', async () => {
  const calls = [];
  const db = { query: async (sql, params) => { calls.push({ sql, params }); return { rows: [] }; } };
  const queries = {
    system_interface_type_links_delete: 'DELETE',
    system_interface_type_links_insert: 'INSERT',
  };

  await syncSystemInterfaceTypes(db, queries, 42, [1, 5]);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].sql, 'DELETE');
  assert.deepEqual(calls[0].params, [42]);
  assert.equal(calls[1].sql, 'INSERT');
  assert.deepEqual(calls[1].params, [42, [1, 5]]);
});

test('syncSystemInterfaceTypes: пустой набор — только удаление', async () => {
  const calls = [];
  const db = { query: async (sql) => { calls.push(sql); return { rows: [] }; } };
  const queries = {
    system_interface_type_links_delete: 'DELETE',
    system_interface_type_links_insert: 'INSERT',
  };

  await syncSystemInterfaceTypes(db, queries, 7, []);
  assert.deepEqual(calls, ['DELETE']);
});

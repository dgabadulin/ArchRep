'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MATRIX_SOURCE,
  classifySystemStatus,
  sortProductsByParam,
  sortFunctionsByParam,
  buildTargetArchitectureMatrix,
} = require('../targetArchitectureMatrix');

test('sortProductsByParam: порядок из системного параметра по коду/названию', () => {
  const products = [
    { id: 1, code: 'bs-a', name: 'А' },
    { id: 2, code: 'bs-b', name: 'Б' },
    { id: 3, code: 'bs-c', name: 'В' },
  ];

  assert.deepEqual(
    sortProductsByParam(products, ['bs-c', 'А']).map((p) => p.code),
    ['bs-c', 'bs-a', 'bs-b'],
  );
  assert.deepEqual(
    sortProductsByParam(products, '["bs-b","bs-a"]').map((p) => p.code),
    ['bs-b', 'bs-a', 'bs-c'],
  );
  assert.deepEqual(sortProductsByParam(products, []).map((p) => p.code), ['bs-a', 'bs-b', 'bs-c']);
});

test('sortFunctionsByParam: порядок строк из JSON {code, order} (issue #127)', () => {
  const functions = [
    { id: 1, code: 'BF-C', name: 'В' },
    { id: 2, code: 'BF-A', name: 'А' },
    { id: 3, code: 'BF-B', name: 'Б' },
  ];

  assert.deepEqual(
    sortFunctionsByParam(functions, [{ code: 'BF-B', order: 1 }, { code: 'BF-C', order: 2 }]).map((f) => f.code),
    ['BF-B', 'BF-C', 'BF-A'],
  );
  assert.deepEqual(
    sortFunctionsByParam(functions, '[{"code":"BF-A","order":10}]').map((f) => f.code),
    ['BF-A', 'BF-C', 'BF-B'],
  );
  // Пустой параметр — порядок backend-запроса не меняется.
  assert.deepEqual(sortFunctionsByParam(functions, '[]').map((f) => f.code), ['BF-C', 'BF-A', 'BF-B']);
});

test('classifySystemStatus: промышленная и опытная эксплуатация — green', () => {
  assert.equal(classifySystemStatus('В промышленной эксплуатации'), 'green');
  assert.equal(classifySystemStatus('В опытной эксплуатации'), 'green');
});

test('classifySystemStatus: новые и планируемые системы — orange', () => {
  assert.equal(classifySystemStatus('Планируется к внедрению'), 'orange');
  assert.equal(classifySystemStatus('В процессе внедрения'), 'orange');
  assert.equal(classifySystemStatus('Новая система'), 'orange');
  assert.equal(classifySystemStatus('Проектируется'), 'orange');
  assert.equal(classifySystemStatus('В разработке'), 'orange');
});

test('classifySystemStatus: вывод из эксплуатации, архив и пустой статус — neutral', () => {
  assert.equal(classifySystemStatus('Планируется к выводу из эксплуатации'), 'neutral');
  assert.equal(classifySystemStatus('Выведена из эксплуатации'), 'neutral');
  assert.equal(classifySystemStatus('В архивном режиме'), 'neutral');
  assert.equal(classifySystemStatus(''), 'neutral');
  assert.equal(classifySystemStatus(null), 'neutral');
});

test('buildTargetArchitectureMatrix: отдаёт данные только из целевой матрицы и тона статусов', async () => {
  const calls = [];
  const pool = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (/parent\.name AS parent_name/.test(sql)) {
        return { rows: [{ id: 10, name: 'Продажи', parent_id: 1, parent_name: 'Коммерция' }] };
      }
      if (/bs\.fullname/.test(sql)) {
        return { rows: [{ id: 20, code: 'bs-lcv-mcv', name: 'LCV, MCV (кроме Валдай)', fullname: null }] };
      }
      if (/ss\.name AS status/.test(sql)) {
        return {
          rows: [
            { id: 30, code: 'CRM', name: 'CRM', status: 'В промышленной эксплуатации' },
            { id: 31, code: 'NEW', name: 'Новая система', status: 'Планируется к внедрению' },
          ],
        };
      }
      if (/AS function_id/.test(sql)) {
        return { rows: [{ system_id: 30, function_id: 10 }] };
      }
      if (/AS business_service_id/.test(sql)) {
        return { rows: [{ system_id: 30, business_service_id: 20 }] };
      }
      throw new Error(`unexpected query: ${sql}`);
    },
  };

  const data = await buildTargetArchitectureMatrix(pool);

  assert.equal(data.source, MATRIX_SOURCE);
  assert.deepEqual(data.functions, [{ id: 10, name: 'Продажи', parent_id: 1, parent_name: 'Коммерция' }]);
  assert.deepEqual(data.products, [
    { id: 20, code: 'bs-lcv-mcv', name: 'LCV, MCV (кроме Валдай)', fullname: null },
  ]);
  assert.deepEqual(data.systems, [
    { id: 30, code: 'CRM', name: 'CRM', status: 'В промышленной эксплуатации', tone: 'green' },
    { id: 31, code: 'NEW', name: 'Новая система', status: 'Планируется к внедрению', tone: 'orange' },
  ]);
  assert.deepEqual(data.functionRelations, [{ system_id: 30, function_id: 10 }]);
  assert.deepEqual(data.productRelations, [{ system_id: 30, business_service_id: 20 }]);
  assert.equal(calls.length, 5);
  assert.ok(calls.every((call) => call.params[0] === MATRIX_SOURCE));
});

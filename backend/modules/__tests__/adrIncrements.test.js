'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeIncrementPayload,
  normalizeRelationEntry,
  normalizeSystemEntry,
  mergeAppliedHeader,
  extractMxfile,
  validateMxfile,
  buildFullSaveResponse,
} = require('../../adrIncrements');

const MXFILE = '<?xml version="1.0"?><mxfile><diagram><mxGraphModel><root/></mxGraphModel></diagram></mxfile>';

test('normalizeSystemEntry: client_ref модуля → local_key ядра', () => {
  const out = normalizeSystemEntry({ kind: 'new', client_ref: 'sys-1', name: 'Новая ИС' });
  assert.equal(out.local_key, 'sys-1');
  assert.equal(out.client_ref, 'sys-1');
});

test('normalizeSystemEntry: ядровый local_key сохраняется приоритетно', () => {
  const out = normalizeSystemEntry({ kind: 'new', local_key: 'core-key', client_ref: 'module-key' });
  assert.equal(out.local_key, 'core-key');
});

test('normalizeRelationEntry: from_ref/to_ref → from_new_key/to_new_key', () => {
  const out = normalizeRelationEntry({ from_ref: 'sys-1', to_ref: 'sys-2', name: 'Поток' });
  assert.equal(out.from_new_key, 'sys-1');
  assert.equal(out.to_new_key, 'sys-2');
});

test('normalizeRelationEntry: нечисловой id черновой системы уходит в ключ', () => {
  const out = normalizeRelationEntry({ from_ar_systems_id: 'draft-a', to_ar_systems_id: 10 });
  assert.equal(out.from_ar_systems_id, null);
  assert.equal(out.from_new_key, 'draft-a');
  assert.equal(out.to_ar_systems_id, 10);
  assert.equal(out.to_new_key, null);
});

test('normalizeIncrementPayload: смешанная форма (модуль + ручная форма)', () => {
  const [inc] = normalizeIncrementPayload([
    {
      name: 'Решение',
      order_index: 1,
      systems: [
        { kind: 'new', client_ref: 'n1', name: 'Система А', description: 'Описание' },
        { kind: 'existing', ar_systems_id: 5, local_key: 'e5' },
      ],
      relations: [{ from_ref: 'n1', to_ar_systems_id: 5 }],
    },
  ]);
  assert.equal(inc.systems[0].local_key, 'n1');
  assert.equal(inc.systems[0].description, 'Описание');
  assert.equal(inc.systems[1].local_key, 'e5');
  assert.equal(inc.relations[0].from_new_key, 'n1');
  assert.equal(inc.relations[0].to_new_key, null);
});

test('normalizeIncrementPayload: не-массив → пустой массив (не падает)', () => {
  assert.deepEqual(normalizeIncrementPayload(undefined), []);
  assert.deepEqual(normalizeIncrementPayload({ increments: [] }), []);
});

test('mergeAppliedHeader: тело { increments } не затирает шапку', () => {
  const currentRow = {
    task_name: 'Задача',
    task_link: 'https://tracker/1',
    conclusion: 'Вывод',
    author: 'Иванов',
    ar_adr_statuses_id: 3,
  };
  const header = mergeAppliedHeader({ increments: [] }, currentRow);
  assert.deepEqual(header, {
    task_name: 'Задача',
    task_link: 'https://tracker/1',
    conclusion: 'Вывод',
    author: 'Иванов',
    ar_adr_statuses_id: 3,
  });
});

test('mergeAppliedHeader: явно переданные поля (включая пустые) применяются', () => {
  const header = mergeAppliedHeader(
    { task_name: 'Новая', conclusion: '', ar_adr_statuses_id: 7 },
    { task_name: 'Старая', task_link: 'L', conclusion: 'C', author: 'A', ar_adr_statuses_id: 1 },
  );
  assert.equal(header.task_name, 'Новая');
  assert.equal(header.conclusion, '');
  assert.equal(header.task_link, 'L');
  assert.equal(header.author, 'A');
  assert.equal(header.ar_adr_statuses_id, 7);
});

test('extractMxfile: строка / отсутствие / неверный тип', () => {
  assert.equal(extractMxfile({ mxfile: MXFILE }).xml, MXFILE);
  assert.equal(extractMxfile({}).xml, null);
  assert.match(extractMxfile({ mxfile: 42 }).error, /строкой XML/);
});

test('validateMxfile: валидный mxfile и mxGraphModel', () => {
  assert.equal(validateMxfile(MXFILE, { maxBytes: 1024 * 1024 }).ok, true);
  assert.equal(validateMxfile('<mxGraphModel><root/></mxGraphModel>', { maxBytes: 1024 }).ok, true);
});

test('validateMxfile: чужой XML, DOCTYPE и превышение размера', () => {
  assert.match(validateMxfile('<html></html>', { maxBytes: 1024 }).error, /корневого элемента/);
  assert.match(
    validateMxfile('<!DOCTYPE x><mxfile/>', { maxBytes: 1024 }).error,
    /DOCTYPE/,
  );
  assert.match(validateMxfile(MXFILE, { maxBytes: 10 }).error, /превышает лимит/);
});

test('buildFullSaveResponse: модуль читает increment_id', () => {
  const out = buildFullSaveResponse({
    appliedId: 42,
    code: 'ADRA-1',
    increments: [{ id: 7, order_index: 1, name: 'Решение' }],
  });
  assert.equal(out.id, 42);
  assert.equal(out.code, 'ADRA-1');
  assert.equal(out.increment_id, 7);
  assert.deepEqual(out.increments, [{ id: 7, order_index: 1, name: 'Решение' }]);
});

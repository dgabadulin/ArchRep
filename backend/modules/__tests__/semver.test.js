'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { satisfies, parseVersion, compare } = require('../semver');

test('parseVersion: полная и частичная версия', () => {
  assert.deepEqual(parseVersion('1.2.3'), { major: 1, minor: 2, patch: 3 });
  assert.deepEqual(parseVersion('v1.0.0'), { major: 1, minor: 0, patch: 0 });
  assert.equal(parseVersion('1.0').major, 1);
  assert.equal(parseVersion('abc'), null);
});

test('compare: числовое сравнение без лексикографических ошибок', () => {
  assert.equal(compare(parseVersion('1.10.0'), parseVersion('1.9.9')), 1);
  assert.equal(compare(parseVersion('2.0.0'), parseVersion('2.0.0')), 0);
});

test('satisfies: диапазон из манифеста DrawIO Pro (>=1.0) при ядре 1.0.0', () => {
  assert.equal(satisfies('1.0.0', '>=1.0').ok, true);
  assert.equal(satisfies('1.0.0', '>=1.0 <2.0').ok, true);
  assert.equal(satisfies('2.1.0', '>=1.0 <2.0').ok, false);
});

test('satisfies: ^ и ~ (npm-семантика)', () => {
  assert.equal(satisfies('1.5.0', '^1.2.3').ok, true);
  assert.equal(satisfies('2.0.0', '^1.2.3').ok, false);
  assert.equal(satisfies('0.2.9', '^0.2.3').ok, true);
  assert.equal(satisfies('0.3.0', '^0.2.3').ok, false);
  assert.equal(satisfies('1.2.9', '~1.2.3').ok, true);
  assert.equal(satisfies('1.3.0', '~1.2.3').ok, false);
});

test('satisfies: wildcard и альтернативы', () => {
  assert.equal(satisfies('9.9.9', '*').ok, true);
  assert.equal(satisfies('1.4.0', '1.x').ok, true);
  assert.equal(satisfies('2.0.0', '1.x').ok, false);
  assert.equal(satisfies('3.0.0', '^1.0 || >=3.0').ok, true);
  assert.equal(satisfies('2.5.0', '^1.0 || >=3.0').ok, false);
});

test('satisfies: неподдерживаемая форма → ok=false с причиной', () => {
  const res = satisfies('1.0.0', 'latest');
  assert.equal(res.ok, false);
  assert.match(res.reason, /неподдерживаемый диапазон/);
});

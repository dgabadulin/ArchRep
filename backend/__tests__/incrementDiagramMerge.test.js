'use strict';

/**
 * Регрессия: при merge новых систем на схеме решения они не должны накладываться
 * на существующие узлы, координаты которых сохранены из предыдущего mxfile.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildMxfile, extractVertexGeometryMap } = require('../incrementDiagram.js');

function sys(id, name) {
  return { ar_systems_id: id, system_name: name, system_code: `S${id}`, comment: '' };
}

test('merge: новая система не пересекает сохранённые вершины', () => {
  const systems = [sys(1, '1C:ERP'), sys(2, '1C:HRM'), sys(3, '1C:KPI')];
  const geometryMap = new Map([
    ['sys-1', { x: 40, y: 40, width: 220, height: 110 }],
    ['sys-2', { x: 320, y: 40, width: 220, height: 110 }],
  ]);
  const xml = buildMxfile({
    systems,
    relations: [],
    solutionName: 'Тест',
    versionLabel: 'v1',
    geometryMap,
  });
  const geometry = extractVertexGeometryMap(xml);
  const a = geometry.get('sys-1');
  const b = geometry.get('sys-2');
  const c = geometry.get('sys-3');
  assert.deepEqual(a, { x: 40, y: 40, width: 220, height: 110 });
  assert.deepEqual(b, { x: 320, y: 40, width: 220, height: 110 });
  assert.ok(c, 'новая вершина должна быть в mxfile');

  const overlaps = (p, q) =>
    !(
      p.x + p.width <= q.x ||
      q.x + q.width <= p.x ||
      p.y + p.height <= q.y ||
      q.y + q.height <= p.y
    );
  assert.equal(overlaps(c, a), false, 'новая вершина пересекает sys-1');
  assert.equal(overlaps(c, b), false, 'новая вершина пересекает sys-2');
});

test('merge: уже сохранённое пересечение исправляется при обновлении', () => {
  const systems = [sys(1, 'A'), sys(2, 'B')];
  const geometryMap = new Map([
    ['sys-1', { x: 40, y: 40, width: 200, height: 100 }],
    ['sys-2', { x: 100, y: 60, width: 200, height: 100 }],
  ]);
  const xml = buildMxfile({
    systems,
    relations: [],
    solutionName: 'Тест',
    versionLabel: 'v1',
    geometryMap,
  });
  const geometry = extractVertexGeometryMap(xml);
  const a = geometry.get('sys-1');
  const b = geometry.get('sys-2');
  const overlaps = (p, q) =>
    !(
      p.x + p.width <= q.x ||
      q.x + q.width <= p.x ||
      p.y + p.height <= q.y ||
      q.y + q.height <= p.y
    );
  assert.equal(overlaps(a, b), false, 'сохранённое наложение должно быть исправлено');
});

test('merge: две новые системы не пересекаются между собой', () => {
  const systems = [sys(1, 'A'), sys(2, 'B'), sys(3, 'C')];
  const geometryMap = new Map([['sys-1', { x: 40, y: 40, width: 200, height: 100 }]]);
  const xml = buildMxfile({
    systems,
    relations: [],
    solutionName: 'Тест',
    versionLabel: 'v1',
    geometryMap,
  });
  const geometry = extractVertexGeometryMap(xml);
  const b = geometry.get('sys-2');
  const c = geometry.get('sys-3');
  assert.ok(b && c);
  const overlaps = (p, q) =>
    !(
      p.x + p.width <= q.x ||
      q.x + q.width <= p.x ||
      p.y + p.height <= q.y ||
      q.y + q.height <= p.y
    );
  assert.equal(overlaps(b, c), false);
  assert.equal(overlaps(b, geometry.get('sys-1')), false);
  assert.equal(overlaps(c, geometry.get('sys-1')), false);
});

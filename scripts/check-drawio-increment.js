#!/usr/bin/env node
'use strict';

/**
 * Проверка генерации схемы решения в draw.io (issue #93).
 *
 * 1) Разводка связей: встречные потоки A→B / B→A не накладываются, веер портов
 *    с одной грани разводится, ребро обходит чужой узел, self-loop строится.
 * 2) Маркеры функций в теле узла: + создаётся, • модифицируется, ✓ используется,
 *    - выводится, ? статус не задан; соответствие берётся из `DRAWIO_SYSFUNC_MARKERS`.
 * 3) Сборка mxfile: тело узла из функций (issue #93), легенда содержит блок «Функции:».
 *
 * Запуск: `npm run check:drawio`. При находках — код выхода 1.
 */

const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const { computeEdgeRoutes } = require(path.join(ROOT, 'backend', 'incrementDiagramLayout.js'));
const { buildMxfile } = require(path.join(ROOT, 'backend', 'incrementDiagram.js'));
const {
  formatSysFuncLines,
  formatSysFuncComment,
  resolveSysFuncMarkers,
} = require(path.join(ROOT, 'backend', 'sysFuncMarkers.js'));

let failures = 0;

function check(name, cond, details) {
  if (cond) {
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${name}${details ? ` — ${details}` : ''}`);
  }
}

/** Точка порта по относительным координатам стиля (одна из них 0/1 — грань фигуры). */
function portPoint(box, fx, fy) {
  return { x: box.x + box.width * fx, y: box.y + box.height * fy };
}

/** Полная ломаная ребра: выход → waypoints → вход. */
function polyline(route, fromBox, toBox) {
  const pts = [portPoint(fromBox, route.exitX, route.exitY)];
  for (const p of route.points || []) pts.push({ x: p.x, y: p.y });
  pts.push(portPoint(toBox, route.entryX, route.entryY));
  return pts;
}

/** Отрезки ломаной в нормализованном виде: ориентация, координата, диапазон. */
function segmentsOf(pts) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (Math.abs(a.x - b.x) < 0.01) {
      out.push({ orient: 'v', c: a.x, min: Math.min(a.y, b.y), max: Math.max(a.y, b.y) });
    } else if (Math.abs(a.y - b.y) < 0.01) {
      out.push({ orient: 'h', c: a.y, min: Math.min(a.x, b.x), max: Math.max(a.x, b.x) });
    }
  }
  return out;
}

/** Пары рёбер, у которых есть наложенные отрезки (одна линия поверх другой). */
function findOverlaps(routes, positions, relationById) {
  const entries = [...routes.entries()].map(([rid, route]) => {
    const rel = relationById.get(rid);
    const from = `sys-${rel.from_ar_systems_id}`;
    const to = `sys-${rel.to_ar_systems_id}`;
    return { rid, segs: segmentsOf(polyline(route, positions.get(from), positions.get(to))) };
  });
  const pairs = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      for (const s1 of entries[i].segs) {
        for (const s2 of entries[j].segs) {
          if (s1.orient !== s2.orient) continue;
          if (Math.abs(s1.c - s2.c) > 0.5) continue;
          if (Math.min(s1.max, s2.max) - Math.max(s1.min, s2.min) > 0.5) {
            pairs.push(`${entries[i].rid}~${entries[j].rid}`);
          }
        }
      }
    }
  }
  return [...new Set(pairs)];
}

function relationByIdOf(relations) {
  return new Map(relations.map((r) => [`rel-${r.id}`, r]));
}

function relation(id, from, to) {
  return { id, from_ar_systems_id: from, to_ar_systems_id: to };
}

const LAYOUT = { direction: 'LR', parallelEdgeGap: 12 };

// ============================================================
// 1. Встречные потоки A→B / B→A
// ============================================================
console.log('Разводка связей');
{
  const positions = new Map([
    ['sys-1', { x: 0, y: 0, width: 160, height: 80 }],
    ['sys-2', { x: 300, y: 0, width: 160, height: 80 }],
  ]);
  const relations = [relation(1, 1, 2), relation(2, 1, 2), relation(3, 2, 1), relation(4, 2, 1)];
  const routes = computeEdgeRoutes(positions, relations, LAYOUT);
  const overlaps = findOverlaps(routes, positions, relationByIdOf(relations));
  check('встречные потоки не накладываются', overlaps.length === 0, overlaps.join(', '));
  const keys = new Set([...routes.values()].map((r) => JSON.stringify(r)));
  check('у 4 связей 4 разных маршрута', keys.size === 4, `уникальных: ${keys.size}`);
}

// ============================================================
// 2. Веер из одного узла: порты на одной грани разведены
// ============================================================
{
  const positions = new Map([
    ['sys-1', { x: 0, y: 0, width: 160, height: 80 }],
    ['sys-2', { x: 300, y: -100, width: 160, height: 80 }],
    ['sys-3', { x: 300, y: 0, width: 160, height: 80 }],
    ['sys-4', { x: 300, y: 100, width: 160, height: 80 }],
  ]);
  const relations = [relation(1, 1, 2), relation(2, 1, 3), relation(3, 1, 4)];
  const routes = computeEdgeRoutes(positions, relations, LAYOUT);
  const exitYs = [...routes.values()].map((r) => r.exitY);
  check('веер: 3 разных точки выхода', new Set(exitYs).size === 3, exitYs.join(', '));
  const overlaps = findOverlaps(routes, positions, relationByIdOf(relations));
  check('веер: нет наложений', overlaps.length === 0, overlaps.join(', '));
}

// ============================================================
// 3. Обход чужого узла
// ============================================================
{
  const positions = new Map([
    ['sys-1', { x: 0, y: 0, width: 120, height: 80 }],
    ['sys-2', { x: 280, y: 0, width: 120, height: 80 }],
    ['sys-3', { x: 600, y: 0, width: 120, height: 80 }],
  ]);
  const relations = [relation(1, 1, 3)];
  const routes = computeEdgeRoutes(positions, relations, LAYOUT);
  const route = routes.get('rel-1');
  const pts = polyline(route, positions.get('sys-1'), positions.get('sys-3'));
  const blocker = positions.get('sys-2');
  const hitsBody = segmentsOf(pts).some((s) => {
    if (s.orient === 'v') {
      return s.c > blocker.x && s.c < blocker.x + blocker.width
        && Math.min(s.max, blocker.y + blocker.height) - Math.max(s.min, blocker.y) > 0.5;
    }
    return s.c > blocker.y && s.c < blocker.y + blocker.height
      && Math.min(s.max, blocker.x + blocker.width) - Math.max(s.min, blocker.x) > 0.5;
  });
  check('ребро 1→3 обходит узел 2', !hitsBody);
}

// ============================================================
// 4. Self-loop: ортогональность и порты
// ============================================================
{
  const positions = new Map([['sys-1', { x: 0, y: 0, width: 160, height: 80 }]]);
  const relations = [relation(1, 1, 1), relation(2, 1, 1)];
  const routes = computeEdgeRoutes(positions, relations, LAYOUT);
  check('self-loop: два разных маршрута', JSON.stringify(routes.get('rel-1')) !== JSON.stringify(routes.get('rel-2')));
}

/** Диагональные сегменты недопустимы: маршрут строго ортогональный. */
function hasDiagonal(pts) {
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = Math.abs(pts[i + 1].x - pts[i].x);
    const dy = Math.abs(pts[i + 1].y - pts[i].y);
    if (dx > 0.5 && dy > 0.5) return true;
  }
  return false;
}

{
  // Петля на узле, к которому приходит другая связь: порты не должны совпадать.
  const positions = new Map([
    ['sys-1', { x: 256, y: 40, width: 160, height: 104 }],
    ['sys-2', { x: 40, y: 224, width: 176, height: 72 }],
  ]);
  const relations = [relation(1, 1, 2), relation(2, 2, 2)];
  const routes = computeEdgeRoutes(positions, relations, LAYOUT);
  const overlaps = findOverlaps(routes, positions, relationByIdOf(relations));
  check('петля не садится на порт другой связи', overlaps.length === 0, overlaps.join(', '));
  const loopPts = polyline(routes.get('rel-2'), positions.get('sys-2'), positions.get('sys-2'));
  check('петля: сегменты ортогональны', !hasDiagonal(loopPts));
}

// ============================================================
// 5. Маркеры функций (DRAWIO_SYSFUNC_MARKERS)
// ============================================================
console.log('Маркеры функций');
{
  const lines = formatSysFuncLines([
    { name: 'Новая', increment_sysfunc_status_code: 'ADR_INCR_SYSFUNC_CREATING' },
    { name: 'Изменяемая', increment_sysfunc_status_code: 'ADR_INCR_SYSFUNC_MODIFYING' },
    { name: 'Существующая', increment_sysfunc_status_code: 'ADR_INCR_SYSFUNC_IN_USE' },
    { name: 'Удаляемая', increment_sysfunc_status_code: 'ADR_INCR_SYSFUNC_DECOMMISSIONING' },
    { name: 'Без статуса', increment_sysfunc_status_code: null },
    { name: 'Неизвестный', increment_sysfunc_status_code: 'ADR_INCR_SYSFUNC_UNKNOWN' },
  ]);
  check('новые функции с «+»', lines[0] === '+Новая;', lines[0]);
  check('изменяемые с «•» (U+2022)', lines[1] === '\u2022Изменяемая;', lines[1]);
  check('используемые с «✓» (U+2713)', lines[2] === '\u2713Существующая;', lines[2]);
  check('удаляемые с «-»', lines[3] === '-Удаляемая;', lines[3]);
  check('без статуса с «?»', lines[4] === '?Без статуса;', lines[4]);
  check('неизвестный статус с «?»', lines[5] === '?Неизвестный;', lines[5]);

  const custom = formatSysFuncComment(
    [{ name: 'Новая', increment_sysfunc_status_code: 'ADR_INCR_SYSFUNC_CREATING' }],
    (code, def) => (code === 'DRAWIO_SYSFUNC_MARKERS' ? { ADR_INCR_SYSFUNC_CREATING: '*' } : def),
  );
  check('маркеры переопределяются параметром', custom === '*Новая;', custom);
  check('дефолт параметра — 4 статуса', Object.keys(resolveSysFuncMarkers(() => undefined)).length === 4);
}

// ============================================================
// 6. Сборка mxfile: тело узла из функций + легенда
// ============================================================
console.log('Сборка mxfile');
{
  const systems = [
    {
      ar_systems_id: 1,
      system_name: 'Система А',
      status_code: 'ADR_INCR_SYS_IN_USE',
      comment: '-Устаревшее зеркало;',
      functions: [
        { name: 'Новая', increment_sysfunc_status_code: 'ADR_INCR_SYSFUNC_CREATING' },
        { name: 'Существующая', increment_sysfunc_status_code: 'ADR_INCR_SYSFUNC_IN_USE' },
      ],
    },
    { ar_systems_id: 2, system_name: 'Система Б', status_code: 'ADR_INCR_SYS_IN_USE', comment: '-Легаси;' },
  ];
  const relations = [relation(1, 1, 2)];
  const mxfile = buildMxfile({
    systems,
    relations,
    solutionName: 'Проверка',
    versionLabel: 'v1',
    getParam: () => undefined,
  });
  check('тело узла: «+» для новой функции', mxfile.includes('+Новая;'));
  check('тело узла: «✓» для используемой', mxfile.includes('\u2713Существующая;'));
  check('легаси-комментарий — с маркером «?»', mxfile.includes('?Легаси;'));
  check('легенда содержит блок «Функции:»', mxfile.includes('Функции:'));
  check('легенда не расширяет лист', /pageHeight="827"/.test(mxfile));
}

if (failures) {
  console.error(`\nПроверка не пройдена: ${failures} замечан.`);
  process.exit(1);
}
console.log('\nВсе проверки пройдены.');

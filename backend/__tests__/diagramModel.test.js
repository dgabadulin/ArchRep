'use strict';

/**
 * Тесты модели диаграммы решения (`frontend-v3/src/utils/diagramModel.js`).
 *
 * Модель — ESM (используется палитрой в браузере), поэтому подключается динамическим import().
 * Главная проверка — совместимость с серверным генератором `backend/incrementDiagram.js`:
 * диаграмма, собранная ядром (`buildMxfile`), должна разбираться обратно в тот же состав,
 * иначе «Заполнить из диаграммы» не сможет прочитать схему.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

const { buildMxfile } = require('../incrementDiagram.js');

const MODEL_PATH = path.resolve(__dirname, '..', '..', 'frontend-v3', 'src', 'utils', 'diagramModel.js');
const modelPromise = import(pathToFileURL(MODEL_PATH).href);

test('ids: sys-/rel-/draft-* и разбор обратно', async () => {
  const m = await modelPromise;
  assert.equal(m.systemCellId({ id: 12 }), 'sys-12');
  assert.equal(m.systemCellId({ draftKey: 'abc' }), 'draft-sys-abc');
  assert.equal(m.relationCellId({ id: 7 }), 'rel-7');
  assert.equal(m.relationCellId({ draftKey: 'k1' }), 'draft-rel-k1');

  assert.deepEqual(m.parseCellId('sys-12'), { type: 'system', kind: 'existing', id: '12', draftKey: null });
  assert.deepEqual(m.parseCellId('draft-sys-abc'), { type: 'system', kind: 'new', id: null, draftKey: 'abc' });
  assert.deepEqual(m.parseCellId('rel-7'), { type: 'relation', kind: 'existing', id: '7', draftKey: null });
  // Легенда и служебные ячейки не должны распознаваться как объекты ИСАР.
  assert.equal(m.parseCellId('ar-leg-3').type, null);
  assert.equal(m.parseCellId('sys-legend').type, null);
  assert.equal(m.isDraftId('draft-sys-abc'), true);
  assert.equal(m.isDraftId('sys-1'), false);
});

test('значение узла: рендер/разбор совместимы с серверным buildNodeHtmlValue', async () => {
  const m = await modelPromise;
  const value = m.renderSystemNodeValue('CRM', ['+Ф-я 1;', '\u2713Ф-я 2;']);

  // Рендер — это XML-атрибут, поэтому HTML экранирован (одно экранирование, как на сервере).
  assert.match(value, /^&lt;div style=&quot;text-align:center;/);
  const html = m.unescapeXml(value);
  assert.match(html, /<div style="text-align:center;font-size:14px;"><b>CRM<\/b><\/div>/);
  assert.match(html, /<br\/>/);

  const back = m.decodeNodeValue(value);
  assert.equal(back.title, 'CRM');
  assert.deepEqual(back.lines, ['+Ф-я 1;', '\u2713Ф-я 2;']);

  // Маркеры превращаются в коды статусов, неизвестный маркер даёт null.
  const map = m.markerToStatusCodeMap(m.DEFAULT_SYSFUNC_MARKERS);
  assert.deepEqual(m.parseSysFuncLine('+Новая;', map), { name: 'Новая', statusCode: 'ADR_INCR_SYSFUNC_CREATING' });
  assert.deepEqual(m.parseSysFuncLine('Без статуса;', map), { name: 'Без статуса', statusCode: null });
});

test('parseMxfile читает диаграмму, собранную ядром (buildMxfile)', async () => {
  const m = await modelPromise;
  const xml = buildMxfile({
    systems: [
      {
        ar_systems_id: 1,
        system_name: 'CRM',
        system_code: 'SYS-1',
        status_code: 'ADR_INCR_SYS_IN_USE',
        functions: [{ name: 'Ведение клиентов', increment_sysfunc_status_code: 'ADR_INCR_SYSFUNC_IN_USE' }],
      },
      { ar_systems_id: 2, system_name: 'ERP', system_code: 'SYS-2', status_code: 'ADR_INCR_SYS_CREATING' },
    ],
    relations: [
      {
        id: 55,
        name: 'Заявки',
        from_ar_systems_id: 1,
        to_ar_systems_id: 2,
        increment_relation_status_code: 'ADR_INCR_REL_CREATING',
      },
    ],
    solutionName: 'Решение 1',
    versionLabel: 'v1',
  });

  const model = m.parseMxfile(xml);
  assert.equal(model.systems.length, 2, 'легенда не должна попадать в системы');
  const crm = model.systems.find((s) => s.id === '1');
  assert.ok(crm, 'система sys-1 найдена');
  assert.equal(crm.label, 'CRM');
  assert.equal(crm.kind, 'existing');
  assert.equal(crm.functions.length, 1);
  assert.equal(crm.functions[0].name, 'Ведение клиентов');
  assert.equal(crm.functions[0].statusCode, 'ADR_INCR_SYSFUNC_IN_USE');

  assert.equal(model.relations.length, 1);
  assert.equal(model.relations[0].id, '55');
  assert.equal(model.relations[0].fromRef, 'sys-1');
  assert.equal(model.relations[0].toRef, 'sys-2');
});

test('roundtrip: модель → mxfile → модель (раскладка и статусы сохраняются)', async () => {
  const m = await modelPromise;
  const source = {
    systems: [
      { ref: 'sys-1', kind: 'existing', id: '1', label: 'CRM', statusCode: 'ADR_INCR_SYS_IN_USE', functions: [] },
      { ref: 'draft-sys-a', kind: 'new', draftKey: 'a', label: 'Новая ИС', statusCode: 'ADR_INCR_SYS_CREATING', functions: [] },
    ],
    relations: [
      {
        ref: 'draft-rel-r', kind: 'new', draftKey: 'r', label: 'Поток', statusCode: 'ADR_INCR_REL_CREATING',
        fromRef: 'sys-1', toRef: 'draft-sys-a',
      },
    ],
  };
  const xml = m.buildDiagramMxfile(source, { markers: m.DEFAULT_SYSFUNC_MARKERS, name: 'Черновик' });
  const back = m.parseMxfile(xml);

  assert.equal(back.systems.length, 2);
  assert.equal(back.systems.find((s) => s.ref === 'sys-1').statusCode, 'ADR_INCR_SYS_IN_USE');
  const draft = back.systems.find((s) => s.ref === 'draft-sys-a');
  assert.equal(draft.kind, 'new');
  assert.equal(draft.draftKey, 'a');
  assert.equal(draft.label, 'Новая ИС');
  assert.equal(back.relations.length, 1);
  assert.equal(back.relations[0].fromRef, 'sys-1');
  assert.equal(back.relations[0].toRef, 'draft-sys-a');
});

test('extractGeometry сохраняет позиции узлов (для «Обновить» без потери раскладки)', async () => {
  const m = await modelPromise;
  const model = {
    systems: [{ ref: 'sys-1', kind: 'existing', id: '1', label: 'CRM', statusCode: 'ADR_INCR_SYS_IN_USE', functions: [] }],
    relations: [],
  };
  const xml = m.buildDiagramMxfile(model, { name: 'x' });
  const geo = m.extractGeometry(xml);
  const node = geo.nodes.get('sys-1');
  assert.ok(node, 'позиция sys-1 извлечена');
  assert.equal(typeof node.x, 'number');
  assert.equal(typeof node.width, 'number');

  // Пользователь подвинул узел — после «Обновить» координата должна остаться.
  const moved = m.extractGeometry(xml.replace(/x="40"/, 'x="321"'));
  const rebuilt = m.buildDiagramMxfile(model, { name: 'x', geometry: moved });
  assert.match(rebuilt, /x="321"/);
});

test('remapCellIds: черновые id → реальные (id/source/target), value не трогается', async () => {
  const m = await modelPromise;
  const xml = m.buildDiagramMxfile(
    {
      systems: [
        { ref: 'draft-sys-a', kind: 'new', draftKey: 'a', label: 'Новая', statusCode: 'ADR_INCR_SYS_CREATING', functions: [] },
        { ref: 'sys-1', kind: 'existing', id: '1', label: 'CRM', statusCode: 'ADR_INCR_SYS_IN_USE', functions: [] },
      ],
      relations: [
        {
          ref: 'draft-rel-r', kind: 'new', draftKey: 'r', label: 'Поток', statusCode: 'ADR_INCR_REL_CREATING',
          fromRef: 'sys-1', toRef: 'draft-sys-a',
        },
      ],
    },
    { name: 'x' },
  );
  const out = m.remapCellIds(xml, { 'draft-sys-a': 'sys-99', 'draft-rel-r': 'rel-77' });
  assert.match(out, /id="sys-99"/);
  assert.match(out, /id="rel-77"/);
  assert.match(out, /target="sys-99"/);
  assert.doesNotMatch(out, /draft-sys-a/);
  assert.doesNotMatch(out, /draft-rel-r/);
  assert.match(out, /Новая/, 'подпись узла не изменилась');
});

test('parseMxfile понимает формат модуля (<object> с isar*-атрибутами)', async () => {
  const m = await modelPromise;
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?><mxfile><diagram id="d" name="n"><mxGraphModel><root>',
    '<mxCell id="0"/><mxCell id="1" parent="0"/>',
    '<object id="sys-5" label="СУД" isarType="system" isarKind="existing" isarSysId="5">',
    '<mxCell style="rounded=1;" vertex="1" parent="1"><mxGeometry x="10" y="20" width="100" height="50" as="geometry"/></mxCell>',
    '</object>',
    '<object id="rel-9" label="Поток" isarType="relation" isarKind="new" isarFlowId="77">',
    '<mxCell style="" edge="1" parent="1" source="sys-5" target="sys-6"><mxGeometry relative="1" as="geometry"/></mxCell>',
    '</object>',
    '</root></mxGraphModel></diagram></mxfile>',
  ].join('');

  const model = m.parseMxfile(xml);
  assert.equal(model.systems.length, 1);
  assert.equal(model.systems[0].id, '5');
  assert.equal(model.systems[0].label, 'СУД');
  assert.equal(model.relations.length, 1);
  assert.equal(model.relations[0].flowId, '77');
  assert.equal(model.relations[0].fromRef, 'sys-5');
});



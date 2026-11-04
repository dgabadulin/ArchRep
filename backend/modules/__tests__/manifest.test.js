'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  readManifest,
  normalizeLegacyManifest,
  validateManifest,
  discoverModuleCodes,
} = require('../manifest');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'isar-module-'));
}

function writeJson(dir, name, value) {
  fs.writeFileSync(path.join(dir, name), JSON.stringify(value, null, 2), 'utf8');
}

const VALID_MODULE_JSON = {
  code: 'demo-mod',
  name: 'Demo Module',
  version: '0.1.0',
  requiresCore: '>=1.0',
  type: 'hybrid',
  entry: 'index.js',
  frontend: 'frontend/index.js',
  permissions: ['demo_mod:manage'],
  surfaces: [{ point: 'adrAppliedForm.actions', component: 'DemoButton' }],
};

test('readManifest: валидный module.json', () => {
  const dir = tmpDir();
  writeJson(dir, 'module.json', VALID_MODULE_JSON);
  const res = readManifest(dir);
  assert.equal(res.ok, true);
  assert.equal(res.legacy, false);
  assert.equal(res.manifest.code, 'demo-mod');
  assert.equal(res.manifest.permissions[0], 'demo_mod:manage');
});

test('readManifest: legacy manifest.json маппится в контракт (id/permissionsProvided/surface)', () => {
  const dir = tmpDir();
  writeJson(dir, 'manifest.json', {
    id: 'drawio-pro',
    name: 'DrawIO Pro',
    version: '0.1.0',
    requiresCore: '>=1.0',
    type: 'module',
    permissionsProvided: ['drawio_pro:manage'],
    surface: {
      adrAppliedForm: {
        action: 'fillFromDiagram',
        label: 'Заполнить из диаграммы',
        requiredPermission: 'adr_applied:write',
        toolbar: true,
      },
    },
  });
  const res = readManifest(dir);
  assert.equal(res.ok, true);
  assert.equal(res.legacy, true);
  assert.equal(res.manifest.code, 'drawio-pro');
  assert.equal(res.manifest.type, 'hybrid');
  assert.deepEqual(res.manifest.permissions, ['drawio_pro:manage']);
  // legacy-адаптер fail-closed по лицензии: без явного license считаем её обязательной
  assert.deepEqual(res.manifest.license, { required: true, product: 'drawio-pro' });
  const points = res.manifest.surfaces.map((s) => s.point).sort();
  assert.deepEqual(points, ['adrAppliedForm.actions', 'diagramEditor.toolbar']);
});

test('normalizeLegacyManifest: без surfaces/surface не падает', () => {
  const m = normalizeLegacyManifest({ id: 'x-mod', name: 'X', version: '1.0.0' });
  assert.deepEqual(m.surfaces, []);
  assert.equal(m.requiresCore, '>=1.0');
});

test('readManifest: битый JSON → ok=false и ядро не падает', () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, 'module.json'), '{ не json ', 'utf8');
  const res = readManifest(dir);
  assert.equal(res.ok, false);
  assert.match(res.errors[0], /не читается/);
});

test('validateManifest: обязательные поля и kebab-case', () => {
  assert.deepEqual(validateManifest(VALID_MODULE_JSON), []);
  const errors = validateManifest({ code: 'Bad_Code', name: '', version: '', type: 'nope' });
  assert.ok(errors.some((e) => e.includes('kebab-case')));
  assert.ok(errors.some((e) => e.includes('name')));
  assert.ok(errors.some((e) => e.includes('requiresCore')));
  assert.ok(errors.some((e) => e.includes('type')));
});

test('validateManifest: frontend обязателен для hybrid', () => {
  const m = { ...VALID_MODULE_JSON, frontend: null };
  assert.ok(validateManifest(m).some((e) => e.includes('frontend')));
});

test('discoverModuleCodes: зависимости @isar/* и каталог modules', () => {
  const root = tmpDir();
  writeJson(root, 'package.json', {
    name: 'core',
    version: '1.0.0',
    dependencies: { '@isar/from-deps': '0.1.0' },
  });
  const modulesDir = path.join(root, 'modules');
  fs.mkdirSync(path.join(modulesDir, 'from-dir'), { recursive: true });
  const codes = discoverModuleCodes({ rootDir: root, modulesDir, extraCodes: ['from-env'] });
  assert.ok(codes.includes('from-deps'));
  assert.ok(codes.includes('from-dir'));
  assert.ok(codes.includes('from-env'));
});

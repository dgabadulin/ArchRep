'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  registerModules,
  getPublicModulesConfig,
  listModules,
  legacyModuleCodes,
  resetModules,
} = require('../index');
const { clearLicenseCache } = require('../license');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'isar-loader-'));
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content, null, 2), 'utf8');
}

/** Минимальный Express-совместимый двойник: только регистрация маршрутов. */
function fakeApp() {
  const routes = [];
  const add = (method) => (routePath, ...handlers) => routes.push({ method, path: routePath, handlers });
  return {
    routes,
    get: add('GET'),
    post: add('POST'),
    put: add('PUT'),
    patch: add('PATCH'),
    delete: add('DELETE'),
    use() {},
  };
}

function fakePool(rows = []) {
  return {
    async query(sql, params) {
      if (/FROM archrep\.isar_modules\s+ORDER BY code/i.test(sql)) return { rows };
      return { rows: [{ code: params && params[0] }] };
    },
  };
}

/** Создать временный «корень ядра» с модулем в modules/<code>. */
function makeRoot({ code = 'demo-mod', moduleJson, manifestJson, indexJs, deps = {} } = {}) {
  const root = tmpDir();
  write(path.join(root, 'package.json'), {
    name: 'archrep-test-core',
    version: '1.0.0',
    dependencies: { [`@isar/${code}`]: 'file:./modules/' + code, ...deps },
  });
  const dir = path.join(root, 'modules', code);
  if (moduleJson) write(path.join(dir, 'module.json'), moduleJson);
  if (manifestJson) write(path.join(dir, 'manifest.json'), manifestJson);
  write(
    path.join(dir, 'index.js'),
    indexJs || `module.exports = {
      handlers: {
        manifest(req, res) { res.json({ active: true, name: 'Demo' }); },
        parse(req, res) { res.json({ ok: true }); },
      },
      moduleInfo() { return { name: 'Demo', version: '0.1.0', active: true }; },
    };`,
  );
  return { root, dir };
}

const DEMO_MODULE_JSON = {
  code: 'demo-mod',
  name: 'Demo Module',
  version: '0.1.0',
  requiresCore: '>=1.0',
  type: 'hybrid',
  entry: 'index.js',
  frontend: 'frontend/index.js',
  permissions: ['demo_mod:manage'],
  surfaces: [{ point: 'adrAppliedForm.actions', component: 'DemoButton' }],
  license: { required: false },
  endpoints: [
    { method: 'GET', path: '/api/demo-mod/manifest' },
    { method: 'POST', path: '/api/demo-mod/parse' },
  ],
};

const silentLogger = { log() {}, warn() {}, error() {}, debug() {} };

test.beforeEach(() => {
  resetModules();
  clearLicenseCache();
});

test('registerModules: включённый модуль монтирует маршруты и попадает в /api/config', async () => {
  const { root } = makeRoot({ moduleJson: DEMO_MODULE_JSON });
  const app = fakeApp();
  await registerModules(app, {
    db: fakePool(),
    logger: silentLogger,
    rootDir: root,
    env: { ENABLED_MODULES: 'demo-mod' },
  });

  assert.equal(app.routes.length, 2);
  assert.deepEqual(app.routes.map((r) => `${r.method} ${r.path}`).sort(), [
    'GET /api/demo-mod/manifest',
    'POST /api/demo-mod/parse',
  ]);
  assert.deepEqual(getPublicModulesConfig()['demo-mod'], {
    enabled: true,
    licensed: true,
    edition: 'free',
    expires_at: null,
  });
  assert.equal(listModules()[0].mounted, 2);
});

test('registerModules: выключенный модуль маршруты не монтирует', async () => {
  const { root } = makeRoot({ moduleJson: DEMO_MODULE_JSON });
  const app = fakeApp();
  await registerModules(app, { db: fakePool(), logger: silentLogger, rootDir: root, env: {} });
  assert.equal(app.routes.length, 0);
  assert.equal(getPublicModulesConfig()['demo-mod'].enabled, false);
});

test('registerModules: requiresCore не удовлетворён — остальные модули работают', async () => {
  const root = tmpDir();
  write(path.join(root, 'package.json'), {
    name: 'core',
    version: '1.0.0',
    dependencies: { '@isar/too-new': 'file:./modules/too-new', '@isar/demo-mod': 'file:./modules/demo-mod' },
  });
  write(path.join(root, 'modules', 'too-new', 'module.json'), {
    ...DEMO_MODULE_JSON,
    code: 'too-new',
    requiresCore: '>=2.0',
    endpoints: [{ method: 'POST', path: '/api/too-new/parse' }],
  });
  write(path.join(root, 'modules', 'too-new', 'index.js'), 'module.exports = { handlers: { parse() {} } };');
  write(path.join(root, 'modules', 'demo-mod', 'module.json'), DEMO_MODULE_JSON);
  write(path.join(root, 'modules', 'demo-mod', 'index.js'),
    'module.exports = { handlers: { manifest(){}, parse(){} } };');

  const logs = [];
  const app = fakeApp();
  await registerModules(app, {
    db: fakePool(),
    logger: { log() {}, warn: (...a) => logs.push(a.join(' ')), error: (...a) => logs.push(a.join(' ')), debug() {} },
    rootDir: root,
    env: { ENABLED_MODULES: 'too-new,demo-mod' },
  });

  const routes = app.routes.map((r) => `${r.method} ${r.path}`);
  assert.ok(routes.includes('POST /api/demo-mod/parse'));
  assert.ok(!routes.some((r) => r.includes('/api/too-new/')));
  assert.ok(logs.some((l) => /\[modules\] too-new: requires core >=2\.0, have 1\.0\.0/.test(l)));
  assert.equal(getPublicModulesConfig()['too-new'].enabled, false);
});

test('registerModules: отсутствующий пакет — лог и enabled=false', async () => {
  const root = tmpDir();
  write(path.join(root, 'package.json'), {
    name: 'core',
    version: '1.0.0',
    dependencies: { '@isar/ghost-mod': '0.1.0' },
  });
  const logs = [];
  const app = fakeApp();
  await registerModules(app, {
    db: fakePool(),
    logger: { log() {}, warn: (...a) => logs.push(a.join(' ')), error: (...a) => logs.push(a.join(' ')), debug() {} },
    rootDir: root,
    env: { ENABLED_MODULES: 'ghost-mod' },
  });
  assert.equal(app.routes.length, 0);
  assert.ok(logs.some((l) => /ghost-mod: пакет не найден/.test(l)));
  assert.equal(getPublicModulesConfig()['ghost-mod'].enabled, false);
  assert.equal(listModules()[0].error, 'package-not-found');
});

test('registerModules: legacy manifest.json применяется через адаптер', async () => {
  const { root } = makeRoot({
    manifestJson: {
      id: 'demo-mod',
      name: 'Demo Module',
      version: '0.1.0',
      requiresCore: '>=1.0',
      type: 'module',
      permissionsProvided: ['demo_mod:manage'],
      surface: { adrAppliedForm: { action: 'fillFromDiagram', requiredPermission: 'adr_applied:write' } },
      endpoints: [{ method: 'GET', path: '/api/demo-mod/manifest' }],
    },
  });
  const app = fakeApp();
  await registerModules(app, {
    db: fakePool(),
    logger: silentLogger,
    rootDir: root,
    env: { ENABLED_MODULES: 'demo-mod' },
  });
  assert.deepEqual(legacyModuleCodes(), ['demo-mod']);
  assert.equal(app.routes.length, 1);
  assert.deepEqual(listModules()[0].manifest.permissions, ['demo_mod:manage']);
  // Платный legacy-модуль без ключа: маршруты смонтированы, но гейт вернёт 402.
  assert.equal(getPublicModulesConfig()['demo-mod'].licensed, false);
});

test('gate: без лицензии маршруты отвечают 402, /manifest отдаёт статус ядра', async () => {
  const { root } = makeRoot({
    moduleJson: { ...DEMO_MODULE_JSON, license: { required: true, product: 'demo-mod' } },
  });
  const app = fakeApp();
  await registerModules(app, {
    db: fakePool(),
    logger: silentLogger,
    rootDir: root,
    env: { ENABLED_MODULES: 'demo-mod' },
  });

  const cfg = getPublicModulesConfig()['demo-mod'];
  assert.equal(cfg.enabled, true);
  assert.equal(cfg.licensed, false);

  const parseRoute = app.routes.find((r) => r.path === '/api/demo-mod/parse');
  const gate = parseRoute.handlers[0];
  const res = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  let nextCalled = false;
  gate({}, res, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 402);
  assert.match(res.body.error, /не лицензирован/);

  // /manifest: модуль v0.1.0 отдаёт active: true безусловно — ядро подменяет статусом реестра
  const manifestRoute = app.routes.find((r) => r.path === '/api/demo-mod/manifest');
  const out = { body: null, json(payload) { this.body = payload; return this; } };
  manifestRoute.handlers[0]({}, out);
  assert.equal(out.body.active, false);
  assert.equal(out.body.licensed, false);
  assert.equal(out.body.enabled, true);
});

test('лицензия из env SYS_MODULE_demo_mod_LICENSE → licensed=true, маршруты доступны', async () => {
  const { root } = makeRoot({
    moduleJson: { ...DEMO_MODULE_JSON, license: { required: true, product: 'demo-mod' } },
  });
  const payload = Buffer.from(JSON.stringify({ product: 'demo-mod', instance_id: '*' }), 'utf8').toString('base64url');
  const prevKey = process.env.SYS_MODULE_demo_mod_LICENSE;
  const prevAllow = process.env.SYS_MODULE_LICENSE_ALLOW_UNVERIFIED;
  process.env.SYS_MODULE_demo_mod_LICENSE = `${payload}.x`;
  process.env.SYS_MODULE_LICENSE_ALLOW_UNVERIFIED = 'true';
  try {
    const app = fakeApp();
    await registerModules(app, {
      db: fakePool(),
      logger: silentLogger,
      rootDir: root,
      env: { ENABLED_MODULES: 'demo-mod' },
    });
    assert.equal(getPublicModulesConfig()['demo-mod'].licensed, true);

    const parseRoute = app.routes.find((r) => r.path === '/api/demo-mod/parse');
    let nextCalled = false;
    parseRoute.handlers[0]({}, {}, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
  } finally {
    if (prevKey === undefined) delete process.env.SYS_MODULE_demo_mod_LICENSE;
    else process.env.SYS_MODULE_demo_mod_LICENSE = prevKey;
    if (prevAllow === undefined) delete process.env.SYS_MODULE_LICENSE_ALLOW_UNVERIFIED;
    else process.env.SYS_MODULE_LICENSE_ALLOW_UNVERIFIED = prevAllow;
  }
});

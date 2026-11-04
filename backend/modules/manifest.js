'use strict';

/**
 * Манифест подключаемого модуля (docs/modules-contract.md §3).
 *
 * Основной формат — `module.json` в корне пакета модуля.
 * Временный legacy-адаптер: если `module.json` нет, но есть `manifest.json`
 * (`id` / `permissionsProvided` / `surface`), он маппится в контрактную форму.
 * Адаптер нужен, пока модули не приведены к контракту (§16.6 «Известные расхождения»).
 */

const fs = require('fs');
const path = require('path');

const MODULE_TYPES = new Set(['external', 'backend', 'frontend', 'hybrid']);
const KEBAB_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * @param {string} code
 * @returns {boolean}
 */
function isKebabCode(code) {
  return typeof code === 'string' && KEBAB_RE.test(code);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * Преобразовать legacy `manifest.json` (v0.1 модуля DrawIO Pro) в `module.json`.
 *
 * @param {object} raw
 * @returns {object} манифест в контрактной форме
 */
function normalizeLegacyManifest(raw) {
  const code = String(raw.id || raw.code || '').trim();
  const surfaces = [];
  if (Array.isArray(raw.surfaces)) {
    for (const s of raw.surfaces) surfaces.push({ ...s });
  } else if (raw.surface && typeof raw.surface === 'object') {
    // { adrAppliedForm: { action, label, requiredPermission, opensEditor, toolbar } }
    for (const [screen, desc] of Object.entries(raw.surface)) {
      if (!desc || typeof desc !== 'object') continue;
      if (desc.action) {
        surfaces.push({
          point: `${screen}.actions`,
          component: desc.component || null,
          action: desc.action,
          label: desc.label || null,
          requiredPermission: desc.requiredPermission || null,
        });
      }
      if (desc.toolbar === true) {
        surfaces.push({
          point: 'diagramEditor.toolbar',
          component: desc.toolbarComponent || null,
          requiredPermission: desc.requiredPermission || null,
        });
      }
    }
  }

  const type = MODULE_TYPES.has(raw.type) ? raw.type
    : (raw.type === 'module' || raw.type == null ? 'hybrid' : 'hybrid');

  return {
    code,
    name: raw.name || code,
    version: raw.version || '0.0.0',
    requiresCore: raw.requiresCore || '>=1.0',
    type,
    entry: raw.entry || 'index.js',
    frontend: raw.frontend || (type === 'backend' ? null : 'frontend/index.js'),
    permissions: asArray(raw.permissions).length ? raw.permissions : asArray(raw.permissionsProvided),
    menu: asArray(raw.menu),
    surfaces,
    config: asArray(raw.config),
    /**
     * Legacy-манифест не умеет объявлять лицензию, а первый такой модуль — платный.
     * Поэтому адаптер **fail-closed**: без явного `license` считаем, что лицензия обязательна.
     * Приведение к контракту (`module.json`) снимает это допущение — там `license` объявляется явно.
     */
    license: raw.license && typeof raw.license === 'object'
      ? raw.license
      : { required: true, product: code },
    schema: raw.schema || null,
    /** Маршруты, которые модуль монтирует сам (legacy-манифест): нужны check:routes и адаптеру. */
    endpoints: asArray(raw.endpoints),
    /** Маршруты в контрактной форме: [{ method, path, handler, permission }] (задел на будущее). */
    routes: asArray(raw.routes),
  };
}

/**
 * Валидация манифеста в контрактной форме.
 * @param {object} m
 * @returns {string[]} ошибки (пусто — валиден)
 */
function validateManifest(m) {
  const errors = [];
  if (!m || typeof m !== 'object') return ['манифест не является объектом'];
  if (!m.code) errors.push('не задано поле code');
  else if (!isKebabCode(m.code)) errors.push(`code «${m.code}» должен быть в kebab-case (a-z, 0-9, дефисы)`);
  if (!m.name) errors.push('не задано поле name');
  if (!m.version) errors.push('не задано поле version');
  if (!m.requiresCore) errors.push('не задано поле requiresCore');
  if (!m.type) errors.push('не задано поле type');
  else if (!MODULE_TYPES.has(m.type)) {
    errors.push(`type «${m.type}» недопустим (external | backend | frontend | hybrid)`);
  }
  if ((m.type === 'backend' || m.type === 'hybrid') && !m.entry) {
    errors.push('для backend/hybrid обязательно поле entry');
  }
  if ((m.type === 'frontend' || m.type === 'hybrid') && !m.frontend) {
    errors.push('для frontend/hybrid обязательно поле frontend');
  }
  if (m.permissions != null && !Array.isArray(m.permissions)) errors.push('permissions должен быть массивом');
  if (m.surfaces != null && !Array.isArray(m.surfaces)) errors.push('surfaces должен быть массивом');
  if (Array.isArray(m.surfaces)) {
    for (const [i, s] of m.surfaces.entries()) {
      if (!s || typeof s !== 'object') errors.push(`surfaces[${i}] должен быть объектом`);
      else if (!s.point) errors.push(`surfaces[${i}]: не задано point`);
    }
  }
  return errors;
}

function readJson(file) {
  const text = fs.readFileSync(file, 'utf8');
  return JSON.parse(text);
}

/**
 * Прочитать манифест из каталога пакета модуля.
 * Приоритет: `module.json` → legacy `manifest.json`.
 *
 * @param {string} dir — каталог пакета
 * @returns {{ok:boolean, manifest?:object, errors:string[], legacy?:boolean, sourceFile?:string}}
 */
function readManifest(dir) {
  const moduleFile = path.join(dir, 'module.json');
  const legacyFile = path.join(dir, 'manifest.json');

  let raw = null;
  let sourceFile = null;
  let legacy = false;

  if (fs.existsSync(moduleFile)) {
    sourceFile = moduleFile;
    try {
      raw = readJson(moduleFile);
    } catch (err) {
      return { ok: false, errors: [`module.json не читается: ${err.message}`], legacy: false, sourceFile };
    }
  } else if (fs.existsSync(legacyFile)) {
    sourceFile = legacyFile;
    legacy = true;
    try {
      raw = readJson(legacyFile);
    } catch (err) {
      return { ok: false, errors: [`manifest.json не читается: ${err.message}`], legacy: true, sourceFile };
    }
  } else {
    return { ok: false, errors: [`не найден module.json (или legacy manifest.json) в ${dir}`], legacy: false };
  }

  const manifest = legacy ? normalizeLegacyManifest(raw) : raw;
  const errors = validateManifest(manifest);
  return { ok: errors.length === 0, manifest, errors, legacy, sourceFile, raw };
}

/**
 * Каталоги-кандидаты, где может лежать пакет модуля.
 * @param {{rootDir:string, modulesDir?:string, code:string}} opts
 * @returns {string[]}
 */
function packageCandidates({ rootDir, modulesDir, code }) {
  const out = [];
  const envDir = process.env.MODULES_DIR;
  if (envDir) out.push(path.resolve(rootDir, envDir, code));
  out.push(path.resolve(rootDir, 'modules', code));
  if (modulesDir) out.push(path.resolve(modulesDir, code));
  out.push(path.resolve(rootDir, 'node_modules', '@isar', code));
  return [...new Set(out)];
}

/**
 * Найти каталог установленного пакета модуля.
 * `require('@isar/<code>')` приоритетнее каталога `modules/<code>`
 * (контракт §12: npm-пакет — штатный способ, каталог — zip/COPY).
 *
 * @param {{rootDir:string, modulesDir?:string, code:string}} opts
 * @returns {{dir:string, exports?:object, resolvedBy:string}|null}
 */
function resolveModulePackage({ rootDir, modulesDir, code }) {
  try {
    const resolved = require.resolve(`@isar/${code}`, { paths: [rootDir] });
    return { dir: path.dirname(resolved), exports: require(resolved), resolvedBy: 'npm' };
  } catch (_) {
    /* пакета в зависимостях нет — пробуем каталог modules/<code> */
  }
  for (const dir of packageCandidates({ rootDir, modulesDir, code })) {
    if (!fs.existsSync(dir)) continue;
    const entry = path.join(dir, 'index.js');
    if (!fs.existsSync(entry)) return { dir, exports: null, resolvedBy: 'dir' };
    try {
      return { dir, exports: require(entry), resolvedBy: 'dir' };
    } catch (err) {
      return { dir, exports: null, requireError: err, resolvedBy: 'dir' };
    }
  }
  return null;
}

/**
 * Список кодов модулей по зависимостям `@isar/*`, каталогу `modules/` и ENABLED_MODULES.
 * Используется загрузчиком и `scripts/check-route-permissions.js` (без обращения к БД).
 *
 * @param {{rootDir:string, modulesDir?:string, extraCodes?:string[]}} opts
 * @returns {string[]}
 */
function discoverModuleCodes({ rootDir, modulesDir, extraCodes = [] }) {
  const codes = new Set(extraCodes.map((c) => String(c || '').trim()).filter(Boolean));

  try {
    const pkg = readJson(path.join(rootDir, 'package.json'));
    for (const dep of Object.keys({
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
      // optionalDependencies поддерживаем: модуль можно ставить «мягко» (file:./modules/<code>),
      // чтобы сборка без пакета не падала.
      ...(pkg.optionalDependencies || {}),
    })) {
      if (dep.startsWith('@isar/')) codes.add(dep.slice('@isar/'.length));
    }
  } catch (_) { /* package.json может отсутствовать в тестах */ }

  const dirs = new Set();
  if (modulesDir) dirs.add(path.resolve(modulesDir));
  if (process.env.MODULES_DIR) dirs.add(path.resolve(rootDir, process.env.MODULES_DIR));
  dirs.add(path.join(rootDir, 'modules'));
  for (const base of dirs) {
    try {
      for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
        // symlink/junction — тоже валидный способ поставить модуль (npm link, mklink /J).
        if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
        if (isKebabCode(entry.name)) codes.add(entry.name);
      }
    } catch (_) { /* каталога modules/ может не быть */ }
  }
  return [...codes];
}

/**
 * Прочитать манифесты всех найденных модулей (для check:routes и диагностики).
 * @param {{rootDir:string, modulesDir?:string, extraCodes?:string[]}} opts
 * @returns {Array<{code:string, dir:string, manifest:object, errors:string[], legacy:boolean, sourceFile?:string}>}
 */
function discoverInstalledManifests(opts) {
  const out = [];
  for (const code of discoverModuleCodes(opts)) {
    const found = resolveModulePackage({ ...opts, code });
    if (!found) continue;
    const read = readManifest(found.dir);
    out.push({
      code,
      dir: found.dir,
      manifest: read.manifest || null,
      errors: read.errors,
      legacy: Boolean(read.legacy),
      sourceFile: read.sourceFile,
    });
  }
  return out;
}

module.exports = {
  MODULE_TYPES,
  isKebabCode,
  normalizeLegacyManifest,
  validateManifest,
  readManifest,
  resolveModulePackage,
  discoverModuleCodes,
  discoverInstalledManifests,
  packageCandidates,
};

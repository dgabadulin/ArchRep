#!/usr/bin/env node
'use strict';

/**
 * Диагностика подключаемых модулей для администратора: `npm run modules:status`.
 *
 * Показывает по каждому найденному модулю: источник пакета, манифест (module.json/legacy),
 * совместимость `requiresCore` с версией ядра, `enabled` (и откуда взято), статус лицензии
 * (без самого ключа), объявленные и покрытые RBAC маршруты, строку в `archrep.isar_modules`.
 *
 * Работает и без доступной БД (тогда только env-часть). Ключ лицензии не печатается.
 * Код выхода 1 — есть проблемы (битый манифест, несовместимость, включён без лицензии).
 */

require('dotenv').config({ path: `.env.${process.env.NODE_ENV || 'development'}` });

const crypto = require('crypto');
const path = require('path');
const { Pool } = require('pg');

const {
  discoverModuleCodes,
  resolveModulePackage,
  readManifest,
} = require('../backend/modules/manifest');
const { normalizeEndpoints } = require('../backend/modules/adapters/legacy');
const { satisfies } = require('../backend/modules/semver');
const {
  getLicenseStatus,
  licenseEnvKey,
  defaultInstanceId,
  resolveInstallRef,
  installRefParams,
  normalizePublicKeys,
  parseToken,
  VERSION: LICENSE_VERSION,
} = require('../backend/modules/license');
const { loadModuleRecords } = require('../backend/modules/registry');
const { resolveEnabled, readCoreVersion, parseEnabledList } = require('../backend/modules/index');
const { resolveRequiredPermissions } = require('../backend/auth/routePermissions');
const { ALL_PERMISSIONS } = require('../backend/auth/permissionsCatalog');

const ROOT = path.resolve(__dirname, '..');
const problems = [];
const warnings = [];

function line(text = '') {
  console.log(text);
}

function problem(code, message) {
  problems.push(`[${code}] ${message}`);
}

function warning(code, message) {
  warnings.push(`[${code}] ${message}`);
}

function maskKeyPresence(code) {
  const name = licenseEnvKey(code);
  const value = process.env[name];
  if (!value) return `${name} — не задан`;
  return `${name} — задан (${String(value).length} симв.)`;
}

async function openDb() {
  const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    connectionTimeoutMillis: 4000,
  });
  try {
    await pool.query('SELECT 1');
    return { pool, ok: true };
  } catch (err) {
    await pool.end().catch(() => {});
    return { pool: null, ok: false, error: err.message };
  }
}

async function main() {
  const coreVersion = readCoreVersion(ROOT);
  const env = process.env;

  // Генератор идентификатора инсталляции для выпуска лицензии:
  //   npm run modules:status -- --new-instance-id  →  SYS_INSTANCE_ID=<uuid>
  if (process.argv.includes('--new-instance-id')) {
    console.log(`SYS_INSTANCE_ID=${crypto.randomUUID()}`);
    return;
  }

  line('══════════════════════════════════════════════════════════════════');
  line(' Подключаемые модули ИСАР — диагностика');
  line(` Ядро: ${coreVersion} (${path.basename(ROOT)})`);
  line(` instance_id: ${defaultInstanceId()}  ← требуется при выпуске лицензии (mode:"uuid")`);
  const instanceExplicit = Boolean(env.SYS_INSTANCE_ID && String(env.SYS_INSTANCE_ID).trim());
  const refParams = installRefParams(env);
  const installRef = resolveInstallRef(env);
  line(` install_ref: ${installRef}  ← отпечаток ${refParams.host}:${refParams.port}:${refParams.db}` +
    `${env.SYS_INSTALL_REF ? ' (переопределён SYS_INSTALL_REF)' : ''}`);
  if (!instanceExplicit) {
    line(' ⚠ SYS_INSTANCE_ID не задан — для ключей с installation.mode="uuid" ядро откажет в лицензии.');
    line('   На двух серверах с одинаковыми hostname и DB_NAME значение совпадёт, и один ключ подойдёт обоим.');
    line('   Задайте уникальный: npm run modules:status -- --new-instance-id');
    warning('license', 'SYS_INSTANCE_ID не задан — ключи с привязкой mode:"uuid" не будут приняты');
  }
  const keyring = normalizePublicKeys(env);
  const keyringSize = Object.keys(keyring.keys).length;
  line(` Ключи подписи: ${keyringSize ? `PUBKEYS (${keyringSize}: ${Object.keys(keyring.keys).join(', ')})` : 'PUBKEYS не заданы'}` +
    `${keyring.single ? ' + SYS_MODULE_LICENSE_PUBLIC_KEY (fallback)' : ''}`);
  for (const w of keyring.warnings) line(` ⚠ ${w}`);
  if (!keyringSize && !keyring.single) {
    warning('license', 'публичный ключ не задан (SYS_MODULE_LICENSE_PUBKEYS / SYS_MODULE_LICENSE_PUBLIC_KEY) — ' +
      'лицензия не будет подтверждена');
  }
  const allowUnverified = String(env.SYS_MODULE_LICENSE_ALLOW_UNVERIFIED || '').toLowerCase() === 'true';
  if (allowUnverified) {
    line(' ⚠ SYS_MODULE_LICENSE_ALLOW_UNVERIFIED=true — подпись НЕ проверяется (только dev; на prod недопустимо)');
    warning('license', 'включён режим ALLOW_UNVERIFIED — подпись ключа не проверяется (только dev)');
  }
  line('══════════════════════════════════════════════════════════════════');

  const db = await openDb();
  let dbRows = new Map();
  let registryTable = null;
  let getParam = null;
  if (db.ok) {
    try {
      const t = await db.pool.query("SELECT to_regclass('archrep.isar_modules') AS t");
      registryTable = t.rows[0] && t.rows[0].t;
      dbRows = await loadModuleRecords(db.pool, { logger: { warn() {}, log() {}, error() {} } });
      const settings = require('../backend/settingsParams');
      await settings.loadParams(db.pool);
      getParam = settings.getParam;
      line(` БД: доступна; isar_modules: ${registryTable || 'НЕТ (примените миграцию)'}`);
      if (!registryTable) problem('db', 'таблица archrep.isar_modules отсутствует — примените миграцию');
    } catch (err) {
      line(` БД: доступна, но чтение реестра не удалось: ${err.message}`);
    }
  } else {
    line(` БД: недоступна (${db.error}) — проверяются только env-настройки`);
  }

  const modulesDir = env.MODULES_DIR || path.join(ROOT, 'modules');
  const enabledList = parseEnabledList(env.ENABLED_MODULES);
  const extraCodes = [...enabledList, ...dbRows.keys()];
  const codes = discoverModuleCodes({ rootDir: ROOT, modulesDir, extraCodes });
  line(` ENABLED_MODULES: ${env.ENABLED_MODULES ? env.ENABLED_MODULES : '(не задан)'}`);
  line(` MODULES_DIR: ${env.MODULES_DIR || '(по умолчанию <repo>/modules)'}`);
  line(` Кандидаты: ${codes.length ? codes.join(', ') : 'нет'}`);
  line('');

  const allPerms = new Set(ALL_PERMISSIONS);

  for (const code of codes) {
    line('──────────────────────────────────────────────────────────────────');
    line(` Модуль: ${code}`);
    // Включён ли модуль «по конфигурации» — до чтения манифеста известно только env/БД.
    const dbRow = dbRows.get(code);
    const explicitlyEnabled = enabledList.includes(code) || Boolean(dbRow && dbRow.enabled);
    // Проблемой считаем только то, что мешает работать ВКЛЮЧЁННОМУ модулю;
    // у установленного-но-выключенного это предупреждение (иначе диагностика всегда «красная»).
    const report = (message) => (explicitlyEnabled ? problem(code, message) : warning(code, message));

    const found = resolveModulePackage({ rootDir: ROOT, modulesDir, code });
    if (!found) {
      line(' Пакет: НЕ НАЙДЕН');
      line(`   → установите npm-пакет @isar/${code} или каталог modules/${code}`);
      report('пакет не найден');
      line('');
      continue;
    }
    line(` Пакет: ${found.dir}${found.resolvedBy === 'npm' ? ' (node_modules)' : ' (каталог)'}`);
    if (found.requireError) {
      line(` require: ОШИБКА — ${found.requireError.message}`);
      report('ошибка require');
      line('');
      continue;
    }

    const read = readManifest(found.dir);
    if (!read.ok) {
      line(` Манифест: ОШИБКА — ${read.errors.join('; ')}`);
      report('невалидный манифест');
      line('');
      continue;
    }
    const manifest = read.manifest;
    line(` Манифест: ${read.legacy ? 'legacy manifest.json (адаптер ядра)' : 'module.json'}`);
    line(` Версия: ${manifest.version}; тип: ${manifest.type}; requiresCore: ${manifest.requiresCore}`);

    const compat = satisfies(coreVersion, manifest.requiresCore);
    line(` Совместимость: ${compat.ok ? 'OK' : 'НЕ СОВМЕСТИМ'}${compat.ok ? '' : ` — ${compat.reason}`}`);
    if (!compat.ok) {
      report(`requiresCore ${manifest.requiresCore} несовместим с ядром ${coreVersion}`);
    }

    const enabledRes = resolveEnabled({ code, dbRow, getParam, env });
    line(` enabled: ${enabledRes.enabled} (источник: ${enabledRes.source})`);

    const lic = getLicenseStatus({ code, manifest, env });
    const expires = lic.expires_at ? `, до ${String(lic.expires_at).slice(0, 10)}` : '';
    line(` Лицензия: ${lic.licensed ? `активна (edition=${lic.edition || '—'}${expires})` : `НЕ активна — ${lic.reason}`}`);
    line(` Ключ: ${maskKeyPresence(code)}`);
    if (lic.licensed) {
      line(` license_id: ${lic.license_id || '—'}; kid: ${lic.kid || '—'}`);
      const b = lic.binding || {};
      const match = b.match === true ? 'match' : (b.match === false ? 'mismatch' : '—');
      line(` binding: ${b.mode || '—'} (${match}${b.strict ? ', strict' : ''})`);
    }
    for (const w of lic.warnings || []) {
      line(` ⚠ ${w}`);
      warning(code, w);
    }
    const rawKey = env[licenseEnvKey(code)];
    if (rawKey) {
      try {
        const keyPayload = parseToken(rawKey).payload;
        if (Number(keyPayload.v) !== LICENSE_VERSION) {
          line(` ⚠ ключ не в формате v${LICENSE_VERSION} (нет поля v) — перевыпустите: docs/module-license-key.md`);
          warning(code, `ключ лицензии не в формате v${LICENSE_VERSION} — перевыпустите ключ`);
        }
      } catch (err) {
        line(` ⚠ ключ не читается: ${err.message}`);
        warning(code, `ключ лицензии не читается (${err.message})`);
      }
    }
    if (enabledRes.enabled && !lic.licensed) {
      problem(code, 'включён без активной лицензии (маршруты → 402, UI скрыт)');
    }

    for (const p of manifest.permissions || []) {
      if (!allPerms.has(p)) {
        report(`право ${p} отсутствует в backend/auth/permissionsCatalog.js`);
      }
    }

    const endpoints = normalizeEndpoints(manifest);
    if (!endpoints.length) {
      line(' Маршруты: не объявлены в манифесте (модуль монтирует сам или это frontend-модуль)');
    } else {
      line(` Маршруты (${endpoints.length}):`);
      for (const ep of endpoints) {
        const required = resolveRequiredPermissions(ep.method, ep.path, {});
        const rbac = required === null
          ? 'НЕ ПОКРЫТ RBAC'
          : (required.anyOf ? `anyOf: ${required.anyOf.join(' | ')}` : `permissions: ${required.join(' + ') || '—'}`);
        line(`   ${String(ep.method).padEnd(6)} ${ep.path}  → ${rbac}`);
        if (required === null) report(`маршрут ${ep.method} ${ep.path} не покрыт правилом RBAC`);
      }
    }

    if (dbRow) {
      const exp = dbRow.license_expires_at ? String(dbRow.license_expires_at).slice(0, 10) : '—';
      line(` isar_modules: enabled=${dbRow.enabled}, licensed=${dbRow.licensed}, ` +
        `version=${dbRow.version}, expires=${exp}`);
      if (dbRow.license_id || dbRow.license_kid || dbRow.license_binding) {
        const checked = dbRow.license_checked_at
          ? String(dbRow.license_checked_at).replace('T', ' ').slice(0, 19)
          : '—';
        line(`   лицензия в реестре: license_id=${dbRow.license_id || '—'}, kid=${dbRow.license_kid || '—'}, ` +
          `binding=${dbRow.license_binding || '—'}, проверено=${checked}`);
      }
    } else if (db.ok) {
      line(' isar_modules: строки ещё нет (появится после первого старта API с этим модулем)');
    }
    line('');
  }

  line('══════════════════════════════════════════════════════════════════');
  if (problems.length || warnings.length) {
    line(` ИТОГ: модулей ${codes.length}, проблем ${problems.length}, предупреждений ${warnings.length}`);
    for (const p of problems) line(`   ✖ ${p}`);
    for (const w of warnings) line(`   ⚠ ${w}`);
  } else {
    line(` ИТОГ: модулей ${codes.length}, проблем нет`);
  }
  line('══════════════════════════════════════════════════════════════════');

  if (db.pool) await db.pool.end().catch(() => {});
  process.exit(problems.length ? 1 : 0);
}

main().catch((err) => {
  console.error('[modules:status] ошибка:', err && err.message ? err.message : err);
  process.exit(1);
});

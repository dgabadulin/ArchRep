'use strict';

/**
 * Версия продукта и состояние схемы БД (issue #96).
 *
 * Источник версии — git-тег, который на этапе сборки попадает в env (`APP_VERSION`),
 * а фолбэк — `package.json`. Версия схемы БД определяется по маркеру
 * `archrep.ar_schema_info` (его обновляют скрипты миграций, в т.ч. при ручном `psql -f`),
 * затем по `public.pgmigrations` (node-pg-migrate, demo), иначе — `unknown`.
 *
 * ВАЖНО: наружу отдаётся только несекретное (версия, commit, время сборки, состояние схемы).
 */

const fs = require('fs');
const path = require('path');

const PRODUCT = 'ИСАР';
const CONTRACT_VERSION = '1.0';

function rootDir() {
  return path.resolve(__dirname, '..');
}

function readPackageVersion(dir = rootDir()) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    return String(pkg.version || '').trim();
  } catch (_) {
    return '';
  }
}

/**
 * Привести версию к виду `<semver>[+meta]` и определить канал.
 * `1.4.0-dirty` → `1.4.0+dirty.<commit>`; `1.4.0-3-gabc1234` → `1.4.0+3.gabc1234`.
 */
function normalizeVersion(raw, { commit = '', dirty = false } = {}) {
  let value = String(raw == null ? '' : raw).trim() || '0.0.0';
  let isDirty = Boolean(dirty);
  let pre = '';

  const dashDirty = /-dirty$/.exec(value);
  if (dashDirty) {
    isDirty = true;
    value = value.replace(/-dirty$/, '');
  }
  // git describe: v1.4.0-3-gabc1234
  const described = /^v?(\d+\.\d+\.\d+)-(\d+)-g([0-9a-f]+)$/i.exec(value);
  if (described) {
    value = described[1];
    pre = `${described[2]}.g${described[3]}`;
  }
  value = value.replace(/^v/i, '');

  const meta = [];
  if (pre) meta.push(pre);
  if (isDirty) meta.push(`dirty${commit ? `.${commit}` : ''}`);
  const clean = meta.length ? `${value}+${meta.join('.')}` : value;

  let channel = 'stable';
  if (isDirty) channel = 'dev';
  else if (/-rc\.|-beta\.|-alpha\./i.test(clean)) channel = 'rc';
  else if (pre) channel = 'dev';

  return { version: clean, channel, dirty: isDirty };
}

/** Список файлов миграций и их 14-значные префиксы. */
function readMigrationPrefixes(dir = path.join(rootDir(), 'DB', 'migrations')) {
  try {
    return fs
      .readdirSync(dir)
      .filter((name) => /^\d{14}_.+\.js$/.test(name))
      .map((name) => ({ name: name.replace(/\.js$/, ''), prefix: name.slice(0, 14) }))
      .sort((a, b) => a.prefix.localeCompare(b.prefix));
  } catch (_) {
    return [];
  }
}

function pendingFrom(schemaVersion, migrations = readMigrationPrefixes()) {
  if (!schemaVersion) return null;
  return migrations.filter((m) => m.prefix > schemaVersion).map((m) => m.name);
}

/**
 * Состояние схемы БД: маркер → pgmigrations → unknown.
 * @param {import('pg').Pool|null} pool
 */
async function readSchemaState(pool) {
  if (!pool || typeof pool.query !== 'function') {
    return { source: 'unknown', schema_version: null, applied_at: null, pending: null };
  }
  try {
    const r = await pool.query(
      "SELECT version, applied_at FROM archrep.ar_schema_info WHERE code = 'core'",
    );
    if (r.rows && r.rows.length) {
      const schemaVersion = String(r.rows[0].version || '').trim() || null;
      return {
        source: 'schema_info',
        schema_version: schemaVersion,
        applied_at: r.rows[0].applied_at || null,
        pending: pendingFrom(schemaVersion),
      };
    }
  } catch (err) {
    // 42P01 — таблицы ещё нет (миграция маркера не применена): это нормально, идём дальше.
    if (err && err.code !== '42P01') {
      console.warn('[version] ar_schema_info:', err.message);
    }
  }
  try {
    const r = await pool.query('SELECT name, run_on FROM public.pgmigrations ORDER BY id DESC LIMIT 1');
    if (r.rows && r.rows.length) {
      const name = String(r.rows[0].name || '');
      const schemaVersion = /^\d{14}/.test(name) ? name.slice(0, 14) : null;
      return {
        source: 'pgmigrations',
        schema_version: schemaVersion,
        applied_at: r.rows[0].run_on || null,
        pending: pendingFrom(schemaVersion),
      };
    }
  } catch (err) {
    if (err && err.code !== '42P01') {
      console.warn('[version] pgmigrations:', err.message);
    }
  }
  return { source: 'unknown', schema_version: null, applied_at: null, pending: null };
}

/**
 * Фактически действующий адрес draw.io для embed-режима.
 *
 * Приоритет тот же, что у `GET /api/config`: параметр `DRAWIO_EMBED_BASE` из
 * `ar_settings_parameters` → override из env. Значение не секретное (оно и так уходит
 * во фронт), но нужно для диагностики «схема не открывается»: администратор видит,
 * что именно отдаёт backend, не заглядывая в БД и не гадая про кэши.
 *
 * @param {object} [env] — окружение (по умолчанию process.env)
 * @param {(code:string, def:any)=>any} [getParam]
 * @returns {{drawio_embed_base: string|null, drawio_configured: boolean}}
 */
function resolveDrawioConfig(env, getParam) {
  const e = env || {};
  let value = '';
  if (typeof getParam === 'function') {
    const v = getParam('DRAWIO_EMBED_BASE', '');
    value = v == null ? '' : String(v).trim();
  }
  const fromEnv = String(e.DRAWIO_EMBED_BASE == null ? '' : e.DRAWIO_EMBED_BASE).trim();
  if (fromEnv) value = fromEnv;
  return {
    drawio_embed_base: value || null,
    drawio_configured: Boolean(value),
  };
}

/**
 * Публичный объект `GET /api/version`.
 *
 * `deploy` (docs/versioning.md §4) — состояние деплоя: `release` (HEAD на теге) |
 * `ahead` (деплой впереди тега) | `dirty` (есть код вне git). Поля аддитивные,
 * формат остальных секций не меняется.
 *
 * `config.drawio_*` — фактический адрес draw.io (env → параметр БД), чтобы отличать
 * «параметр задан, но backend его не видит» от «параметр пуст».
 *
 * @param {{pool?:object, env?:object, warnMode?:string, deployWarnMode?:string,
 *   getParam?:(code:string, def:any)=>any}} [opts]
 */
async function getVersionInfo(opts = {}) {
  const env = opts.env || process.env;
  const commit = String(env.APP_COMMIT || '').trim();
  const dirtyFlag = String(env.APP_DIRTY || '').toLowerCase() === 'true';
  const normalized = normalizeVersion(env.APP_VERSION || readPackageVersion(), { commit, dirty: dirtyFlag });
  const db = await readSchemaState(opts.pool);

  const deployState = String(env.APP_DEPLOY_STATE || '').trim().toLowerCase() || (normalized.dirty ? 'dirty' : 'release');
  const aheadRaw = Number(env.APP_AHEAD_COMMITS);
  const dirtyRaw = Number(env.APP_DIRTY_FILES);
  const channel = deployState === 'release'
    ? String(env.APP_CHANNEL || normalized.channel)
    : 'dev';

  return {
    product: PRODUCT,
    version: normalized.version,
    channel,
    commit: commit || null,
    build_time: String(env.APP_BUILD_TIME || '').trim() || null,
    contract_version: String(env.APP_CONTRACT_VERSION || CONTRACT_VERSION),
    db: {
      ...db,
      warn_mode: opts.warnMode || 'admin',
    },
    deploy: {
      state: deployState,
      base_tag: String(env.APP_BASE_TAG || '').trim() || null,
      ahead_commits: Number.isFinite(aheadRaw) && aheadRaw > 0 ? aheadRaw : 0,
      dirty_files: Number.isFinite(dirtyRaw) && dirtyRaw > 0 ? dirtyRaw : 0,
      warn_mode: String(opts.deployWarnMode || 'admin').trim().toLowerCase(),
    },
    config: resolveDrawioConfig(env, opts.getParam),
  };
}

module.exports = {
  PRODUCT,
  CONTRACT_VERSION,
  normalizeVersion,
  readPackageVersion,
  readMigrationPrefixes,
  pendingFrom,
  readSchemaState,
  resolveDrawioConfig,
  getVersionInfo,
};

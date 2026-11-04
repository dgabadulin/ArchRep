'use strict';

/**
 * Реестр подключаемых модулей `archrep.isar_modules` (docs/modules-contract.md §5).
 *
 * Таблица — источник правды для UI (enabled / licensed / license_expires_at),
 * env `ENABLED_MODULES` — аварийный override (см. ./index.js).
 *
 * Работа с БД fail-open: если миграция ещё не применена (42P01 — undefined_table),
 * ядро продолжает стартовать, модуль работает по env-флагу, в лог пишется предупреждение.
 */

const TABLE = 'archrep.isar_modules';

const UPSERT_SQL = `
  INSERT INTO ${TABLE} (code, name, version, core_version, enabled, licensed, license_expires_at,
    license_id, license_kid, license_binding, license_checked_at)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
  ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    version = EXCLUDED.version,
    core_version = EXCLUDED.core_version,
    enabled = EXCLUDED.enabled,
    licensed = EXCLUDED.licensed,
    license_expires_at = EXCLUDED.license_expires_at,
    license_id = EXCLUDED.license_id,
    license_kid = EXCLUDED.license_kid,
    license_binding = EXCLUDED.license_binding,
    license_checked_at = EXCLUDED.license_checked_at
  RETURNING *`;

/** Форма записи до миграции метаданных лицензии (license_id/license_kid/license_binding). */
const UPSERT_SQL_LEGACY = `
  INSERT INTO ${TABLE} (code, name, version, core_version, enabled, licensed, license_expires_at)
  VALUES ($1, $2, $3, $4, $5, $6, $7)
  ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    version = EXCLUDED.version,
    core_version = EXCLUDED.core_version,
    enabled = EXCLUDED.enabled,
    licensed = EXCLUDED.licensed,
    license_expires_at = EXCLUDED.license_expires_at
  RETURNING *`;

const SELECT_SQL = `SELECT code, name, version, core_version, enabled, licensed, license_expires_at,
    license_id, license_kid, license_binding, license_checked_at, installed_at
  FROM ${TABLE} ORDER BY code`;

const SELECT_SQL_LEGACY = `SELECT code, name, version, core_version, enabled, licensed, license_expires_at, installed_at
  FROM ${TABLE} ORDER BY code`;

function isMissingTableError(err) {
  return Boolean(err && (err.code === '42P01' || /relation .* does not exist/i.test(String(err.message))));
}

/** Колонка не найдена (42P03/42703) — миграция метаданных лицензии не применена. */
function isMissingColumnError(err) {
  return Boolean(err && (err.code === '42703' || /column .* does not exist/i.test(String(err.message))));
}

/**
 * Прочитать записи реестра.
 * @param {import('pg').Pool} pool
 * @param {{logger?:Console}} [opts]
 * @returns {Promise<Map<string, object>>} code → row
 */
async function loadModuleRecords(pool, { logger = console } = {}) {
  const out = new Map();
  if (!pool || typeof pool.query !== 'function') return out;
  let r;
  try {
    r = await pool.query(SELECT_SQL);
  } catch (err) {
    if (isMissingTableError(err)) {
      logger.warn(`[modules] таблица ${TABLE} не найдена — примените миграцию ` +
        'DB/scripts/migrate_20261103120000_isar_modules.sql (статусы модулей не сохраняются)');
      return out;
    }
    if (isMissingColumnError(err)) {
      logger.warn('[modules] в ' + TABLE + ' нет колонок лицензии — примените миграцию ' +
        'DB/scripts/migrate_20261105120000_isar_modules_license_meta.sql (license_id/kid/binding не сохраняются)');
      try {
        r = await pool.query(SELECT_SQL_LEGACY);
      } catch (legacyErr) {
        logger.warn(`[modules] не удалось прочитать ${TABLE}: ${legacyErr.message}`);
        return out;
      }
    } else {
      logger.warn(`[modules] не удалось прочитать ${TABLE}: ${err.message}`);
      return out;
    }
  }
  for (const row of r.rows || []) out.set(row.code, row);
  return out;
}

/**
 * Синхронизировать запись модуля с фактически загруженным кодом (версия ядра, enabled, licensed,
 * метаданные лицензии). Ключ лицензии в БД не пишется — только id/kid/binding/время проверки.
 *
 * @param {import('pg').Pool} pool
 * @param {{code:string, name?:string, version?:string, coreVersion?:string, enabled?:boolean,
 *   licensed?:boolean, expiresAt?:string|null, licenseId?:string|null, licenseKid?:string|null,
 *   licenseBinding?:string|null}} rec
 * @param {{logger?:Console}} [opts]
 * @returns {Promise<object|null>} строка реестра (или null, если БД недоступна)
 */
async function syncModuleRecord(pool, rec, { logger = console } = {}) {
  if (!pool || typeof pool.query !== 'function') return null;
  const legacyParams = [
    rec.code,
    rec.name || rec.code,
    rec.version || '0.0.0',
    rec.coreVersion || null,
    Boolean(rec.enabled),
    Boolean(rec.licensed),
    rec.expiresAt || null,
  ];
  const params = [
    ...legacyParams,
    rec.licenseId || null,
    rec.licenseKid || null,
    rec.licenseBinding || null,
  ];
  try {
    const r = await pool.query(UPSERT_SQL, params);
    return (r.rows && r.rows[0]) || null;
  } catch (err) {
    if (isMissingTableError(err)) {
      logger.warn(`[modules] ${rec.code}: ${TABLE} не найдена — статус не сохранён в БД ` +
        '(примените DB/scripts/migrate_20261103120000_isar_modules.sql)');
      return null;
    }
    if (isMissingColumnError(err)) {
      logger.warn(`[modules] ${rec.code}: нет колонок лицензии в ${TABLE} — статус сохранён без ` +
        'license_id/kid/binding (примените DB/scripts/migrate_20261105120000_isar_modules_license_meta.sql)');
      try {
        const r = await pool.query(UPSERT_SQL_LEGACY, legacyParams);
        return (r.rows && r.rows[0]) || null;
      } catch (legacyErr) {
        logger.warn(`[modules] ${rec.code}: не удалось записать статус в ${TABLE}: ${legacyErr.message}`);
        return null;
      }
    }
    logger.warn(`[modules] ${rec.code}: не удалось записать статус в ${TABLE}: ${err.message}`);
    return null;
  }
}

module.exports = {
  TABLE,
  UPSERT_SQL,
  UPSERT_SQL_LEGACY,
  SELECT_SQL,
  SELECT_SQL_LEGACY,
  isMissingTableError,
  isMissingColumnError,
  loadModuleRecords,
  syncModuleRecord,
};

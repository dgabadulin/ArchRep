'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Метаданные лицензии модулей в archrep.isar_modules: license_id / license_kid /
 * license_binding / license_checked_at (docs/modules-contract.md §5, §10;
 * формат ключа — docs/module-license-key.md).
 *
 * Dual-миграция: тот же SQL, что в prod-скрипте
 * DB/scripts/migrate_20261105120000_isar_modules_license_meta.sql
 * (psql -f для prod, node-pg-migrate — для demo-схемы).
 */
exports.up = (pgm) => {
  const sqlPath = path.join(__dirname, '..', 'scripts', 'migrate_20261105120000_isar_modules_license_meta.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  pgm.sql(sql);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS archrep.isar_modules_license_expires_idx;
    ALTER TABLE archrep.isar_modules
      DROP COLUMN IF EXISTS license_id,
      DROP COLUMN IF EXISTS license_kid,
      DROP COLUMN IF EXISTS license_binding,
      DROP COLUMN IF EXISTS license_checked_at;
  `);
};

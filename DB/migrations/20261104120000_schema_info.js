'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Issue #96: версия схемы БД (archrep.ar_schema_info) и параметр
 * SYS_DB_SCHEMA_WARN_MODE.
 *
 * Dual-миграция: тот же SQL, что в prod-скрипте
 * DB/scripts/migrate_20261104120000_schema_info.sql.
 */
exports.up = (pgm) => {
  const sqlPath = path.join(__dirname, '..', 'scripts', 'migrate_20261104120000_schema_info.sql');
  pgm.sql(fs.readFileSync(sqlPath, 'utf8'));
};

exports.down = (pgm) => {
  pgm.sql(`
    DELETE FROM archrep.ar_settings_parameters WHERE code = 'SYS_DB_SCHEMA_WARN_MODE';
    DROP TABLE IF EXISTS archrep.ar_schema_info;
  `);
};

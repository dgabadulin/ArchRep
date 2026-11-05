'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Параметр `SYS_DEPLOY_WARN_MODE` — кому показывать пометку «деплой не из релиза»
 * (docs/versioning.md §4). Dual-миграция: тот же SQL, что в prod-скрипте
 * DB/scripts/migrate_20261107120000_deploy_warn_mode.sql.
 */
exports.up = (pgm) => {
  const sqlPath = path.join(__dirname, '..', 'scripts', 'migrate_20261107120000_deploy_warn_mode.sql');
  pgm.sql(fs.readFileSync(sqlPath, 'utf8'));
};

exports.down = (pgm) => {
  pgm.sql(`
    DELETE FROM archrep.ar_settings_parameters WHERE code = 'SYS_DEPLOY_WARN_MODE';
  `);
};

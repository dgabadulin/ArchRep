'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Подключаемые модули: реестр archrep.isar_modules + параметры группы «Модули»
 * (история; удалено в v4.0.0).
 *
 * Dual-миграция: тот же SQL, что в prod-скрипте
 * DB/scripts/migrate_20261103120000_isar_modules.sql (psql -f для prod,
 * node-pg-migrate — для demo-схемы).
 */
exports.up = (pgm) => {
  const sqlPath = path.join(__dirname, '..', 'scripts', 'migrate_20261103120000_isar_modules.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  pgm.sql(sql);
};

exports.down = (pgm) => {
  pgm.sql(`
    DELETE FROM archrep.ar_settings_parameters
     WHERE code IN ('SYS_MODULE_drawio_pro_ENABLED', 'DRAWIO_MXFILE_MAX_MB');
    DROP TABLE IF EXISTS archrep.isar_modules;
  `);
};

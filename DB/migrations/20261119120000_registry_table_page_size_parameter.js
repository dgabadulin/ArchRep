'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Количество строк на странице табличных реестров (issue #114), параметр `ARR_TABLE_PAGE_SIZE`.
 * Тот же SQL, что в prod-сиде DB/scripts/migrate_20261119120000_registry_table_page_size_parameter.sql
 * (dual-миграция: psql -f для prod, node-pg-migrate — для demo-схемы).
 */
exports.up = (pgm) => {
  const sqlPath = path.join(__dirname, '..', 'scripts', 'migrate_20261119120000_registry_table_page_size_parameter.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  pgm.sql(sql);
};

exports.down = (pgm) => {
  pgm.sql(`DELETE FROM archrep.ar_settings_parameters WHERE code = 'ARR_TABLE_PAGE_SIZE';`);
};

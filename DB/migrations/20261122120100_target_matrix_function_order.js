'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Дашборд «Карта ИТ ландшафта» — порядок строк бизнес-способностей (issue #127),
 * параметр `ARR_TARGET_MATRIX_FUNCTION_ORDER`.
 * Тот же SQL, что в prod-скрипте DB/scripts/migrate_20261122120100_target_matrix_function_order.sql
 * (dual-миграция: psql -f для prod, node-pg-migrate — для demo-схемы).
 */
exports.up = (pgm) => {
  const sqlPath = path.join(
    __dirname,
    '..',
    'scripts',
    'migrate_20261122120100_target_matrix_function_order.sql',
  );
  pgm.sql(fs.readFileSync(sqlPath, 'utf8'));
};

exports.down = (pgm) => {
  pgm.sql(`DELETE FROM archrep.ar_settings_parameters WHERE code = 'ARR_TARGET_MATRIX_FUNCTION_ORDER';`);
};

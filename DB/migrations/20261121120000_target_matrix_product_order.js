'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Дашборд «Целевая архитектура: матрица» — параметр `ARR_TARGET_MATRIX_ORDER`.
 * Тот же SQL, что в prod-скрипте DB/scripts/migrate_20261121120000_target_matrix_product_order.sql
 * (dual-миграция: psql -f для prod, node-pg-migrate — для demo-схемы).
 */
exports.up = (pgm) => {
  const sqlPath = path.join(
    __dirname,
    '..',
    'scripts',
    'migrate_20261121120000_target_matrix_product_order.sql',
  );
  const sql = fs.readFileSync(sqlPath, 'utf8');
  pgm.sql(sql);
};

exports.down = (pgm) => {
  pgm.sql(`DELETE FROM archrep.ar_settings_parameters WHERE code = 'ARR_TARGET_MATRIX_ORDER';`);
};

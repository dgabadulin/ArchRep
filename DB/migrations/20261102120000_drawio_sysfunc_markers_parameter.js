'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Маркеры функций систем на схеме решения (issue #93), параметр `DRAWIO_SYSFUNC_MARKERS`.
 * Тот же SQL, что в prod-сиде DB/scripts/migrate_20261102120000_drawio_sysfunc_markers_parameter.sql
 * (dual-миграция: psql -f для prod, node-pg-migrate — для demo-схемы).
 */
exports.up = (pgm) => {
  const sqlPath = path.join(__dirname, '..', 'scripts', 'migrate_20261102120000_drawio_sysfunc_markers_parameter.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  pgm.sql(sql);
};

exports.down = (pgm) => {
  // Возврат к состоянию до миграции: параметра не было (в т.ч. если он остался под ранним именем).
  pgm.sql(`DELETE FROM archrep.ar_settings_parameters WHERE code IN ('DRAWIO_SYSFUNC_MARKERS', 'ADR_SYSFUNC_MARKERS');`);
};

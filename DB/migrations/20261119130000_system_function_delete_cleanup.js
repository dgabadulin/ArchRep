'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Issue #76: удаление функции ИС убирает её связи метамодели.
 * Тот же SQL, что в prod-скрипте DB/scripts/migrate_20261119130000_system_function_delete_cleanup.sql
 * (dual-миграция: psql -f для prod, node-pg-migrate — для demo-схемы).
 */
exports.up = (pgm) => {
  const sqlPath = path.join(__dirname, '..', 'scripts', 'migrate_20261119130000_system_function_delete_cleanup.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  pgm.sql(sql);
};

exports.down = (pgm) => {
  // Убираем отдельный DELETE-триггер; INSERT/UPDATE-триггер не трогали. Удалённые «висячие» рёбра не восстанавливаются.
  pgm.sql(`
    DROP TRIGGER IF EXISTS trg_ar_system_functions_delete_metamodel ON archrep.ar_system_functions;
  `);
};

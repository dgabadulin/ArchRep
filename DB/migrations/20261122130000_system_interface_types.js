'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Тип интерфейса ИС (issue #129): справочник `ar_system_interface_types` +
 * связь `ar_system_interface_type_links` (M:N).
 * Тот же SQL, что в prod-скрипте DB/scripts/migrate_20261122130000_system_interface_types.sql
 * (dual-миграция: psql -f для prod, node-pg-migrate — для demo-схемы).
 */
exports.up = (pgm) => {
  const sqlPath = path.join(
    __dirname,
    '..',
    'scripts',
    'migrate_20261122130000_system_interface_types.sql',
  );
  pgm.sql(fs.readFileSync(sqlPath, 'utf8'));
};

exports.down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS archrep.ar_system_interface_type_links;');
  pgm.sql('DROP TABLE IF EXISTS archrep.ar_system_interface_types;');
};

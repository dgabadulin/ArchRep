'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Статусы систем: поле «Доп.классификация1» (issue #130).
 * Единственный источник SQL:
 * DB/scripts/migrate_20261122140000_system_statuses_extra_classification1.sql
 * (dual-миграция: psql -f для Прод ИСАР, node-pg-migrate — для Демо ИСАР).
 */
exports.up = (pgm) => {
  const sqlPath = path.join(
    __dirname,
    '..',
    'scripts',
    'migrate_20261122140000_system_statuses_extra_classification1.sql',
  );
  pgm.sql(fs.readFileSync(sqlPath, 'utf8'));
};

exports.down = (pgm) => {
  pgm.sql('ALTER TABLE archrep.ar_system_statuses DROP COLUMN IF EXISTS extra_classification1;');
};

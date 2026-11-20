'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Repair маркера archrep.ar_schema_info после трёх миграций, накатанных без upsert
 * (issue #96). Единственный источник SQL — prod-скрипт:
 * DB/scripts/migrate_20261120120000_schema_info_marker_repair.sql
 *
 * На demo применяется штатным `npm run db:migrate`; на prod — `psql -f`.
 */
exports.up = (pgm) => {
  const sqlPath = path.join(
    __dirname,
    '..',
    'scripts',
    'migrate_20261120120000_schema_info_marker_repair.sql',
  );
  const sql = fs.readFileSync(sqlPath, 'utf8');
  pgm.sql(sql);
};

exports.down = (pgm) => {
  // Repair не меняет схему. При откате возвращаем маркер к предыдущему известному
  // префиксу, но только если он всё ещё указывает на эту repair-миграцию.
  pgm.sql(`
    UPDATE archrep.ar_schema_info
       SET version = '20261119130000',
           applied_at = now(),
           applied_by = current_user
     WHERE code = 'core'
       AND version = '20261120120000';
  `);
};

'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Доп.классификация1 справочника функциональных вертикалей (issue #123).
 * Единственный источник SQL:
 * DB/scripts/migrate_20261120140000_owner_extra_classification1.sql
 */
exports.up = (pgm) => {
  const sqlPath = path.join(
    __dirname,
    '..',
    'scripts',
    'migrate_20261120140000_owner_extra_classification1.sql',
  );
  const sql = fs.readFileSync(sqlPath, 'utf8');
  pgm.sql(sql);
};

exports.down = false;

/* eslint-disable camelcase */
const fs = require('fs');
const path = require('path');

exports.shorthands = undefined;

exports.up = (pgm) => {
  const sqlPath = path.join(__dirname, '..', 'scripts', 'migrate_20260814110000_domain_import_allowed.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  pgm.sql(sql);
};

exports.down = false;

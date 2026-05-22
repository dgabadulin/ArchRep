/* eslint-disable camelcase */
const fs = require('fs');
const path = require('path');

exports.shorthands = undefined;

exports.up = (pgm) => {
  const sqlPath = path.join(__dirname, '..', 'scripts', 'migrate_20260504120000_section32_metamodel_types_and_fk_projections.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  pgm.sql(sql);
};

exports.down = false;

/* eslint-disable camelcase */
const fs = require('fs');
const path = require('path');

exports.shorthands = undefined;

exports.up = (pgm) => {
  const sqlPath = path.join(
    __dirname,
    '..',
    'scripts',
    'migrate_20260506120000_demo_full_model_entities_matrix_relation_dictionary.sql',
  );
  const sql = fs.readFileSync(sqlPath, 'utf8');
  pgm.sql(sql);
};

exports.down = false;

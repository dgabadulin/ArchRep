/* eslint-disable camelcase */
const fs = require('fs');
const path = require('path');

exports.shorthands = undefined;

exports.up = (pgm) => {
  const sqlPath = path.join(
    __dirname,
    '..',
    'scripts',
    'migrate_20261021130000_infrastructure_relation_labels.sql',
  );
  const sql = fs.readFileSync(sqlPath, 'utf8');
  pgm.sql(sql);
};

exports.down = false;

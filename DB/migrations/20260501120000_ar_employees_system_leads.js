/* eslint-disable camelcase */
const fs = require('fs');
const path = require('path');

exports.shorthands = undefined;

exports.up = (pgm) => {
  const sqlPath = path.join(__dirname, '..', 'scripts', 'migrate_20260501120000_ar_employees_system_leads.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  pgm.sql(sql);
};

// Откат DDL/триггеров и данных безопасен только в чистой демо-БД; на проде не используйте.
exports.down = false;

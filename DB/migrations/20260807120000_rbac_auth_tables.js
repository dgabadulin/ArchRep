'use strict';

const fs = require('fs');
const path = require('path');

exports.up = (pgm) => {
  const sqlPath = path.join(__dirname, '..', 'scripts', 'migrate_20260807120000_rbac_auth_tables.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  pgm.sql(sql);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS archrep.ar_user_roles;
    DROP TABLE IF EXISTS archrep.ar_role_permissions;
    DROP TABLE IF EXISTS archrep.ar_permissions;
    DROP TABLE IF EXISTS archrep.ar_roles;
    DROP TABLE IF EXISTS archrep.ar_app_users;
  `);
};

'use strict';

const fs = require('fs');
const path = require('path');

exports.up = (pgm) => {
  const sqlPath = path.join(__dirname, '..', 'scripts', 'migrate_20260911120000_sysfunc_status_model.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  pgm.sql(sql);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE archrep.ar_adr_increment_system_functions
      DROP COLUMN IF EXISTS ar_adr_increment_system_function_statuses_id;
    ALTER TABLE archrep.ar_system_functions
      DROP COLUMN IF EXISTS ar_system_function_statuses_id;
    ALTER TABLE archrep.ar_system_statuses
      DROP CONSTRAINT IF EXISTS ar_system_statuses_code_uq;
    ALTER TABLE archrep.ar_system_statuses
      DROP COLUMN IF EXISTS code;
    DROP TABLE IF EXISTS archrep.ar_adr_increment_system_function_statuses;
    DROP TABLE IF EXISTS archrep.ar_system_function_statuses;
    DELETE FROM archrep.ar_settings_parameters WHERE code IN ('ADR_SYSTEM_STATUS_MAP', 'ADR_SYSFUNC_STATUS_MAP');
  `);
};
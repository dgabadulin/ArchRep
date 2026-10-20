'use strict';

const fs = require('fs');
const path = require('path');

exports.up = (pgm) => {
  const sqlPath = path.join(__dirname, '..', 'scripts', 'migrate_20260912120000_adr_relation_flow_link.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  pgm.sql(sql);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE archrep.ar_adr_increment_relations
      DROP CONSTRAINT IF EXISTS ar_adr_increment_relations_flow_event_type_fkey;
    ALTER TABLE archrep.ar_adr_increment_relations
      DROP CONSTRAINT IF EXISTS ar_adr_increment_relations_flow_fkey;
    DROP INDEX IF EXISTS archrep.adr_increment_relations_flow_idx;
    DROP INDEX IF EXISTS archrep.integration_flows_pair_idx;
    ALTER TABLE archrep.ar_adr_increment_relations
      DROP COLUMN IF EXISTS ar_integration_flow_event_types_id;
    ALTER TABLE archrep.ar_adr_increment_relations
      DROP COLUMN IF EXISTS periodicity;
    ALTER TABLE archrep.ar_adr_increment_relations
      DROP COLUMN IF EXISTS transfer_method;
    ALTER TABLE archrep.ar_adr_increment_relations
      DROP COLUMN IF EXISTS transferred_data;
    ALTER TABLE archrep.ar_adr_increment_relations
      DROP COLUMN IF EXISTS ar_integration_flows_id;
  `);
};

'use strict';

const fs = require('fs');
const path = require('path');

exports.up = (pgm) => {
  const sqlPath = path.join(__dirname, '..', 'scripts', 'migrate_20260729140000_entity_types_import_allowed_domain.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  pgm.sql(sql);
};

exports.down = (pgm) => {
  pgm.sql(`
    UPDATE archrep.ar_metamodel_entity_types
    SET import_allowed = false
    WHERE code IN (
      'gap', 'adr_principle', 'principle', 'technology', 'system',
      'organization_unit', 'actor', 'business_service', 'business_function'
    );
  `);
};

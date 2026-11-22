'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Система → организация-владелец (issue #126): FK `owner_ar_organization_units_id`,
 * тип связи `owns_system` и триггер-проекция в метамодель.
 * Тот же SQL, что в prod-скрипте DB/scripts/migrate_20261122120000_system_owner_org_unit.sql
 * (dual-миграция: psql -f для prod, node-pg-migrate — для demo-схемы).
 */
exports.up = (pgm) => {
  const sqlPath = path.join(
    __dirname,
    '..',
    'scripts',
    'migrate_20261122120000_system_owner_org_unit.sql',
  );
  pgm.sql(fs.readFileSync(sqlPath, 'utf8'));
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TRIGGER IF EXISTS trg_ar_systems_owner_org_unit ON archrep.ar_systems;
    DROP TRIGGER IF EXISTS trg_ar_systems_owner_org_unit_del ON archrep.ar_systems;
    DROP FUNCTION IF EXISTS archrep.sync_system_owner_org_unit_relation();
    DELETE FROM archrep.ar_metamodel_relations
    WHERE relation_type = 'owns_system'
      AND from_entity_type = 'organization_unit'
      AND to_entity_type = 'system';
    DELETE FROM archrep.ar_metamodel_relation_types WHERE code = 'owns_system';
    DROP INDEX IF EXISTS archrep.ar_systems_owner_org_unit_idx;
    ALTER TABLE archrep.ar_systems DROP CONSTRAINT IF EXISTS ar_systems_owner_org_unit_fkey;
    ALTER TABLE archrep.ar_systems DROP COLUMN IF EXISTS owner_ar_organization_units_id;
  `);
};

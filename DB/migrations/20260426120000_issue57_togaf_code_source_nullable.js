/* eslint-disable camelcase */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE archrep.ar_organization_units ALTER COLUMN code DROP NOT NULL;
    ALTER TABLE archrep.ar_actors ALTER COLUMN code DROP NOT NULL;
    ALTER TABLE archrep.ar_actors ALTER COLUMN source DROP NOT NULL;
    ALTER TABLE archrep.ar_business_services ALTER COLUMN code DROP NOT NULL;
    ALTER TABLE archrep.ar_business_functions ALTER COLUMN code DROP NOT NULL;
  `);
};

// Откат NOT NULL небезопасен, если появились строки с NULL в code/source.
exports.down = false;

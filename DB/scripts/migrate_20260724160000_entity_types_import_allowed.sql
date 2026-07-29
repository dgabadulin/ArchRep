-- Issue #64: флаг «допустимо для импорта» на типах сущностей метамодели.
-- Пилот: web_resource = true.

ALTER TABLE archrep.ar_metamodel_entity_types
  ADD COLUMN IF NOT EXISTS import_allowed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN archrep.ar_metamodel_entity_types.import_allowed IS
  'Показывать тип в select сервисного импорта данных (docs/data-import-service.md)';

UPDATE archrep.ar_metamodel_entity_types
SET import_allowed = true
WHERE code = 'web_resource';

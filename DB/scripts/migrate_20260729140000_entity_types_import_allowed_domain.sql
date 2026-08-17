-- Issue #64: разрешить сервисный импорт для доменных реестров (не справочников).
-- applied / subsystem / system_function / partner / employee — вне scope плоского импорта.

UPDATE archrep.ar_metamodel_entity_types
SET import_allowed = true
WHERE code IN (
  'web_resource',
  'gap',
  'adr_principle',
  'principle',
  'technology',
  'system',
  'organization_unit',
  'actor',
  'business_service',
  'business_function',
  'domain'
);

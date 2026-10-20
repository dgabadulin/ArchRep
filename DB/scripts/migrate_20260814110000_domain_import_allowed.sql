-- Issue #67: разрешить сервисный импорт для реестра доменов.

UPDATE archrep.ar_metamodel_entity_types
SET import_allowed = true
WHERE code = 'domain';

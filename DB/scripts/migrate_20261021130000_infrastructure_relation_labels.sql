-- Подпись ребра «ИС → сервер» (issue #92): как у остальных проекций, она берётся
-- из ar_metamodel_relation_types.name («Размещена на»), а не из displayed_name.
-- Очищаем ранее записанные displayed_name (имя сервера), если первая миграция уже накатана.
-- Идемпотентно.

UPDATE archrep.ar_metamodel_relations
   SET displayed_name = NULL,
       updated_at = current_timestamp
 WHERE to_entity_type = 'infrastructure_object'
   AND relation_type IN ('system_infrastructure', 'subsystem_infrastructure')
   AND displayed_name IS NOT NULL;

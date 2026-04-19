-- Issue #44: тип связи system_technology, перенос ar_systems_technologies → ar_metamodel_relations, параметр SYS_TECH_STACK_RELATION_CODE.
-- Требуется: archrep_togaf_metamodel, archrep_relation_types_from_to_ids (FK на ar_metamodel_entity_types).
-- Резервная копия БД до запуска. После выполнения: перезапуск backend (кэш параметров).

BEGIN;

-- 1. Тип связи «ИС — технология»
INSERT INTO archrep.ar_metamodel_relation_types (code, name, description, from_entity_type_id, to_entity_type_id)
SELECT
  'system_technology',
  'Использует технологию',
  'Связь информационной системы с элементом технологического стека',
  fs.id,
  ts.id
FROM archrep.ar_metamodel_entity_types fs
CROSS JOIN archrep.ar_metamodel_entity_types ts
WHERE fs.code = 'system'
  AND ts.code = 'technology'
  AND NOT EXISTS (
    SELECT 1
    FROM archrep.ar_metamodel_relation_types rt
    WHERE rt.code = 'system_technology'
      AND rt.from_entity_type_id = fs.id
      AND rt.to_entity_type_id = ts.id
  );

-- 2. Параметр настроек (код типа связи; должен совпадать с relation_type в строках ниже)
INSERT INTO archrep.ar_settings_parameters (code, description, value, value_type, "group", is_secret, read_only)
SELECT
  'SYS_TECH_STACK_RELATION_CODE',
  'Код типа связи метамодели для стека технологий ИС (вкладка редактирования системы)',
  'system_technology',
  'string',
  'Метамодель',
  false,
  false
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_settings_parameters WHERE code = 'SYS_TECH_STACK_RELATION_CODE');

-- 3–4. Перенос из legacy-таблицы (если есть) и очистка
DO $mig$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'archrep'
      AND table_name = 'ar_systems_technologies'
  ) THEN
    INSERT INTO archrep.ar_metamodel_relations (
      from_entity_type,
      from_entity_id,
      to_entity_type,
      to_entity_id,
      relation_type,
      name,
      description,
      payload,
      displayed_name,
      reference_to_baserow
    )
    SELECT
      'system',
      st.systems_id,
      'technology',
      st.technologies_id,
      'system_technology',
      NULL,
      NULL,
      NULL,
      NULL,
      NULL
    FROM archrep.ar_systems_technologies st
    WHERE NOT EXISTS (
      SELECT 1
      FROM archrep.ar_metamodel_relations r
      WHERE r.from_entity_type = 'system'
        AND r.from_entity_id = st.systems_id
        AND r.to_entity_type = 'technology'
        AND r.to_entity_id = st.technologies_id
        AND r.relation_type = 'system_technology'
    );

    DELETE FROM archrep.ar_systems_technologies;
  END IF;
END
$mig$;

COMMIT;

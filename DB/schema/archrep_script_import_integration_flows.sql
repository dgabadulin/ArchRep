-- SQL-скрипт: перенос данных из temp_for_import_integration_flows в ar_integration_flows
-- с удалением перенесённых строк из временной таблицы.
-- Поиск систем from/to в ar_systems по коду, краткому (name) и полному (fullname) наименованию.
-- Запуск: psql -h ... -U ... -d ... -f DB/schema/archrep_script_import_integration_flows.sql

BEGIN;

-- 1. Вставка в ar_integration_flows (только строки, где обе системы найдены в ar_systems)
INSERT INTO archrep.ar_integration_flows (
  source_ar_systems_id,
  target_ar_systems_id,
  transferred_data,
  transfer_method,
  periodicity
)
SELECT
  src.id,
  tgt.id,
  NULLIF(trim(t.transferred_data), ''),
  NULLIF(trim(t.transfer_metod), ''),
  NULLIF(trim(t.periodicity), '')
FROM archrep.temp_for_import_integration_flows t
LEFT JOIN LATERAL (
  SELECT id FROM archrep.ar_systems
  WHERE trim(t.system_from) IS NOT NULL AND trim(t.system_from) <> ''
    AND (code = trim(t.system_from) OR lower(code) = lower(trim(t.system_from))
         OR name = trim(t.system_from) OR lower(name) = lower(trim(t.system_from))
         OR fullname = trim(t.system_from) OR (fullname IS NOT NULL AND lower(fullname) = lower(trim(t.system_from))))
  LIMIT 1
) src(id) ON true
LEFT JOIN LATERAL (
  SELECT id FROM archrep.ar_systems
  WHERE trim(t.system_to) IS NOT NULL AND trim(t.system_to) <> ''
    AND (code = trim(t.system_to) OR lower(code) = lower(trim(t.system_to))
         OR name = trim(t.system_to) OR lower(name) = lower(trim(t.system_to))
         OR fullname = trim(t.system_to) OR (fullname IS NOT NULL AND lower(fullname) = lower(trim(t.system_to))))
  LIMIT 1
) tgt(id) ON true
WHERE src.id IS NOT NULL
  AND tgt.id IS NOT NULL;

-- 2. Удаление из временной таблицы строк, которые были перенесены (обе системы найдены)
DELETE FROM archrep.temp_for_import_integration_flows t
WHERE trim(t.system_from) IS NOT NULL AND trim(t.system_from) <> ''
  AND trim(t.system_to) IS NOT NULL AND trim(t.system_to) <> ''
  AND EXISTS (
    SELECT 1 FROM archrep.ar_systems s
    WHERE s.code = trim(t.system_from) OR lower(s.code) = lower(trim(t.system_from))
       OR s.name = trim(t.system_from) OR lower(s.name) = lower(trim(t.system_from))
       OR s.fullname = trim(t.system_from) OR (s.fullname IS NOT NULL AND lower(s.fullname) = lower(trim(t.system_from)))
  )
  AND EXISTS (
    SELECT 1 FROM archrep.ar_systems s
    WHERE s.code = trim(t.system_to) OR lower(s.code) = lower(trim(t.system_to))
       OR s.name = trim(t.system_to) OR lower(s.name) = lower(trim(t.system_to))
       OR s.fullname = trim(t.system_to) OR (s.fullname IS NOT NULL AND lower(s.fullname) = lower(trim(t.system_to)))
  );

COMMIT;

-- Выгрузка всех интеграционных потоков (реестр ar_integration_flows):
-- система-источник, система-получатель, передаваемые данные.
-- Краткое наименование ИС/модуля — колонка archrep.ar_systems.name (не fullname).
--
-- Пример (psql):
--   psql -h HOST -p PORT -U USER -d DBNAME -f DB/scripts/export_integration_flows_transferred_data.sql
--
-- CSV с заголовком:
--   \copy (
--     SELECT src.name, tgt.name, COALESCE(f.transferred_data, '')
--     FROM archrep.ar_integration_flows f
--     JOIN archrep.ar_systems src ON src.id = f.source_ar_systems_id
--     JOIN archrep.ar_systems tgt ON tgt.id = f.target_ar_systems_id
--     ORDER BY src.name, tgt.name, f.id
--   ) TO 'integration_flows_data.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');

SELECT
  src.name AS "Система источник",
  tgt.name AS "Система получатель",
  COALESCE(f.transferred_data, '') AS "Передаваемые данные"
FROM archrep.ar_integration_flows f
INNER JOIN archrep.ar_systems src ON src.id = f.source_ar_systems_id
INNER JOIN archrep.ar_systems tgt ON tgt.id = f.target_ar_systems_id
ORDER BY src.name, tgt.name, f.id;

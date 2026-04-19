-- Issue #32: параметр шаблона отображаемого имени для модулей систем (subsystem) в списках и на графе.
-- Идемпотентно: если код уже есть — не меняет строку.
-- Запуск: psql -h ... -U ... -d ... -f DB/scripts/migrate_issue32_disp_subsystem_template.sql

INSERT INTO archrep.ar_settings_parameters (code, description, value, value_type, "group", is_secret, read_only)
VALUES (
  'DISP_SUBSYSTEM_TEMPLATE',
  'Шаблон именования в списках выбора модулей систем для всех экранных форм. Пример: {field1}[[ || ''->'' || {field2}]] - выведет наименование в формате field1 -> field2 (при условии что field2 не null, undefined или '''' )',
  '{name}',
  'string',
  'Display',
  false,
  false
)
ON CONFLICT (code) DO NOTHING;

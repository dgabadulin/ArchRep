-- Issue #48: параметр GRAPH_COLLAPSED_SYSTEM_ICON в ar_settings_parameters (иконка ИС при свёртке модулей на графе анализатора).
-- Идемпотентно. После выполнения — перезапуск backend (кэш параметров).

INSERT INTO archrep.ar_settings_parameters (code, description, value, value_type, "group", is_secret, read_only)
SELECT
  'GRAPH_COLLAPSED_SYSTEM_ICON',
  'Имя компонента Lucide для узла ИС на графе анализатора при свёртке модулей в систему (issue #48). Пример: MonitorDot.',
  'MonitorDot',
  'string',
  'Граф',
  false,
  false
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_settings_parameters WHERE code = 'GRAPH_COLLAPSED_SYSTEM_ICON');

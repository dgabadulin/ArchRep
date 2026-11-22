-- Дашборд «Карта ИТ ландшафта» (ранее «Целевая архитектура: матрица»): порядок строк
-- бизнес-способностей (issue #127). Значение — JSON-массив объектов {"code": "...", "order": N};
-- способности вне списка идут после, в порядке backend-запроса (родитель, наименование).
-- Идемпотентно. После применения: перезапуск backend (ar_settings_parameters кэшируются).

INSERT INTO archrep.ar_settings_parameters (code, description, value, value_type, "group", is_secret, read_only)
VALUES (
  'ARR_TARGET_MATRIX_FUNCTION_ORDER',
  'Порядок бизнес-способностей (строк) на дашборде «Карта ИТ ландшафта». JSON-массив [{"code":"...","order":1}]; способности вне списка идут после, в порядке реестра.',
  '[]',
  'json',
  'Дашборды',
  false,
  false
)
ON CONFLICT (code) DO NOTHING;

-- Версия схемы (issue #127): этот скрипт — последняя применённая миграция.
INSERT INTO archrep.ar_schema_info (code, version, applied_at, applied_by)
VALUES ('core', '20261122120100', now(), current_user)
ON CONFLICT (code) DO UPDATE
  SET version = EXCLUDED.version,
      applied_at = now(),
      applied_by = EXCLUDED.applied_by
  WHERE archrep.ar_schema_info.version < EXCLUDED.version;

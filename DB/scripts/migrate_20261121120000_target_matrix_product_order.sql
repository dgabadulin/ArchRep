-- Дашборд «Целевая архитектура: матрица»: порядок колонок продуктов.
-- Значение — коды бизнес-сервисов из реестра ar_business_services (string_list).
-- Если параметр не задан, backend использует порядок реестра (ORDER BY name).
-- Идемпотентно. После применения: перезапуск backend (ar_settings_parameters кэшируются).

INSERT INTO archrep.ar_settings_parameters (code, description, value, value_type, "group", is_secret, read_only)
VALUES (
  'ARR_TARGET_MATRIX_ORDER',
  'Порядок продуктов (колонок) в дашборде «Целевая архитектура: матрица». Список кодов бизнес-сервисов из реестра; продукты вне списка идут после, в порядке реестра.',
  '["bs-lcv-mcv","bs-valday","bs-bus","bs-cat","bs-spare-parts","bs-service-commercial","bs-digital-services"]',
  'string_list',
  'Дашборды',
  false,
  false
)
ON CONFLICT (code) DO NOTHING;

-- Версия схемы (issue #124): этот скрипт — последняя применённая миграция.
INSERT INTO archrep.ar_schema_info (code, version, applied_at, applied_by)
VALUES ('core', '20261121120000', now(), current_user)
ON CONFLICT (code) DO UPDATE
  SET version = EXCLUDED.version,
      applied_at = now(),
      applied_by = EXCLUDED.applied_by
  WHERE archrep.ar_schema_info.version < EXCLUDED.version;

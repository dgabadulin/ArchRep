-- Issue #93: маркеры функций систем на схеме решения (тело узла draw.io).
-- Маркер стоит перед названием функции: + создаётся, • модифицируется, ✓ используется, - выводится.
-- Параметр относится только к схеме draw.io, поэтому префикс DRAWIO_ (как DRAWIO_NODE_STYLE / DRAWIO_EDGE_STYLE).
-- Читает backend (backend/sysFuncMarkers.js) при сохранении заключения и при генерации схемы.
-- Идемпотентно; после применения перезапустите backend (ar_settings_parameters кэшируются при старте).

-- 1. Переименование с раннего имени параметра (если миграция успела накатиться в тестовой БД).
--    Выполняется только когда нового кода ещё нет — иначе ON CONFLICT ниже не сработает по unique(code).
UPDATE archrep.ar_settings_parameters
SET code = 'DRAWIO_SYSFUNC_MARKERS',
    updated_at = current_timestamp
WHERE code = 'ADR_SYSFUNC_MARKERS'
  AND NOT EXISTS (
    SELECT 1 FROM archrep.ar_settings_parameters WHERE code = 'DRAWIO_SYSFUNC_MARKERS'
  );

-- 2. Сид параметра (значения существующих строк не перетираются).
INSERT INTO archrep.ar_settings_parameters (code, description, value, value_type, "group", is_secret, read_only)
VALUES (
  'DRAWIO_SYSFUNC_MARKERS',
  'JSON: код статуса функции в заключении (ar_adr_increment_system_function_statuses.code) → маркер перед названием функции в теле узла схемы решения. Коды без соответствия и легаси-строки без статуса помечаются «?». Относится только к схеме draw.io.',
  '{"ADR_INCR_SYSFUNC_CREATING":"+","ADR_INCR_SYSFUNC_MODIFYING":"\u2022","ADR_INCR_SYSFUNC_IN_USE":"\u2713","ADR_INCR_SYSFUNC_DECOMMISSIONING":"-"}',
  'json', 'Draw.io', false, false
)
ON CONFLICT (code) DO NOTHING;

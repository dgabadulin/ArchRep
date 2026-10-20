-- Статусы и лимиты контура заключения — параметры ar_settings_parameters (issue #91).
-- Цель: убрать из кода «магические» коды статусов (ADR_INCR_SYS_CREATING и т.п.), эвристику по названию
-- статуса («применяется», «Черновик») и молчаливый fallback маппингов статусов — всё становится данными.
-- Dual-миграция: этот файл (prod: psql -f) + DB/migrations/20261006120000_adr_increment_status_params.js (demo).
-- Идемпотентно: ON CONFLICT (code) DO NOTHING (значения существующих строк не перетираются),
-- удаление легаси-параметров — обычный DELETE.
-- После применения перезапустите backend: ar_settings_parameters кэшируются при старте.

-- ============================================================
-- 1. Группа ADR — статусы контура заключения и правила маппингов
-- ============================================================
INSERT INTO archrep.ar_settings_parameters (code, description, value, value_type, "group", is_secret, read_only)
VALUES
  ('ADR_INCR_SYS_NEW_STATUS_CODE',
   'Код статуса системы «в решении» для новой системы заключения. Подставляется при сохранении структуры и в черновике ИИ; значение — код из ar_adr_increment_system_statuses.',
   'ADR_INCR_SYS_CREATING', 'string', 'ADR', false, false),

  ('ADR_INCR_SYS_DEFAULT_STATUS_CODE',
   'Код статуса системы «в решении» по умолчанию для системы, которая уже есть в реестре (пикер статуса на форме заключения). Код из ar_adr_increment_system_statuses; если кода нет в справочнике — статус остаётся пустым.',
   'ADR_INCR_SYS_IN_USE', 'string', 'ADR', false, false),

  ('ADR_INCR_SYSFUNC_NEW_STATUS_CODE',
   'Код статуса функции системы «в решении» для новых функций заключения. Значение — код из ar_adr_increment_system_function_statuses.',
   'ADR_INCR_SYSFUNC_CREATING', 'string', 'ADR', false, false),

  ('ADR_INCR_REL_NEW_STATUS_CODE',
   'Код статуса связи «в решении» для новых интеграций (в том числе подставляемый в черновике ИИ). Значение — код из ar_adr_increment_relation_statuses.',
   'ADR_INCR_REL_CREATING', 'string', 'ADR', false, false),

  ('ADR_INCR_REL_EXISTING_STATUS_CODE',
   'Код статуса связи «в решении» для связи с уже существующим потоком реестра (модалка интеграций). Значение — код из ar_adr_increment_relation_statuses.',
   'ADR_INCR_REL_IN_USE', 'string', 'ADR', false, false),

  ('ADR_EDITABLE_STATUS_CODES',
   'JSON-массив кодов статусов заключения (ar_adr_statuses.code), при которых разрешено править решения, системы и связи. Проверяют форма и сервер (PUT /full). Раньше правило было зашито сравнением имени статуса с «Черновик».',
   '["ADR_STATUS_DRAFT"]', 'json', 'ADR', false, false),

  ('ADR_FLOW_DEFAULT_STATUS_CODE',
   'Код статуса интеграционного потока, применяемый, когда статус связи не описан в ADR_FLOW_STATUS_MAP. Значение — код из ar_integration_flow_statuses.code (в текущих базах: FLOW_STATUS_1 «Планируется к реализации» … FLOW_STATUS_5 «Реализация отменена»).',
   'FLOW_STATUS_1', 'string', 'ADR', false, false),

  ('ADR_STATUS_MAP_STRICT',
   'Строгий режим маппингов статусов (ADR_SYSTEM_STATUS_MAP, ADR_SYSFUNC_STATUS_MAP, ADR_FLOW_STATUS_MAP): false — если статус не описан, применяется статус по умолчанию (в консоль пишется предупреждение); true — статус реестра не меняется.',
   'false', 'boolean', 'ADR', false, false)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 2. Группа «ИИ-архитектор» — лимиты черновика и фокуса экрана
--    Значения читает только агент (backend/ai/tools.js).
-- ============================================================
INSERT INTO archrep.ar_settings_parameters (code, description, value, value_type, "group", is_secret, read_only)
VALUES
  ('SYS_AI_PREFILL_MAX_INCREMENTS',
   'Максимум решений (инкрементов) в структурном черновике заключения. Используется ИИ-архитектором при генерации ADR: лишнее отбрасывается с предупреждением.',
   '10', 'number', 'ИИ-архитектор', false, false),

  ('SYS_AI_PREFILL_MAX_SYSTEMS',
   'Максимум систем в одном решении черновика заключения. Используется ИИ-архитектором при генерации ADR: лишнее отбрасывается с предупреждением.',
   '30', 'number', 'ИИ-архитектор', false, false),

  ('SYS_AI_PREFILL_MAX_FUNCTIONS',
   'Максимум функций у одной системы черновика заключения. Используется ИИ-архитектором при генерации ADR: лишнее отбрасывается с предупреждением.',
   '20', 'number', 'ИИ-архитектор', false, false),

  ('SYS_AI_PREFILL_MAX_RELATIONS',
   'Максимум связей (интеграций) в одном решении черновика заключения. Используется ИИ-архитектором при генерации ADR: лишнее отбрасывается с предупреждением.',
   '30', 'number', 'ИИ-архитектор', false, false),

  ('SYS_AI_PREFILL_MAX_JSON_CHARS',
   'Бюджет структурной части черновика заключения по размеру JSON, символов: черновик открывается ссылкой формы (?payload=), поэтому состав обрезается по размеру. Используется ИИ-архитектором при генерации ADR.',
   '5000', 'number', 'ИИ-архитектор', false, false),

  ('SYS_AI_FOCUS_MAX_IDS',
   'Максимум идентификаторов в фокусе экрана «Анализ зависимостей» (диплинк ?entity=&ids=). Используется ИИ-архитектором при открытии экрана с фокусом; фронт читает то же значение.',
   '50', 'number', 'ИИ-архитектор', false, false)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 3. Удаление легаси-параметров по именам статусов (issue #31 → #91).
--    Код их не читает (перешли на ADR_APPROVED_STATUS_CODES + ADR_DRAFT_STATUS_CODE),
--    поэтому параметры убираем. DELETE идемпотентен: повторный прогон ничего не сломает.
-- ============================================================
DELETE FROM archrep.ar_settings_parameters
WHERE code IN ('ADR_APPROVED_NAMES', 'ADR_DRAFT_STATUS');

-- ============================================================
-- 4. Выравнивание значений ADR_FLOW_STATUS_MAP / ADR_FLOW_DEFAULT_STATUS_CODE
--    со справочником ar_integration_flow_statuses.
--    Исторически параметр ADR_FLOW_STATUS_MAP ссылался на несуществующие коды
--    FLOW_STATUS_PLANNED / FLOW_STATUS_PRODUCTION / FLOW_STATUS_IN_PROGRESS / FLOW_STATUS_EXCLUDED,
--    поэтому маппинг молча уходил в статус по умолчанию (id 1 «Планируется к реализации»),
--    а в консоль писалось предупреждение [refCodes] ADR_FLOW_STATUS_MAP.
--    Переводим ЗНАЧЕНИЯ на реальные коды справочника (по смыслу названий):
--      FLOW_STATUS_1 «Планируется к реализации», FLOW_STATUS_2 «В процессе реализации»,
--      FLOW_STATUS_3 «В промышленной эксплуатации», FLOW_STATUS_4 «Исключена»,
--      FLOW_STATUS_5 «Реализация отменена».
--    UPDATE идемпотентен и НЕ перетирает ручные правки: применяется, только пока значение
--    историческое (ссылается на FLOW_STATUS_PLANNED). Ключи (ADR_INCR_REL_*) не меняются.
-- ============================================================
UPDATE archrep.ar_settings_parameters
SET value = '{"ADR_INCR_REL_CREATING":"FLOW_STATUS_1","ADR_INCR_REL_MODIFYING":"FLOW_STATUS_3","ADR_INCR_REL_IN_USE":"FLOW_STATUS_3","ADR_INCR_REL_REMOVING":"FLOW_STATUS_4","ADR_INCR_REL_PLANNED":"FLOW_STATUS_1","ADR_INCR_REL_IMPLEMENTING":"FLOW_STATUS_2","ADR_INCR_REL_DONE":"FLOW_STATUS_3"}',
    updated_at = current_timestamp
WHERE code = 'ADR_FLOW_STATUS_MAP'
  AND value LIKE '%FLOW_STATUS_PLANNED%';

UPDATE archrep.ar_settings_parameters
SET value = 'FLOW_STATUS_1',
    updated_at = current_timestamp
WHERE code = 'ADR_FLOW_DEFAULT_STATUS_CODE'
  AND value = 'FLOW_STATUS_PLANNED';

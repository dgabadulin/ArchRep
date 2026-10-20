-- Issue #74: двухконтурная статусная модель функций + коды статусов систем
-- + единая линейная модель сохранения ADR (kind:"new").
-- Идемпотентно; после применения перезапуск backend (кэш refCodes / параметров).

-- ============================================================
-- 1. Справочник статусов функции в реестре (ИТ-ландшафт)
-- ============================================================
CREATE TABLE IF NOT EXISTS archrep.ar_system_function_statuses (
  id          bigserial PRIMARY KEY,
  code        varchar(64)  NOT NULL,
  name        varchar(255) NOT NULL,
  description text NULL,
  CONSTRAINT ar_system_function_statuses_code_uq UNIQUE (code)
);

COMMENT ON TABLE archrep.ar_system_function_statuses
  IS 'Статус функции в ИТ-ландшафте (реестр)';

INSERT INTO archrep.ar_system_function_statuses (code, name, description) VALUES
  ('SYSFUNC_STATUS_PLANNED', 'Планируется', 'Функция предложена к внедрению, но не утверждена'),
  ('SYSFUNC_STATUS_ACTIVE',  'Действует',   'Функция актуальна'),
  ('SYSFUNC_STATUS_RETIRED', 'Выведена',    'Функция более не используется')
ON CONFLICT (code) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description;

-- ============================================================
-- 2. Колонка статуса функции в реестре
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'archrep' AND table_name = 'ar_system_functions'
      AND column_name = 'ar_system_function_statuses_id'
  ) THEN
    ALTER TABLE archrep.ar_system_functions
      ADD COLUMN ar_system_function_statuses_id bigint
        REFERENCES archrep.ar_system_function_statuses(id);
  END IF;
END $$;

-- ============================================================
-- 3. Справочник статусов функции в рамках заключения
-- ============================================================
CREATE TABLE IF NOT EXISTS archrep.ar_adr_increment_system_function_statuses (
  id          bigserial PRIMARY KEY,
  code        varchar(64)  NOT NULL,
  name        varchar(255) NOT NULL,
  description text NULL,
  CONSTRAINT ar_adr_incr_sysfunc_status_code_uq UNIQUE (code)
);

COMMENT ON TABLE archrep.ar_adr_increment_system_function_statuses
  IS 'Статус функции в рамках архитектурного заключения';

INSERT INTO archrep.ar_adr_increment_system_function_statuses (code, name, description) VALUES
  ('ADR_INCR_SYSFUNC_CREATING',      'Создается',      'Функция создаётся в рамках решения'),
  ('ADR_INCR_SYSFUNC_MODIFYING',     'Модифицируется', 'Функция дорабатывается'),
  ('ADR_INCR_SYSFUNC_IN_USE',        'Используется',   'Существующая функция используется'),
  ('ADR_INCR_SYSFUNC_DECOMMISSIONING', 'Выводится',    'Функция выводится из эксплуатации')
ON CONFLICT (code) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description;

-- ============================================================
-- 4. Колонка статуса функции в заключении
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'archrep' AND table_name = 'ar_adr_increment_system_functions'
      AND column_name = 'ar_adr_increment_system_function_statuses_id'
  ) THEN
    ALTER TABLE archrep.ar_adr_increment_system_functions
      ADD COLUMN ar_adr_increment_system_function_statuses_id bigint
        REFERENCES archrep.ar_adr_increment_system_function_statuses(id);
  END IF;
END $$;

-- ============================================================
-- 5. Стабильные коды статусов систем (для ADR_SYSTEM_STATUS_MAP)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'archrep' AND table_name = 'ar_system_statuses'
      AND column_name = 'code'
  ) THEN
    ALTER TABLE archrep.ar_system_statuses ADD COLUMN code varchar(64);
  END IF;
END $$;

UPDATE archrep.ar_system_statuses s
SET code = x.code
FROM (VALUES
  (2, 'SYS_STATUS_PLANNED'),       -- Планируется к внедрению
  (3, 'SYS_STATUS_IMPLEMENTING'),  -- В процессе внедрения
  (4, 'SYS_STATUS_PILOT'),         -- В опытной эксплуатации
  (5, 'SYS_STATUS_PRODUCTION'),    -- В промышленной эксплуатации
  (6, 'SYS_STATUS_RETIRING'),      -- Планируется к выводу из эксплуатации
  (7, 'SYS_STATUS_RETIRED'),       -- Выведена из эксплуатации
  (8, 'SYS_STATUS_ARCHIVED')       -- В архивном режиме
) AS x(id, code)
WHERE s.id = x.id AND (s.code IS NULL OR s.code = '');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ar_system_statuses_code_uq'
  ) THEN
    ALTER TABLE archrep.ar_system_statuses ADD CONSTRAINT ar_system_statuses_code_uq UNIQUE (code);
  END IF;
END $$;

-- ============================================================
-- 6. Параметры маппингов статусов
-- ============================================================
INSERT INTO archrep.ar_settings_parameters (code, description, value, value_type, "group", is_secret, read_only)
VALUES (
  'ADR_SYSTEM_STATUS_MAP',
  'JSON: код статуса системы в заключении → код статуса системы в реестре. Пустая строка = без изменений. Применяется при создании (kind:new) и при утверждении заключения.',
  '{"ADR_INCR_SYS_CREATING":"SYS_STATUS_PLANNED","ADR_INCR_SYS_MODIFYING":"","ADR_INCR_SYS_IN_USE":"","ADR_INCR_SYS_DECOMMISSIONING":"SYS_STATUS_RETIRING","ADR_INCR_SYS_OTHER_SOLUTION":""}',
  'json', 'ADR', false, false
)
ON CONFLICT (code) DO UPDATE SET
  description = EXCLUDED.description,
  value_type  = EXCLUDED.value_type,
  "group"     = EXCLUDED."group";

INSERT INTO archrep.ar_settings_parameters (code, description, value, value_type, "group", is_secret, read_only)
VALUES (
  'ADR_SYSFUNC_STATUS_MAP',
  'JSON: код статуса функции в заключении → код статуса функции в реестре. Пустая строка = без изменений. Применяется при создании (kind:new) и при утверждении заключения.',
  '{"ADR_INCR_SYSFUNC_CREATING":"SYSFUNC_STATUS_PLANNED","ADR_INCR_SYSFUNC_MODIFYING":"","ADR_INCR_SYSFUNC_IN_USE":"","ADR_INCR_SYSFUNC_DECOMMISSIONING":"SYSFUNC_STATUS_RETIRED"}',
  'json', 'ADR', false, false
)
ON CONFLICT (code) DO UPDATE SET
  description = EXCLUDED.description,
  value_type  = EXCLUDED.value_type,
  "group"     = EXCLUDED."group";
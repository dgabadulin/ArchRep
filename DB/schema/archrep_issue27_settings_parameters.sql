-- Issue #27: настроечные параметры системы (docs/settings-parameters-design.md).
-- Таблица: code (уникальный), description, value (текст/JSON), value_type, group, is_secret, read_only, updated_at.
-- Запуск: psql -h ... -U ... -d ... -f DB/schema/archrep_issue27_settings_parameters.sql

BEGIN;

CREATE TABLE IF NOT EXISTS archrep.ar_settings_parameters (
  id bigserial NOT NULL,
  code varchar(255) NOT NULL,
  description text NULL,
  value text NULL,
  value_type varchar(50) NOT NULL DEFAULT 'string',
  "group" varchar(255) NULL,
  is_secret boolean NOT NULL DEFAULT false,
  read_only boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ar_settings_parameters_pkey PRIMARY KEY (id),
  CONSTRAINT ar_settings_parameters_code_key UNIQUE (code)
);

COMMENT ON TABLE archrep.ar_settings_parameters IS 'Настроечные параметры системы (Keycloak, лимиты, флаги и т.д.)';
COMMENT ON COLUMN archrep.ar_settings_parameters.code IS 'Уникальный код параметра (AR_Keycloak_Enabled, AR_Session_Timeout_Min и т.п.)';
COMMENT ON COLUMN archrep.ar_settings_parameters.value_type IS 'Тип значения: string, number, boolean, json, string_list';
COMMENT ON COLUMN archrep.ar_settings_parameters."group" IS 'Группа для отображения в UI (Аутентификация, Интеграции и т.д.)';
COMMENT ON COLUMN archrep.ar_settings_parameters.is_secret IS 'Секретный параметр: в UI маскировать, в логах не выводить';
COMMENT ON COLUMN archrep.ar_settings_parameters.read_only IS 'Только из окружения/конфига, в UI не редактировать';

CREATE INDEX IF NOT EXISTS ar_settings_parameters_group_idx ON archrep.ar_settings_parameters ("group");
CREATE INDEX IF NOT EXISTS ar_settings_parameters_code_idx ON archrep.ar_settings_parameters (code);

COMMIT;

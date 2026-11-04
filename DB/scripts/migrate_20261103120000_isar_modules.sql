-- Подключаемые модули ИСАР (docs/modules-contract.md §5, §9).
-- Реестр archrep.isar_modules — источник правды для UI (enabled / licensed / license_expires_at).
-- env ENABLED_MODULES — аварийный override, в БД не дублируется.
-- Ключ лицензии в БД НЕ хранится: только env SYS_MODULE_<code>_LICENSE (contract §10).
-- Идемпотентно: повторный запуск безопасен.

CREATE TABLE IF NOT EXISTS archrep.isar_modules (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code varchar NOT NULL UNIQUE,
  name text NOT NULL,
  version text NOT NULL,
  core_version text,
  enabled boolean NOT NULL DEFAULT false,
  licensed boolean NOT NULL DEFAULT false,
  license_expires_at timestamptz,
  installed_at timestamptz NOT NULL DEFAULT now(),
  settings_json jsonb
);

COMMENT ON TABLE archrep.isar_modules IS
  'Реестр подключаемых модулей ИСАР (docs/modules-contract.md). Статус синхронизируется ядром при старте.';
COMMENT ON COLUMN archrep.isar_modules.code IS 'Код модуля (kebab-case), = префикс маршрутов /api/<code> и прав <code>:<action>';
COMMENT ON COLUMN archrep.isar_modules.enabled IS 'Включён (env ENABLED_MODULES имеет приоритет как аварийный override)';
COMMENT ON COLUMN archrep.isar_modules.licensed IS 'Лицензия активна (проверка Ed25519 по ключу из env, ключ в БД не хранится)';
COMMENT ON COLUMN archrep.isar_modules.settings_json IS 'Необязательные настройки модуля (несекретные). Ключ лицензии сюда не пишется.';

-- Параметры группы «Модули»: значение из env имеет приоритет над БД (как в /api/config).
INSERT INTO archrep.ar_settings_parameters (code, description, value, value_type, "group", is_secret, read_only)
VALUES
  (
    'SYS_MODULE_drawio_pro_ENABLED',
    'Включение модуля DrawIO Pro. Приоритет: env ENABLED_MODULES / SYS_MODULE_drawio_pro_ENABLED → значение в реестре isar_modules → этот параметр. Требуется активная лицензия, иначе маршруты модуля отвечают 402.',
    'false',
    'boolean',
    'Модули',
    false,
    false
  ),
  (
    'DRAWIO_MXFILE_MAX_MB',
    'Максимальный размер клиентского mxfile, принимаемого POST /api/increments/:incrementId/diagrams (МБ).',
    '5',
    'number',
    'Модули',
    false,
    false
  )
ON CONFLICT (code) DO NOTHING;

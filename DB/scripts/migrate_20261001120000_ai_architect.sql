-- ИИ-архитектор (ядро ИСАР): история диалогов + параметры SYS_AI_*.
-- Dual-миграция: этот файл (prod: psql -f) + DB/migrations/20261001120000_ai_architect.js (demo: node-pg-migrate).
-- Идемпотентно: CREATE ... IF NOT EXISTS, ON CONFLICT (code) DO NOTHING.
-- После применения перезапустите backend (подтянуть кэш ar_settings_parameters и права RBAC).

CREATE TABLE IF NOT EXISTS archrep.ar_ai_conversations (
  id         bigserial PRIMARY KEY,
  user_login varchar(100) NOT NULL,
  title      varchar(255) NOT NULL DEFAULT 'Новый диалог',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ar_ai_conversations_user_idx
  ON archrep.ar_ai_conversations (user_login, updated_at DESC);

CREATE TABLE IF NOT EXISTS archrep.ar_ai_messages (
  id              bigserial PRIMARY KEY,
  conversation_id bigint NOT NULL REFERENCES archrep.ar_ai_conversations(id) ON DELETE CASCADE,
  role            varchar(16) NOT NULL,
  content         text NOT NULL DEFAULT '',
  tool_name       varchar(64) NULL,
  payload         jsonb NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ar_ai_messages_role_chk'
  ) THEN
    ALTER TABLE archrep.ar_ai_messages
      ADD CONSTRAINT ar_ai_messages_role_chk
      CHECK (role IN ('user', 'assistant', 'tool'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ar_ai_messages_conversation_idx
  ON archrep.ar_ai_messages (conversation_id, id);

-- Публичные параметры панели (значения можно менять на странице «Настройки → Параметры»).
-- Секреты (AI_API_KEY, AI_BASE_URL) в БД не хранятся — только env сервера.
INSERT INTO archrep.ar_settings_parameters (code, description, value, value_type, "group", is_secret, read_only)
VALUES
  ('SYS_AI_ENABLED', 'ИИ-архитектор включён: кнопка в футере левого меню и панель чата доступны.', 'false', 'boolean', 'ИИ-архитектор', false, false),
  ('SYS_AI_MODEL', 'Имя модели ИИ-архитектора (OpenAI-совместимый endpoint, AI_BASE_URL).', 'Qwen/Qwen3.5-397B-A17B-FP8', 'string', 'ИИ-архитектор', false, false),
  ('SYS_AI_TITLE', 'Заголовок панели ИИ-архитектора.', 'ИИ-архитектор', 'string', 'ИИ-архитектор', false, false),
  ('SYS_AI_PANEL_WIDTH', 'Ширина панели ИИ-архитектора на десктопе, px (380–720).', '400', 'number', 'ИИ-архитектор', false, false),
  ('SYS_AI_HISTORY_LIMIT', 'Сколько последних сообщений диалога отправлять в модель, шт.', '20', 'number', 'ИИ-архитектор', false, false)
ON CONFLICT (code) DO NOTHING;

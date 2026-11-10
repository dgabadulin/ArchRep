-- Вложения в чате ИИ-архитектора (issue #95, п.3): публичные параметры SYS_AI_*.
-- Dual-миграция: этот файл (prod: psql -f) + DB/migrations/20261109120000_ai_attachments.js (demo: node-pg-migrate).
-- Идемпотентно: ON CONFLICT (code) DO NOTHING. Таблицы не меняются — метаданные вложений
-- сохраняются в существующем archrep.ar_ai_messages.payload (jsonb).
-- После применения перезапуск backend не нужен: CRUD параметров перечитывает кэш.

INSERT INTO archrep.ar_settings_parameters (code, description, value, value_type, "group", is_secret, read_only)
VALUES
  ('SYS_AI_ATTACHMENTS_ENABLED', 'Прикрепление файлов и изображений в чате ИИ-архитектора (issue #95). Текст читается в браузере, лимиты проверяются на сервере.', 'true', 'boolean', 'ИИ-архитектор', false, false),
  ('SYS_AI_VISION_ENABLED', 'Прикрепление изображений в чат ИИ-архитектора. Включать только если модель принимает image_url (проверка: scripts/ai-vision-probe.js).', 'false', 'boolean', 'ИИ-архитектор', false, false),
  ('SYS_AI_MAX_ATTACHMENTS', 'Максимум вложений в одном сообщении ИИ-архитектора (1–10).', '3', 'number', 'ИИ-архитектор', false, false),
  ('SYS_AI_MAX_ATTACHMENT_MB', 'Максимальный размер текстового вложения, МБ (1–10).', '1', 'number', 'ИИ-архитектор', false, false),
  ('SYS_AI_MAX_IMAGE_MB', 'Максимальный размер изображения-вложения, МБ (1–20).', '5', 'number', 'ИИ-архитектор', false, false),
  ('SYS_AI_MAX_ATTACHMENT_CHARS', 'Суммарный бюджет символов текста вложений в одном сообщении (1000–200000). Превышение обрезается с пометкой.', '30000', 'number', 'ИИ-архитектор', false, false)
ON CONFLICT (code) DO NOTHING;

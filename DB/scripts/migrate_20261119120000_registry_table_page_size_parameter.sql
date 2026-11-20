-- Issue #114: количество строк на странице табличных реестров.
-- Параметр читает фронт через GET /api/config (ARR_TABLE_PAGE_SIZE) и режет таблицу на страницы.
-- Пустое/0 значение — фронт использует дефолт 50. Идемпотентно; после наката перезапустить backend.

INSERT INTO archrep.ar_settings_parameters (code, description, value, value_type, "group", is_secret, read_only)
VALUES (
  'ARR_TABLE_PAGE_SIZE',
  'Количество строк на одной странице табличных реестров (Каталог ИС, интеграции, домены и др.). Допустимый диапазон на фронте: 5–500; пусто/0 — значение по умолчанию 50.',
  '50',
  'number',
  'Система',
  false,
  false
)
ON CONFLICT (code) DO NOTHING;

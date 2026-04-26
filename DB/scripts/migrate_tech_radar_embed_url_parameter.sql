-- Системный параметр TECH_RADAR_EMBED_URL (страница «Тех.радар», iframe).
-- Идемпотентно: при уже существующем code строка не меняется (ON CONFLICT DO NOTHING).
-- После применения перезапустите backend, чтобы подтянуть кэш ar_settings_parameters.

INSERT INTO archrep.ar_settings_parameters (code, description, value, value_type, "group", is_secret, read_only)
VALUES (
  'TECH_RADAR_EMBED_URL',
  'Полный URL iframe страницы «Тех.радар» (внешний сервис; documentId и др. в query). Значение задаётся только здесь или через env TECH_RADAR_EMBED_URL.',
  'https://radar.st.tech/?documentId=https://radar.st.tech/radar/platforma-a.csv',
  'string',
  'Технологии',
  false,
  false
)
ON CONFLICT (code) DO NOTHING;

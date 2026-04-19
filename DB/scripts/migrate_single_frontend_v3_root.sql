-- После перехода на единственный фронт (v3) с корня сайта.
-- Выполнить один раз на существующей БД (после деплоя с новой статикой).
-- Старые закладки /v3/... редиректятся на /... в BFF.

UPDATE archrep.ar_settings_parameters
SET value = '/'
WHERE code = 'ARR_APP_BASE'
  AND btrim(value) IN ('/v3/', '/v3');

-- Опционально: удалить неиспользуемые параметры v1/v2 (если нет внешних ссылок на code).
-- DELETE FROM archrep.ar_settings_parameters WHERE code IN ('ARR_FRONTEND_V1_PATH', 'ARR_FRONTEND_V2_PATH');

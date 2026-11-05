-- v4.0.0 «единое ядро»: подключаемые модули удалены.
--
-- Удаляет инфраструктуру модулей:
--   * archrep.isar_modules — реестр подключаемых модулей (в ядре больше нет загрузчика);
--   * параметр SYS_MODULE_drawio_pro_ENABLED — включал модуль DrawIO Pro;
--   * право drawio_pro:manage — из каталога прав (привязки к ролям удалятся каскадом).
--
-- ВАЖНО: параметр DRAWIO_MXFILE_MAX_MB НЕ удаляется — лимит mxfile использует ядро
-- (backend/adrIncrements.js, POST /api/increments/:id/diagrams).
--
-- До выкатки: ключи лицензий и SYS_MODULE_* из env можно удалить, они больше не читаются.
-- Идемпотентно: повторный запуск безопасен.

DROP TABLE IF EXISTS archrep.isar_modules;

DELETE FROM archrep.ar_settings_parameters
 WHERE code = 'SYS_MODULE_drawio_pro_ENABLED';

DELETE FROM archrep.ar_permissions
 WHERE code = 'drawio_pro:manage';

-- Версия схемы (issue #96): этот скрипт — последняя применённая миграция.
INSERT INTO archrep.ar_schema_info (code, version, applied_at, applied_by)
VALUES ('core', '20261106120000', now(), current_user)
ON CONFLICT (code) DO UPDATE
  SET version = EXCLUDED.version,
      applied_at = now(),
      applied_by = EXCLUDED.applied_by;

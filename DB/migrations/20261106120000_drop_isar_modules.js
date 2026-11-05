'use strict';

const fs = require('fs');
const path = require('path');

/**
 * v4.0.0 «единое ядро»: удаление инфраструктуры подключаемых модулей
 * (реестр isar_modules, параметр включения модуля, право drawio_pro:manage).
 *
 * Dual-миграция: тот же SQL, что в prod-скрипте
 * DB/scripts/migrate_20261106120000_drop_isar_modules.sql
 * (node-pg-migrate — для demo-схемы).
 */
exports.up = (pgm) => {
  const sqlPath = path.join(__dirname, '..', 'scripts', 'migrate_20261106120000_drop_isar_modules.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  pgm.sql(sql);
};

exports.down = (pgm) => {
  pgm.sql(`
    INSERT INTO archrep.ar_permissions (code, description, is_active)
    VALUES ('drawio_pro:manage', 'Модуль DrawIO Pro (удалён в v4.0.0)', true)
    ON CONFLICT (code) DO NOTHING;
    INSERT INTO archrep.ar_settings_parameters (code, description, value, value_type, "group", is_secret, read_only)
    VALUES ('SYS_MODULE_drawio_pro_ENABLED', 'Включение модуля DrawIO Pro (удалён в v4.0.0)', 'false', 'boolean', 'Модули', false, false)
    ON CONFLICT (code) DO NOTHING;
  `);
};

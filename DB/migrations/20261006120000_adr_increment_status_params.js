'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Статусы и лимиты контура заключения — параметры ar_settings_parameters (issue #91).
 * Тот же SQL, что в prod-сиде DB/scripts/migrate_20261006120000_adr_increment_status_params.sql
 * (dual-миграция: psql -f для prod, node-pg-migrate — для demo-схемы).
 */
exports.up = (pgm) => {
  const sqlPath = path.join(__dirname, '..', 'scripts', 'migrate_20261006120000_adr_increment_status_params.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  pgm.sql(sql);
};

exports.down = (pgm) => {
  pgm.sql(`
    DELETE FROM archrep.ar_settings_parameters WHERE code IN (
      'ADR_INCR_SYS_NEW_STATUS_CODE',
      'ADR_INCR_SYS_DEFAULT_STATUS_CODE',
      'ADR_INCR_SYSFUNC_NEW_STATUS_CODE',
      'ADR_INCR_REL_NEW_STATUS_CODE',
      'ADR_INCR_REL_EXISTING_STATUS_CODE',
      'ADR_EDITABLE_STATUS_CODES',
      'ADR_FLOW_DEFAULT_STATUS_CODE',
      'ADR_STATUS_MAP_STRICT',
      'SYS_AI_PREFILL_MAX_INCREMENTS',
      'SYS_AI_PREFILL_MAX_SYSTEMS',
      'SYS_AI_PREFILL_MAX_FUNCTIONS',
      'SYS_AI_PREFILL_MAX_RELATIONS',
      'SYS_AI_PREFILL_MAX_JSON_CHARS',
      'SYS_AI_FOCUS_MAX_IDS'
    );

    -- ADR_FLOW_STATUS_MAP возвращаем к историческому значению (как было до up()), т.к. up()
    -- выравнивает его ЗНАЧЕНИЯ на реальные коды справочника. Только если значение ещё «новое».
    UPDATE archrep.ar_settings_parameters
    SET value = '{"ADR_INCR_REL_CREATING":"FLOW_STATUS_PLANNED","ADR_INCR_REL_MODIFYING":"FLOW_STATUS_PRODUCTION","ADR_INCR_REL_IN_USE":"FLOW_STATUS_PRODUCTION","ADR_INCR_REL_REMOVING":"FLOW_STATUS_EXCLUDED","ADR_INCR_REL_PLANNED":"FLOW_STATUS_PLANNED","ADR_INCR_REL_IMPLEMENTING":"FLOW_STATUS_IN_PROGRESS","ADR_INCR_REL_DONE":"FLOW_STATUS_PRODUCTION"}'
    WHERE code = 'ADR_FLOW_STATUS_MAP'
      AND value = '{"ADR_INCR_REL_CREATING":"FLOW_STATUS_1","ADR_INCR_REL_MODIFYING":"FLOW_STATUS_3","ADR_INCR_REL_IN_USE":"FLOW_STATUS_3","ADR_INCR_REL_REMOVING":"FLOW_STATUS_4","ADR_INCR_REL_PLANNED":"FLOW_STATUS_1","ADR_INCR_REL_IMPLEMENTING":"FLOW_STATUS_2","ADR_INCR_REL_DONE":"FLOW_STATUS_3"}';

    -- Легаси-параметры (issue #31), удалённые в up(): возвращаем с исходными значениями,
    -- чтобы откат был полным. Идемпотентно: ON CONFLICT (code) DO NOTHING.
    INSERT INTO archrep.ar_settings_parameters (code, description, value, value_type, "group", is_secret, read_only)
    VALUES
      ('ADR_APPROVED_NAMES',
       'Список названий статусов утверждения; при смене на один из них из инкрементов создаются записи в реестре потоков.',
       '["Утверждено архитектором","Утверждено арх.советом"]', 'json', 'ADR', false, false),
      ('ADR_DRAFT_STATUS',
       'Название статуса «черновик» (редактирование разрешено только в нём).',
       'Черновик', 'string', 'ADR', false, false)
    ON CONFLICT (code) DO NOTHING;
  `);
};

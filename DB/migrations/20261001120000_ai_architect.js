'use strict';

const fs = require('fs');
const path = require('path');

/**
 * ИИ-архитектор: ar_ai_conversations / ar_ai_messages + параметры SYS_AI_*.
 * Единый источник — DB/scripts/migrate_20261001120000_ai_architect.sql (правило dual-миграций).
 */
exports.up = (pgm) => {
  const sqlPath = path.join(__dirname, '..', 'scripts', 'migrate_20261001120000_ai_architect.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  pgm.sql(sql);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS archrep.ar_ai_messages;
    DROP TABLE IF EXISTS archrep.ar_ai_conversations;
    DELETE FROM archrep.ar_settings_parameters
     WHERE code IN ('SYS_AI_ENABLED', 'SYS_AI_MODEL', 'SYS_AI_TITLE', 'SYS_AI_PANEL_WIDTH', 'SYS_AI_HISTORY_LIMIT');
  `);
};

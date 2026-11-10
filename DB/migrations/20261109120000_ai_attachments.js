'use strict';

const fs = require('fs');
const path = require('path');

/**
 * ИИ-архитектор: параметры вложений (issue #95, п.3).
 * Единый источник — DB/scripts/migrate_20261109120000_ai_attachments.sql (правило dual-миграций).
 */
exports.up = (pgm) => {
  const sqlPath = path.join(__dirname, '..', 'scripts', 'migrate_20261109120000_ai_attachments.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  pgm.sql(sql);
};

exports.down = (pgm) => {
  pgm.sql(`
    DELETE FROM archrep.ar_settings_parameters
     WHERE code IN (
       'SYS_AI_ATTACHMENTS_ENABLED',
       'SYS_AI_VISION_ENABLED',
       'SYS_AI_MAX_ATTACHMENTS',
       'SYS_AI_MAX_ATTACHMENT_MB',
       'SYS_AI_MAX_IMAGE_MB',
       'SYS_AI_MAX_ATTACHMENT_CHARS'
     );
  `);
};

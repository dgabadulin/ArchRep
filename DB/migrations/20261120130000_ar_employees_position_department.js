'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Справочник сотрудников: должность и подразделение (issue #122).
 * Единственный источник SQL — prod-скрипт:
 * DB/scripts/migrate_20261120130000_ar_employees_position_department.sql
 *
 * На demo применяется штатным `npm run db:migrate`; на prod — `psql -f`.
 */
exports.up = (pgm) => {
  const sqlPath = path.join(
    __dirname,
    '..',
    'scripts',
    'migrate_20261120130000_ar_employees_position_department.sql',
  );
  const sql = fs.readFileSync(sqlPath, 'utf8');
  pgm.sql(sql);
};

// Откат удаляет поля и снимает обычный индекс. Уникальность по фамилии не
// восстанавливаем: после появления однофамильцев это может упасть. На demo/prod
// откат выполняется только осознанно.
exports.down = false;

#!/usr/bin/env node
'use strict';

/**
 * Кросс-платформенный запуск тестов подключаемых модулей.
 * `node --test <dir>` в Node 24 не раскрывает каталог, а glob через cmd.exe не работает —
 * поэтому список файлов собирается здесь и передаётся явно.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const dir = path.join(__dirname, '..', 'backend', 'modules', '__tests__');
const files = fs
  .readdirSync(dir)
  .filter((name) => name.endsWith('.test.js'))
  .sort()
  .map((name) => path.join(dir, name));

if (!files.length) {
  console.error('[test:modules] не найдены тесты в backend/modules/__tests__');
  process.exit(1);
}

console.log(`[test:modules] файлов: ${files.length}`);
const res = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(res.status == null ? 1 : res.status);

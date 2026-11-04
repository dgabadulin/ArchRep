#!/usr/bin/env node
'use strict';

/**
 * Единая точка запуска тестов ядра: `npm test`.
 * Собирает все файлы `*.test.js` из каталогов `__tests__` внутри `backend` и запускает node:test.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const BACKEND = path.join(ROOT, 'backend');

function collect(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_) {
    return out;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') {
        for (const file of fs.readdirSync(full)) {
          if (file.endsWith('.test.js')) out.push(path.join(full, file));
        }
      } else {
        collect(full, out);
      }
    }
  }
  return out;
}

const files = collect(BACKEND).sort();
if (!files.length) {
  console.error('[test] не найдены тесты backend/**/__tests__/*.test.js');
  process.exit(1);
}
console.log(`[test] файлов: ${files.length}`);
const res = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(res.status == null ? 1 : res.status);

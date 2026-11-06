#!/usr/bin/env node
'use strict';

/**
 * Устанавливает git-хуки из каталога `.githooks` (`core.hooksPath`).
 * Запуск: `npm run hooks:install` (один раз на рабочую копию).
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const HOOKS_DIR = path.join(ROOT, '.githooks');

function git(args) {
  const res = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  if (res.status !== 0) {
    throw new Error(`git ${args.join(' ')} → ${res.status}: ${(res.stderr || '').trim()}`);
  }
  return (res.stdout || '').trim();
}

function main() {
  if (!fs.existsSync(HOOKS_DIR)) {
    console.error('[hooks] каталог .githooks не найден');
    return 1;
  }
  let previous = '';
  try {
    previous = git(['config', '--get', 'core.hooksPath']);
  } catch (_) {
    previous = '';
  }
  git(['config', 'core.hooksPath', '.githooks']);
  for (const name of fs.readdirSync(HOOKS_DIR)) {
    try {
      fs.chmodSync(path.join(HOOKS_DIR, name), 0o755);
    } catch (_) {
      /* на Windows режим не важен */
    }
  }
  console.log(`[hooks] core.hooksPath = .githooks (было: ${previous || '—'})`);
  console.log('[hooks] активен commit-msg → scripts/commit-gate.js (согласование сообщения коммита)');
  console.log('[hooks] проверить: npm run commit:gate');
  return 0;
}

if (require.main === module) process.exit(main());

module.exports = { main };

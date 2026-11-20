'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const SCRIPTS_DIR = path.join(ROOT, 'DB', 'scripts');
const MIGRATIONS_DIR = path.join(ROOT, 'DB', 'migrations');
const SCHEMA_MARKER_BASELINE = '20261104120000';

function listFiles(dir, pattern) {
  return fs
    .readdirSync(dir)
    .map((name) => {
      const match = pattern.exec(name);
      return match ? { name, prefix: match[1] } : null;
    })
    .filter(Boolean)
    .filter((entry) => entry.prefix >= SCHEMA_MARKER_BASELINE)
    .sort((a, b) => a.prefix.localeCompare(b.prefix));
}

function scripts() {
  return listFiles(SCRIPTS_DIR, /^migrate_(\d{14})_.+\.sql$/);
}

function migrations() {
  return listFiles(MIGRATIONS_DIR, /^(\d{14})_.+\.js$/);
}

test('schema marker: каждый prod SQL-скрипт после baseline обновляет ar_schema_info', () => {
  const entries = scripts();
  assert.ok(entries.length > 0, 'в DB/scripts нет migrate_*.sql после baseline');

  for (const entry of entries) {
    const sql = fs.readFileSync(path.join(SCRIPTS_DIR, entry.name), 'utf8');
    assert.match(sql, /ar_schema_info/, `${entry.name}: нет обращения к ar_schema_info`);
    assert.match(
      sql,
      /ON CONFLICT\s*\(\s*code\s*\)\s*DO UPDATE/i,
      `${entry.name}: нет upsert-а маркера (ON CONFLICT (code) DO UPDATE)`,
    );
    assert.match(
      sql,
      /WHERE\s+archrep\.ar_schema_info\.version\s*<\s*EXCLUDED\.version/i,
      `${entry.name}: upsert маркера не монотонный (нет WHERE archrep.ar_schema_info.version < EXCLUDED.version)`,
    );

    const marker = /VALUES\s*\(\s*'core'\s*,\s*'(\d{14})'/i.exec(sql);
    assert.ok(marker, `${entry.name}: не найден VALUES ('core', '<14 цифр>')`);
    assert.equal(
      marker[1],
      entry.prefix,
      `${entry.name}: маркер ${marker[1]} не совпадает с префиксом файла ${entry.prefix}`,
    );
  }
});

test('schema marker: каждой JS-миграции после baseline соответствует SQL-скрипт', () => {
  const sqlPrefixes = new Set(scripts().map((entry) => entry.prefix));
  const entries = migrations();
  assert.ok(entries.length > 0, 'в DB/migrations нет миграций после baseline');

  for (const entry of entries) {
    assert.ok(
      sqlPrefixes.has(entry.prefix),
      `${entry.name}: нет парного DB/scripts/migrate_${entry.prefix}_*.sql`,
    );
  }
});

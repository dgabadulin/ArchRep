'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const SCRIPTS_DIR = path.join(ROOT, 'DB', 'scripts');
const MIGRATIONS_DIR = path.join(ROOT, 'DB', 'migrations');
const DUAL_MIGRATION_BASELINE = '20261104120000';
const SCHEMA_MARKER_CUTOVER = '20261120120000';

function listFiles(dir, pattern, minPrefix) {
  return fs
    .readdirSync(dir)
    .map((name) => {
      const match = pattern.exec(name);
      return match ? { name, prefix: match[1] } : null;
    })
    .filter(Boolean)
    .filter((entry) => entry.prefix >= minPrefix)
    .sort((a, b) => a.prefix.localeCompare(b.prefix));
}

function scripts(minPrefix = SCHEMA_MARKER_CUTOVER) {
  return listFiles(SCRIPTS_DIR, /^migrate_(\d{14})_.+\.sql$/, minPrefix);
}

function allScripts() {
  return listFiles(SCRIPTS_DIR, /^migrate_(\d{14})_.+\.sql$/, '');
}

function migrations() {
  return listFiles(MIGRATIONS_DIR, /^(\d{14})_.+\.js$/, DUAL_MIGRATION_BASELINE);
}

test('schema marker: каждый новый prod SQL-скрипт начиная с cutover обновляет ar_schema_info', () => {
  const entries = scripts();
  assert.ok(entries.length > 0, `в DB/scripts нет новых migrate_*.sql начиная с ${SCHEMA_MARKER_CUTOVER}`);

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
  const sqlPrefixes = new Set(allScripts().map((entry) => entry.prefix));
  const entries = migrations();
  assert.ok(entries.length > 0, 'в DB/migrations нет миграций после baseline');

  for (const entry of entries) {
    assert.ok(
      sqlPrefixes.has(entry.prefix),
      `${entry.name}: нет парного DB/scripts/migrate_${entry.prefix}_*.sql`,
    );
  }
});

test('schema marker: ни в одном SQL-скрипте нет неоднозначного WHERE version', () => {
  for (const entry of allScripts()) {
    const sql = fs.readFileSync(path.join(SCRIPTS_DIR, entry.name), 'utf8');
    assert.doesNotMatch(
      sql,
      /WHERE\s+version\s*<\s*EXCLUDED\.version/i,
      `${entry.name}: неоднозначная ссылка WHERE version; нужно WHERE archrep.ar_schema_info.version`,
    );
  }
});

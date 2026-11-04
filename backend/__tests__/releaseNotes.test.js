'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { extractSection, buildReleaseNotes } = require('../../scripts/release-notes');

const CHANGELOG = `# Changelog

## 3.0.2

### Исправлено
- сортировка дат

## [3.0.1](https://example/compare)

Первый релиз.
`;

test('extractSection: секция по версии (заголовок с [ ])', () => {
  const section = extractSection(CHANGELOG, '3.0.1');
  assert.match(section, /Первый релиз/);
  assert.doesNotMatch(section, /сортировка дат/);
});

test('extractSection: секция по простому заголовку', () => {
  const section = extractSection(CHANGELOG, '3.0.2');
  assert.match(section, /сортировка дат/);
});

test('extractSection: нет секции → null', () => {
  assert.equal(extractSection(CHANGELOG, '9.9.9'), null);
});

test('buildReleaseNotes: front-matter + тело, канал stable/rc', () => {
  const stable = buildReleaseNotes('v3.0.1', CHANGELOG);
  assert.match(stable, /^---\ntitle: "ИСАР 3\.0\.1"/);
  assert.match(stable, /version: 3\.0\.1/);
  assert.match(stable, /channel: stable/);
  assert.match(stable, /Первый релиз/);

  const rc = buildReleaseNotes('v3.1.0-rc.1', CHANGELOG);
  assert.match(rc, /channel: rc/);
});

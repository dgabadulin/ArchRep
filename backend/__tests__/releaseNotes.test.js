'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { extractSection, isServiceRelease, buildReleaseNotes } = require('../../scripts/release-notes');

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

test('isServiceRelease: только «release X.Y.Z» → служебный; содержательные пункты → нет', () => {
  const service = '## [4.0.1](https://example/compare) (2026-11-05)\n\n\n### Служебное\n\n* release 4.0.1 ([2a235e5](https://example/commit))';
  assert.equal(isServiceRelease(service, '4.0.1'), true);
  assert.equal(isServiceRelease('', '4.0.1'), true);
  assert.equal(isServiceRelease('### Новое\n\n* feat: новая форма', '4.0.1'), false);
});

test('buildReleaseNotes: тело GitHub Release приоритетнее CHANGELOG.md', () => {
  const out = buildReleaseNotes('v3.0.1', CHANGELOG, {
    body: '### Новое\n\n* согласованный текст из GitHub Release',
    date: '2026-11-05',
  });
  assert.match(out, /date: 2026-11-05/);
  assert.match(out, /согласованный текст из GitHub Release/);
  assert.doesNotMatch(out, /Первый релиз/);
});

test('buildReleaseNotes: служебный релиз → шаблон вместо «release X.Y.Z»', () => {
  const out = buildReleaseNotes('v4.0.1', '', {
    body: '## [4.0.1](https://example/compare) (2026-11-05)\n\n\n### Служебное\n\n* release 4.0.1 ([abc1234](https://example/commit))',
  });
  assert.match(out, /## 4\.0\.1/);
  assert.match(out, /только служебные изменения/);
  assert.doesNotMatch(out, /Служебное/);
});

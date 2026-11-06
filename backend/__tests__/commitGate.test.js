'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  normalizeMessage,
  isExempt,
  compareMessages,
  check,
  APPROVAL_FILE,
} = require('../../scripts/commit-gate');

test('normalizeMessage: CRLF, комментарии git и пустые края', () => {
  const raw = '\r\n\r\ndocs(rules): тест\r\n\r\n# Please enter the commit message\r\n# Lines starting with # are ignored\r\n\r\nтело\r\n\r\n';
  assert.equal(normalizeMessage(raw), 'docs(rules): тест\n\nтело');
});

test('normalizeMessage: хвостовые пробелы и не-строка', () => {
  assert.equal(normalizeMessage('feat(api): x   \n\n'), 'feat(api): x');
  assert.equal(normalizeMessage(null), '');
  assert.equal(normalizeMessage(undefined), '');
});

test('normalizeMessage: комментарий в середине не ломает тело', () => {
  const raw = 'fix(deploy): гейт\n\n# пояснение\nстрока тела';
  assert.equal(normalizeMessage(raw), 'fix(deploy): гейт\n\nстрока тела');
});

test('isExempt: служебные сообщения пропускаются', () => {
  assert.match(isExempt('Merge branch \'main\' into main', {}), /служебное/);
  assert.match(isExempt('Revert "feat(api): что-то"', {}), /служебное/);
  assert.match(isExempt('fixup! feat(api): x', {}), /служебное/);
  assert.match(isExempt('amend! feat(api): x', {}), /служебное/);
});

test('isExempt: обычное сообщение не пропускается', () => {
  assert.equal(isExempt('docs(rules): шлюз разрешения', {}), null);
  assert.equal(isExempt('', {}), null);
});

test('isExempt: ISAR_COMMIT_GATE=off отключает гейт', () => {
  assert.equal(isExempt('feat(api): x', { ISAR_COMMIT_GATE: 'off' }), 'ISAR_COMMIT_GATE=off');
  assert.equal(isExempt('feat(api): x', { ISAR_COMMIT_GATE: 'OFF' }), 'ISAR_COMMIT_GATE=off');
  assert.equal(isExempt('feat(api): x', { ISAR_COMMIT_GATE: 'on' }), null);
});

test('compareMessages: совпадение после нормализации', () => {
  assert.equal(compareMessages('docs(rules): x\n', 'docs(rules): x\r\n\r\n'), true);
  assert.equal(compareMessages('docs(rules): x\n\nтело\n', 'docs(rules): x\n\nтело\n'), true);
});

test('compareMessages: расхождение и пустое ожидание', () => {
  assert.equal(compareMessages('docs(rules): x', 'docs(rules): y'), false);
  assert.equal(compareMessages('docs(rules): x\n\nтело', 'docs(rules): x'), false);
  assert.equal(compareMessages('', ''), false);
  assert.equal(compareMessages('   \n\n', '   \n\n'), false);
});

function tmpGitDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'isar-commit-gate-'));
}

test('check: без согласования блокирует коммит', () => {
  const dir = tmpGitDir();
  const messagePath = path.join(dir, 'COMMIT_EDITMSG');
  fs.writeFileSync(messagePath, 'docs(rules): тест\n', 'utf8');
  assert.equal(check({ gitDir: dir, messagePath }), 1);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('check: совпадающее согласование пропускает и расходует подтверждение', () => {
  const dir = tmpGitDir();
  const messagePath = path.join(dir, 'COMMIT_EDITMSG');
  fs.writeFileSync(messagePath, 'docs(rules): тест\n\nтело\n', 'utf8');
  fs.writeFileSync(path.join(dir, APPROVAL_FILE), 'docs(rules): тест\r\n\r\nтело\r\n', 'utf8');
  assert.equal(check({ gitDir: dir, messagePath }), 0);
  assert.equal(fs.existsSync(path.join(dir, APPROVAL_FILE)), false, 'подтверждение должно быть израсходовано');
  assert.equal(check({ gitDir: dir, messagePath }), 1, 'повторный коммит требует нового согласования');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('check: расхождение с согласованным блокирует', () => {
  const dir = tmpGitDir();
  const messagePath = path.join(dir, 'COMMIT_EDITMSG');
  fs.writeFileSync(messagePath, 'docs(rules): другой текст\n', 'utf8');
  fs.writeFileSync(path.join(dir, APPROVAL_FILE), 'docs(rules): тест\n', 'utf8');
  assert.equal(check({ gitDir: dir, messagePath }), 1);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('check: служебное сообщение проходит без согласования', () => {
  const dir = tmpGitDir();
  const messagePath = path.join(dir, 'COMMIT_EDITMSG');
  fs.writeFileSync(messagePath, "Merge branch 'main' into feature\n", 'utf8');
  assert.equal(check({ gitDir: dir, messagePath }), 0);
  fs.rmSync(dir, { recursive: true, force: true });
});

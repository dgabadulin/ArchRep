#!/usr/bin/env node
'use strict';

/**
 * Гейт сообщений коммита (pre-commit hook).
 *
 * Правило `.clinerules` §1: сообщение коммита показывается владельцу ДО коммита и требует явного «ок».
 * Механика: согласованный текст кладётся в `.git/isar-commit-ok` (одноразово), `pre-commit`
 * сверяет с ним `COMMIT_EDITMSG` и блокирует коммит при расхождении.
 *
 * Команды:
 *   node scripts/commit-gate.js check                          # вызывается хуком
 *   node scripts/commit-gate.js approve --file <utf8-файл>    # согласовать (после «ок» владельца)
 *   node scripts/commit-gate.js approve --message "<текст>"
 *   node scripts/commit-gate.js show                           # что сейчас согласовано
 *
 * Пропускаются служебные сообщения (`Merge …`, `Revert "…"`, `fixup!`, `squash!`, `amend!`, `reword!`)
 * и вызовы с `ISAR_COMMIT_GATE=off` (аварийно, только по явной просьбе владельца).
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const APPROVAL_FILE = 'isar-commit-ok';
const MESSAGE_FILE = 'COMMIT_EDITMSG';
const EXEMPT_PREFIXES = ['Merge ', 'Revert "', 'fixup!', 'squash!', 'amend!', 'reword!'];

/** Нормализует сообщение: CRLF → LF, убирает комментарии git, хвостовые пробелы,
 *  схлопывает повторные пустые строки и обрезает пустые края. */
function normalizeMessage(text) {
  if (typeof text !== 'string') return '';
  const lines = [];
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (line.startsWith('#')) continue;
    const trimmed = line.replace(/[ \t]+$/, '');
    if (trimmed === '' && lines.length && lines[lines.length - 1] === '') continue;
    lines.push(trimmed);
  }
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  while (lines.length && lines[0] === '') lines.shift();
  return lines.join('\n');
}

/** Причина пропуска гейта или null. */
function isExempt(message, env = process.env) {
  if (String(env.ISAR_COMMIT_GATE || '').toLowerCase() === 'off') return 'ISAR_COMMIT_GATE=off';
  const first = normalizeMessage(message).split('\n')[0] || '';
  const hit = EXEMPT_PREFIXES.find((prefix) => first.startsWith(prefix));
  return hit ? `служебное сообщение (${hit.trim()})` : null;
}

/** Совпадает ли фактическое сообщение с согласованным (после нормализации). */
function compareMessages(expected, actual) {
  const a = normalizeMessage(expected);
  return a !== '' && a === normalizeMessage(actual);
}

function readOrNull(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (_) {
    return null;
  }
}

function resolveGitDir(cwd = process.cwd()) {
  const out = execFileSync('git', ['rev-parse', '--git-dir'], { cwd, encoding: 'utf8' }).trim();
  return path.resolve(cwd, out);
}

function printBlocked(message, reason) {
  console.error('');
  console.error('================ КОММИТ ЗАБЛОКИРОВАН ================');
  console.error(`Причина: ${reason}.`);
  console.error('Сообщение коммита согласуется с владельцем ДО коммита (.clinerules §1).');
  console.error('');
  console.error('Предлагаемое сообщение:');
  console.error('---');
  console.error(message || '(пусто)');
  console.error('---');
  console.error('После «ок» владельца:');
  console.error('  npm run commit:approve -- --file <utf8-файл-с-сообщением>');
  console.error('  git commit -F <utf8-файл-с-сообщением>');
  console.error('Аварийный обход (только по явной просьбе): git commit --no-verify');
  console.error('====================================================');
}

function check(options = {}) {
  const cwd = options.cwd || process.cwd();
  const dir = options.gitDir || resolveGitDir(cwd);
  const messagePath = options.messagePath || path.join(dir, MESSAGE_FILE);
  const raw = readOrNull(messagePath);
  if (raw == null) {
    console.log(`[commit-gate] ${path.basename(messagePath)} не найден — проверять нечего`);
    return 0;
  }
  const message = normalizeMessage(raw);
  const exempt = isExempt(message);
  if (exempt) {
    console.log(`[commit-gate] пропуск: ${exempt}`);
    return 0;
  }
  const approvalPath = path.join(dir, APPROVAL_FILE);
  const approved = readOrNull(approvalPath);
  if (approved == null) {
    printBlocked(message, 'нет согласованного сообщения');
    return 1;
  }
  if (!compareMessages(approved, message)) {
    console.error('--- согласовано ранее ---');
    console.error(normalizeMessage(approved));
    console.error('-------------------------');
    printBlocked(message, 'сообщение не совпадает с согласованным');
    return 1;
  }
  fs.rmSync(approvalPath, { force: true });
  console.log('[commit-gate] сообщение согласовано — подтверждение израсходовано');
  return 0;
}

function approve(args) {
  const dir = resolveGitDir(process.cwd());
  const fileIndex = args.indexOf('--file');
  const messageIndex = args.indexOf('--message');
  let text = null;
  if (fileIndex !== -1 && args[fileIndex + 1]) text = fs.readFileSync(args[fileIndex + 1], 'utf8');
  else if (messageIndex !== -1 && args[messageIndex + 1]) text = args[messageIndex + 1];
  if (!text) {
    console.error('[commit-gate] укажите --file <path> или --message "<текст>"');
    return 2;
  }
  const normalized = normalizeMessage(text);
  if (!normalized) {
    console.error('[commit-gate] пустое сообщение согласовать нельзя');
    return 2;
  }
  fs.writeFileSync(path.join(dir, APPROVAL_FILE), `${normalized}\n`, 'utf8');
  console.log('[commit-gate] согласовано:');
  console.log('---');
  console.log(normalized);
  console.log('---');
  return 0;
}

function show() {
  const dir = resolveGitDir(process.cwd());
  const approved = readOrNull(path.join(dir, APPROVAL_FILE));
  if (approved == null) {
    console.log('[commit-gate] согласованного сообщения нет');
    return 0;
  }
  console.log('[commit-gate] согласовано:');
  console.log('---');
  console.log(normalizeMessage(approved));
  console.log('---');
  return 0;
}

function main(argv = process.argv.slice(2)) {
  const command = argv[0] || 'check';
  if (command === 'check') {
    // Хук commit-msg передаёт путь к файлу с сообщением (может отличаться от COMMIT_EDITMSG).
    const messagePath = argv[1] && !argv[1].startsWith('-') ? path.resolve(argv[1]) : null;
    return check(messagePath ? { messagePath } : {});
  }
  if (command === 'approve') return approve(argv.slice(1));
  if (command === 'show') return show();
  console.error(`[commit-gate] неизвестная команда: ${command} (check [path]|approve|show)`);
  return 2;
}

if (require.main === module) process.exit(main());

module.exports = {
  normalizeMessage,
  isExempt,
  compareMessages,
  check,
  main,
  APPROVAL_FILE,
  MESSAGE_FILE,
};

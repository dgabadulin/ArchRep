#!/usr/bin/env node
'use strict';

/**
 * Release notes для тега (issue #96) → Markdown с front-matter (asset релиза + сайт).
 *
 * Источник текста (по приоритету):
 *   1. `--body-file <path>` — тело GitHub Release (workflow выгружает `gh release view`);
 *   2. `--from-release` — то же, но скрипт сам вызывает `gh release view`;
 *   3. секция `CHANGELOG.md` на текущем коммите (fallback, работает без gh).
 *
 * Служебные релизы (в теле только «Служебное → release X.Y.Z», без содержательных пунктов)
 * заменяются шаблоном — чтобы на сайте не появлялась новость «release X.Y.Z».
 *
 * Запуск:
 *   node scripts/release-notes.js --tag v3.0.1 --out release-notes.md
 *   node scripts/release-notes.js --tag v3.0.1 --body-file release-body.md --out release-notes.md
 *   node scripts/release-notes.js --tag v3.0.1 --from-release
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

function arg(name, def = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

/** Прочитать текст с автоопределением BOM (PowerShell-редирект даёт UTF-16LE). */
function readText(file) {
  const buf = fs.readFileSync(file);
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return buf.slice(2).toString('utf16le');
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    const swapped = Buffer.from(buf.slice(2));
    swapped.swap16();
    return swapped.toString('utf16le');
  }
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.slice(3).toString('utf8');
  }
  return buf.toString('utf8');
}

/**
 * Вырезать секцию релиза из CHANGELOG.
 * @param {string} changelog
 * @param {string} version — без префикса v
 * @returns {string|null}
 */
function extractSection(changelog, version) {
  const lines = String(changelog || '').split(/\r?\n/);
  const escape = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^##\\s+(?:\\[)?v?${escape}(?:\\]|\\(|\\s|$)`);
  const start = lines.findIndex((l) => re.test(l));
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^##\s+/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start + 1, end).join('\n').trim();
}

function tagDate(tag) {
  try {
    return execFileSync('git', ['log', '-1', '--format=%cs', tag], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch (_) {
    return new Date().toISOString().slice(0, 10);
  }
}

function escapeRe(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * «Служебный» релиз: в теле нет содержательных пунктов — только заголовки секций
 * и строка вида `release X.Y.Z` (так выглядит релиз, выпущенный пустым коммитом
 * `chore: release X.Y.Z` с `Release-As`).
 * @param {string|null} body
 * @param {string} version — без префикса v
 */
function isServiceRelease(body, version) {
  const text = String(body || '')
    .replace(/^#{1,6}\s.*$/gm, '')
    .replace(/^---$/gm, '')
    .trim();
  if (!text) return true;
  const items = text
    .split(/\r?\n/)
    .map((line) => line
      .replace(/^[\s*-]+/, '')
      .replace(/\(\[[^\]]*\]\([^)]*\)\)/g, '') // хвост «([2a235e5](https://…))»
      .replace(/\*\*/g, '')
      .trim())
    .filter(Boolean);
  if (!items.length) return true;
  const releaseRe = new RegExp(`^release\\s+v?${escapeRe(version)}$`, 'i');
  return items.every((item) => releaseRe.test(item));
}

/** Текст новости для служебного релиза (вместо «Служебное: release X.Y.Z»). */
function serviceBody(version) {
  return [
    `## ${version}`,
    '',
    'В этом релизе — только служебные изменения (версия, документация, инфраструктура).',
    'Пользовательских изменений нет.',
  ].join('\n');
}
/**
 * Собрать release-notes.md.
 *
 * @param {string} tag — vX.Y.Z
 * @param {string} changelog — содержимое CHANGELOG.md (fallback-источник)
 * @param {{body?:string|null, date?:string}} [opts] — тело GitHub Release и дата релиза
 * @returns {string}
 */
function buildReleaseNotes(tag, changelog, opts = {}) {
  const version = String(tag || '').replace(/^v/, '').trim();
  const fromRelease = typeof opts.body === 'string' ? opts.body.trim() : '';
  const fromChangelog = extractSection(changelog, version) || '';
  let body = fromRelease || fromChangelog;
  if (isServiceRelease(body, version)) body = serviceBody(version);

  const channel = /-(rc|beta|alpha)\./i.test(version) ? 'rc' : 'stable';
  const date = String(opts.date || '').trim() || tagDate(tag);
  const front = [
    '---',
    `title: "ИСАР ${version}"`,
    `date: ${date}`,
    `version: ${version}`,
    `tag: ${tag}`,
    `channel: ${channel}`,
    '---',
    '',
  ].join('\n');
  return `${front}${body}\n`;
}

/** Тело релиза из GitHub (через gh CLI); null, если gh недоступен. */
function releaseBodyFromGh(tag) {
  try {
    const out = execFileSync('gh', ['release', 'view', tag, '--json', 'body,publishedAt'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const parsed = JSON.parse(out);
    return {
      body: typeof parsed.body === 'string' ? parsed.body : null,
      date: typeof parsed.publishedAt === 'string' ? parsed.publishedAt.slice(0, 10) : null,
    };
  } catch (_) {
    return null;
  }
}

function main() {
  const tag = String(arg('tag') || process.env.GITHUB_REF_NAME || '').trim();
  if (!tag) {
    console.error('[release-notes] укажите --tag vX.Y.Z');
    process.exit(1);
  }

  const changelogPath = path.join(ROOT, 'CHANGELOG.md');
  const changelog = fs.existsSync(changelogPath) ? readText(changelogPath) : '';

  let body = null;
  let date = arg('date');

  const bodyFile = arg('body-file');
  if (bodyFile) {
    body = readText(path.resolve(ROOT, bodyFile));
  } else if (hasFlag('from-release')) {
    const fromGh = releaseBodyFromGh(tag);
    if (fromGh) {
      body = fromGh.body;
      date = date || fromGh.date;
    } else {
      console.warn('[release-notes] gh release view недоступен — беру секцию CHANGELOG.md');
    }
  }

  if (!changelog && !body) {
    console.error('[release-notes] нет ни CHANGELOG.md, ни тела релиза (--body-file/--from-release)');
    process.exit(1);
  }

  const out = buildReleaseNotes(tag, changelog, { body, date });
  const outFile = arg('out');
  if (outFile) {
    fs.writeFileSync(path.resolve(ROOT, outFile), out, 'utf8');
    console.log(`[release-notes] ${tag} → ${outFile}`);
  } else {
    process.stdout.write(out);
  }
}

module.exports = { extractSection, isServiceRelease, serviceBody, buildReleaseNotes };

if (require.main === module) main();


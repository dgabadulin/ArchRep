#!/usr/bin/env node
'use strict';

/**
 * Release notes для тега (issue #96): секция CHANGELOG.md → Markdown с front-matter.
 *
 * Запуск: node scripts/release-notes.js --tag v3.0.1 --out release-notes.md
 * Используется workflow `release-notes.yml` (артефакт release-notes.md в GitHub Release),
 * а также сайтом (archrep-site) как источник новости.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

function arg(name, def = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
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

function buildReleaseNotes(tag, changelog) {
  const version = String(tag || '').replace(/^v/, '').trim();
  const body = extractSection(changelog, version);
  const channel = /-(rc|beta|alpha)\./i.test(version) ? 'rc' : 'stable';
  const front = [
    '---',
    `title: "ИСАР ${version}"`,
    `date: ${tagDate(tag)}`,
    `version: ${version}`,
    `tag: ${tag}`,
    `channel: ${channel}`,
    '---',
    '',
  ].join('\n');
  return `${front}${body || `## ${version}\n\nИзменения см. в описании релиза.`}\n`;
}

function main() {
  const tag = String(arg('tag') || process.env.GITHUB_REF_NAME || '').trim();
  if (!tag) {
    console.error('[release-notes] укажите --tag vX.Y.Z');
    process.exit(1);
  }
  const changelogPath = path.join(ROOT, 'CHANGELOG.md');
  if (!fs.existsSync(changelogPath)) {
    console.error(`[release-notes] не найден ${changelogPath}`);
    process.exit(1);
  }
  const out = buildReleaseNotes(tag, fs.readFileSync(changelogPath, 'utf8'));
  const outFile = arg('out');
  if (outFile) {
    fs.writeFileSync(path.resolve(ROOT, outFile), out, 'utf8');
    console.log(`[release-notes] ${tag} → ${outFile}`);
  } else {
    process.stdout.write(out);
  }
}

module.exports = { extractSection, buildReleaseNotes };

if (require.main === module) main();

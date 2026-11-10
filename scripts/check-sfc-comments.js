#!/usr/bin/env node
'use strict';

/**
 * Проверка «висячих» JSDoc-комментариев во фронтенде (frontend-v3/src).
 *
 * Опасный дефект: строка, состоящая только из открывающего маркера комментария, без
 * продолжения ` * …`. В JS блочный комментарий закрывается первым встречным закрывающим
 * маркером, поэтому такой «обрубок» молча комментирует код до следующего закрывающего
 * маркера: объявления исчезают, шаблон ссылается на несуществующие биндинги, а сборка
 * и `node --check` этого не видят — для них это валидный JS.
 *
 * Именно так была сломана `DiagramEditorView.vue`: `drawioBase`, `iframeSrc` и `onMounted`
 * оказались закомментированы, экран всегда показывал «не задан адрес Draw.io», а draw.io
 * не загружался — при полностью корректном параметре `DRAWIO_EMBED_BASE`.
 *
 * Запуск: `npm run check:sfc`. При находках — код выхода 1.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'frontend-v3', 'src');
const EXTENSIONS = new Set(['.js', '.mjs', '.vue']);
const SKIP_DIRS = new Set(['node_modules', 'dist']);

function collect(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_) {
    return out;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(full, out);
    else if (EXTENSIONS.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

/**
 * Найти «висячий» открывающий маркер: строка ровно из него, а следующая непустая строка
 * не начинается с `*` (то есть это не документирующий блок, а обрубок).
 * @param {string} text
 * @returns {{line:number, next:string}[]}
 */
function findDanglingDocComments(text) {
  const lines = String(text).split(/\r?\n/);
  const problems = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() !== '/**') continue;
    let j = i + 1;
    while (j < lines.length && lines[j].trim() === '') j++;
    if (j >= lines.length) continue;
    const next = lines[j].trim();
    if (next.startsWith('*')) continue;
    problems.push({ line: i + 1, next });
  }
  return problems;
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`[check:sfc] каталог не найден: ${SRC}`);
    process.exit(2);
  }
  const files = collect(SRC).sort();
  let failed = 0;
  for (const file of files) {
    const problems = findDanglingDocComments(fs.readFileSync(file, 'utf8'));
    for (const p of problems) {
      failed += 1;
      const rel = path.relative(ROOT, file).replace(/\\/g, '/');
      console.error(`  FAIL ${rel}:${p.line} — висячий «/**» перед: ${p.next}`);
    }
  }
  if (failed) {
    console.error(`\n[check:sfc] найдено проблем: ${failed}. Обрубок «/**» комментирует код — удалите его.`);
    process.exit(1);
  }
  console.log(`[check:sfc] ok: файлов ${files.length}, висячих «/**» нет`);
}

module.exports = { findDanglingDocComments, collect };

if (require.main === module) main();

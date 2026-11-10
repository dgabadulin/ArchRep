'use strict';

/**
 * Тесты вложений ИИ-архитектора (issue #95, п.3):
 * классификация файлов, лимиты, сборка текстового блока и подстановка в сообщение модели.
 * Проверяется главное: сервер не доверяет клиенту (размеры/типы/бюджет) и не сохраняет base64.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  classifyAttachment,
  base64Bytes,
  toDataUrl,
  buildAttachmentsText,
  normalizeAttachments,
} = require('../ai/attachments');
const { applyAttachmentsToLastUser } = require('../ai/aiService');

const LIMITS = { enabled: true, vision: false, maxFiles: 3, maxFileMb: 1, maxImageMb: 5, maxChars: 1000 };

test('classifyAttachment: текст по расширению/mime, изображение по mime, прочее — null', () => {
  assert.equal(classifyAttachment({ name: 'a.csv' }), 'text');
  assert.equal(classifyAttachment({ name: 'a.JSON' }), 'text');
  assert.equal(classifyAttachment({ name: 'x', mime: 'text/plain' }), 'text');
  assert.equal(classifyAttachment({ name: 'x', mime: 'application/json' }), 'text');
  assert.equal(classifyAttachment({ name: 'a.png', mime: 'image/png' }), 'image');
  assert.equal(classifyAttachment({ name: 'a.bin', mime: 'application/octet-stream' }), null);
  assert.equal(classifyAttachment(null), null);
});

test('base64Bytes: размер data-URL и чистого base64', () => {
  assert.equal(base64Bytes(''), 0);
  // 4 символа base64 без паддинга = 3 байта
  assert.equal(base64Bytes('AAAA'), 3);
  // «AA==» = 1 байт
  assert.equal(base64Bytes('AA=='), 1);
  assert.equal(base64Bytes('data:image/png;base64,AAAA'), 3);
});

test('toDataUrl: добавляет префикс и убирает существующий', () => {
  assert.equal(toDataUrl('image/png', 'AAAA'), 'data:image/png;base64,AAAA');
  assert.equal(toDataUrl('image/jpeg', 'data:image/jpeg;base64,AAAA'), 'data:image/jpeg;base64,AAAA');
});

test('buildAttachmentsText: заголовки файлов и пометка усечения по бюджету', () => {
  const built = buildAttachmentsText(
    [
      { name: 'a.txt', text: 'строка A' },
      { name: 'b.txt', text: 'x'.repeat(100) },
    ],
    120,
  );
  assert.match(built.block, /--- Вложение: a\.txt \(8 симв\.\) ---/);
  assert.equal(built.truncated, true);
  assert.match(built.block, /\(вложение усечено\)/);
  // второй файл не попал целиком, но попал в meta с флагом
  assert.ok(built.included.length >= 1);
  assert.equal(built.included[0].name, 'a.txt');
});

test('normalizeAttachments: пустой список — без ошибок и без текста', () => {
  const res = normalizeAttachments([], LIMITS);
  assert.equal(res.ok, true);
  assert.equal(res.text, '');
  assert.deepEqual(res.images, []);
  assert.deepEqual(res.meta, []);
});

test('normalizeAttachments: вложения отключены / превышено число / неизвестный тип', () => {
  assert.equal(normalizeAttachments([{ name: 'a.txt', text: 'x' }], { ...LIMITS, enabled: false }).error.code, 'AI_ATTACHMENTS_DISABLED');
  assert.equal(
    normalizeAttachments([{ name: '1.txt', text: 'a' }, { name: '2.txt', text: 'b' }, { name: '3.txt', text: 'c' }, { name: '4.txt', text: 'd' }], LIMITS).error.code,
    'AI_ATTACHMENT_LIMIT',
  );
  assert.equal(normalizeAttachments([{ name: 'a.exe', mime: 'application/x-msdownload' }], LIMITS).error.code, 'AI_ATTACHMENT_TYPE');
  assert.equal(normalizeAttachments([{ name: 'a.txt', text: '   ' }], LIMITS).error.code, 'AI_ATTACHMENT_EMPTY');
});

test('normalizeAttachments: изображения только при vision=true, размер проверяется по base64', () => {
  const img = { name: 'shot.png', mime: 'image/png', kind: 'image', dataBase64: 'AAAA' };
  assert.equal(normalizeAttachments([img], LIMITS).error.code, 'AI_VISION_DISABLED');

  const withVision = normalizeAttachments([img], { ...LIMITS, vision: true });
  assert.equal(withVision.ok, true);
  assert.equal(withVision.images.length, 1);
  assert.equal(withVision.images[0].dataUrl, 'data:image/png;base64,AAAA');
  // в метаданных нет base64 — только имя/тип/размер
  assert.equal(JSON.stringify(withVision.meta).includes('base64'), false);

  // 8 МБ base64 ≈ 6 МБ бинарных данных — больше лимита 5 МБ
  const big = { name: 'big.png', mime: 'image/png', kind: 'image', dataBase64: 'data:image/png;base64,' + 'A'.repeat(8 * 1024 * 1024) };
  assert.equal(normalizeAttachments([big], { ...LIMITS, vision: true }).error.code, 'AI_ATTACHMENT_TOO_LARGE');
});

test('normalizeAttachments: успешный кейс — текст, метаданные и отсутствие base64 в meta', () => {
  const res = normalizeAttachments([{ name: 'schema.csv', mime: 'text/csv', text: 'a,b\n1,2' }], LIMITS);
  assert.equal(res.ok, true);
  assert.match(res.text, /--- Вложение: schema\.csv/);
  assert.equal(res.meta.length, 1);
  assert.equal(res.meta[0].kind, 'text');
  assert.equal(res.meta[0].name, 'schema.csv');
  assert.equal(res.meta[0].truncated, false);
});

test('applyAttachmentsToLastUser: текст идёт перед вопросом, в историю БД он не попадает', () => {
  const messages = [
    { role: 'system', content: 'sys' },
    { role: 'user', content: 'Что в файле?' },
  ];
  applyAttachmentsToLastUser(messages, { text: '--- Вложение: a.txt (5 симв.) ---\nhello', images: [] });
  assert.equal(messages[1].role, 'user');
  assert.match(messages[1].content, /^--- Вложение: a\.txt/);
  assert.match(messages[1].content, /Что в файле\?$/);
  // system и порядок сообщений не тронуты
  assert.equal(messages[0].content, 'sys');
});

test('applyAttachmentsToLastUser: изображения → content как массив parts', () => {
  const messages = [{ role: 'user', content: 'Опиши схему' }];
  applyAttachmentsToLastUser(messages, {
    text: '',
    images: [{ name: 'a.png', dataUrl: 'data:image/png;base64,AAAA' }],
  });
  assert.ok(Array.isArray(messages[0].content));
  assert.deepEqual(messages[0].content[0], { type: 'text', text: 'Опиши схему' });
  assert.deepEqual(messages[0].content[1], { type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } });
});

test('applyAttachmentsToLastUser: без вложений сообщение не меняется', () => {
  const messages = [{ role: 'user', content: 'вопрос' }];
  applyAttachmentsToLastUser(messages, { text: '', images: [] });
  assert.equal(messages[0].content, 'вопрос');
  applyAttachmentsToLastUser(messages, undefined);
  assert.equal(messages[0].content, 'вопрос');
});

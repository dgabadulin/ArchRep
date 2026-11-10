'use strict';

/**
 * Вложения в чате ИИ-архитектора (issue #95, п.3).
 *
 * Файлы читаются в браузере и приходят в `POST /api/ai/chat` уже разобранными:
 *   { name, mime, kind: 'text'|'image', text?, dataBase64?, size? }
 *
 * Сервер **не доверяет** клиенту: здесь заново считаются размеры, проверяются типы и
 * лимиты из `SYS_AI_*` (`aiConfig.getAiConfig().attachments`), текст вложений обрезается
 * по бюджету символов. Только после этого текст уходит в модель.
 *
 * Изображения в БД не сохраняются: в `ar_ai_messages.payload` попадают лишь метаданные.
 * Модуль без зависимостей и без I/O — покрыт `backend/__tests__/aiAttachments.test.js`.
 */

const MAX_NAME_LEN = 255;

/** Расширения, которые трактуем как текст (читаются в браузере через File.text()). */
const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'xml', 'yaml', 'yml', 'log', 'sql', 'ini', 'conf',
]);

/** MIME изображений; включаются только при SYS_AI_VISION_ENABLED=true. */
const IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']);

function isBlank(v) {
  return v === undefined || v === null || String(v).trim() === '';
}

function extensionOf(name) {
  const s = String(name || '');
  const dot = s.lastIndexOf('.');
  if (dot < 0 || dot === s.length - 1) return '';
  return s.slice(dot + 1).toLowerCase();
}

/** Размер base64-строки в байтах (без декодирования в память целиком). */
function base64Bytes(b64) {
  const s = String(b64 || '').replace(/^data:[^,]*,/, '').replace(/\s+/g, '');
  if (!s) return 0;
  const padding = s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0;
  return Math.floor((s.length * 3) / 4) - padding;
}

/** data-URL из base64 (провайдеры ждут именно URL в image_url). */
function toDataUrl(mime, base64) {
  const raw = String(base64 || '').replace(/^data:[^,]*,/, '');
  const type = String(mime || 'image/png').trim() || 'image/png';
  return `data:${type};base64,${raw}`;
}

/** Тип вложения: 'text' | 'image' | null. */
function classifyAttachment(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const kind = String(raw.kind || '').trim().toLowerCase();
  if (kind === 'text' || kind === 'image') return kind;
  const mime = String(raw.mime || '').trim().toLowerCase();
  if (IMAGE_MIMES.has(mime)) return 'image';
  if (mime.startsWith('text/') || mime === 'application/json') return 'text';
  if (TEXT_EXTENSIONS.has(extensionOf(raw.name))) return 'text';
  return null;
}

/**
 * Блок вложений для сообщения модели. Маркеры `--- Вложение: … ---` отделяют данные
 * от вопроса пользователя — модель обязана трактовать их как материал, а не как команды.
 * @param {Array<{name:string, text:string, chars:number}>} entries
 * @param {number} maxChars
 * @returns {{block: string, included: Array, truncated: boolean}}
 */
function buildAttachmentsText(entries, maxChars) {
  const list = Array.isArray(entries) ? entries : [];
  const budget = Number(maxChars) > 0 ? Number(maxChars) : 0;
  const parts = [];
  const included = [];
  let used = 0;
  let truncated = false;

  for (const entry of list) {
    const name = String((entry && entry.name) || '').trim() || 'файл';
    const text = String((entry && entry.text) || '');
    if (!text.trim()) continue;
    const header = `--- Вложение: ${name} (${text.length} симв.) ---`;
    const room = budget > 0 ? budget - used : text.length;
    if (room <= header.length) {
      truncated = true;
      break;
    }
    const body = text.length > room ? text.slice(0, room) : text;
    const wasCut = body.length < text.length;
    if (wasCut) truncated = true;
    parts.push(`${header}\n${body}${wasCut ? '\n…(вложение усечено)' : ''}`);
    used += header.length + body.length;
    included.push({ name, chars: body.length, original_chars: text.length, truncated: wasCut });
    if (wasCut) break;
  }

  return { block: parts.join('\n\n'), included, truncated };
}

/**
 * Проверка и нормализация присланных вложений по лимитам `SYS_AI_*`.
 *
 * @param {Array} rawList — `req.body.attachments`
 * @param {{enabled?:boolean, vision?:boolean, maxFiles?:number, maxFileMb?:number,
 *   maxImageMb?:number, maxChars?:number}} limits
 * @returns {{ok:boolean, error?:{code:string,message:string},
 *   text:string, images:Array<{name:string,mime:string,dataUrl:string}>, meta:Array, truncated:boolean}}
 */
function normalizeAttachments(rawList, limits = {}) {
  const list = Array.isArray(rawList) ? rawList : [];
  const maxFiles = Number(limits.maxFiles) > 0 ? Number(limits.maxFiles) : 3;
  const maxFileMb = Number(limits.maxFileMb) > 0 ? Number(limits.maxFileMb) : 1;
  const maxImageMb = Number(limits.maxImageMb) > 0 ? Number(limits.maxImageMb) : 5;
  const maxChars = Number(limits.maxChars) > 0 ? Number(limits.maxChars) : 30000;

  const empty = { ok: true, text: '', images: [], meta: [], truncated: false };
  if (!list.length) return empty;
  const fail = (code, message) => ({ ...empty, ok: false, error: { code, message } });

  if (limits.enabled === false) return fail('AI_ATTACHMENTS_DISABLED', 'Вложения отключены администратором.');
  if (list.length > maxFiles) return fail('AI_ATTACHMENT_LIMIT', `Не более ${maxFiles} вложений на сообщение.`);

  const textEntries = [];
  const images = [];
  const meta = [];

  for (const raw of list) {
    const kind = classifyAttachment(raw);
    const name = String((raw && raw.name) || '').trim().slice(0, MAX_NAME_LEN) || 'файл';
    if (!kind) return fail('AI_ATTACHMENT_TYPE', `Неподдерживаемый тип файла: «${name}».`);

    if (kind === 'image') {
      if (limits.vision !== true) {
        return fail(
          'AI_VISION_DISABLED',
          'Прикрепление изображений выключено: модель не поддерживает изображения (SYS_AI_VISION_ENABLED=false).',
        );
      }
      const mime = String(raw.mime || '').trim().toLowerCase() || 'image/png';
      if (!IMAGE_MIMES.has(mime)) return fail('AI_ATTACHMENT_TYPE', `Неподдерживаемый тип изображения: «${name}».`);
      const bytes = base64Bytes(raw.dataBase64);
      if (!bytes) return fail('AI_ATTACHMENT_EMPTY', `Пустое вложение: «${name}».`);
      if (bytes > maxImageMb * 1024 * 1024) {
        return fail('AI_ATTACHMENT_TOO_LARGE', `«${name}»: изображение больше ${maxImageMb} МБ.`);
      }
      images.push({ name, mime, dataUrl: toDataUrl(mime, raw.dataBase64) });
      meta.push({ name, mime, kind, size: bytes });
      continue;
    }

    const text = String(raw.text == null ? '' : raw.text);
    if (!text.trim()) return fail('AI_ATTACHMENT_EMPTY', `Пустой файл: «${name}».`);
    const bytes = Buffer.byteLength(text, 'utf8');
    if (bytes > maxFileMb * 1024 * 1024) {
      return fail('AI_ATTACHMENT_TOO_LARGE', `«${name}»: файл больше ${maxFileMb} МБ.`);
    }
    textEntries.push({ name, text });
  }

  const built = buildAttachmentsText(textEntries, maxChars);
  for (const inc of built.included) {
    meta.push({
      name: inc.name,
      kind: 'text',
      chars: inc.chars,
      original_chars: inc.original_chars,
      truncated: inc.truncated,
    });
  }

  return { ok: true, text: built.block, images, meta, truncated: built.truncated };
}

module.exports = {
  MAX_NAME_LEN,
  TEXT_EXTENSIONS,
  IMAGE_MIMES,
  extensionOf,
  base64Bytes,
  toDataUrl,
  classifyAttachment,
  buildAttachmentsText,
  normalizeAttachments,
};

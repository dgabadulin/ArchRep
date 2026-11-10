/**
 * Вложения чата ИИ-архитектора: чтение файлов в браузере (issue #95, п.3).
 *
 * Файл не загружается на сервер «как есть»: здесь он превращается в текст (для документов и
 * таблиц) или в data-URL (для изображений), а сервер (`backend/ai/attachments.js`) заново
 * проверяет типы, размеры и бюджет символов. Лимиты приходят из `GET /api/config` (`SYS_AI_*`).
 */
import { getConfig } from '../config/params.js'

/** Расширения, читаемые как текст. */
export const TEXT_EXTENSIONS = ['txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'xml', 'yaml', 'yml', 'log', 'sql', 'ini', 'conf']

/** Таблицы разбираются через xlsx (зависимость уже есть в проекте). */
export const TABLE_EXTENSIONS = ['xlsx', 'xls']

/** Изображения — только при SYS_AI_VISION_ENABLED=true. */
export const IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']

function extOf(name) {
  const s = String(name || '')
  const dot = s.lastIndexOf('.')
  return dot < 0 ? '' : s.slice(dot + 1).toLowerCase()
}

/** Лимиты вложений из публичного конфига (совпадают с серверными дефолтами). */
export function limitsFromConfig() {
  const cfg = getConfig()
  const num = (value, def) => {
    const n = Number(value)
    return Number.isFinite(n) && n > 0 ? n : def
  }
  return {
    enabled: cfg.SYS_AI_ATTACHMENTS_ENABLED !== false,
    vision: cfg.SYS_AI_VISION_ENABLED === true,
    maxFiles: num(cfg.SYS_AI_MAX_ATTACHMENTS, 3),
    maxFileMb: num(cfg.SYS_AI_MAX_ATTACHMENT_MB, 1),
    maxImageMb: num(cfg.SYS_AI_MAX_IMAGE_MB, 5),
    maxChars: num(cfg.SYS_AI_MAX_ATTACHMENT_CHARS, 30000),
  }
}

/** Тип файла: 'text' | 'image' | null. */
export function classifyFile(file) {
  const mime = String((file && file.type) || '').toLowerCase()
  const ext = extOf(file && file.name)
  if (IMAGE_MIMES.includes(mime)) return 'image'
  if (mime.startsWith('text/') || mime === 'application/json') return 'text'
  if (TEXT_EXTENSIONS.includes(ext) || TABLE_EXTENSIONS.includes(ext)) return 'text'
  return null
}

/** `accept` для input[type=file] с учётом включённого vision. */
export function acceptAttr(limits = limitsFromConfig()) {
  const list = [
    ...TEXT_EXTENSIONS.map((e) => `.${e}`),
    ...TABLE_EXTENSIONS.map((e) => `.${e}`),
  ]
  if (limits.vision) list.push(...IMAGE_MIMES)
  return list.join(',')
}

/** Расширение по MIME изображения (`image/jpeg` → `jpg`). */
function extFromMime(mime) {
  const m = String(mime || '').toLowerCase()
  if (m === 'image/jpeg' || m === 'image/jpg') return 'jpg'
  if (m === 'image/webp') return 'webp'
  if (m === 'image/gif') return 'gif'
  return 'png'
}

/**
 * Имя для картинки из буфера обмена: у скриншота имя `image.png` или пустое,
 * поэтому формируем человекочитаемое `вставка-20261109-143015.png`.
 */
export function pastedImageName(date = new Date(), mime = 'image/png') {
  const pad = (n) => String(n).padStart(2, '0')
  const d = date instanceof Date ? date : new Date()
  const stamp =
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  return `вставка-${stamp}.${extFromMime(mime)}`
}

/** Пересобрать File с нормальным именем (имя у File только для чтения). */
function renamePastedImage(file, mime) {
  try {
    return new File([file], pastedImageName(new Date(), mime), {
      type: mime || 'image/png',
      lastModified: file.lastModified || Date.now(),
    })
  } catch (_) {
    return file
  }
}

/** data-URL → File (фолбэк для приложений, которые кладут картинку только в HTML). */
function dataUrlToFile(dataUrl, mime) {
  try {
    const base64 = String(dataUrl).replace(/^data:[^,]*,/, '')
    const bin = atob(base64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i)
    return new File([bytes], pastedImageName(new Date(), mime), { type: mime })
  } catch (_) {
    return null
  }
}

/**
 * Изображения из буфера обмена (Ctrl+V). Скриншот приходит как `kind: 'file'`
 * в `clipboardData.items`; некоторые приложения — только как HTML с `data:`-URL.
 * @param {DataTransfer|null} clipboardData
 * @returns {File[]}
 */
export function extractPastedImages(clipboardData) {
  if (!clipboardData) return []
  const out = []

  const pushImage = (file) => {
    if (!file) return
    const mime = String(file.type || '').toLowerCase()
    if (!IMAGE_MIMES.includes(mime)) return
    out.push(renamePastedImage(file, mime))
  }

  const items = clipboardData.items ? Array.from(clipboardData.items) : []
  for (const item of items) {
    if (!item || item.kind !== 'file') continue
    pushImage(typeof item.getAsFile === 'function' ? item.getAsFile() : null)
  }
  if (out.length) return out

  // Часть браузеров отдаёт файлы только в `files`, без `items`.
  const files = clipboardData.files ? Array.from(clipboardData.files) : []
  for (const file of files) pushImage(file)
  if (out.length) return out

  const html = typeof clipboardData.getData === 'function' ? String(clipboardData.getData('text/html') || '') : ''
  const hit = /<img[^>]+src=["'](data:image\/(png|jpeg|jpg|webp|gif);base64,[^"']+)["']/i.exec(html)
  if (hit) {
    const mime = `image/${hit[2].toLowerCase() === 'jpg' ? 'jpeg' : hit[2].toLowerCase()}`
    const file = dataUrlToFile(hit[1], mime)
    if (file) out.push(file)
  }
  return out
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'))
    reader.readAsDataURL(file)
  })
}

/** Excel/CSV-таблица → плоский текст (лист за листом), с ограничением по длине. */
async function readTable(file, maxChars) {
  const mod = await import('xlsx')
  const XLSX = mod && mod.default ? mod.default : mod
  const buffer = await file.arrayBuffer()
  const book = XLSX.read(buffer, { type: 'array' })
  const parts = []
  let used = 0
  for (const sheetName of book.SheetNames || []) {
    const csv = XLSX.utils.sheet_to_csv(book.Sheets[sheetName], { blankrows: false })
    if (!csv.trim()) continue
    const header = `[Лист: ${sheetName}]`
    const room = maxChars > 0 ? maxChars - used : csv.length
    if (room <= header.length) break
    const body = csv.length > room ? csv.slice(0, room) : csv
    parts.push(`${header}\n${body}`)
    used += header.length + body.length
    if (body.length < csv.length) break
  }
  return parts.join('\n\n')
}

/**
 * Прочитать файл в вложение для API.
 * @param {File} file
 * @param {object} [limits]
 * @returns {Promise<{name:string, mime:string, kind:'text'|'image', size:number, text?:string, dataBase64?:string, chars?:number}>}
 */
export async function readAttachment(file, limits = limitsFromConfig()) {
  const kind = classifyFile(file)
  if (!kind) {
    throw new Error(`Неподдерживаемый тип файла: «${file.name}». Доступны текст, CSV, Excel${limits.vision ? ' и изображения' : ''}.`)
  }
  if (kind === 'image') {
    if (!limits.vision) {
      throw new Error(
        'Прикрепление изображений выключено. Включается параметром SYS_AI_VISION_ENABLED — только после проверки модели: node scripts/ai-vision-probe.js.',
      )
    }
    if (file.size > limits.maxImageMb * 1024 * 1024) {
      throw new Error(`«${file.name}»: изображение больше ${limits.maxImageMb} МБ.`)
    }
    const dataUrl = await readAsDataUrl(file)
    return {
      name: file.name,
      mime: file.type || 'image/png',
      kind: 'image',
      size: file.size,
      dataBase64: dataUrl,
    }
  }

  if (file.size > limits.maxFileMb * 1024 * 1024) {
    throw new Error(`«${file.name}»: файл больше ${limits.maxFileMb} МБ.`)
  }
  const isTable = TABLE_EXTENSIONS.includes(extOf(file.name))
  const text = isTable ? await readTable(file, limits.maxChars) : await file.text()
  if (!String(text || '').trim()) throw new Error(`«${file.name}»: файл пустой.`)
  return {
    name: file.name,
    mime: file.type || 'text/plain',
    kind: 'text',
    size: file.size,
    chars: String(text).length,
    text: String(text),
  }
}

/** Суммарная длина текста вложений (для индикатора бюджета). */
export function totalChars(list) {
  return (Array.isArray(list) ? list : []).reduce((sum, a) => sum + (a && a.kind === 'text' ? Number(a.chars) || 0 : 0), 0)
}

/** Вложения → тело запроса `POST /api/ai/chat`. */
export function toPayload(list) {
  return (Array.isArray(list) ? list : []).map((a) => ({
    name: a.name,
    mime: a.mime,
    kind: a.kind,
    text: a.kind === 'text' ? a.text : undefined,
    dataBase64: a.kind === 'image' ? a.dataBase64 : undefined,
  }))
}

/** Метаданные для отображения в пузыре сообщения (без содержимого). */
export function toMeta(list) {
  return (Array.isArray(list) ? list : []).map((a) => ({
    name: a.name,
    kind: a.kind,
    size: a.size,
    chars: a.chars,
  }))
}

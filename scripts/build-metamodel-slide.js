'use strict';
// ---------------------------------------------------------------------------
// Сборка схемы метамодели ИСАР: «Метамодель ИСАР: сущности и типы связей».
// PPTX собирается без внешних зависимостей: OOXML + собственный ZIP-writer.
//
// Версионирование схемы (правило `.clinerules` §10):
//   - добавлена СВЯЗЬ      → минор:  2.0 → 2.1
//   - добавлена СУЩНОСТЬ   → мажор:  2.1 → 3.0
// Новый файл пишется в `docs/diagrams/Метамодель ИСАР <версия>.pptx`;
// прежняя версия не редактируется (история схемы сохраняется).
//
// Запуск: npm run build:metamodel -- 2.1
// ---------------------------------------------------------------------------
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/** Версия схемы (X.Y) — обязательный аргумент: прежние файлы не перезаписываются. */
const versionArg = String(process.argv[2] || '').trim();
if (!/^\d+\.\d+$/.test(versionArg)) {
  console.error('Укажите версию схемы: npm run build:metamodel -- 2.1');
  process.exit(1);
}
const VERSION = versionArg;
/** Необязательный путь вывода (`--out <file>`): предпросмотр без перезаписи версии. */
const outArgIndex = process.argv.indexOf('--out');
const CUSTOM_OUT = outArgIndex > 0 ? String(process.argv[outArgIndex + 1] || '').trim() : '';
/** Дата снимка метамодели — обновлять при выпуске версии. */
const SNAPSHOT = '22.11.2026';
const SNAPSHOT_ISO = '2026-11-22T12:00:00Z';

const EMU = 914400;
const emu = v => Math.round(v * EMU);

// ------------------------------- ZIP ---------------------------------------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function zip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const f of files) {
    const data = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data, 'utf8');
    const crc = crc32(data);
    const deflated = zlib.deflateRawSync(data, { level: 9 });
    const store = deflated.length >= data.length;
    const body = store ? data : deflated;
    const method = store ? 0 : 8;
    const nameBuf = Buffer.from(f.name, 'utf8');

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0x21, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, body);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(method, 10);
    cd.writeUInt16LE(0, 12);
    cd.writeUInt16LE(0x21, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(body.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(offset, 42);
    centrals.push(cd, nameBuf);

    offset += local.length + nameBuf.length + body.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([Buffer.concat(locals), centralBuf, end]);
}

// ------------------------------ служебное ----------------------------------
const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

let idSeq = 10;
const nextId = () => idSeq++;

// ------------------------------- цвета -------------------------------------
const NAVY = '1F3864';       // рамки карточек, линии связей
const ORANGE = 'C55A11';     // заголовки сущностей
const PANEL = 'F2F2F2';      // фон панелей-слоёв
const PANEL_TXT = 'CFCFCF';  // «водяной» заголовок панели
const LABEL = '3C3C3C';      // подписи связей
const CODE = '8C8C8C';       // коды сущностей
const MUTED = '808080';


// --------------------------- DrawingML-хелперы -----------------------------
function runProps(sz, bold, color, italic) {
  return `<a:rPr lang="ru-RU" altLang="en-US" sz="${Math.round(sz * 100)}"${bold ? ' b="1"' : ''}${italic ? ' i="1"' : ''} dirty="0">`
    + `<a:solidFill><a:srgbClr val="${color}"/></a:solidFill>`
    + `<a:latin typeface="Segoe UI"/><a:cs typeface="Segoe UI"/></a:rPr>`;
}

function paragraph(text, opts) {
  const { sz = 6, bold = false, color = LABEL, italic = false, align = 'ctr', lnSpc = 88, spcBef = 0 } = opts || {};
  return `<a:p><a:pPr algn="${align}" marL="0" indent="0">`
    + `<a:lnSpc><a:spcPct val="${Math.round(lnSpc * 1000)}"/></a:lnSpc>`
    + `<a:spcBef><a:spcPts val="${Math.round(spcBef * 100)}"/></a:spcBef><a:spcAft><a:spcPts val="0"/></a:spcAft>`
    + `</a:pPr><a:r>${runProps(sz, bold, color, italic)}<a:t>${esc(text)}</a:t></a:r></a:p>`;
}

/**
 * Прямоугольник / текстовый блок / подпись.
 * lines — массив { text, sz, bold, color, italic, align }
 */
function box(opts) {
  const {
    x, y, w, h,
    fill = null, line = null, lineW = 0.75, dash = null,
    geom = 'rect', radius = 0.08,
    lines = [], anchor = 'ctr', rot = 0,
    insetX = 0.04, insetY = 0.02, name = 'shape', align = 'ctr', lnSpc = 88
  } = opts;
  const id = nextId();
  const prst = geom === 'roundRect'
    ? `<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val ${Math.min(50000, Math.round((radius / Math.max(w, 0.01)) * 100000))}"/></a:avLst></a:prstGeom>`
    : geom === 'ellipse'
      ? '<a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom>'
      : '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>';
  const fillXml = fill ? `<a:solidFill><a:srgbClr val="${fill}"/></a:solidFill>` : '<a:noFill/>';
  const lineXml = line
    ? `<a:ln w="${Math.round(lineW * 12700)}" cap="flat"><a:solidFill><a:srgbClr val="${line}"/></a:solidFill>`
      + `${dash ? `<a:prstDash val="${dash}"/>` : ''}<a:round/></a:ln>`
    : '<a:ln><a:noFill/></a:ln>';
  const rotAttr = rot ? ` rot="${rot}"` : '';
  const paras = lines.length
    ? lines.map(l => paragraph(l.text, {
      sz: l.sz || 6, bold: !!l.bold, color: l.color || LABEL,
      italic: !!l.italic, align: l.align || align, lnSpc, spcBef: l.spcBef || 0
    })).join('')
    : '<a:p><a:endParaRPr lang="ru-RU"/></a:p>';
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${esc(name)}-${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>`
    + `<p:spPr><a:xfrm${rotAttr}><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm>`
    + `${prst}${fillXml}${lineXml}</p:spPr>`
    + `<p:txBody><a:bodyPr wrap="square" lIns="${emu(insetX)}" tIns="${emu(insetY)}" rIns="${emu(insetX)}" bIns="${emu(insetY)}" anchor="${anchor}"><a:noAutofit/></a:bodyPr><a:lstStyle/>${paras}</p:txBody></p:sp>`;
}

/** Отрезок со стрелкой. */
function line(x1, y1, x2, y2, opts) {
  const { color = NAVY, w = 0.75, arrow = true, head = false, dash = null, name = 'conn' } = opts || {};
  const id = nextId();
  const offX = Math.min(x1, x2);
  const offY = Math.min(y1, y2);
  const cx = Math.abs(x2 - x1);
  const cy = Math.abs(y2 - y1);
  const flipH = x2 < x1 ? ' flipH="1"' : '';
  const flipV = y2 < y1 ? ' flipV="1"' : '';
  const dashXml = dash ? `<a:prstDash val="${dash}"/>` : '';
  const heads = (head ? '<a:headEnd type="triangle" w="sm" len="sm"/>' : '<a:headEnd type="none"/>')
    + (arrow ? '<a:tailEnd type="triangle" w="sm" len="sm"/>' : '<a:tailEnd type="none"/>');
  return `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${id}" name="${esc(name)}-${id}"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr>`
    + `<p:spPr><a:xfrm${flipH}${flipV}><a:off x="${emu(offX)}" y="${emu(offY)}"/><a:ext cx="${emu(cx)}" cy="${emu(cy)}"/></a:xfrm>`
    + `<a:prstGeom prst="line"><a:avLst/></a:prstGeom><a:noFill/>`
    + `<a:ln w="${Math.round(w * 12700)}" cap="flat"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill>${dashXml}<a:round/>${heads}</a:ln>`
    + `</p:spPr></p:cxnSp>`;
}

/** Полилиния: стрелка только на последнем сегменте. */
function polyline(points, opts) {
  const parts = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    parts.push(line(x1, y1, x2, y2, { ...(opts || {}), arrow: i === points.length - 2 }));
  }
  return parts.join('');
}


// ---------------------------------------------------------------------------
// Данные схемы: панели-слои, сущности, связи (39 типов из md-файла)
// ---------------------------------------------------------------------------
const PANELS = [
  { x: 0.20, y: 0.85, w: 2.30, h: 3.20, title: 'УПРАВЛЕНИЕ АРХИТЕКТУРОЙ' },
  { x: 2.70, y: 0.85, w: 7.90, h: 1.75, title: 'БИЗНЕС-СЛОЙ' },
  { x: 2.70, y: 2.95, w: 7.90, h: 2.10, title: 'ПРИКЛАДНОЙ СЛОЙ' },
  { x: 0.20, y: 5.25, w: 5.85, h: 1.60, title: 'ТЕХНОЛОГИИ, ИНФРАСТРУКТУРА, ПАРТНЁРЫ' },
  { x: 6.20, y: 5.25, w: 4.40, h: 1.60, title: 'ИНТЕРНЕТ-ПРИСУТСТВИЕ' },
  { x: 10.72, y: 0.85, w: 2.42, h: 2.65, title: 'УЧАСТНИКИ' }
];

/** Панель «Типы связей»: линии и номера не должны заходить внутрь неё. */
const LEGEND = { x: 10.72, y: 3.60, w: 2.42, h: 3.25 };

const ENTITIES = {
  adr_principle: { x: 0.35, y: 1.10, w: 1.95, h: 0.62, name: 'ADRP', code: 'прикладной принцип · adr_principle' },
  applied: { x: 0.35, y: 2.10, w: 1.95, h: 0.62, name: 'Архитектурное заключение', code: 'applied' },
  gap: { x: 0.35, y: 3.10, w: 1.95, h: 0.62, name: 'Архитектурный долг', code: 'gap' },

  organization_unit: { x: 2.90, y: 1.35, w: 1.70, h: 0.66, name: 'Организационная единица', code: 'organization_unit' },
  business_function: { x: 5.25, y: 1.35, w: 1.75, h: 0.66, name: 'Бизнес-способность', code: 'business_function' },
  business_service: { x: 8.05, y: 1.35, w: 1.90, h: 0.66, name: 'Бизнес-сервис (продукт)', code: 'business_service' },

  system: { x: 2.90, y: 3.25, w: 2.40, h: 0.80, name: 'Информационная система', code: 'system' },
  subsystem: { x: 6.05, y: 3.25, w: 2.40, h: 0.80, name: 'Модуль системы', code: 'subsystem' },
  system_function: { x: 8.75, y: 3.25, w: 1.65, h: 0.80, name: 'Функция ИС', code: 'system_function' },

  partner: { x: 0.40, y: 5.55, w: 1.55, h: 0.62, name: 'Партнёр', code: 'partner' },
  technology: { x: 2.10, y: 5.55, w: 1.75, h: 0.62, name: 'Технология', code: 'technology' },
  infrastructure_object: { x: 4.00, y: 5.55, w: 1.85, h: 0.62, name: 'Сервер инфраструктуры', code: 'infrastructure_object' },

  web_resource: { x: 6.35, y: 5.55, w: 1.20, h: 0.62, name: 'Веб-ресурс', code: 'web_resource' },
  domain: { x: 7.70, y: 5.55, w: 1.15, h: 0.62, name: 'Домен', code: 'domain' },
  certificate: { x: 9.00, y: 5.55, w: 1.50, h: 0.62, name: 'Сертификат', code: 'certificate' },

  actor: { x: 10.87, y: 1.15, w: 2.12, h: 0.62, name: 'Заинтересованное лицо', code: 'actor' },
  employee: { x: 10.87, y: 2.40, w: 2.12, h: 0.62, name: 'Сотрудник', code: 'employee' }
};

/**
 * Связи. rel — id типов связей (ar_metamodel_relation_types.id), pts — маршрут в дюймах.
 * Расшифровка id — в реестре REL (легенда слайда).
 */
const EDGES = [
  // --- управление архитектурой ---
  { rel: [45], pts: [[0.70, 2.10], [0.70, 1.72]] },
  { rel: [13], pts: [[0.70, 2.72], [0.70, 3.10]] },
  { rel: [11], pts: [[2.30, 3.41], [2.90, 3.41]] },

  // --- бизнес-слой ---
  { rel: [35], pts: [[4.60, 1.66], [5.25, 1.66]] },
  { rel: [30], pts: [[7.00, 1.66], [8.05, 1.66]] },
  { rel: [31], pts: [[3.40, 2.01], [3.40, 2.30], [9.30, 2.30], [9.30, 2.01]] },
  { rel: [34], pts: [[10.87, 1.42], [10.62, 1.42], [10.62, 0.98], [5.60, 0.98], [5.60, 1.35]] },
  { rel: [44], pts: [[11.93, 1.77], [11.93, 2.15], [10.25, 2.15], [10.25, 3.25]] },

  // --- бизнес-слой <-> прикладной слой ---
  { rel: [33], pts: [[4.55, 3.25], [4.55, 2.42], [6.60, 2.42], [6.60, 2.01]] },
  { rel: [29], pts: [[4.05, 3.25], [4.05, 2.14], [9.50, 2.14], [9.50, 2.01]] },
  { rel: [32], pts: [[8.85, 3.25], [8.85, 2.62], [6.75, 2.62], [6.75, 2.01]] },
  { rel: [28], pts: [[9.85, 3.25], [9.85, 2.01]] },

  // --- ядро: информационная система и модуль ---
  { rel: [12], pts: [[6.05, 3.62], [5.30, 3.62]] },
  { rel: [21], pts: [[4.60, 4.05], [4.60, 4.72], [7.75, 4.72], [7.75, 4.05]], pos: 0.32 },
  { rel: [22], pts: [[7.20, 4.05], [7.20, 4.45], [5.20, 4.45], [5.20, 4.05]] },
  { rel: [43], pts: [[4.30, 4.05], [4.30, 4.95], [9.60, 4.95], [9.60, 4.05]] },
  { rel: [46], pts: [[8.35, 4.05], [8.35, 4.30], [9.35, 4.30], [9.35, 4.05]] }
];


EDGES.push(
  // --- технологии и инфраструктура ---
  { rel: [19], pts: [[3.05, 4.05], [3.05, 5.55]] },
  { rel: [20], pts: [[6.15, 4.05], [6.15, 5.42], [3.45, 5.42], [3.45, 5.55]] },
  { rel: [52], pts: [[3.55, 4.05], [3.55, 5.20], [4.90, 5.20], [4.90, 5.55]] },
  { rel: [53], pts: [[6.35, 4.05], [6.35, 5.32], [5.10, 5.32], [5.10, 5.55]] },

  // --- партнёры ---
  { rel: [37, 38, 39], pts: [[2.90, 3.90], [2.58, 3.90], [2.58, 4.85], [1.20, 4.85], [1.20, 5.55]] },
  { rel: [40, 41, 42], pts: [[7.90, 4.05], [7.90, 5.12], [1.60, 5.12], [1.60, 5.55]] },
  { rel: [36], pts: [[2.60, 6.17], [2.60, 6.55], [1.15, 6.55], [1.15, 6.17]] },

  // --- веб-ресурсы, домены, сертификаты ---
  { rel: [47], pts: [[5.05, 4.05], [5.05, 4.85], [7.35, 4.85], [7.35, 5.55]] },
  { rel: [48], pts: [[7.00, 4.05], [7.00, 5.55]], pos: 0.33 },
  { rel: [49], pts: [[7.10, 6.17], [7.10, 6.48], [8.25, 6.48], [8.25, 6.17]] },
  { rel: [50], pts: [[9.30, 6.17], [9.30, 6.62], [8.60, 6.62], [8.60, 6.17]] },

  // --- сотрудники (ответственные и владельцы) ---
  { rel: [25, 27], pts: [[4.90, 3.25], [4.90, 3.10], [10.55, 3.10], [10.55, 2.30], [11.90, 2.30], [11.90, 2.40]] },
  { rel: [24, 26], pts: [[8.20, 4.05], [8.20, 4.20], [10.66, 4.20], [10.66, 2.71], [10.87, 2.71]] },
  { rel: [51], pts: [[10.00, 5.55], [10.00, 4.35], [10.50, 4.35], [10.50, 3.45], [11.90, 3.45], [11.90, 3.02]] },

  // --- организация-владелец ИС (issue #126): organization_unit → system ---
  { rel: [54], pts: [[3.05, 2.01], [3.05, 3.25]] }
);


// ---------------------------------------------------------------------------
// Реестр типов связей: id -> name / пара сущностей (из md-снимка)
// ---------------------------------------------------------------------------
const REL = {
  11: { name: 'Относится к', from: 'gap', to: 'system' },
  12: { name: 'Модуль системы', from: 'subsystem', to: 'system' },
  13: { name: 'Фиксирует арх. долг', from: 'applied', to: 'gap' },
  14: { name: 'Интеграционный поток', from: 'system', to: 'system' },
  19: { name: 'Использует', from: 'system', to: 'technology' },
  20: { name: 'Использует', from: 'subsystem', to: 'technology' },
  21: { name: 'Интеграционный поток (Система → Модуль)', from: 'system', to: 'subsystem' },
  22: { name: 'Интеграционный поток (Модуль → Система)', from: 'subsystem', to: 'system' },
  23: { name: 'Интеграционный поток (Модуль → Модуль)', from: 'subsystem', to: 'subsystem' },
  24: { name: 'Ответственный от ИТ', from: 'subsystem', to: 'employee' },
  25: { name: 'Ответственный от ИТ', from: 'system', to: 'employee' },
  26: { name: 'Владелец системы', from: 'subsystem', to: 'employee' },
  27: { name: 'Владелец системы', from: 'system', to: 'employee' },
  28: { name: 'Обеспечивает продукт', from: 'system_function', to: 'business_service' },
  29: { name: 'Обеспечивает продукт', from: 'system', to: 'business_service' },
  30: { name: 'Поддерживает сервис', from: 'business_function', to: 'business_service' },
  31: { name: 'Отвечает за', from: 'organization_unit', to: 'business_service' },
  32: { name: 'Реализует бизнес-функцию', from: 'system_function', to: 'business_function' },
  33: { name: 'Реализует бизнес-функцию', from: 'system', to: 'business_function' },
  34: { name: 'Отвечает за', from: 'actor', to: 'business_function' },
  35: { name: 'Отвечает за', from: 'organization_unit', to: 'business_function' },
  36: { name: 'Вендор', from: 'technology', to: 'partner' },
  37: { name: 'Вендор', from: 'system', to: 'partner' },
  38: { name: 'Интегратор', from: 'system', to: 'partner' },
  39: { name: 'Поддерживает', from: 'system', to: 'partner' },
  40: { name: 'Вендор', from: 'subsystem', to: 'partner' },
  41: { name: 'Интегратор', from: 'subsystem', to: 'partner' },
  42: { name: 'Поддерживает', from: 'subsystem', to: 'partner' },
  43: { name: 'Содержит функцию ИС', from: 'system', to: 'system_function' },
  44: { name: 'Использует функцию ИС', from: 'actor', to: 'system_function' },
  45: { name: 'Соблюдает принцип', from: 'applied', to: 'adr_principle' },
  46: { name: 'Содержит функцию ИС', from: 'subsystem', to: 'system_function' },
  47: { name: 'Опубликован', from: 'system', to: 'web_resource' },
  48: { name: 'Опубликован', from: 'subsystem', to: 'web_resource' },
  49: { name: 'Размещен', from: 'web_resource', to: 'domain' },
  50: { name: 'Выпущен для', from: 'certificate', to: 'domain' },
  51: { name: 'Ответственный', from: 'certificate', to: 'employee' },
  52: { name: 'Размещена на', from: 'system', to: 'infrastructure_object' },
  53: { name: 'Размещена на', from: 'subsystem', to: 'infrastructure_object' },
  54: { name: 'Владеет', from: 'organization_unit', to: 'system' }
};

// Самосвязи «Интеграционный поток» (14, 23) — петли у нижней кромки карточек
EDGES.push(
  { rel: [14], pts: [[3.45, 4.05], [3.45, 4.22], [3.08, 4.22], [3.08, 4.05]] },
  { rel: [23], pts: [[7.55, 4.05], [7.55, 4.22], [7.18, 4.22], [7.18, 4.05]] }
);

// Счётчики для подписей слайда считаются из данных (без ручных правок текстов).
const ENTITY_COUNT = Object.keys(ENTITIES).length;
const REL_COUNT = Object.keys(REL).length;
/** Типы связей, которые вводятся вручную (остальные — managed-проекции). */
const MANUAL_REL_IDS = [11, 13, 28, 29, 30, 32, 33, 34, 44, 45];
const MANAGED_REL_COUNT = REL_COUNT - MANUAL_REL_IDS.filter((id) => REL[id]).length;

/**
 * Точки для номеров типов связей: на самом длинном сегменте маршрута,
 * компактной группой (для пар со несколькими типами связей).
 */
function badgePoints(e) {
  const pts = e.pts;
  let bi = 0;
  let bl = -1;
  for (let i = 0; i < pts.length - 1; i++) {
    const len = Math.abs(pts[i + 1][0] - pts[i][0]) + Math.abs(pts[i + 1][1] - pts[i][1]);
    if (len > bl && (e.seg === undefined || e.seg === i)) { bl = len; bi = i; }
  }
  const [x1, y1] = pts[bi];
  const [x2, y2] = pts[bi + 1];
  const horizontal = Math.abs(y2 - y1) < 1e-9;
  const n = e.rel.length;
  const step = 0.19;
  const lo = 0.11;
  const t0 = e.pos === undefined ? 0.5 : e.pos;
  const res = [];
  for (let k = 0; k < n; k++) {
    const d = (k - (n - 1) / 2) * step;
    if (horizontal) {
      const mid = Math.min(x1, x2) + Math.abs(x2 - x1) * t0;
      const cx = Math.min(Math.max(mid + d, Math.min(x1, x2) + lo), Math.max(x1, x2) - lo);
      res.push({ id: e.rel[k], x: cx, y: y1 });
    } else {
      const mid = Math.min(y1, y2) + Math.abs(y2 - y1) * t0;
      const cy = Math.min(Math.max(mid + d, Math.min(y1, y2) + lo), Math.max(y1, y2) - lo);
      res.push({ id: e.rel[k], x: x1, y: cy });
    }
  }
  return res;
}

/** Номер типа связи: белый кружок с id. */
function badgeShape(id, x, y) {
  return box({
    x: x - 0.085, y: y - 0.085, w: 0.17, h: 0.17,
    fill: 'FFFFFF', line: NAVY, lineW: 0.6, geom: 'ellipse', name: 'rel-id',
    lines: [{ text: String(id), sz: 4.5, bold: true, color: NAVY }],
    anchor: 'ctr', insetX: 0, insetY: 0, lnSpc: 80
  });
}

// ---------------------------------------------------------------------------
// Сборка содержимого слайда
// ---------------------------------------------------------------------------
function slideShapes() {
  const out = [];

  // --- заголовок ---
  out.push(box({
    x: 0.30, y: 0.08, w: 9.60, h: 0.34, name: 'title',
    lines: [{ text: 'Метамодель ИСАР: сущности и типы связей', sz: 17, bold: true, color: NAVY, align: 'l' }],
    anchor: 'ctr', insetX: 0, insetY: 0
  }));
  out.push(box({
    x: 0.31, y: 0.42, w: 9.60, h: 0.22, name: 'subtitle',
    lines: [{
      text: `${ENTITY_COUNT} типов сущностей · ${REL_COUNT} типов связей · версия ${VERSION} · бизнес-слой, приложения, технологии, интернет-присутствие`,
      sz: 8, color: MUTED, align: 'l'
    }],
    anchor: 'ctr', insetX: 0, insetY: 0
  }));
  out.push(box({
    x: 9.95, y: 0.42, w: 3.05, h: 0.22, name: 'source',
    lines: [{ text: 'ar_metamodel_entity_types / ar_metamodel_relation_types', sz: 7, color: MUTED, align: 'r' }],
    anchor: 'ctr', insetX: 0, insetY: 0
  }));

  // --- панели-слои ---
  for (const p of PANELS) {
    out.push(box({ x: p.x, y: p.y, w: p.w, h: p.h, fill: PANEL, geom: 'roundRect', radius: 0.06, name: 'panel' }));
    out.push(box({
      x: p.x + 0.12, y: p.y + 0.05, w: p.w - 0.24, h: 0.18, name: 'panel-title',
      lines: [{ text: p.title, sz: 7.5, bold: true, color: PANEL_TXT, align: 'l' }],
      anchor: 'ctr', insetX: 0, insetY: 0
    }));
  }

  // --- связи (под карточками, чтобы линии не заходили в текст) ---
  for (const e of EDGES) out.push(polyline(e.pts, { w: 0.75, color: NAVY }));

  // --- карточки сущностей ---
  for (const [id, b] of Object.entries(ENTITIES)) {
    out.push(box({
      x: b.x, y: b.y, w: b.w, h: b.h, fill: 'FFFFFF', line: NAVY, lineW: 1.1, name: `ent-${id}`,
      lines: [
        { text: b.name, sz: 8, bold: true, color: ORANGE },
        { text: b.code, sz: 5, color: CODE }
      ],
      anchor: 'ctr', insetX: 0.03, insetY: 0.01, lnSpc: 88
    }));
  }

  // --- номера типов связей на линиях ---
  for (const e of EDGES) {
    for (const b of badgePoints(e)) out.push(badgeShape(b.id, b.x, b.y));
  }

  // --- блок «Типы связей»: расшифровка номеров ---
  out.push(box({ x: LEGEND.x, y: LEGEND.y, w: LEGEND.w, h: LEGEND.h, fill: PANEL, geom: 'roundRect', radius: 0.06, name: 'legend-panel' }));
  out.push(box({
    x: 10.84, y: 3.63, w: 2.18, h: 0.17, name: 'legend-title',
    lines: [{ text: 'ТИПЫ СВЯЗЕЙ', sz: 7, bold: true, color: '7F7F7F', align: 'l' }],
    anchor: 'ctr', insetX: 0, insetY: 0
  }));
  out.push(box({
    x: 10.84, y: 3.79, w: 2.18, h: 0.14, name: 'legend-hint',
    lines: [{ text: 'номер у линии — id в ar_metamodel_relation_types', sz: 4.8, color: '8C8C8C', align: 'l' }],
    anchor: 'ctr', insetX: 0, insetY: 0
  }));
  const legendIds = Object.keys(REL).map(Number).sort((a, b) => a - b);
  const half = Math.ceil(legendIds.length / 2);
  [legendIds.slice(0, half), legendIds.slice(half)].forEach((arr, ci) => {
    out.push(box({
      x: 10.84 + ci * 1.09, y: 3.95, w: 1.06, h: 2.30, name: `legend-col-${ci}`,
      lines: arr.map(id => ({
        text: `${id}  ${REL[id].name}`, sz: 5, color: '4A4A4A', align: 'l', spcBef: 1.0
      })),
      anchor: 't', insetX: 0, insetY: 0, lnSpc: 92
    }));
  });
  out.push(box({
    x: 10.84, y: 6.26, w: 2.18, h: 0.52, name: 'legend-note',
    lines: [
      { text: 'Стрелка — направление «от» → «к»; под названием сущности — её код.', sz: 4.8, color: '767676', align: 'l' },
      { text: `Автоматически формируются ${MANAGED_REL_COUNT} типов (managed); вводятся вручную ${REL_COUNT - MANAGED_REL_COUNT}: 11, 13, 28–30, 32–34, 44, 45.`, sz: 4.8, color: '767676', align: 'l' },
      { text: `Всего: ${ENTITY_COUNT} типов сущностей, ${REL_COUNT} типов связей. Версия ${VERSION}, снимок ${SNAPSHOT}.`, sz: 4.8, color: '767676', align: 'l' }
    ],
    anchor: 'b', insetX: 0, insetY: 0, lnSpc: 100
  }));

  // --- подвал ---
  out.push(line(0.20, 7.02, 13.14, 7.02, { w: 0.5, color: 'D9D9D9', arrow: false }));
  out.push(box({
    x: 0.20, y: 7.08, w: 10.0, h: 0.20, name: 'footer-left',
    lines: [{ text: `ИСАР · корпоративная архитектура · метамодель ${VERSION}: ${ENTITY_COUNT} типов сущностей, ${REL_COUNT} типов связей`, sz: 6.5, color: MUTED, align: 'l' }],
    anchor: 'ctr', insetX: 0, insetY: 0
  }));
  out.push(box({
    x: 10.60, y: 7.08, w: 2.55, h: 0.20, name: 'footer-right',
    lines: [{ text: 'ИСАР', sz: 9, bold: true, color: NAVY, align: 'r' }],
    anchor: 'ctr', insetX: 0, insetY: 0
  }));

  return out.join('');
}

// ---------------------------------------------------------------------------
// Части пакета OOXML
// ---------------------------------------------------------------------------
const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
  + 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
  + 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n';

const CONTENT_TYPES = XML_HEAD
  + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
  + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
  + '<Default Extension="xml" ContentType="application/xml"/>'
  + '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>'
  + '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>'
  + '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>'
  + '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>'
  + '<Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>'
  + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
  + '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'
  + '</Types>';

const ROOT_RELS = XML_HEAD
  + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
  + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>'
  + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
  + '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>'
  + '</Relationships>';

const CORE_PROPS = XML_HEAD
  + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
  + 'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" '
  + 'xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
  + '<dc:title>Метамодель ИСАР ' + VERSION + ': сущности и типы связей</dc:title>'
  + '<dc:subject>Метамодель ИСАР — схема сущностей и типов связей (версия ' + VERSION + ')</dc:subject>'
  + '<dc:creator>ИСАР</dc:creator>'
  + '<cp:lastModifiedBy>ИСАР</cp:lastModifiedBy>'
  + '<dcterms:created xsi:type="dcterms:W3CDTF">' + SNAPSHOT_ISO + '</dcterms:created>'
  + '<dcterms:modified xsi:type="dcterms:W3CDTF">' + SNAPSHOT_ISO + '</dcterms:modified>'
  + '</cp:coreProperties>';

const APP_PROPS = XML_HEAD
  + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" '
  + 'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
  + '<Application>Microsoft Office PowerPoint</Application><Slides>1</Slides>'
  + '<Notes>0</Notes><PresentationFormat>Широкоэкранный</PresentationFormat>'
  + '</Properties>';

const PRESENTATION = XML_HEAD
  + `<p:presentation ${NS} saveSubsetFonts="1">`
  + '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>'
  + '<p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst>'
  + '<p:sldSz cx="12192000" cy="6858000"/>'
  + '<p:notesSz cx="6858000" cy="9144000"/>'
  + '<p:defaultTextStyle><a:defPPr><a:defRPr lang="ru-RU"/></a:defPPr></p:defaultTextStyle>'
  + '</p:presentation>';

const PRESENTATION_RELS = XML_HEAD
  + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
  + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>'
  + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>'
  + '</Relationships>';

const THEME = XML_HEAD
  + '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Theme ISAR">'
  + '<a:themeElements><a:clrScheme name="ISAR">'
  + '<a:dk1><a:srgbClr val="1F3864"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>'
  + '<a:dk2><a:srgbClr val="3C3C3C"/></a:dk2><a:lt2><a:srgbClr val="F2F2F2"/></a:lt2>'
  + '<a:accent1><a:srgbClr val="1F3864"/></a:accent1><a:accent2><a:srgbClr val="C55A11"/></a:accent2>'
  + '<a:accent3><a:srgbClr val="2E75B6"/></a:accent3><a:accent4><a:srgbClr val="7F7F7F"/></a:accent4>'
  + '<a:accent5><a:srgbClr val="A6A6A6"/></a:accent5><a:accent6><a:srgbClr val="D9D9D9"/></a:accent6>'
  + '<a:hlink><a:srgbClr val="2E75B6"/></a:hlink><a:folHlink><a:srgbClr val="1F3864"/></a:folHlink>'
  + '</a:clrScheme>'
  + '<a:fontScheme name="ISAR">'
  + '<a:majorFont><a:latin typeface="Segoe UI"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>'
  + '<a:minorFont><a:latin typeface="Segoe UI"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>'
  + '</a:fontScheme>'
  + '<a:fmtScheme name="ISAR">'
  + '<a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'
  + '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>'
  + '<a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>'
  + '<a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>'
  + '<a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>'
  + '<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle>'
  + '<a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>'
  + '<a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'
  + '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>'
  + '</a:fmtScheme></a:themeElements></a:theme>';

const SLIDE_MASTER = XML_HEAD
  + `<p:sldMaster ${NS}>`
  + '<p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree>'
  + '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>'
  + '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'
  + '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title Placeholder 1"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>'
  + '<p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>'
  + '<p:spPr><a:xfrm><a:off x="838200" y="365125"/><a:ext cx="10515600" cy="1325563"/></a:xfrm></p:spPr>'
  + '<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="ru-RU"/><a:t>Заголовок слайда</a:t></a:r></a:p></p:txBody></p:sp>'
  + '<p:sp><p:nvSpPr><p:cNvPr id="3" name="Text Placeholder 2"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>'
  + '<p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>'
  + '<p:spPr><a:xfrm><a:off x="838200" y="1825625"/><a:ext cx="10515600" cy="4351338"/></a:xfrm></p:spPr>'
  + '<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="ru-RU"/></a:p></p:txBody></p:sp>'
  + '</p:spTree></p:cSld>'
  + '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" '
  + 'accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>'
  + '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>'
  + '<p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr lang="ru-RU"/></a:lvl1pPr></p:titleStyle>'
  + '<p:bodyStyle><a:lvl1pPr><a:defRPr lang="ru-RU"/></a:lvl1pPr></p:bodyStyle>'
  + '<p:otherStyle><a:lvl1pPr><a:defRPr lang="ru-RU"/></a:lvl1pPr></p:otherStyle></p:txStyles>'
  + '</p:sldMaster>';

const MASTER_RELS = XML_HEAD
  + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
  + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>'
  + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>'
  + '</Relationships>';

const SLIDE_LAYOUT = XML_HEAD
  + `<p:sldLayout ${NS} type="blank" preserve="1">`
  + '<p:cSld name="Пустой"><p:spTree>'
  + '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>'
  + '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'
  + '</p:spTree></p:cSld>'
  + '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>';

const LAYOUT_RELS = XML_HEAD
  + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
  + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>'
  + '</Relationships>';

const SLIDE_RELS = XML_HEAD
  + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
  + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>'
  + '</Relationships>';

// ---------------------------------------------------------------------------
// Сборка файла
// ---------------------------------------------------------------------------
/**
 * Запись артефакта с повтором: в рабочей копии (Nextcloud/антивирус) файл может быть
 * временно заблокирован сразу после предыдущей записи — EBUSY/EPERM/EACCES ретраим.
 */
function writeWithRetry(target, buf, attempts = 12, delayMs = 400) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      fs.writeFileSync(target, buf);
      return;
    } catch (err) {
      const retryable = err && (err.code === 'EBUSY' || err.code === 'EPERM' || err.code === 'EACCES');
      if (!retryable || i === attempts - 1) throw err;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs);
    }
  }
}

function buildPptx(target) {
  idSeq = 10;
  const slide = XML_HEAD
    + `<p:sld ${NS}>`
    + '<p:cSld><p:spTree>'
    + '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>'
    + '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'
    + slideShapes()
    + '</p:spTree></p:cSld>'
    + '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>'
    + '</p:sld>';

  const files = [
    { name: '[Content_Types].xml', data: CONTENT_TYPES },
    { name: '_rels/.rels', data: ROOT_RELS },
    { name: 'docProps/core.xml', data: CORE_PROPS },
    { name: 'docProps/app.xml', data: APP_PROPS },
    { name: 'ppt/presentation.xml', data: PRESENTATION },
    { name: 'ppt/_rels/presentation.xml.rels', data: PRESENTATION_RELS },
    { name: 'ppt/theme/theme1.xml', data: THEME },
    { name: 'ppt/slideMasters/slideMaster1.xml', data: SLIDE_MASTER },
    { name: 'ppt/slideMasters/_rels/slideMaster1.xml.rels', data: MASTER_RELS },
    { name: 'ppt/slideLayouts/slideLayout1.xml', data: SLIDE_LAYOUT },
    { name: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels', data: LAYOUT_RELS },
    { name: 'ppt/slides/slide1.xml', data: slide },
    { name: 'ppt/slides/_rels/slide1.xml.rels', data: SLIDE_RELS }
  ];

  const buf = zip(files);
  writeWithRetry(target, buf);
  return buf.length;
}

// ---------------------------------------------------------------------------
// Проверка раскладки: номера связей не должны попадать на карточки и друг на друга
// ---------------------------------------------------------------------------
function checkLayout() {
  const problems = [];
  const overlap = (a, b) => Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1))
    * Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));

  /**
   * Точка лежит на границе карточки (допуск 0.04″): линия должна начинаться/заканчиваться
   * на краю фигуры, а не в пустоте. Иначе связь «уходит в никуда».
   */
  const onBoxBoundary = (x, y, b, eps = 0.04) => {
    const insideX = x >= b.x - eps && x <= b.x + b.w + eps;
    const insideY = y >= b.y - eps && y <= b.y + b.h + eps;
    if (!insideX || !insideY) return false;
    return Math.abs(x - b.x) <= eps
      || Math.abs(x - (b.x + b.w)) <= eps
      || Math.abs(y - b.y) <= eps
      || Math.abs(y - (b.y + b.h)) <= eps;
  };

  const badges = [];
  EDGES.forEach(e => badgePoints(e).forEach(b => badges.push({
    id: b.id, x1: b.x - 0.085, y1: b.y - 0.085, x2: b.x + 0.085, y2: b.y + 0.085, text: `#${b.id}`
  })));
  const ents = Object.entries(ENTITIES).map(([id, b]) => ({ x1: b.x, y1: b.y, x2: b.x + b.w, y2: b.y + b.h, text: id }));

  badges.forEach((b, i) => {
    if (b.x1 < 0.15 || b.y1 < 0.85 || b.x2 > 13.18 || b.y2 > 6.95) problems.push(`номер ${b.text} вне поля`);
    ents.forEach(e => {
      const a = overlap(b, e);
      if (a > 0.001) problems.push(`номер ${b.text} на карточке ${e.text} (${a.toFixed(3)})`);
    });
    for (let j = i + 1; j < badges.length; j++) {
      const a = overlap(b, badges[j]);
      if (a > 0.001) problems.push(`номер ${b.text} × ${badges[j].text} (${a.toFixed(3)})`);
    }
  });

  // линии не должны проходить сквозь карточки сущностей
  const segThroughBox = (x1, y1, x2, y2, b) => {
    const eps = 0.015;
    if (Math.abs(y1 - y2) < 1e-6) {
      return y1 > b.y1 + eps && y1 < b.y2 - eps
        && Math.max(x1, x2) > b.x1 + eps && Math.min(x1, x2) < b.x2 - eps;
    }
    if (Math.abs(x1 - x2) < 1e-6) {
      return x1 > b.x1 + eps && x1 < b.x2 - eps
        && Math.max(y1, y2) > b.y1 + eps && Math.min(y1, y2) < b.y2 - eps;
    }
    return false;
  };
  EDGES.forEach(e => {
    for (let p = 0; p < e.pts.length - 1; p++) {
      const [x1, y1] = e.pts[p];
      const [x2, y2] = e.pts[p + 1];
      Object.entries(ENTITIES).forEach(([id, b]) => {
        if (segThroughBox(x1, y1, x2, y2, b)) problems.push(`линия ${e.rel.join(',')} через карточку ${id}`);
      });
    }
  });

  // панель легенды: линии и номера не должны заходить в неё
  const legend = { x1: LEGEND.x, y1: LEGEND.y, x2: LEGEND.x + LEGEND.w, y2: LEGEND.y + LEGEND.h };
  badges.forEach((b) => {
    if (overlap(b, legend) > 0.001) problems.push(`номер ${b.text} перекрывает легенду типов связей`);
  });
  Object.entries(ENTITIES).forEach(([id, b]) => {
    const card = { x1: b.x, y1: b.y, x2: b.x + b.w, y2: b.y + b.h };
    if (overlap(legend, card) > 0.001) problems.push(`легенда перекрывает карточку ${id}`);
  });
  EDGES.forEach(e => {
    for (let p = 0; p < e.pts.length - 1; p++) {
      const [x1, y1] = e.pts[p];
      const [x2, y2] = e.pts[p + 1];
      if (segThroughBox(x1, y1, x2, y2, legend)) {
        problems.push(`линия ${e.rel.join(',')} проходит через легенду типов связей`);
      }
    }
  });

  // полнота: каждый тип связи из реестра изображён ровно один раз
  const drawn = EDGES.flatMap(e => e.rel);
  const dupes = drawn.filter((id, i) => drawn.indexOf(id) !== i);
  if (dupes.length) problems.push(`дубли типов связей: ${dupes.join(', ')}`);
  Object.keys(REL).map(Number).forEach(id => {
    if (!drawn.includes(id)) problems.push(`тип связи ${id} не изображён`);
  });

  // концы линий должны лежать на карточках «от» и «к» (иначе линия «уходит в никуда»)
  EDGES.forEach((e) => {
    const meta = REL[e.rel[0]];
    if (!meta) {
      problems.push(`связь ${e.rel.join(',')}: нет описания в REL`);
      return;
    }
    e.rel.forEach((id) => {
      const r = REL[id];
      if (r && (r.from !== meta.from || r.to !== meta.to)) {
        problems.push(`связь ${e.rel.join(',')}: тип ${id} имеет другую пару (${r.from} → ${r.to})`);
      }
    });

    const fromBox = ENTITIES[meta.from];
    const toBox = ENTITIES[meta.to];
    const [x0, y0] = e.pts[0];
    const [x1, y1] = e.pts[e.pts.length - 1];

    if (!fromBox) {
      problems.push(`связь ${e.rel.join(',')}: нет карточки «от» (${meta.from})`);
    } else if (!onBoxBoundary(x0, y0, fromBox)) {
      problems.push(`связь ${e.rel.join(',')}: начало (${x0.toFixed(2)},${y0.toFixed(2)}) не на карточке ${meta.from}`);
    }

    if (!toBox) {
      problems.push(`связь ${e.rel.join(',')}: нет карточки «к» (${meta.to})`);
    } else if (!onBoxBoundary(x1, y1, toBox)) {
      problems.push(`связь ${e.rel.join(',')}: конец (${x1.toFixed(2)},${y1.toFixed(2)}) не на карточке ${meta.to}`);
    }
  });

  // номера не должны лежать на чужих линиях (пересечения/наложения), сегменты — ортогональны
  const EPS = 0.02;
  const HALF_BADGE = 0.085;
  const segments = [];
  EDGES.forEach((e) => {
    for (let i = 0; i < e.pts.length - 1; i++) {
      const [x1, y1] = e.pts[i];
      const [x2, y2] = e.pts[i + 1];
      const horizontal = Math.abs(y1 - y2) <= EPS;
      const vertical = Math.abs(x1 - x2) <= EPS;
      if (!horizontal && !vertical) {
        problems.push(`линия ${e.rel.join(',')}: сегмент (${x1},${y1})→(${x2},${y2}) не ортогонален`);
      }
      segments.push({ rel: e.rel, x1, y1, x2, y2, horizontal, vertical });
    }
  });

  // наложение сегментов разных связей (совпадающая прямая и общий интервал)
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const a = segments[i];
      const b = segments[j];
      if (a.rel.join(',') === b.rel.join(',')) continue;
      if (a.horizontal && b.horizontal && Math.abs(a.y1 - b.y1) <= EPS) {
        const lo = Math.max(Math.min(a.x1, a.x2), Math.min(b.x1, b.x2));
        const hi = Math.min(Math.max(a.x1, a.x2), Math.max(b.x1, b.x2));
        if (hi - lo > EPS) {
          problems.push(`линия ${a.rel.join(',')} совпадает с линией ${b.rel.join(',')} (y=${a.y1.toFixed(2)}, x ${lo.toFixed(2)}…${hi.toFixed(2)})`);
        }
      }
      if (a.vertical && b.vertical && Math.abs(a.x1 - b.x1) <= EPS) {
        const lo = Math.max(Math.min(a.y1, a.y2), Math.min(b.y1, b.y2));
        const hi = Math.min(Math.max(a.y1, a.y2), Math.max(b.y1, b.y2));
        if (hi - lo > EPS) {
          problems.push(`линия ${a.rel.join(',')} совпадает с линией ${b.rel.join(',')} (x=${a.x1.toFixed(2)}, y ${lo.toFixed(2)}…${hi.toFixed(2)})`);
        }
      }
    }
  }

  // номер связи не должен попадать на чужую линию
  badges.forEach((badge) => {
    segments.forEach((s) => {
      if (s.rel.includes(badge.id)) return;
      if (s.horizontal) {
        const lo = Math.min(s.x1, s.x2) - HALF_BADGE;
        const hi = Math.max(s.x1, s.x2) + HALF_BADGE;
        if (Math.abs(badge.y - s.y1) <= HALF_BADGE && badge.x >= lo && badge.x <= hi) {
          problems.push(`номер ${badge.id} лежит на линии ${s.rel.join(',')}`);
        }
      } else if (s.vertical) {
        const lo = Math.min(s.y1, s.y2) - HALF_BADGE;
        const hi = Math.max(s.y1, s.y2) + HALF_BADGE;
        if (Math.abs(badge.x - s.x1) <= HALF_BADGE && badge.y >= lo && badge.y <= hi) {
          problems.push(`номер ${badge.id} лежит на линии ${s.rel.join(',')}`);
        }
      }
    });
  });

  return problems;
}

const problems = checkLayout();
if (problems.length) {
  console.error(`Схема метамодели ${VERSION}: проверка раскладки не пройдена:`);
  for (const problem of problems) console.error(` - ${problem}`);
  process.exit(1);
}

const defaultOutPath = path.join(__dirname, '..', 'docs', 'diagrams', `Метамодель ИСАР ${VERSION}.pptx`);
const outPath = CUSTOM_OUT ? path.resolve(CUSTOM_OUT) : defaultOutPath;
let size;
try {
  size = buildPptx(outPath);
} catch (err) {
  if (err && (err.code === 'EBUSY' || err.code === 'EPERM' || err.code === 'EACCES')) {
    console.error(`Файл занят другой программой: ${outPath}`);
    console.error('Закройте его (PowerPoint / просмотрщик) и повторите:');
    console.error(`  npm run build:metamodel -- ${VERSION}`);
    process.exit(1);
  }
  throw err;
}
console.log(`OK: ${outPath} (${(size / 1024).toFixed(1)} КБ), версия ${VERSION}, ${ENTITY_COUNT} сущностей / ${REL_COUNT} связей`);



/**
 * Модель диаграммы решения для палитры «Заполнить из диаграммы» (перенос модуля DrawIO Pro в ядро).
 *
 * Роль — «переводчик» между mxfile (draw.io) и составом инкремента:
 *   parseMxfile(xml)          mxfile → { systems, relations }
 *   buildDiagramMxfile(model) модель → mxfile (с сохранением геометрии)
 *   extractGeometry(xml)      раскладка (координаты узлов, маршруты рёбер)
 *   remapCellIds(xml, map)    черновые id (draft-*) → реальные (sys-{id}/rel-{id})
 *
 * Соглашения по id ячеек — те же, что у серверного генератора `backend/incrementDiagram.js`,
 * иначе merge раскладки (`mergeMxfileWithData`) не найдёт ячейку:
 *   sys-{ar_systems_id}            система из реестра
 *   rel-{ar_adr_increment_relations.id}  связь решения
 *   draft-sys-{key} / draft-rel-{key}    черновик до сохранения (локальные ключи)
 *
 * Функции системы отображаются строками внутри тела узла (как на сервере, issue #93):
 * `<div центр><b>Название</b></div><div слева>+Функция;<br/>•Функция;</div>`
 * Маркер перед названием — статус функции в решении; соответствие маркер ↔ код — данные
 * (параметр `DRAWIO_SYSFUNC_MARKERS`), поэтому карта передаётся снаружи.
 *
 * Файл чистый (без Vue и обращения к API): им пользуется палитра и его же
 * проверяет `backend/__tests__/diagramModel.test.js` через динамический import.
 */

export const SYS_PREFIX = 'sys-'
export const REL_PREFIX = 'rel-'
export const DRAFT_SYS_PREFIX = 'draft-sys-'
export const DRAFT_REL_PREFIX = 'draft-rel-'

/** Маркер функции без статуса (легаси-строки диаграмм ядра). */
export const UNKNOWN_SYSFUNC_MARKER = '?'

/** Маркеры функций по умолчанию — совпадают с сидом `DRAWIO_SYSFUNC_MARKERS`. */
export const DEFAULT_SYSFUNC_MARKERS = Object.freeze({
  ADR_INCR_SYSFUNC_CREATING: '+',
  ADR_INCR_SYSFUNC_MODIFYING: '\u2022',
  ADR_INCR_SYSFUNC_IN_USE: '\u2713',
  ADR_INCR_SYSFUNC_DECOMMISSIONING: '-',
})

function isBlank(v) {
  return v === undefined || v === null || String(v).trim() === ''
}

/** Локальный ключ черновика (уникальный в пределах сеанса). */
export function makeDraftKey(prefix = 'k') {
  const rnd = Math.random().toString(36).slice(2, 8)
  const ts = Date.now().toString(36)
  return `${prefix}-${ts}${rnd}`
}

/** id ячейки системы: по id реестра либо по ключу черновика. */
export function systemCellId({ id, draftKey } = {}) {
  if (!isBlank(id)) return `${SYS_PREFIX}${String(id).trim()}`
  if (!isBlank(draftKey)) return `${DRAFT_SYS_PREFIX}${String(draftKey).trim()}`
  throw new Error('systemCellId: требуется id или draftKey')
}

/** id ячейки связи: по id связи либо по ключу черновика. */
export function relationCellId({ id, draftKey } = {}) {
  if (!isBlank(id)) return `${REL_PREFIX}${String(id).trim()}`
  if (!isBlank(draftKey)) return `${DRAFT_REL_PREFIX}${String(draftKey).trim()}`
  throw new Error('relationCellId: требуется id или draftKey')
}

/** Разбор id ячейки: { type: 'system'|'relation'|null, kind: 'existing'|'new'|null, id, draftKey }. */
export function parseCellId(cellId) {
  const s = String(cellId == null ? '' : cellId)
  if (s.startsWith(DRAFT_SYS_PREFIX)) {
    return { type: 'system', kind: 'new', id: null, draftKey: s.slice(DRAFT_SYS_PREFIX.length) }
  }
  if (s.startsWith(SYS_PREFIX)) {
    const rest = s.slice(SYS_PREFIX.length)
    // Числовой суффикс — id реестра; иначе не наш формат (например `sys-legend`).
    if (!/^\d+$/.test(rest)) return { type: null, kind: null, id: null, draftKey: null }
    return { type: 'system', kind: 'existing', id: rest, draftKey: null }
  }
  if (s.startsWith(DRAFT_REL_PREFIX)) {
    return { type: 'relation', kind: 'new', id: null, draftKey: s.slice(DRAFT_REL_PREFIX.length) }
  }
  if (s.startsWith(REL_PREFIX)) {
    const rest = s.slice(REL_PREFIX.length)
    if (!/^\d+$/.test(rest)) return { type: null, kind: null, id: null, draftKey: null }
    return { type: 'relation', kind: 'existing', id: rest, draftKey: null }
  }
  return { type: null, kind: null, id: null, draftKey: null }
}

/** true, если id относится к черновой ячейке. */
export function isDraftId(cellId) {
  const s = String(cellId || '')
  return s.startsWith(DRAFT_SYS_PREFIX) || s.startsWith(DRAFT_REL_PREFIX)
}

/** Экранирование XML-значений (как в `backend/incrementDiagram.js`). */
export function escapeXml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Обратное преобразование XML-сущностей (включая `&#39;` от парсера ядра). */
export function unescapeXml(value) {
  return String(value == null ? '' : value)
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
}

/** Строка атрибутов, пустые значения пропускаются. */
export function attrs(map) {
  const parts = []
  for (const [key, val] of Object.entries(map || {})) {
    if (val === undefined || val === null || val === '') continue
    parts.push(`${key}="${escapeXml(val)}"`)
  }
  return parts.join(' ')
}

/** Маркер функции по коду статуса в решении. */
export function sysFuncMarker(code, markers) {
  const map = markers && typeof markers === 'object' ? markers : DEFAULT_SYSFUNC_MARKERS
  const key = code == null ? '' : String(code).trim()
  if (!key) return UNKNOWN_SYSFUNC_MARKER
  return map[key] || UNKNOWN_SYSFUNC_MARKER
}

/** Карта «маркер → код статуса» (обратная к `sysFuncMarker`). */
export function markerToStatusCodeMap(markers) {
  const map = markers && typeof markers === 'object' ? markers : DEFAULT_SYSFUNC_MARKERS
  const out = new Map()
  for (const [code, marker] of Object.entries(map)) {
    const m = String(marker == null ? '' : marker).trim()
    if (m) out.set(m, String(code).trim())
  }
  return out
}

/**
 * Подпись тела узла: `<маркер><название>;` — формат серверного генератора (issue #93).
 * @param {Array<{name?:string, increment_sysfunc_status_code?:string|null}>} entries
 * @param {Record<string,string>} [markers]
 * @returns {string[]}
 */
export function formatSysFuncLines(entries, markers) {
  const list = Array.isArray(entries) ? entries : []
  const lines = []
  for (const entry of list) {
    const name = String((entry && entry.name) || '').trim()
    if (!name) continue
    lines.push(`${sysFuncMarker(entry && entry.increment_sysfunc_status_code, markers)}${name};`)
  }
  return lines
}

/**
 * HTML значения узла — побайтово совместим с `buildNodeHtmlValue` ядра,
 * чтобы «Обновить» на сервере не менял вид узла.
 */
export function renderSystemNodeValue(title, bodyLines, opts = {}) {
  const ts = Number(opts.titleFontSize) || 14
  const bs = Number(opts.bodyFontSize) || 11
  const lh = Number(opts.bodyLineHeight) || 1.25
  const tb = opts.titleBold !== false
  const t = String(title || '').trim() || 'Система'
  const titleInner = tb ? `<b>${t}</b>` : t
  const lines = Array.isArray(bodyLines) ? bodyLines : []
  const bodyInner = lines.length ? lines.map((ln) => String(ln)).join('<br/>') : ''
  const html =
    `<div style="text-align:center;font-size:${ts}px;">${titleInner}</div>` +
    (bodyInner
      ? `<div style="text-align:left;font-size:${bs}px;line-height:${lh};">${bodyInner}</div>`
      : '')
  return escapeXml(html)
}

/** HTML-значение ячейки → { title, lines[] } (обратное к `renderSystemNodeValue`). */
export function decodeNodeValue(value) {
  const html = unescapeXml(value)
  if (!html) return { title: '', lines: [] }
  const titleM = /<b>([\s\S]*?)<\/b>/i.exec(html)
  let title = titleM ? titleM[1] : ''
  if (!title) {
    const firstDiv = /<div\b[^>]*>([\s\S]*?)<\/div>/i.exec(html)
    title = firstDiv ? firstDiv[1] : html
  }
  title = stripTags(title).trim()
  // Тело — всё после первого закрывающего </div> (в нём заголовок).
  const bodyStart = html.indexOf('</div>')
  const bodyHtml = bodyStart >= 0 ? html.slice(bodyStart + 6) : ''
  const lines = bodyHtml
    .replace(/<\/?div\b[^>]*>/gi, '')
    .split(/<br\s*\/?>/i)
    .map((s) => stripTags(s).trim())
    .filter(Boolean)
  return { title, lines }
}

function stripTags(html) {
  return String(html || '').replace(/<[^>]*>/g, '')
}

/** Строка тела узла → { name, code }. */
export function parseSysFuncLine(line, markerMap) {
  const raw = String(line || '').trim()
  if (!raw) return null
  const body = raw.replace(/;$/, '').trim()
  if (!body) return null
  const first = body.slice(0, 1)
  const map = markerMap instanceof Map ? markerMap : markerToStatusCodeMap(markerMap)
  if (map.has(first)) {
    return { name: body.slice(1).trim(), statusCode: map.get(first) || null }
  }
  // Без маркера — легаси-строка: имя как есть, статус не задан.
  return { name: body, statusCode: null }
}

// --- разбор атрибутов и ячеек -------------------------------------------------

function parseAttrs(str) {
  const out = {}
  const re = /([A-Za-z_][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g
  let m
  while ((m = re.exec(str || '')) !== null) {
    const raw = m[3] != null ? m[3] : m[4]
    out[m[1]] = unescapeXml(raw)
  }
  return out
}

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

/** Все ячейки mxfile: `<object>`-обёртки и «голые» `<mxCell>`. */
export function parseCells(xml) {
  const src = String(xml || '')
  const out = []

  const objRe = /<(object|UserObject)\b([^>]*)>([\s\S]*?)<\/\1>/gi
  let m
  while ((m = objRe.exec(src)) !== null) {
    const meta = parseAttrs(m[2])
    const inner = m[3]
    const cm = inner.match(/<mxCell\b([^>]*?)(?:\/>|>([\s\S]*?)<\/mxCell>)/i)
    if (!cm && !meta.id) continue
    const cellAttrs = cm ? parseAttrs(cm[1]) : {}
    out.push(toCell(cellAttrs, (cm && cm[2]) || inner, meta))
  }

  const stripped = src.replace(objRe, '')
  const cellRe = /<mxCell\b([^>]*?)(\/>|>([\s\S]*?)<\/mxCell>)/gi
  while ((m = cellRe.exec(stripped)) !== null) {
    const cellAttrs = parseAttrs(m[1])
    const id = cellAttrs.id
    if (!id || id === '0' || id === '1') continue
    out.push(toCell(cellAttrs, m[3] || '', {}))
  }
  return out
}

function toCell(cellAttrs, inner, meta) {
  const a = { ...(meta || {}), ...(cellAttrs || {}) }
  const style = String(a.style || '')
  const body = String(inner || '')
  const geoM = /<mxGeometry\b([^>]*?)(\/>|>)/i.exec(body)
  const geo = geoM ? parseAttrs(geoM[1]) : {}
  const points = []
  const ptRe = /<mxPoint\b([^>]*?)\/>/gi
  let pm
  while ((pm = ptRe.exec(body)) !== null) {
    const pa = parseAttrs(pm[1])
    const x = num(pa.x)
    const y = num(pa.y)
    if (x !== undefined && y !== undefined && String(pa.as || '') !== 'offset') points.push({ x, y })
  }
  return {
    cellId: a.id || '',
    label: a.label != null ? a.label : (a.value != null ? a.value : ''),
    style,
    parent: a.parent || '',
    source: a.source || '',
    target: a.target || '',
    vertex: a.vertex === '1' || a.vertex === 1,
    edge: a.edge === '1' || a.edge === 1,
    isarType: a.isarType || '',
    isarKind: a.isarKind || '',
    isarSysId: a.isarSysId || '',
    isarRelId: a.isarRelId || '',
    isarFlowId: a.isarFlowId || '',
    isarDraftKey: a.isarDraftKey || '',
    isarDescription: a.isarDescription || '',
    geom: {
      x: num(geo.x),
      y: num(geo.y),
      width: num(geo.width),
      height: num(geo.height),
    },
    ports: parseStylePorts(style),
    points,
  }
}

function parseStylePorts(style) {
  const get = (name) => {
    const re = new RegExp(`(?:^|;)${name}=([^;]+)`)
    const hit = re.exec(style || '')
    return hit ? hit[1] : null
  }
  return { exitX: get('exitX'), exitY: get('exitY'), entryX: get('entryX'), entryY: get('entryY') }
}

/** Код статуса из стиля ячейки (`isarStatus=...`). */
export function statusFromStyle(style) {
  const hit = /(?:^|;)isarStatus=([^;]+)/.exec(String(style || ''))
  return hit ? decodeURIComponent(hit[1]) : null
}

// --- модель → mxfile → модель -------------------------------------------------

/** Заливки узлов для предпросмотра (после сохранения стиль задаёт сервер по `DRAWIO_NODE_STYLE`). */
export const SYSTEM_STATUS_FILL = Object.freeze({
  ADR_INCR_SYS_CREATING: '#d5e8d4',
  ADR_INCR_SYS_MODIFYING: '#ffe6cc',
  ADR_INCR_SYS_IN_USE: '#dae8fc',
  ADR_INCR_SYS_DECOMMISSIONING: '#f8cecc',
  DEFAULT: '#dae8fc',
})

export const SYSTEM_STATUS_STROKE = Object.freeze({
  ADR_INCR_SYS_CREATING: '#82b366',
  ADR_INCR_SYS_MODIFYING: '#d79b00',
  ADR_INCR_SYS_IN_USE: '#6c8ebf',
  ADR_INCR_SYS_DECOMMISSIONING: '#b85450',
  DEFAULT: '#6c8ebf',
})

export const RELATION_STATUS_STROKE = Object.freeze({
  ADR_INCR_REL_CREATING: '#82b366',
  ADR_INCR_REL_MODIFYING: '#d79b00',
  ADR_INCR_REL_IN_USE: '#6c8ebf',
  ADR_INCR_REL_DECOMMISSIONING: '#b85450',
  ADR_INCR_REL_EXCLUDED: '#b00020',
  DEFAULT: '#666666',
})

/**
 * Ячейка системы: `<mxCell id="sys-1" value="<div…><b>Название</b></div>…">`.
 * Статус в решении хранится в стиле (`isarStatus=`) — переживает движение ячейки в draw.io.
 */
export function buildSystemCell(system, opts = {}) {
  const cellId = system.cellId || systemCellId(system)
  const markers = opts.markers || DEFAULT_SYSFUNC_MARKERS
  const bodyLines = formatSysFuncLines(system.functions || [], markers)
  const title = system.label || system.name || ''
  const value = renderSystemNodeValue(title, bodyLines, opts)
  const fill = SYSTEM_STATUS_FILL[system.statusCode] || SYSTEM_STATUS_FILL.DEFAULT
  const stroke = SYSTEM_STATUS_STROKE[system.statusCode] || SYSTEM_STATUS_STROKE.DEFAULT
  const statusStyle = system.statusCode ? `isarStatus=${system.statusCode};` : ''
  const style = `rounded=1;whiteSpace=wrap;html=1;arcSize=8;fillColor=${fill};strokeColor=${stroke};${statusStyle}`
  const g = pickGeom(system, opts.geometry)
  return (
    `<mxCell id="${escapeXml(cellId)}" value="${value}" style="${escapeXml(style)}" vertex="1" parent="1">` +
    `<mxGeometry x="${g.x}" y="${g.y}" width="${g.width}" height="${g.height}" as="geometry"/>` +
    '</mxCell>'
  )
}

/** Ребро-связь между системами. */
export function buildRelationEdge(relation, opts = {}) {
  const cellId = relation.cellId || relationCellId(relation)
  const fromCellId = opts.fromCellId || relation.fromCellId
  const toCellId = opts.toCellId || relation.toCellId
  if (!fromCellId || !toCellId) return ''
  const label = escapeXml(relation.label || relation.name || 'Связь')
  const stroke = RELATION_STATUS_STROKE[relation.statusCode] || RELATION_STATUS_STROKE.DEFAULT
  const statusStyle = relation.statusCode ? `isarStatus=${relation.statusCode};` : ''
  const route = opts.geometry || {}
  const portStyle =
    (route.exitX != null && route.exitY != null ? `exitX=${route.exitX};exitY=${route.exitY};` : '') +
    (route.entryX != null && route.entryY != null ? `entryX=${route.entryX};entryY=${route.entryY};` : '')
  const style =
    'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;' +
    `startArrow=none;endArrow=classic;endFill=1;strokeColor=${stroke};strokeWidth=2;fontSize=10;${portStyle}${statusStyle}`
  const points = Array.isArray(route.points) && route.points.length
    ? route.points.map((p) => `<mxPoint x="${p.x}" y="${p.y}"/>`).join('')
    : ''
  const geoXml = points
    ? `<mxGeometry relative="1" as="geometry"><Array as="points">${points}</Array></mxGeometry>`
    : '<mxGeometry relative="1" as="geometry"/>'
  return (
    `<mxCell id="${escapeXml(cellId)}" value="${label}" style="${escapeXml(style)}" edge="1" parent="1"` +
    ` source="${escapeXml(fromCellId)}" target="${escapeXml(toCellId)}">${geoXml}</mxCell>`
  )
}

function pickGeom(entity, fallback) {
  const out = { x: 40, y: 40, width: 180, height: 72 }
  if (fallback) {
    if (fallback.x != null) out.x = fallback.x
    if (fallback.y != null) out.y = fallback.y
    if (fallback.width != null) out.width = fallback.width
    if (fallback.height != null) out.height = fallback.height
  }
  const src = entity && entity.geom ? entity.geom : {}
  for (const key of ['x', 'y', 'width', 'height']) {
    if (src[key] != null) out[key] = src[key]
  }
  return out
}

/** Полный mxfile из набора ячеек. */
export function wrapMxfile(cellsXml, { name = 'Схема решения' } = {}) {
  const inner = '<mxCell id="0"/><mxCell id="1" parent="0"/>' + (cellsXml || '')
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<mxfile host="app.diagrams.net">' +
    `<diagram id="isar-1" name="${escapeXml(name)}">` +
    '<mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" math="0" shadow="0">' +
    `<root>${inner}</root>` +
    '</mxGraphModel></diagram></mxfile>'
  )
}

/**
 * Модель диаграммы → mxfile. Раскладка берётся из `geometry` (результат `extractGeometry`),
 * иначе узлы раскладываются сеткой.
 *
 * @param {{systems:Array, relations:Array}} model
 * @param {{name?:string, geometry?:{nodes?:Map, edges?:Map}, markers?:object}} [opts]
 */
export function buildDiagramMxfile(model, opts = {}) {
  const systems = Array.isArray(model && model.systems) ? model.systems : []
  const relations = Array.isArray(model && model.relations) ? model.relations : []
  const geometry = opts.geometry || {}
  const nodes = geometry.nodes instanceof Map ? geometry.nodes : new Map()
  const edges = geometry.edges instanceof Map ? geometry.edges : new Map()

  const refToCellId = new Map()
  let cells = ''

  systems.forEach((s, i) => {
    const cellId = systemCellId(s)
    refToCellId.set(s.ref || cellId, cellId)
    const col = i % 4
    const row = Math.floor(i / 4)
    const fallback = { x: 40 + col * 240, y: 40 + row * 140, width: 180, height: 72 }
    const geom = nodes.get(cellId) || nodes.get(s.ref) || fallback
    cells += buildSystemCell({ ...s, cellId }, { ...opts, geometry: geom })
  })

  for (const r of relations) {
    const cellId = relationCellId(r)
    const fromCellId = refToCellId.get(r.fromRef) || r.fromCellId
    const toCellId = refToCellId.get(r.toRef) || r.toCellId
    if (!fromCellId || !toCellId) continue
    cells += buildRelationEdge({ ...r, cellId }, { fromCellId, toCellId, geometry: edges.get(cellId) || {} })
  }

  return wrapMxfile(cells, { name: opts.name })
}

/** Раскладка из mxfile: координаты узлов и маршруты рёбер (для «Обновить» без потери позиций). */
export function extractGeometry(xml) {
  const nodes = new Map()
  const edges = new Map()
  for (const c of parseCells(xml)) {
    const pid = parseCellId(c.cellId)
    if (!pid.type) continue
    if (c.edge) {
      edges.set(c.cellId, {
        exitX: c.ports.exitX,
        exitY: c.ports.exitY,
        entryX: c.ports.entryX,
        entryY: c.ports.entryY,
        points: c.points,
      })
    } else if (pid.type === 'system') {
      const g = c.geom || {}
      nodes.set(c.cellId, {
        x: g.x != null ? g.x : 40,
        y: g.y != null ? g.y : 40,
        width: g.width != null ? g.width : 180,
        height: g.height != null ? g.height : 72,
      })
    }
  }
  return { nodes, edges }
}

/**
 * Перекодирование id черновых ячеек в реальные после сохранения:
 * `draft-sys-{key}` → `sys-{ar_systems_id}`, `draft-rel-{key}` → `rel-{id}`.
 * Заменяются только ссылочные атрибуты — `value` и стили не трогаются.
 *
 * @param {string} xml
 * @param {Record<string,string>|Map<string,string>} mapping
 */
export function remapCellIds(xml, mapping) {
  const map = mapping instanceof Map ? mapping : new Map(Object.entries(mapping || {}))
  if (!map.size) return String(xml || '')
  const make = (attr) => (full, quote, value) => {
    const next = map.get(value)
    return next ? `${attr}=${quote}${next}${quote}` : full
  }
  return String(xml || '')
    .replace(/\bid=(["'])([^"']*)\1/g, make('id'))
    .replace(/\bparent=(["'])([^"']*)\1/g, make('parent'))
    .replace(/\bsource=(["'])([^"']*)\1/g, make('source'))
    .replace(/\btarget=([\"'])([^\"']*)\1/g, make('target'))
}

// --- mxfile → модель ----------------------------------------------------------

/**
 * Разбор mxfile в модель состава решения.
 *
 * Понимает две формы записи:
 *   1. «голые» `<mxCell id="sys-1" value="<div…>">` — так генерирует и ядро, и палитра;
 *   2. `<object id="sys-1" label="…" isarType="system" isarKind="existing" isarSysId="1">` —
 *      формат модуля DrawIO Pro (совместимость со схемами, нарисованными модулем).
 *
 * Функции системы читаются из тела узла (строки с маркерами) — отображение «внутри узла»
 * остаётся серверным (issue #93), вложенных ячеек `fn-*` палитра не создаёт.
 *
 * @param {string} xml
 * @param {{markers?: Record<string,string>}} [opts]
 * @returns {{systems: Array, relations: Array}}
 */
export function parseMxfile(xml, opts = {}) {
  const markerMap = markerToStatusCodeMap(opts.markers || DEFAULT_SYSFUNC_MARKERS)
  const cells = parseCells(xml)
  const systems = []
  const relations = []

  for (const c of cells) {
    if (c.edge) continue
    const pid = parseCellId(c.cellId)
    const type = c.isarType || pid.type
    if (type !== 'system') continue
    const decoded = decodeNodeValue(c.label)
    const functions = decoded.lines
      .map((line) => parseSysFuncLine(line, markerMap))
      .filter(Boolean)
      .map((f, i) => ({ ref: `${c.cellId}#fn${i}`, name: f.name, statusCode: f.statusCode }))
    systems.push({
      ref: c.cellId,
      cellId: c.cellId,
      kind: c.isarKind || pid.kind || 'existing',
      id: c.isarSysId || pid.id || null,
      draftKey: c.isarDraftKey || pid.draftKey || null,
      label: decoded.title || '',
      description: c.isarDescription || '',
      statusCode: statusFromStyle(c.style) || null,
      geom: c.geom,
      functions,
    })
  }

  for (const c of cells) {
    if (!c.edge) continue
    const pid = parseCellId(c.cellId)
    const isKnown = Boolean(c.isarType || pid.type)
    if (!isKnown) continue
    relations.push({
      ref: c.cellId,
      cellId: c.cellId,
      kind: c.isarKind || pid.kind || 'existing',
      id: c.isarRelId || pid.id || null,
      draftKey: c.isarDraftKey || pid.draftKey || null,
      flowId: c.isarFlowId || null,
      label: c.isarType ? c.label : decodeNodeValue(c.label).title,
      description: c.isarDescription || '',
      statusCode: statusFromStyle(c.style) || null,
      fromRef: c.source || null,
      toRef: c.target || null,
    })
  }

  return { systems, relations }
}


/**
 * Генерация и merge mxfile для диаграмм решения (инкремента) заключения ADR Applied.
 * Стабильные id: sys-{ar_systems_id}, rel-{ar_adr_increment_relations.id}
 * Стили: DRAWIO_* через resolveDrawioStyles (issue #53).
 */

const { resolveDrawioStyles } = require('./drawioStyles');
const {
  extractEdgeGeometryMap,
  layoutNodes,
  computeEdgeRoutes,
  formatPortStyle,
  formatEdgeGeometryXml,
  routeFromSaved,
} = require('./incrementDiagramLayout');

function escapeXml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Извлекает координаты прямоугольников для вершин sys-* (сохранение раскладки при merge).
 */
function extractVertexGeometryMap(mxfile) {
  const map = new Map();
  if (!mxfile || typeof mxfile !== 'string') return map;
  const re = /<mxCell\b[^>]*\bid=["'](sys-\d+)["'][^>]*>/g;
  let m;
  while ((m = re.exec(mxfile)) !== null) {
    const id = m[1];
    const start = m.index;
    const end = mxfile.indexOf('</mxCell>', start);
    const block = end === -1 ? mxfile.slice(start) : mxfile.slice(start, end + 9);
    const geo = /<mxGeometry\s+([^/>]+)(?:\/>|>)/.exec(block);
    if (!geo) continue;
    const attrs = geo[1];
    const x = /x="([^"]*)"/.exec(attrs);
    const y = /y="([^"]*)"/.exec(attrs);
    const w = /width="([^"]*)"/.exec(attrs);
    const h = /height="([^"]*)"/.exec(attrs);
    map.set(id, {
      x: x ? parseFloat(x[1]) : 40,
      y: y ? parseFloat(y[1]) : 40,
      width: w ? parseFloat(w[1]) : 120,
      height: h ? parseFloat(h[1]) : 64,
    });
  }
  return map;
}

function gridRound(n, step) {
  const s = Number(step) > 0 ? Number(step) : 8;
  return Math.ceil(Number(n) / s) * s;
}

/** Грубый перенос слов по длине символов (латиница/кириллица). */
function wrapLines(text, maxChars) {
  const t = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!t) return [];
  const max = Math.max(8, maxChars | 0);
  const lines = [];
  for (const rawLine of t.split('\n')) {
    let line = rawLine;
    while (line.length > max) {
      let cut = line.lastIndexOf(' ', max);
      if (cut <= 0) cut = max;
      lines.push(line.slice(0, cut).trimEnd());
      line = line.slice(cut).trimStart();
    }
    if (line.length) lines.push(line);
  }
  return lines;
}

function estimateNodeSize(system, nodeStyle) {
  const title = String(system.system_name || system.system_code || 'Система').trim() || 'Система';
  const comment = (system.comment != null && String(system.comment).trim()) ? String(system.comment) : '';
  const maxTextWidth = Number(nodeStyle.maxTextWidth) || 280;
  const paddingH = Number(nodeStyle.paddingH) || 12;
  const paddingV = Number(nodeStyle.paddingV) || 10;
  const minW = Number(nodeStyle.minWidth) || 140;
  const minH = Number(nodeStyle.minHeight) || 72;
  const titleFontSize = Number(nodeStyle.titleFontSize) || 14;
  const bodyFontSize = Number(nodeStyle.bodyFontSize) || 11;
  const bodyLineHeight = Number(nodeStyle.bodyLineHeight) || 1.25;

  const approxChar = (fs) => Math.max(4, fs * 0.55);
  const maxChars = Math.max(12, Math.floor(maxTextWidth / approxChar(bodyFontSize)));
  const bodyLines = wrapLines(comment, maxChars);

  const titleW = title.length * approxChar(titleFontSize);
  let bodyMaxW = 0;
  for (const ln of bodyLines) bodyMaxW = Math.max(bodyMaxW, ln.length * approxChar(bodyFontSize));
  let w = Math.max(minW, Math.max(titleW, bodyMaxW) + 2 * paddingH);
  w = Math.min(520, w);
  w = gridRound(w, nodeStyle.gridStep);

  const titleH = titleFontSize * 1.35;
  const bodyH = bodyLines.length * bodyFontSize * bodyLineHeight;
  let h = paddingV * 2 + titleH + (bodyLines.length ? bodyH + 6 : 0);
  h = Math.max(minH, gridRound(h, nodeStyle.gridStep));
  return { width: w, height: h, title, bodyLines };
}

/**
 * HTML для html=1-узла: одно экранирование для XML-атрибута value.
 * Раньше текст экранировался внутри и снова целиком — &amp; превращался в &amp;amp;, Draw.io не рисовал содержимое.
 */
function buildNodeHtmlValue(title, bodyLines, nodeStyle) {
  const ts = Number(nodeStyle.titleFontSize) || 14;
  const bs = Number(nodeStyle.bodyFontSize) || 11;
  const lh = Number(nodeStyle.bodyLineHeight) || 1.25;
  const tb = nodeStyle.titleBold !== false;
  const t = String(title || '').trim() || 'Система';
  const titleInner = tb ? `<b>${t}</b>` : t;
  const bodyInner = bodyLines.length ? bodyLines.map((ln) => String(ln)).join('<br/>') : '';
  const html =
    `<div style="text-align:center;font-size:${ts}px;">${titleInner}</div>` +
    (bodyInner
      ? `<div style="text-align:left;font-size:${bs}px;line-height:${lh};">${bodyInner}</div>`
      : '');
  return escapeXml(html);
}

function nodeColors(system, nodeStyle) {
  const code = (system.status_code && String(system.status_code).trim()) || '';
  const fillMap = nodeStyle.nodeStatusColor || {};
  const strokeMap = nodeStyle.nodeStatusStroke || {};
  const fill = (code && fillMap[code]) || fillMap.DEFAULT || '#dae8fc';
  const stroke = (code && strokeMap[code]) || strokeMap.DEFAULT || '#6c8ebf';
  return { fillColor: fill, strokeColor: stroke };
}

function edgeStrokeColor(relation, edgeStyle) {
  const code = (relation.increment_relation_status_code && String(relation.increment_relation_status_code).trim()) || '';
  const map = edgeStyle.edgeStatusColor || {};
  return (code && map[code]) || map.DEFAULT || '#666666';
}

function escStyle(s) {
  return String(s || '').replace(/"/g, '\\"');
}

/** Ландшафт A4 в draw.io; легенда — координаты как в temp/«Целевое решение… v4».drawio */
const PAGE_LANDSCAPE_W = 1169;
const PAGE_LANDSCAPE_H = 827;

/** Подписи и раскладка ячеек — из эталонного drawio (v4). Заливки/линии — из nodeStatusColor / edgeStatusColor. */
function legendHtmlSpan(text) {
  return escapeXml(`<span style="color: rgb(33, 33, 33); text-align: left;">${text}</span>`);
}

function legendHtmlTwoLines(line1, line2) {
  return escapeXml(
    `<span style="color: rgb(33, 33, 33); text-align: left;">${line1}</span><div><span style="color: rgb(33, 33, 33); text-align: left;">${line2}</span></div>`,
  );
}

/**
 * Легенда в правом нижнем углу (как в «Целевое решение (с интеграцией в ИТ ландшафт) v4.drawio»).
 * Только при генерации mxfile на сервере; цвета из DRAWIO_NODE_STYLE / DRAWIO_EDGE_STYLE.
 */
function buildLegendMxCells(parentId, nodeStyle, edgeStyle) {
  const nodeColors = (nodeStyle && nodeStyle.nodeStatusColor) || {};
  const edgeColors = (edgeStyle && edgeStyle.edgeStatusColor) || {};
  const sw = 2;

  const frameX = 910;
  const frameY = 510;
  const frameW = 245;
  const frameH = 309;

  const parts = [];
  let idn = 0;
  const nid = () => `ar-leg-${idn++}`;

  parts.push(
    `<mxCell id="${nid()}" value="" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FAFAFA;strokeColor=#424242;dashed=1;dashPattern=4 3;arcSize=4;" vertex="1" parent="${parentId}">` +
      `<mxGeometry x="${frameX}" y="${frameY}" width="${frameW}" height="${frameH}" as="geometry"/>` +
      `</mxCell>`,
  );

  parts.push(
    `<mxCell id="${nid()}" value="${escapeXml('ОБОЗНАЧЕНИЯ:')}" style="text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;fontStyle=1;fontSize=12;fontColor=#212121;" vertex="1" parent="${parentId}">` +
      `<mxGeometry x="922" y="522" width="223" height="22" as="geometry"/>` +
      `</mxCell>`,
  );

  parts.push(
    `<mxCell id="${nid()}" value="${escapeXml('Системы/модули:')}" style="text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;fontStyle=1;fontSize=10;fontColor=#424242;" vertex="1" parent="${parentId}">` +
      `<mxGeometry x="922" y="543" width="213" height="16" as="geometry"/>` +
      `</mxCell>`,
  );

  const boxStyle = (fill) =>
    `rounded=1;whiteSpace=wrap;html=1;align=center;verticalAlign=middle;fontSize=9;fillColor=${escStyle(fill)};strokeColor=#000000;arcSize=19;`;

  const boxes = [
    { fillKey: 'ADR_INCR_SYS_IN_USE', x: 922, y: 569, value: legendHtmlSpan('Существующая система/модуль') },
    { fillKey: 'ADR_INCR_SYS_CREATING', x: 1035, y: 569, value: legendHtmlTwoLines('Создаваемая', 'система/модуль') },
    { fillKey: 'ADR_INCR_SYS_MODIFYING', x: 922, y: 614, value: legendHtmlTwoLines('Изменяемая', 'система/модуль') },
    { fillKey: 'ADR_INCR_SYS_OTHER_SOLUTION', x: 1035, y: 614, value: legendHtmlTwoLines('Реализуемая в рамках смежной задачи', 'система/модуль') },
  ];
  for (const b of boxes) {
    const fill = nodeColors[b.fillKey] || '#E0E0E0';
    parts.push(
      `<mxCell id="${nid()}" value="${b.value}" style="${boxStyle(fill)}" vertex="1" parent="${parentId}">` +
        `<mxGeometry x="${b.x}" y="${b.y}" width="103" height="35" as="geometry"/>` +
        `</mxCell>`,
    );
  }

  parts.push(
    `<mxCell id="${nid()}" value="${escapeXml('Интеграции:')}" style="text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;fontStyle=1;fontSize=10;fontColor=#424242;" vertex="1" parent="${parentId}">` +
      `<mxGeometry x="922" y="659" width="223" height="16" as="geometry"/>` +
      `</mxCell>`,
  );

  const intRows = [
    { code: 'ADR_INCR_REL_CREATING', sy: 683, ly: 671, lab: 'Создаётся' },
    { code: 'ADR_INCR_REL_MODIFYING', sy: 700.86, ly: 688, lab: 'Модифицируется' },
    { code: 'ADR_INCR_REL_IN_USE', sy: 719, ly: 705, lab: 'Используется' },
    { code: 'ADR_INCR_REL_REMOVING', sy: 738, ly: 726, lab: 'Удаляется' },
  ];
  for (const row of intRows) {
    const stroke = edgeColors[row.code] || '#616161';
    parts.push(
      `<mxCell id="${nid()}" value="" style="endArrow=none;startArrow=none;html=1;strokeWidth=${sw};strokeColor=${escStyle(stroke)};" edge="1" parent="${parentId}">` +
        `<mxGeometry width="50" height="50" relative="1" as="geometry">` +
        `<mxPoint x="922" y="${row.sy}" as="sourcePoint"/>` +
        `<mxPoint x="962" y="${row.sy}" as="targetPoint"/>` +
        `</mxGeometry></mxCell>`,
    );
    parts.push(
      `<mxCell id="${nid()}" value="${escapeXml(row.lab)}" style="text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;fontSize=9;fontColor=#212121;whiteSpace=wrap;" vertex="1" parent="${parentId}">` +
        `<mxGeometry x="970" y="${row.ly}" width="175" height="22" as="geometry"/>` +
        `</mxCell>`,
    );
  }

  const remCol = edgeColors.ADR_INCR_REL_REMOVING || '#C62828';
  parts.push(
    `<mxCell id="${nid()}" value="${escapeXml('Прочее:')}" style="text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;fontStyle=1;fontSize=10;fontColor=#424242;" vertex="1" parent="${parentId}">` +
      `<mxGeometry x="922" y="759" width="48" height="16" as="geometry"/>` +
      `</mxCell>`,
  );
  parts.push(
    `<mxCell id="${nid()}" value="${escapeXml('✕')}" style="text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;fontSize=22;fontStyle=1;fontColor=${escStyle(remCol)};" vertex="1" parent="${parentId}">` +
      `<mxGeometry x="922" y="781" width="28" height="28" as="geometry"/>` +
      `</mxCell>`,
  );
  parts.push(
    `<mxCell id="${nid()}" value="${escapeXml('Система/модуль выводится из эксплуатации')}" style="text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;fontSize=9;fontColor=#212121;whiteSpace=wrap;" vertex="1" parent="${parentId}">` +
      `<mxGeometry x="954" y="779" width="191" height="30" as="geometry"/>` +
      `</mxCell>`,
  );

  return parts.join('');
}

/**
 * @param {object} opts
 * @param {ReturnType<resolveDrawioStyles> | null} [opts.drawio] — если null, берётся из getParam
 * @param {(code: string, def: any) => any} [opts.getParam]
 */
function buildMxfile(opts) {
  const {
    systems = [],
    relations = [],
    solutionName = 'Решение',
    versionLabel = 'v1',
    geometryMap,
    drawio: drawioIn,
    getParam,
  } = opts;

  const drawio = drawioIn || (getParam ? resolveDrawioStyles(getParam) : resolveDrawioStyles(() => undefined));
  const nodeStyle = drawio.node;
  const edgeStyle = drawio.edge;
  const layout = drawio.layout;

  const parent = '1';
  const cells = [];
  cells.push('<mxCell id="0"/>');
  cells.push('<mxCell id="1" parent="0"/>');

  const sortedSystems = [...systems]
    .filter((s) => s && s.ar_systems_id != null && String(s.ar_systems_id).trim() !== '')
    .sort((a, b) =>
    String(a.system_name || a.system_code || '').localeCompare(String(b.system_name || b.system_code || ''), 'ru'),
  );

  const sizes = sortedSystems.map((s) => ({ sys: s, ...estimateNodeSize(s, nodeStyle) }));
  let maxW = 140;
  let maxH = 72;
  for (const z of sizes) {
    maxW = Math.max(maxW, z.width);
    maxH = Math.max(maxH, z.height);
  }

  const edgeGeometryMap = opts.edgeGeometryMap || null;
  const useLayeredLayout = !geometryMap || geometryMap.size === 0;
  const nodePositions = useLayeredLayout
    ? layoutNodes(sizes, relations, layout)
    : null;

  const positionsForRoutes = new Map();
  sizes.forEach((z, i) => {
    const s = z.sys;
    const sid = `sys-${s.ar_systems_id}`;
    const value = buildNodeHtmlValue(z.title, z.bodyLines, nodeStyle);
    const { fillColor, strokeColor } = nodeColors(s, nodeStyle);
    const corner = Number(nodeStyle.cornerRadius) || 8;
    let x;
    let y;
    let w = z.width;
    let h = z.height;
    const g = geometryMap && geometryMap.get(sid);
    if (g) {
      x = g.x;
      y = g.y;
      w = g.width;
      h = g.height;
    } else if (nodePositions && nodePositions.has(sid)) {
      const p = nodePositions.get(sid);
      x = p.x;
      y = p.y;
      w = p.width;
      h = p.height;
    } else {
      const margin = Number(layout.margin) || 40;
      const nodeSep = Number(layout.nodeSep) || 40;
      const rankSep = Number(layout.rankSep) || 80;
      const n = sizes.length;
      const cols = n === 0 ? 1 : Math.min(4, Math.max(1, Math.ceil(Math.sqrt(n))));
      const cellW = maxW + nodeSep;
      const cellH = maxH + rankSep;
      x = margin + (i % cols) * cellW;
      y = margin + Math.floor(i / cols) * cellH;
    }
    const style =
      `rounded=1;whiteSpace=wrap;html=1;arcSize=${corner};` +
      `fillColor=${fillColor};strokeColor=${strokeColor};`;
    positionsForRoutes.set(sid, { x, y, width: w, height: h });
    cells.push(
      `<mxCell id="${sid}" value="${value}" style="${style}" vertex="1" parent="${parent}"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`,
    );
  });
  const computedRoutes =
    positionsForRoutes.size > 0 ? computeEdgeRoutes(positionsForRoutes, relations, layout) : new Map();

  const edgeLabelFs = Number(edgeStyle.labelFontSize) || 10;
  const systemIdSet = new Set(sortedSystems.map((s) => String(s.ar_systems_id)));
  relations.forEach((r) => {
    const from = r.from_ar_systems_id != null ? `sys-${r.from_ar_systems_id}` : null;
    const to = r.to_ar_systems_id != null ? `sys-${r.to_ar_systems_id}` : null;
    if (!from || !to) return;
    if (!systemIdSet.has(String(r.from_ar_systems_id)) || !systemIdSet.has(String(r.to_ar_systems_id))) return;
    const rid = `rel-${r.id}`;
    const label = escapeXml((r.name || r.description || 'Связь').slice(0, 500));
    const stroke = edgeStrokeColor(r, edgeStyle);
    const sw = 2;
    const saved = edgeGeometryMap && edgeGeometryMap.get(rid);
    const route = saved ? routeFromSaved(saved) : computedRoutes.get(rid);
    const portStyle = formatPortStyle(route);
    const style =
      `edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;` +
      `startArrow=none;endArrow=classic;endFill=1;strokeColor=${stroke};strokeWidth=${sw};` +
      `fontSize=${edgeLabelFs};fontColor=#000000;${portStyle}`;
    const geoXml = formatEdgeGeometryXml(route);
    cells.push(
      `<mxCell id="${rid}" value="${label}" style="${style}" edge="1" parent="${parent}" source="${from}" target="${to}">${geoXml}</mxCell>`,
    );
  });

  cells.push(buildLegendMxCells(parent, nodeStyle, edgeStyle));

  const inner = cells.join('');
  const diagramName = escapeXml(`${solutionName} ${versionLabel}`);
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8"?><mxfile host="app.diagrams.net" modified="${now}" version="22.1.0" type="device"><diagram id="d1" name="${diagramName}"><mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${PAGE_LANDSCAPE_W}" pageHeight="${PAGE_LANDSCAPE_H}" math="0" shadow="0"><root>${inner}</root></mxGraphModel></diagram></mxfile>`;
}

/**
 * Пересборка с учётом сохранённой геометрии вершин из предыдущего mxfile.
 */
function mergeMxfileWithData(previousMxfile, systems, relations, solutionName, versionLabel, getParam) {
  const geometryMap = extractVertexGeometryMap(previousMxfile);
  const edgeGeometryMap = extractEdgeGeometryMap(previousMxfile);
  const drawio = getParam ? resolveDrawioStyles(getParam) : null;
  return buildMxfile({
    systems,
    relations,
    solutionName,
    versionLabel,
    geometryMap,
    edgeGeometryMap,
    drawio,
  });
}

module.exports = {
  escapeXml,
  extractVertexGeometryMap,
  extractEdgeGeometryMap,
  buildMxfile,
  mergeMxfileWithData,
  resolveDrawioStyles,
};

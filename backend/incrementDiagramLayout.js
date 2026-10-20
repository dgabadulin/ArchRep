/**
 * Слойная раскладка (dagre) и ортогональная разводка рёбер для draw.io (issue #53, варианты C + D).
 */


/**
 * @param {string} mxfile
 * @returns {Map<string, { exitX?: string, exitY?: string, entryX?: string, entryY?: string, points?: {x:number,y:number}[] }>}
 */
function extractEdgeGeometryMap(mxfile) {
  const map = new Map();
  if (!mxfile || typeof mxfile !== 'string') return map;
  const re = /<mxCell\b[^>]*\bid=["'](rel-\d+)["'][^>]*>/g;
  let m;
  while ((m = re.exec(mxfile)) !== null) {
    const id = m[1];
    const start = m.index;
    const end = mxfile.indexOf('</mxCell>', start);
    const block = end === -1 ? mxfile.slice(start) : mxfile.slice(start, end + 9);
    const styleM = /\bstyle="([^"]*)"/.exec(block);
    const style = styleM ? styleM[1] : '';
    const ports = parseStylePorts(style);
    const points = parseGeometryPoints(block);
    if (ports.exitX != null || ports.entryX != null || (points && points.length)) {
      map.set(id, { ...ports, points: points || undefined });
    }
  }
  return map;
}

function parseStylePorts(style) {
  const get = (name) => {
    const re = new RegExp(`(?:^|;)${name}=([^;]+)`);
    const hit = re.exec(style || '');
    return hit ? hit[1] : null;
  };
  return {
    exitX: get('exitX'),
    exitY: get('exitY'),
    entryX: get('entryX'),
    entryY: get('entryY'),
  };
}

function parseGeometryPoints(block) {
  const arr = /<Array as="points">([\s\S]*?)<\/Array>/.exec(block);
  if (!arr) return [];
  const pts = [];
  const ptRe = /<mxPoint x="([^"]*)" y="([^"]*)"/g;
  let pm;
  while ((pm = ptRe.exec(arr[1])) !== null) {
    pts.push({ x: parseFloat(pm[1]), y: parseFloat(pm[2]) });
  }
  return pts;
}

/**
 * @param {Array<{ sys: object, width: number, height: number }>} sizes
 * @param {Array} relations
 * @param {object} layout — DRAWIO_LAYOUT_STYLE
 * @returns {Map<string, { x: number, y: number, width: number, height: number }>}
 */
function layoutNodesLayered(sizes, relations, layout) {
  // eslint-disable-next-line global-require
  const dagre = require('dagre');
  const margin = Number(layout.margin) || 40;
  const nodeSep = (Number(layout.nodeSep) || 40) + (Number(layout.edgeLabelReserveV) || 0);
  const rankSep = (Number(layout.rankSep) || 80) + (Number(layout.edgeLabelReserveH) || 0);
  const direction = String(layout.direction || 'LR').toUpperCase();
  const rankdir = direction === 'TB' || direction === 'BT' ? direction : 'LR';

  const g = new dagre.graphlib.Graph({ compound: false, multigraph: true });
  g.setGraph({
    rankdir,
    nodesep: nodeSep,
    ranksep: rankSep,
    marginx: margin,
    marginy: margin,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const z of sizes) {
    const sid = `sys-${z.sys.ar_systems_id}`;
    g.setNode(sid, { width: z.width, height: z.height });
  }

  const nodeIds = new Set(sizes.map((z) => `sys-${z.sys.ar_systems_id}`));
  for (const r of relations || []) {
    const from = r.from_ar_systems_id != null ? `sys-${r.from_ar_systems_id}` : null;
    const to = r.to_ar_systems_id != null ? `sys-${r.to_ar_systems_id}` : null;
    if (!from || !to || !nodeIds.has(from) || !nodeIds.has(to)) continue;
    g.setEdge(from, to, { relationId: r.id });
  }

  dagre.layout(g);

  const positions = new Map();
  for (const z of sizes) {
    const sid = `sys-${z.sys.ar_systems_id}`;
    const n = g.node(sid);
    if (!n) continue;
    positions.set(sid, {
      x: n.x - n.width / 2,
      y: n.y - n.height / 2,
      width: n.width,
      height: n.height,
    });
  }
  return positions;
}

/** Сетка (fallback), если algorithm !== layered_orthogonal */
function layoutNodesGrid(sizes, layout) {
  const margin = Number(layout.margin) || 40;
  const nodeSep = Number(layout.nodeSep) || 40;
  const rankSep = Number(layout.rankSep) || 80;
  let maxW = 140;
  let maxH = 72;
  for (const z of sizes) {
    maxW = Math.max(maxW, z.width);
    maxH = Math.max(maxH, z.height);
  }
  const n = sizes.length;
  const cols = n === 0 ? 1 : Math.min(4, Math.max(1, Math.ceil(Math.sqrt(n))));
  const cellW = maxW + nodeSep;
  const cellH = maxH + rankSep;
  const positions = new Map();
  sizes.forEach((z, i) => {
    const sid = `sys-${z.sys.ar_systems_id}`;
    positions.set(sid, {
      x: margin + (i % cols) * cellW,
      y: margin + Math.floor(i / cols) * cellH,
      width: z.width,
      height: z.height,
    });
  });
  return positions;
}

function layoutNodes(sizes, relations, layout) {
  const algo = String(layout.algorithm || 'layered_orthogonal');
  if (algo === 'layered_orthogonal' && sizes.length > 0) {
    try {
      return layoutNodesLayered(sizes, relations, layout);
    } catch (e) {
      console.warn('[incrementDiagram] layered layout failed, using grid:', e.message);
    }
  }
  return layoutNodesGrid(sizes, layout);
}

function portFraction(index, total) {
  if (total <= 1) return 0.5;
  return (index + 1) / (total + 1);
}

/**
 * @param {Map<string, {x,y,width,height}>} positions
 * @param {Array} relations
 * @param {object} layout
 * @returns {Map<string, { exitX: number, exitY: number, entryX: number, entryY: number, points?: {x:number,y:number}[] }>}
 */
function boxCenter(box) {
  return { cx: box.x + box.width / 2, cy: box.y + box.height / 2 };
}

/**
 * Сторона выхода/входа по взаимному положению центров (ближайшая грань).
 * @param {'LR'|'TB'|'BT'} layoutDirection — при почти равных |dx| и |dy|
 */
function pickSides(fromBox, toBox, layoutDirection = 'LR') {
  const fc = boxCenter(fromBox);
  const tc = boxCenter(toBox);
  const dx = tc.cx - fc.cx;
  const dy = tc.cy - fc.cy;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  const tiePx = 24;
  let horizontal;
  if (Math.abs(adx - ady) <= tiePx) {
    horizontal = layoutDirection === 'LR';
  } else {
    horizontal = adx >= ady;
  }
  if (horizontal) {
    if (dx >= 0) return { exitSide: 'east', entrySide: 'west' };
    return { exitSide: 'west', entrySide: 'east' };
  }
  if (dy >= 0) return { exitSide: 'south', entrySide: 'north' };
  return { exitSide: 'north', entrySide: 'south' };
}

/** @param {'east'|'west'|'north'|'south'} side */
function portOnSide(box, side, frac, isExit) {
  const f = Math.min(1, Math.max(0, frac));
  const { x, y, width: w, height: h } = box;
  switch (side) {
    case 'east':
      return {
        x: x + w,
        y: y + h * f,
        ...(isExit ? { exitX: 1, exitY: f } : { entryX: 1, entryY: f }),
      };
    case 'west':
      return {
        x,
        y: y + h * f,
        ...(isExit ? { exitX: 0, exitY: f } : { entryX: 0, entryY: f }),
      };
    case 'south':
      return {
        x: x + w * f,
        y: y + h,
        ...(isExit ? { exitX: f, exitY: 1 } : { entryX: f, entryY: 1 }),
      };
    case 'north':
    default:
      return {
        x: x + w * f,
        y,
        ...(isExit ? { exitX: f, exitY: 0 } : { entryX: f, entryY: 0 }),
      };
  }
}

/**
 * Ортогональный маршрут снаружи bbox: выход/вход с ближайших граней, излом между ними.
 */
function orthogonalRouteNearestSide(fromBox, toBox, exitFrac, entryFrac, offset, layoutDirection = 'LR') {
  const { exitSide, entrySide } = pickSides(fromBox, toBox, layoutDirection);
  const exit = portOnSide(fromBox, exitSide, exitFrac, true);
  const entry = portOnSide(toBox, entrySide, entryFrac, false);

  const isHoriz = exitSide === 'east' || exitSide === 'west';
  const points = [];

  if (isHoriz) {
    const midX = (exit.x + entry.x) / 2;
    const sy = exit.y + offset;
    const ty = entry.y + offset;
    points.push({ x: midX, y: sy }, { x: midX, y: ty });
  } else {
    const midY = (exit.y + entry.y) / 2 + offset;
    points.push({ x: exit.x, y: midY }, { x: entry.x, y: midY });
  }

  return {
    exitX: exit.exitX,
    exitY: exit.exitY,
    entryX: entry.entryX,
    entryY: entry.entryY,
    points,
  };
}

function computeEdgeRoutes(positions, relations, layout) {
  const layoutDirection = String(layout.direction || 'LR').toUpperCase();
  const parallelGap = Number(layout.parallelEdgeGap) || 12;
  const routes = new Map();

  const valid = (relations || []).filter((r) => {
    const from = r.from_ar_systems_id != null ? `sys-${r.from_ar_systems_id}` : null;
    const to = r.to_ar_systems_id != null ? `sys-${r.to_ar_systems_id}` : null;
    return from && to && positions.has(from) && positions.has(to);
  });

  const byPair = new Map();
  const outBySource = new Map();
  const inByTarget = new Map();

  for (const r of valid) {
    const from = `sys-${r.from_ar_systems_id}`;
    const to = `sys-${r.to_ar_systems_id}`;
    const pk = `${from}\0${to}`;
    if (!byPair.has(pk)) byPair.set(pk, []);
    byPair.get(pk).push(r);
    if (!outBySource.has(from)) outBySource.set(from, []);
    outBySource.get(from).push(r);
    if (!inByTarget.has(to)) inByTarget.set(to, []);
    inByTarget.get(to).push(r);
  }

  const outIndex = new Map();
  const inIndex = new Map();
  const pairIndex = new Map();
  const sortedValid = [...valid].sort((a, b) => Number(a.id) - Number(b.id));

  for (const r of sortedValid) {
    const from = `sys-${r.from_ar_systems_id}`;
    const to = `sys-${r.to_ar_systems_id}`;
    const pk = `${from}\0${to}`;
    const oi = outIndex.get(from) || 0;
    outIndex.set(from, oi + 1);
    const ii = inIndex.get(to) || 0;
    inIndex.set(to, ii + 1);
    const pi = pairIndex.get(pk) || 0;
    pairIndex.set(pk, pi + 1);

    const rid = `rel-${r.id}`;
    const fromBox = positions.get(from);
    const toBox = positions.get(to);
    const nOut = outBySource.get(from).length;
    const nIn = inByTarget.get(to).length;
    const nPair = byPair.get(pk).length;

    if (from === to) {
      routes.set(rid, selfLoopRoute(fromBox, pi, nPair, layoutDirection, parallelGap));
      continue;
    }

    const offset = nPair > 1 ? (pi - (nPair - 1) / 2) * parallelGap : 0;
    const exitFrac = nPair > 1 ? portFraction(pi, nPair) : portFraction(oi, nOut);
    const entryFrac = nPair > 1 ? portFraction(pi, nPair) : portFraction(ii, nIn);
    const route = orthogonalRouteNearestSide(
      fromBox,
      toBox,
      exitFrac,
      entryFrac,
      offset,
      layoutDirection,
    );
    routes.set(rid, route);
  }

  return routes;
}

function selfLoopRoute(box, index, total, direction, gap) {
  const t = portFraction(index, total);
  if (direction === 'TB' || direction === 'BT') {
    const cx = box.x + box.width * t;
    const loop = Math.max(40, gap * 4);
    return {
      exitX: t,
      exitY: 1,
      entryX: Math.min(1, t + 0.15),
      entryY: 1,
      points: [
        { x: cx, y: box.y + box.height + loop },
        { x: cx + loop, y: box.y + box.height + loop },
        { x: cx + loop, y: box.y + box.height - 8 },
      ],
    };
  }
  const cy = box.y + box.height * t;
  const loop = Math.max(48, gap * 4);
  return {
    exitX: 1,
    exitY: t,
    entryX: 1,
    entryY: Math.min(1, t + 0.35),
    points: [
      { x: box.x + box.width + loop, y: cy },
      { x: box.x + box.width + loop, y: cy - loop * 0.6 },
      { x: box.x + box.width - 8, y: cy - loop * 0.5 },
    ],
  };
}

function formatPortStyle(route) {
  if (!route) return '';
  const parts = [];
  if (route.exitX != null) parts.push(`exitX=${route.exitX}`);
  if (route.exitY != null) parts.push(`exitY=${route.exitY}`);
  if (route.entryX != null) parts.push(`entryX=${route.entryX}`);
  if (route.entryY != null) parts.push(`entryY=${route.entryY}`);
  return parts.length ? `${parts.join(';')};` : '';
}

function formatEdgeGeometryXml(route) {
  if (!route || !route.points || !route.points.length) {
    return '<mxGeometry relative="1" as="geometry"/>';
  }
  const pts = route.points.map((p) => `<mxPoint x="${p.x}" y="${p.y}"/>`).join('');
  return `<mxGeometry relative="1" as="geometry"><Array as="points">${pts}</Array></mxGeometry>`;
}

/** Слияние сохранённых портов (строки) с вычисленным маршрутом */
function routeFromSaved(saved) {
  if (!saved) return null;
  const route = {
    exitX: saved.exitX != null ? parseFloat(saved.exitX) : undefined,
    exitY: saved.exitY != null ? parseFloat(saved.exitY) : undefined,
    entryX: saved.entryX != null ? parseFloat(saved.entryX) : undefined,
    entryY: saved.entryY != null ? parseFloat(saved.entryY) : undefined,
    points: saved.points,
  };
  return route;
}

module.exports = {
  extractEdgeGeometryMap,
  layoutNodes,
  computeEdgeRoutes,
  formatPortStyle,
  formatEdgeGeometryXml,
  routeFromSaved,
};

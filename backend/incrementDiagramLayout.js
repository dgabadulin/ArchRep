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

/** Ключ неупорядоченной пары узлов: A→B и B→A — один пучок (issue #93). */
function pairKey(a, b) {
  const sa = String(a);
  const sb = String(b);
  return sa <= sb ? `${sa}\u0000${sb}` : `${sb}\u0000${sa}`;
}

/** Прямоугольник, расширенный на зазор: линия не идёт вплотную к чужому узлу. */
function inflateBox(box, d) {
  const g = Number(d) || 0;
  return { x: box.x - g, y: box.y - g, width: box.width + 2 * g, height: box.height + 2 * g };
}

/** Координата грани узла по оси движения (x для east/west, y для north/south). */
function sideCoord(box, side) {
  switch (side) {
    case 'east':
      return box.x + box.width;
    case 'west':
      return box.x;
    case 'south':
      return box.y + box.height;
    case 'north':
    default:
      return box.y;
  }
}

/**
 * Пересечение орто-отрезка с прямоугольником. Отрезки всегда горизонтальные или
 * вертикальные, поэтому достаточно пересечения bbox.
 */
function segmentHitsBox(p1, p2, box) {
  const minX = Math.min(p1.x, p2.x);
  const maxX = Math.max(p1.x, p2.x);
  const minY = Math.min(p1.y, p2.y);
  const maxY = Math.max(p1.y, p2.y);
  if (maxX <= box.x || minX >= box.x + box.width) return false;
  if (maxY <= box.y || minY >= box.y + box.height) return false;
  return true;
}

function routeCrossings(points, obstacles) {
  let n = 0;
  for (let i = 0; i < points.length - 1; i++) {
    for (const ob of obstacles) {
      if (segmentHitsBox(points[i], points[i + 1], ob)) n++;
    }
  }
  return n;
}

function routeLength(points) {
  let len = 0;
  for (let i = 0; i < points.length - 1; i++) {
    len += Math.abs(points[i + 1].x - points[i].x) + Math.abs(points[i + 1].y - points[i].y);
  }
  return len;
}

function clamp(v, lo, hi) {
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo > hi) return v;
  return Math.min(Math.max(v, lo), hi);
}

/** Приоритет маршрута: меньше пересечений → меньше изломов → ближе к своей полосе → короче. */
function isBetterRoute(a, b) {
  if (!b) return true;
  if (a.crossings !== b.crossings) return a.crossings < b.crossings;
  if (a.points.length !== b.points.length) return a.points.length < b.points.length;
  if (Math.abs(a.laneDelta - b.laneDelta) > 0.5) return a.laneDelta < b.laneDelta;
  return a.length < b.length - 0.5;
}

/**
 * Кандидаты маршрута для горизонтального выхода/входа (LR):
 * 1) вертикальный коридор между узлами — своя полоса `lane` плюс обходы по x снаружи чужих узлов;
 * 2) обход «сверху/снизу» — горизонтальная полоса вне блокирующих узлов.
 */
function buildHorizontalCandidates(exit, entry, exitSide, entrySide, preferred, obstacles, opts, consider) {
  const gutter = Number(opts.gutter) || 12;
  const stub = Number(opts.stub) || gutter;
  const bounds = opts.bounds || {};
  const outDir = exitSide === 'east' ? 1 : -1;
  const inDir = entrySide === 'east' ? 1 : -1;
  const startX = exit.x + outDir * stub;
  const endX = entry.x + inDir * stub;
  const lo = Math.min(startX, endX);
  const hi = Math.max(startX, endX);

  const xs = [preferred, (startX + endX) / 2];
  for (const ob of obstacles) xs.push(ob.x - gutter, ob.x + ob.width + gutter);
  const usedX = new Set();
  for (const raw of xs) {
    const x = clamp(raw, lo, hi);
    const key = Math.round(x * 100) / 100;
    if (usedX.has(key)) continue;
    usedX.add(key);
    consider([exit, { x, y: exit.y }, { x, y: entry.y }, entry], Math.abs(x - preferred));
  }

  const ys = [(exit.y + entry.y) / 2];
  for (const ob of obstacles) ys.push(ob.y - gutter, ob.y + ob.height + gutter);
  const usedY = new Set();
  for (const raw of ys) {
    const y = clamp(raw, bounds.minY, bounds.maxY);
    const key = Math.round(y * 100) / 100;
    if (usedY.has(key)) continue;
    usedY.add(key);
    consider(
      [exit, { x: startX, y: exit.y }, { x: startX, y }, { x: endX, y }, { x: endX, y: entry.y }, entry],
      Math.abs(y - preferred) * 2,
    );
  }
}

/**
 * Кандидаты маршрута для вертикального выхода/входа (TB/BT):
 * 1) горизонтальный коридор между узлами — своя полоса `lane` плюс обходы по y снаружи чужих узлов;
 * 2) обход «слева/справа» — вертикальная полоса вне блокирующих узлов.
 */
function buildVerticalCandidates(exit, entry, exitSide, entrySide, preferred, obstacles, opts, consider) {
  const gutter = Number(opts.gutter) || 12;
  const stub = Number(opts.stub) || gutter;
  const bounds = opts.bounds || {};
  const outDir = exitSide === 'south' ? 1 : -1;
  const inDir = entrySide === 'south' ? 1 : -1;
  const startY = exit.y + outDir * stub;
  const endY = entry.y + inDir * stub;
  const lo = Math.min(startY, endY);
  const hi = Math.max(startY, endY);

  const ys = [preferred, (startY + endY) / 2];
  for (const ob of obstacles) ys.push(ob.y - gutter, ob.y + ob.height + gutter);
  const usedY = new Set();
  for (const raw of ys) {
    const y = clamp(raw, lo, hi);
    const key = Math.round(y * 100) / 100;
    if (usedY.has(key)) continue;
    usedY.add(key);
    consider([exit, { x: exit.x, y }, { x: entry.x, y }, entry], Math.abs(y - preferred));
  }

  const midX = (exit.x + entry.x) / 2;
  const xs = [midX];
  for (const ob of obstacles) xs.push(ob.x - gutter, ob.x + ob.width + gutter);
  const usedX = new Set();
  for (const raw of xs) {
    const x = clamp(raw, bounds.minX, bounds.maxX);
    const key = Math.round(x * 100) / 100;
    if (usedX.has(key)) continue;
    usedX.add(key);
    consider(
      [exit, { x: exit.x, y: startY }, { x, y: startY }, { x, y: endY }, { x: entry.x, y: endY }, entry],
      Math.abs(x - midX) * 2,
    );
  }
}


/**
 * Маршрут ребра: порты на ближайших гранях + ортогональные waypoints с обходом чужих узлов.
 * Порты задаются долями вдоль грани (`exitY`/`entryY` при LR, `exitX`/`entryX` при TB).
 *
 * @param {object} fromBox
 * @param {object} toBox
 * @param {'east'|'west'|'north'|'south'} exitSide
 * @param {'east'|'west'|'north'|'south'} entrySide
 * @param {number} exitFrac — доля вдоль грани источника (разведение параллельных рёбер)
 * @param {number} entryFrac — доля вдоль грани приёмника
 * @param {number} lane — предпочтительная координата коридора (x для LR, y для TB)
 * @param {Array<{x:number,y:number,width:number,height:number}>} obstacles — чужие узлы, расширенные на gutter
 * @param {{ gutter: number, stub: number, bounds: object }} opts
 * @returns {{ exitX:number, exitY:number, entryX:number, entryY:number, points:{x:number,y:number}[] }}
 */
function routeBetween(fromBox, toBox, exitSide, entrySide, exitFrac, entryFrac, lane, obstacles, opts) {
  const exit = portOnSide(fromBox, exitSide, exitFrac, true);
  const entry = portOnSide(toBox, entrySide, entryFrac, false);
  const horizontal = exitSide === 'east' || exitSide === 'west';
  const midLane = horizontal ? (exit.x + entry.x) / 2 : (exit.y + entry.y) / 2;
  const preferred = Number.isFinite(lane) ? lane : midLane;

  let best = null;
  const consider = (points, laneDelta) => {
    const cand = {
      points,
      laneDelta,
      crossings: routeCrossings(points, obstacles),
      length: routeLength(points),
    };
    if (isBetterRoute(cand, best)) best = cand;
  };

  if (horizontal) {
    buildHorizontalCandidates(exit, entry, exitSide, entrySide, preferred, obstacles, opts, consider);
  } else {
    buildVerticalCandidates(exit, entry, exitSide, entrySide, preferred, obstacles, opts, consider);
  }

  const chosen = best ? best.points : [exit, entry];
  const points = [];
  for (const p of chosen.slice(1, -1)) {
    const prev = points.length ? points[points.length - 1] : exit;
    if (Math.round(prev.x) === Math.round(p.x) && Math.round(prev.y) === Math.round(p.y)) continue;
    points.push({ x: p.x, y: p.y });
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
  // Зазор до чужих узлов при обходе (issue #93): по умолчанию — половина parallelEdgeGap, не меньше 8px.
  const gutter = Number(layout.obstacleGap) > 0 ? Number(layout.obstacleGap) : Math.max(8, Math.round(parallelGap / 2));
  const stub = Math.max(8, Math.round(gutter));
  const routes = new Map();

  const valid = (relations || [])
    .filter((r) => {
      const from = r.from_ar_systems_id != null ? `sys-${r.from_ar_systems_id}` : null;
      const to = r.to_ar_systems_id != null ? `sys-${r.to_ar_systems_id}` : null;
      return from && to && positions.has(from) && positions.has(to);
    })
    .sort((a, b) => Number(a.id) - Number(b.id));

  if (!valid.length) return routes;

  const nodes = [...positions.entries()].map(([id, box]) => ({ id, box }));
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const { box } of nodes) {
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.width);
    maxY = Math.max(maxY, box.y + box.height);
  }
  const bounds = {
    minX: minX - 2 * gutter,
    minY: minY - 2 * gutter,
    maxX: maxX + 2 * gutter,
    maxY: maxY + 2 * gutter,
  };

  // 1. Стороны портов — по взаимному положению узлов (ближайшая грань).
  // Для петли (система → сама себе) выход и вход — на одной грани по направлению раскладки.
  const selfSide = layoutDirection === 'TB' || layoutDirection === 'BT' ? 'south' : 'east';
  const infos = valid.map((r) => {
    const from = `sys-${r.from_ar_systems_id}`;
    const to = `sys-${r.to_ar_systems_id}`;
    const selfLoop = from === to;
    const sides = selfLoop
      ? { exitSide: selfSide, entrySide: selfSide }
      : pickSides(positions.get(from), positions.get(to), layoutDirection);
    return { r, from, to, selfLoop, sides, pair: pairKey(from, to) };
  });

  // 2. Пучок A↔B: полосы (lane) внутри коридора общие для обоих направлений (issue #93).
  const byPair = new Map();
  for (const info of infos) {
    if (!byPair.has(info.pair)) byPair.set(info.pair, []);
    byPair.get(info.pair).push(info);
  }
  const laneByRel = new Map();
  for (const list of byPair.values()) {
    const sorted = [...list].sort((a, b) => Number(a.r.id) - Number(b.r.id));
    if (sorted[0].selfLoop) continue;
    const { exitSide, entrySide } = sorted[0].sides;
    const fromBox = positions.get(sorted[0].from);
    const toBox = positions.get(sorted[0].to);
    const c0 = sideCoord(fromBox, exitSide);
    const c1 = sideCoord(toBox, entrySide);
    const lo = Math.min(c0, c1);
    const hi = Math.max(c0, c1);
    const mid = (lo + hi) / 2;
    const width = Math.max(0, hi - lo);
    const n = sorted.length;
    sorted.forEach((info, i) => {
      let lane = mid;
      if (n > 1) {
        const step = Math.max(parallelGap, width / (n + 1));
        lane = clamp(mid + (i - (n - 1) / 2) * step, lo, hi);
      }
      laneByRel.set(info.r.id, lane);
    });
  }

  // 3. Порты на грань узла. Предпочтительная доля ребра одна для выхода и входа (ребро идёт «прямо»,
  // а не Z-образно), затем внутри грани доли выравниваются по порядку — это разводит и встречные потоки.
  // Петли участвуют в распределении наравне с остальными связями (две точки на одной грани).
  const pairSlotFrac = new Map();
  for (const list of byPair.values()) {
    const sorted = [...list].sort((a, b) => Number(a.r.id) - Number(b.r.id));
    sorted.forEach((info, i) => pairSlotFrac.set(info.r.id, portFraction(i, sorted.length)));
  }

  const slotKey = (nodeId, side) => `${nodeId}\u0000${side}`;
  const slots = new Map();
  for (const info of infos) {
    const a = slotKey(info.from, info.sides.exitSide);
    const b = slotKey(info.to, info.sides.entrySide);
    if (!slots.has(a)) slots.set(a, []);
    if (!slots.has(b)) slots.set(b, []);
    const preferred = pairSlotFrac.get(info.r.id) ?? 0.5;
    slots.get(a).push({ relId: info.r.id, role: 'exit', preferred });
    slots.get(b).push({ relId: info.r.id, role: 'entry', preferred });
  }
  const fracByRel = new Map();
  for (const list of slots.values()) {
    list.sort((x, y) => {
      if (Math.abs(x.preferred - y.preferred) > 1e-6) return x.preferred - y.preferred;
      if (x.role !== y.role) return x.role === 'exit' ? -1 : 1;
      return Number(x.relId) - Number(y.relId);
    });
    list.forEach((it, i) => fracByRel.set(`${it.relId}\u0000${it.role}`, portFraction(i, list.length)));
  }

  // 4. Маршруты: ближайшая сторона, свободный коридор или обход чужих узлов.
  for (const info of infos) {
    const rid = `rel-${info.r.id}`;
    const fromBox = positions.get(info.from);
    const toBox = positions.get(info.to);
    if (!fromBox || !toBox) continue;
    const exitFrac = fracByRel.get(`${info.r.id}\u0000exit`) ?? 0.5;
    const entryFrac = fracByRel.get(`${info.r.id}\u0000entry`) ?? 0.5;
    if (info.selfLoop) {
      routes.set(rid, selfLoopRoute(fromBox, exitFrac, entryFrac, layoutDirection, parallelGap));
      continue;
    }
    const obstacles = nodes
      .filter((n) => n.id !== info.from && n.id !== info.to)
      .map((n) => inflateBox(n.box, gutter));
    routes.set(
      rid,
      routeBetween(
        fromBox,
        toBox,
        info.sides.exitSide,
        info.sides.entrySide,
        exitFrac,
        entryFrac,
        laneByRel.get(info.r.id),
        obstacles,
        { gutter, stub, bounds },
      ),
    );
  }

  return routes;
}

/**
 * Петля связи «система → сама себе»: ортогональный обход снаружи узла (issue #93).
 * Доли выхода/входа приходят из общего распределения портов по грани (`computeEdgeRoutes`),
 * поэтому петля не садится на точку другой связи.
 */
function selfLoopRoute(box, exitFrac, entryFrac, direction, gap) {
  const loop = Math.max(40, gap * 4);
  if (direction === 'TB' || direction === 'BT') {
    const yLoop = box.y + box.height + loop;
    return {
      exitX: exitFrac,
      exitY: 1,
      entryX: entryFrac,
      entryY: 1,
      points: [
        { x: box.x + box.width * exitFrac, y: yLoop },
        { x: box.x + box.width * entryFrac, y: yLoop },
      ],
    };
  }
  const xLoop = box.x + box.width + loop;
  return {
    exitX: 1,
    exitY: exitFrac,
    entryX: 1,
    entryY: entryFrac,
    points: [
      { x: xLoop, y: box.y + box.height * exitFrac },
      { x: xLoop, y: box.y + box.height * entryFrac },
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

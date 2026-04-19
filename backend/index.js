const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { Pool } = require('pg');
const queries = require('./queries');
const { buildExcelBuffer } = require('./excelHelper');
const { loadParams, getParam } = require('./settingsParams');
const {
  loadRefCodes,
  getAdrStatusCodeById,
  resolveFlowStatusIdFromMap,
} = require('./refCodes');
const { applyDisplayName, validateTemplateValue } = require('./displayName');
const { buildHomeStats } = require('./homeDashboard');
const { buildMxfile, mergeMxfileWithData } = require('./incrementDiagram');
const {
  DEFAULT_DRAWIO_NODE_STYLE,
  DEFAULT_DRAWIO_EDGE_STYLE,
  DEFAULT_DRAWIO_LAYOUT_STYLE,
} = require('./drawioStyles');

// Параметры ADR: только коды справочников (issue #31).
const DEFAULT_FLOW_STATUS_MAP_BY_CODE = {
  ADR_INCR_REL_CREATING: 'FLOW_STATUS_PLANNED',
  ADR_INCR_REL_MODIFYING: 'FLOW_STATUS_PRODUCTION',
  ADR_INCR_REL_IN_USE: 'FLOW_STATUS_PRODUCTION',
  ADR_INCR_REL_REMOVING: 'FLOW_STATUS_EXCLUDED',
  ADR_INCR_REL_PLANNED: 'FLOW_STATUS_PLANNED',
  ADR_INCR_REL_IMPLEMENTING: 'FLOW_STATUS_IN_PROGRESS',
  ADR_INCR_REL_DONE: 'FLOW_STATUS_PRODUCTION',
};
const DEFAULT_APPROVED_STATUS_CODES = ['ADR_STATUS_APPROVED_ARCH', 'ADR_STATUS_APPROVED_COUNCIL'];
const DEFAULT_DRAFT_STATUS_CODE = 'ADR_STATUS_DRAFT';

// .env ищем в корне репозитория (при запуске node backend/index.js из корня cwd = корень)
const env = process.env.NODE_ENV || 'development';
const envPath = path.join(process.cwd(), `.env.${env}`);
require('dotenv').config({ path: envPath });

console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '(set)' : '(not set)');
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_PORT:', process.env.DB_PORT);

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

/** node-postgres не принимает undefined в параметрах запроса — подставляем SQL NULL */
function pgParam(v) {
  return v === undefined ? null : v;
}

/** Текст поля «Функции» в строке системы решения (issue #52). */
function formatSystemFunctionsComment(names) {
  const list = (names || []).map((n) => String(n || '').trim()).filter(Boolean);
  if (!list.length) return '';
  return list.map((n) => `-${n};`).join('\r\n');
}

const app = express();
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});
app.use((req, res, next) => {
  const allowed = (process.env.CORS_ORIGIN || 'http://localhost:5175').split(',').map(s => s.trim()).filter(Boolean);
  const origin = req.headers.origin;
  if (origin && (allowed.includes(origin) || allowed.includes('*'))) {
    res.setHeader('Access-Control-Allow-Origin', allowed.includes('*') ? '*' : origin);
  } else if (allowed.length === 1 && allowed[0] !== '*') {
    res.setHeader('Access-Control-Allow-Origin', allowed[0]);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Restart-Secret');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json());

const DISPLAY_NAME_PATHS = [
  [/^\/api\/ar-systems(?:\/\d+)?$/, 'system'],
  [/^\/api\/parent-systems$/, 'system'],
  [/^\/api\/technologies(?:\/\d+)?$/, 'technology'],
  [/^\/api\/partners(?:\/\d+)?$/, 'partner'],
  [/^\/api\/ar-vendors$/, 'partner'],
  [/^\/api\/owners(?:\/\d+)?$/, 'owner'],
  [/^\/api\/hosting-types(?:\/\d+)?$/, 'hosting_type'],
  [/^\/api\/system-statuses(?:\/\d+)?$/, 'system_status'],
  [/^\/api\/technology-classes(?:\/\d+)?$/, 'tech_class'],
  [/^\/api\/technology-types(?:\/\d+)?$/, 'tech_type'],
  [/^\/api\/technology-statuses(?:\/\d+)?$/, 'tech_status'],
  [/^\/api\/adr-statuses(?:\/\d+)?$/, 'adr_status'],
  [/^\/api\/adr-system-statuses(?:\/\d+)?$/, 'adr_system_status'],
  [/^\/api\/adr-relation-statuses(?:\/\d+)?$/, 'adr_relation_status'],
  [/^\/api\/adr-increment-types(?:\/\d+)?$/, 'adr_increment_type'],
  [/^\/api\/decisions\/principle(?:\/\d+)?$/, 'adrp'],
  [/^\/api\/decisions\/applied(?:\/\d+)?$/, 'adra'],
  [/^\/api\/ar-gaps(?:\/\d+)?$/, 'gap'],
  [/^\/api\/ar-gap-types(?:\/\d+)?$/, 'gap_type'],
  [/^\/api\/ar-impact-level-types(?:\/\d+)?$/, 'impact_level'],
  [/^\/api\/ar-gap-states(?:\/\d+)?$/, 'gap_state'],
  [/^\/api\/integration-flow-event-types(?:\/\d+)?$/, 'flow_event_type'],
  [/^\/api\/integration-flow-statuses(?:\/\d+)?$/, 'flow_status'],
  [/^\/api\/togaf\/organization-units(?:\/\d+)?$/, 'org_unit'],
  [/^\/api\/togaf\/refs\/organization-unit-categories(?:\/\d+)?$/, 'org_unit_category'],
  [/^\/api\/togaf\/actors(?:\/\d+)?$/, 'actor'],
  [/^\/api\/togaf\/refs\/actor-types(?:\/\d+)?$/, 'actor_type'],
  [/^\/api\/togaf\/business-services(?:\/\d+)?$/, 'business_service'],
  [/^\/api\/togaf\/refs\/business-service-statuses(?:\/\d+)?$/, 'business_service_status'],
  [/^\/api\/togaf\/business-functions(?:\/\d+)?$/, 'business_function'],
  [/^\/api\/togaf\/entity-types(?:\/\d+)?$/, 'meta_entity_type'],
  [/^\/api\/togaf\/relation-types(?:\/\d+)?$/, 'meta_relation_type'],
];

app.use((req, res, next) => {
  const json = res.json.bind(res);
  res.json = (payload) => {
    if (req.method === 'GET') {
      const hit = DISPLAY_NAME_PATHS.find(([re]) => re.test(req.path));
      const hasDisplayName = Array.isArray(payload)
        ? payload.some((r) => r && typeof r === 'object' && typeof r.display_name === 'string')
        : payload && typeof payload === 'object' && typeof payload.display_name === 'string';
      if (hit && !hasDisplayName) payload = applyDisplayName(payload, hit[1]);
    }
    return json(payload);
  };
  next();
});

// Статика единственного фронта (v3) подключается после loadParams() — путь ARR_FRONTEND_V3_PATH
const fs = require('fs');

/** Редирект со старых префиксов /v3 и /v2 на корень (тот же SPA). */
function legacyFrontendPrefixRedirect(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  if (req.path.startsWith('/api')) return next();
  let rest = req.path;
  if (rest === '/v2' || rest.startsWith('/v2/')) rest = rest.slice(3) || '/';
  else if (rest === '/v3' || rest.startsWith('/v3/')) rest = rest.slice(3) || '/';
  else return next();
  if (!rest.startsWith('/')) rest = '/' + rest;
  const q = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  return res.redirect(301, rest + q);
}

function mountFrontendStatic() {
  const v3Rel = getParam('ARR_FRONTEND_V3_PATH', 'frontend-v3-dist') || 'frontend-v3-dist';
  const frontendV3Dist = path.join(process.cwd(), v3Rel);
  if (fs.existsSync(frontendV3Dist)) {
    app.use(legacyFrontendPrefixRedirect);
    app.use(express.static(frontendV3Dist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(frontendV3Dist, 'index.html'));
    });
  } else {
    app.get('/', (req, res) => res.send('Hello, World!'));
    app.get(/^\/v3(\/.*)?$|^\/v2(\/.*)?$/, (_req, res) => {
      res.status(503).set('Content-Type', 'text/html; charset=utf-8').send(
        '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Фронт не собран</title></head><body><h1>Статика фронта не найдена</h1><p>Выполните <code>npm run build:v3</code> и убедитесь, что каталог <code>frontend-v3-dist</code> лежит рядом с бэкендом (или задайте <code>ARR_FRONTEND_V3_PATH</code>).</p></body></html>'
      );
    });
  }
}

// Проверка доступности бэкенда (без БД); после deploy — открыть http://host:3000/api/health
app.get('/api/health', (req, res) => res.json({ ok: true }));

/** Политика перезапуска процесса Node (сервисные операции UI). */
function getNodeRestartPolicy() {
  const secret = process.env.ADMIN_API_RESTART_SECRET;
  const hasSecret = secret != null && String(secret).length > 0;
  const insecure = process.env.ALLOW_INSECURE_RESTART_WITHOUT_SECRET === 'true';
  return {
    enabled: hasSecret || insecure,
    requiresSecret: hasSecret,
  };
}

app.get('/api/admin/restart-node/status', (req, res) => {
  const p = getNodeRestartPolicy();
  res.json({ enabled: p.enabled, requiresSecret: p.requiresSecret });
});

/**
 * Завершает процесс Node (код 0). В Docker при --restart=always (см. infra/deploy.bat, docker-compose)
 * демон перезапускает тот же контейнер; иначе — PM2/systemd или ручной запуск.
 * Защита: ADMIN_API_RESTART_SECRET (заголовок X-Admin-Restart-Secret или body.secret) либо ALLOW_INSECURE_RESTART_WITHOUT_SECRET=true.
 */
app.post('/api/admin/restart-node', (req, res) => {
  const p = getNodeRestartPolicy();
  if (!p.enabled) {
    return res.status(403).json({
      error:
        'Перезапуск API отключён. На сервере задайте ADMIN_API_RESTART_SECRET или (только в доверенной среде) ALLOW_INSECURE_RESTART_WITHOUT_SECRET=true.',
    });
  }
  if (p.requiresSecret) {
    const sent = req.headers['x-admin-restart-secret'] || (req.body && req.body.secret);
    const a = Buffer.from(String(sent || ''), 'utf8');
    const b = Buffer.from(String(process.env.ADMIN_API_RESTART_SECRET || ''), 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(401).json({ error: 'Неверный секрет перезапуска' });
    }
  }
  console.warn('[admin] Перезапуск API: process.exit(0) через 400 ms');
  res.status(202).json({
    ok: true,
    message:
      'Процесс API завершается. При Docker --restart=always (deploy.bat) или restart: always в compose контейнер поднимется снова; иначе PM2/служба или ручной запуск.',
  });
  setTimeout(() => process.exit(0), 400);
});
app.get('/api/health/db', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, db: 'ok' });
  } catch (err) {
    console.error('Health DB check failed:', err.message);
    res.status(503).json({ ok: false, db: err.message });
  }
});

// Публичный конфиг для фронта (только несекретные параметры, по белому списку)
const PUBLIC_CONFIG_DEFAULTS = {
  ARR_APP_BASE: '/',
  ARR_MENU_COOKIE: 'ar-v3-menu-expanded',
  ARR_COLS_COOKIE: 'ar_cols_',
  ARR_SORT_COOKIE: 'ar_sort_',
  ARR_COOKIE_MAX_DAYS: 365,
  ARR_SEARCH_PLACEHOLDER: 'Поиск по всем полям таблицы',
  GRAPH_LAYOUT_DEF: 'star',
  GRAPH_MAX_NODES: 200,
  GRAPH_EDGE_FONTSZ: 10,
  GRAPH_VIEWBOX_MIN: 500,
  GRAPH_ENTITY_ORDER: ['system', 'subsystem', 'technology', 'organization_unit', 'actor', 'business_service', 'business_function', 'principle'],
  GRAPH_ENTITY_ICONS: null,
  /** Значение из ar_settings_parameters; если строки нет — подставляется ниже (как у GRAPH_ENTITY_ICONS). */
  GRAPH_COLLAPSED_SYSTEM_ICON: null,
  ADR_CODE_MAXLEN: 15,
  SYS_CODE_MAXLEN: 32,
  /** Базовый URL Draw.io/diagrams.net для embed (например https://host/drawio). Пусто — фронт покажет подсказку. */
  DRAWIO_EMBED_BASE: '',
  /** Стили узлов/рёбер/раскладки для генерации mxfile (issue #53); переопределение в ar_settings_parameters value_type=json. */
  DRAWIO_NODE_STYLE: DEFAULT_DRAWIO_NODE_STYLE,
  DRAWIO_EDGE_STYLE: DEFAULT_DRAWIO_EDGE_STYLE,
  DRAWIO_LAYOUT_STYLE: DEFAULT_DRAWIO_LAYOUT_STYLE,
};
app.get('/api/config', (req, res) => {
  const out = {};
  for (const [code, def] of Object.entries(PUBLIC_CONFIG_DEFAULTS)) {
    const v = getParam(code, def);
    out[code] = v !== undefined && v !== '' ? v : def;
  }
  if (out.GRAPH_ENTITY_ICONS == null) {
    out.GRAPH_ENTITY_ICONS = {
      system: { label: 'Информационная система', icon: 'Monitor', listLabel: 'ИС' },
      subsystem: { label: 'Модуль системы', icon: 'Puzzle', listLabel: 'Модули систем' },
      system_child: { label: 'Модуль системы', icon: 'Puzzle', listLabel: 'Модули систем' },
      technology: { label: 'Технология', icon: 'Cpu', listLabel: 'Технологии' },
      organization_unit: { label: 'Организационная единица', icon: 'Building2', listLabel: 'Орг. единицы' },
      actor: { label: 'Актор', icon: 'User', listLabel: 'Акторы' },
      business_service: { label: 'Бизнес-сервис (продукт)', icon: 'Package', listLabel: 'Продукты' },
      business_function: { label: 'Бизнес-функция', icon: 'GitBranch', listLabel: 'Бизнес-способности' },
      principle: { label: 'Принцип', icon: 'Scale', listLabel: 'Принципы' },
    };
  }
  if (out.GRAPH_COLLAPSED_SYSTEM_ICON == null || String(out.GRAPH_COLLAPSED_SYSTEM_ICON).trim() === '') {
    out.GRAPH_COLLAPSED_SYSTEM_ICON = 'MonitorDot';
  }
  const drawioEnv = process.env.DRAWIO_EMBED_BASE;
  if (drawioEnv != null && String(drawioEnv).trim() !== '') {
    out.DRAWIO_EMBED_BASE = String(drawioEnv).trim();
  }
  res.json(out);
});

app.get('/api/dashboard/home-stats', async (req, res) => {
  try {
    const data = await buildHomeStats(pool);
    res.json(data);
  } catch (e) {
    console.error('GET /api/dashboard/home-stats', e);
    res.status(500).json({ error: e.message || 'home-stats failed' });
  }
});

app.get('/api/ar-systems', async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const excel = req.query.excel === '1' || req.query.excel === 'true';
    const excludeModules = req.query.exclude_modules === '1' || req.query.exclude_modules === 'true';
    const onlyModules = req.query.only_modules === '1' || req.query.only_modules === 'true';
    const q = search ? queries.systems_select_search : queries.systems_select;
    const params = search ? ['%' + search + '%'] : [];
    const result = await pool.query(q, params);
    let rows = result.rows;
    if (excludeModules && !onlyModules) rows = rows.filter((r) => r.parent_ar_systems_id == null);
    if (onlyModules && !excludeModules) rows = rows.filter((r) => r.parent_ar_systems_id != null);
    rows = rows.map((r) => applyDisplayName(r, r.parent_ar_systems_id != null ? 'subsystem' : 'system'));
    if (excel) {
      const buf = buildExcelBuffer(rows, 'Системы');
      res.setHeader('Content-Disposition', 'attachment; filename=systems.xlsx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buf);
    }
    res.json(rows);
  } catch (err) {
    console.error('Database error:', err.stack);
    res.status(500).send('Server error');
  }
});

app.get('/api/ar-systems/:id', async (req, res) => {
  try {
    const r = await pool.query(queries.systems_get, [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const row = r.rows[0];
    res.json(applyDisplayName(row, row.parent_ar_systems_id != null ? 'subsystem' : 'system'));
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// GET на URL обновления не поддерживается — использовать PUT
app.get('/api/update-ar-systems/:id', (req, res) => {
  res.set('Allow', 'PUT');
  res.status(405).json({ error: 'Method Not Allowed. Use PUT to update the system.' });
});

app.put('/api/update-ar-systems/:id', async (req, res) => {
  const { id } = req.params;
  const {
    code,
    name,
    fullname,
    parent_ar_systems_id,
    ar_system_statuses_id,
    vendor_ar_partners_id,
    supplier_ar_partners_id,
    supporter_ar_partners_id,
    description,
    it_lead,
    business_lead,
    ar_system_hosting_types_id,
    technologies = '',
    external_system = false,
    comment
  } = req.body;
  if (!code || !name) {
    return res.status(400).json({ error: 'Missing required fields: code or name' });
  }
  try {
    const result = await pool.query(queries.systems_update, [
      code,
      name,
      pgParam(fullname),
      pgParam(parent_ar_systems_id),
      pgParam(ar_system_statuses_id),
      pgParam(vendor_ar_partners_id),
      pgParam(supplier_ar_partners_id),
      pgParam(supporter_ar_partners_id),
      pgParam(description),
      pgParam(it_lead),
      pgParam(business_lead),
      pgParam(ar_system_hosting_types_id),
      technologies,
      external_system,
      pgParam(comment),
      id
    ]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'System not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Database error:', err.stack);
    res.status(500).send('Server error');
  }
});

app.post('/api/add-ar-systems', async (req, res) => {
  try {
    const {
      code,
      name,
      fullname,
      parent_ar_systems_id,
      ar_system_statuses_id,
      vendor_ar_partners_id,
      supplier_ar_partners_id,
      supporter_ar_partners_id,
      description,
      it_lead,
      business_lead,
      ar_system_hosting_types_id,
      technologies = '',
      external_system = false,
      comment
    } = req.body;
    if (!code || !name) {
      return res.status(400).json({ error: 'Fields "code" and "name" are required' });
    }
    const result = await pool.query(queries.systems_insert, [
      code,
      name,
      pgParam(fullname),
      pgParam(parent_ar_systems_id),
      pgParam(ar_system_statuses_id),
      pgParam(vendor_ar_partners_id),
      pgParam(supplier_ar_partners_id),
      pgParam(supporter_ar_partners_id),
      pgParam(description),
      pgParam(it_lead),
      pgParam(business_lead),
      pgParam(ar_system_hosting_types_id),
      technologies,
      external_system,
      pgParam(comment)
    ]);
    res.status(201).json({ message: 'Record created successfully', id: result.rows[0].id });
  } catch (err) {
    console.error('Database error:', err.stack);
    res.status(500).json({ error: 'Failed to create record' });
  }
});

app.get('/api/parent-systems', async (req, res) => {
  try {
    const result = await pool.query(queries.parent_systems_select);
    res.json(result.rows);
  } catch (err) {
    console.error('Database error:', err.stack);
    res.status(500).send('Server error');
  }
});

app.get('/api/system-statuses', async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const excel = req.query.excel === '1' || req.query.excel === 'true';
    const q = search ? queries.system_statuses_select_search : queries.system_statuses_select;
    const params = search ? ['%' + search + '%'] : [];
    const result = await pool.query(q, params);
    const rows = result.rows;
    if (excel) {
      const buf = buildExcelBuffer(rows, 'Статусы систем');
      res.setHeader('Content-Disposition', 'attachment; filename=system-statuses.xlsx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buf);
    }
    res.json(rows);
  } catch (err) {
    console.error('Database error:', err.stack);
    res.status(500).send('Server error');
  }
});

app.get('/api/hosting-types', async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const excel = req.query.excel === '1' || req.query.excel === 'true';
    const q = search ? queries.hosting_types_select_search : queries.system_hosting_types_select;
    const params = search ? ['%' + search + '%'] : [];
    const result = await pool.query(q, params);
    const rows = result.rows;
    if (excel) {
      const buf = buildExcelBuffer(rows, 'Типы хостинга');
      res.setHeader('Content-Disposition', 'attachment; filename=hosting-types.xlsx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buf);
    }
    res.json(rows);
  } catch (err) {
    console.error('Database error:', err.stack);
    res.status(500).send('Server error');
  }
});

app.get('/api/owners', async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const excel = req.query.excel === '1' || req.query.excel === 'true';
    const q = search ? queries.owners_select_search : queries.owners_select;
    const params = search ? ['%' + search + '%'] : [];
    const result = await pool.query(q, params);
    const rows = result.rows;
    if (excel) {
      const buf = buildExcelBuffer(rows, 'Владельцы');
      res.setHeader('Content-Disposition', 'attachment; filename=owners.xlsx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buf);
    }
    res.json(rows);
  } catch (err) {
    console.error('Database error:', err.stack);
    res.status(500).send('Server error');
  }
});

app.get('/api/ar-vendors', async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const excel = req.query.excel === '1' || req.query.excel === 'true';
    const q = search ? queries.partners_select_search : queries.vendors_select;
    const params = search ? ['%' + search + '%'] : [];
    const result = await pool.query(q, params);
    const rows = result.rows;
    if (excel) {
      const buf = buildExcelBuffer(rows, 'Партнёры');
      res.setHeader('Content-Disposition', 'attachment; filename=partners.xlsx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buf);
    }
    res.json(rows);
  } catch (err) {
    console.error('Database error:', err.stack);
    res.status(500).send('Server error');
  }
});

// --- Partners (CRUD) ---
app.get('/api/partners', async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const excel = req.query.excel === '1' || req.query.excel === 'true';
    const q = search ? queries.partners_select_search : queries.partners_select;
    const params = search ? ['%' + search + '%'] : [];
    const result = await pool.query(q, params);
    const rows = result.rows;
    if (excel) { const buf = buildExcelBuffer(rows, 'Партнёры'); res.setHeader('Content-Disposition', 'attachment; filename=partners.xlsx'); res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); return res.send(buf); }
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.get('/api/partners/:id', async (req, res) => {
  try {
    const r = await pool.query(queries.partners_get, [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.post('/api/partners', async (req, res) => {
  try {
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const r = await pool.query(queries.partners_insert, [name]);
    res.status(201).json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create' }); }
});
app.put('/api/partners/:id', async (req, res) => {
  try {
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const r = await pool.query(queries.partners_update, [name, req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.delete('/api/partners/:id', async (req, res) => {
  try {
    const r = await pool.query(queries.partners_delete, [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});

// --- Owners CRUD (additional to GET /api/owners) ---
app.post('/api/owners', async (req, res) => {
  try {
    const { name, leader } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const r = await pool.query(queries.owners_insert, [name, leader]);
    res.status(201).json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create' }); }
});
app.get('/api/owners/:id', async (req, res) => {
  try {
    const r = await pool.query(queries.owners_get, [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.put('/api/owners/:id', async (req, res) => {
  try {
    const { name, leader } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const r = await pool.query(queries.owners_update, [name, leader, req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.delete('/api/owners/:id', async (req, res) => {
  try {
    const r = await pool.query(queries.owners_delete, [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});

// --- System statuses CRUD (additional to GET) ---
app.post('/api/system-statuses', async (req, res) => {
  try {
    const { name, description } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const r = await pool.query(queries.system_statuses_insert, [name, description]);
    res.status(201).json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create' }); }
});
app.put('/api/system-statuses/:id', async (req, res) => {
  try {
    const { name, description } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const r = await pool.query(queries.system_statuses_update, [name, description, req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.delete('/api/system-statuses/:id', async (req, res) => {
  try {
    const r = await pool.query(queries.system_statuses_delete, [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});

// --- Hosting types CRUD (additional to GET) ---
app.post('/api/hosting-types', async (req, res) => {
  try {
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const r = await pool.query(queries.hosting_types_insert, [name]);
    res.status(201).json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create' }); }
});
app.put('/api/hosting-types/:id', async (req, res) => {
  try {
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const r = await pool.query(queries.hosting_types_update, [name, req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.delete('/api/hosting-types/:id', async (req, res) => {
  try {
    const r = await pool.query(queries.hosting_types_delete, [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});

// --- Technologies ---
app.get('/api/technologies', async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const excel = req.query.excel === '1' || req.query.excel === 'true';
    const vendor = req.query.vendor_id;
    const q = search ? queries.technologies_select_search : queries.technologies_select;
    let result; const params = search ? ['%' + search + '%'] : [];
    if (search) result = await pool.query(q, params);
    else result = await pool.query(q);
    let rows = result.rows;
    if (vendor) rows = rows.filter(r => r.vendor_ar_partners_id == vendor);
    if (excel) { const buf = buildExcelBuffer(rows, 'Технологии'); res.setHeader('Content-Disposition', 'attachment; filename=technologies.xlsx'); res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); return res.send(buf); }
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.get('/api/technologies/:id', async (req, res) => {
  try {
    const r = await pool.query(queries.technologies_get, [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.post('/api/technologies', async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.name) return res.status(400).json({ error: 'name required' });
    const r = await pool.query(queries.technologies_insert, [b.name, b.vendor_ar_partners_id, b.technology_classes_id, b.approve_document, b.technology_types_id, b.technology_statuses_id, b.radar_include_flag ?? null, b.description, b.domestic_flag ?? null]);
    res.status(201).json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create' }); }
});
app.put('/api/technologies/:id', async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.name) return res.status(400).json({ error: 'name required' });
    const r = await pool.query(queries.technologies_update, [b.name, b.vendor_ar_partners_id, b.technology_classes_id, b.approve_document, b.technology_types_id, b.technology_statuses_id, b.radar_include_flag ?? null, b.description, b.domestic_flag ?? null, req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.delete('/api/technologies/:id', async (req, res) => {
  try {
    const r = await pool.query(queries.technologies_delete, [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});

// --- Technology classes, statuses, types ---
app.get('/api/technology-classes', async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const excel = req.query.excel === '1' || req.query.excel === 'true';
    const q = search ? queries.technology_classes_select_search : queries.technology_classes_select;
    const params = search ? ['%' + search + '%'] : [];
    const result = await pool.query(q, params);
    const rows = result.rows;
    if (excel) { const buf = buildExcelBuffer(rows, 'Классы технологий'); res.setHeader('Content-Disposition', 'attachment; filename=technology-classes.xlsx'); res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); return res.send(buf); }
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.post('/api/technology-classes', async (req, res) => {
  try {
    const { name, description } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const r = await pool.query(queries.technology_classes_insert, [name, description]);
    res.status(201).json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create' }); }
});
app.put('/api/technology-classes/:id', async (req, res) => {
  try {
    const { name, description } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const r = await pool.query(queries.technology_classes_update, [name, description, req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.delete('/api/technology-classes/:id', async (req, res) => {
  try {
    const r = await pool.query(queries.technology_classes_delete, [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});

app.get('/api/technology-statuses', async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const excel = req.query.excel === '1' || req.query.excel === 'true';
    const q = search ? queries.technology_statuses_select_search : queries.technology_statuses_select;
    const params = search ? ['%' + search + '%'] : [];
    const result = await pool.query(q, params);
    const rows = result.rows;
    if (excel) { const buf = buildExcelBuffer(rows, 'Статусы технологий'); res.setHeader('Content-Disposition', 'attachment; filename=technology-statuses.xlsx'); res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); return res.send(buf); }
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.post('/api/technology-statuses', async (req, res) => {
  try {
    const { name, fullname, description } = req.body || {};
    if (!name || !fullname) return res.status(400).json({ error: 'name and fullname required' });
    const r = await pool.query(queries.technology_statuses_insert, [name, fullname, description]);
    res.status(201).json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create' }); }
});
app.put('/api/technology-statuses/:id', async (req, res) => {
  try {
    const { name, fullname, description } = req.body || {};
    if (!name || !fullname) return res.status(400).json({ error: 'name and fullname required' });
    const r = await pool.query(queries.technology_statuses_update, [name, fullname, description, req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.delete('/api/technology-statuses/:id', async (req, res) => {
  try {
    const r = await pool.query(queries.technology_statuses_delete, [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});

app.get('/api/technology-types', async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const excel = req.query.excel === '1' || req.query.excel === 'true';
    const q = search ? queries.technology_types_select_search : queries.technology_types_select;
    const params = search ? ['%' + search + '%'] : [];
    const result = await pool.query(q, params);
    const rows = result.rows;
    if (excel) { const buf = buildExcelBuffer(rows, 'Типы технологий'); res.setHeader('Content-Disposition', 'attachment; filename=technology-types.xlsx'); res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); return res.send(buf); }
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.post('/api/technology-types', async (req, res) => {
  try {
    const { name, description } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const r = await pool.query(queries.technology_types_insert, [name, description]);
    res.status(201).json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create' }); }
});
app.put('/api/technology-types/:id', async (req, res) => {
  try {
    const { name, description } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const r = await pool.query(queries.technology_types_update, [name, description, req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.delete('/api/technology-types/:id', async (req, res) => {
  try {
    const r = await pool.query(queries.technology_types_delete, [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});

// --- Principles ---
app.get('/api/principles', async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const excel = req.query.excel === '1' || req.query.excel === 'true';
    const q = search ? queries.principles_select_search : queries.principles_select;
    const params = search ? ['%' + search + '%'] : [];
    const result = await pool.query(q, params);
    const rows = result.rows;
    if (excel) { const buf = buildExcelBuffer(rows, 'Принципы'); res.setHeader('Content-Disposition', 'attachment; filename=principles.xlsx'); res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); return res.send(buf); }
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.get('/api/principles/:id', async (req, res) => {
  try {
    const r = await pool.query(queries.principles_get, [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.post('/api/principles', async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.name) return res.status(400).json({ error: 'name required' });
    const r = await pool.query(queries.principles_insert, [b.name, b.statement, b.rationale, b.implications, b.is_approved, b.approve_document]);
    res.status(201).json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create' }); }
});
app.put('/api/principles/:id', async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.name) return res.status(400).json({ error: 'name required' });
    const r = await pool.query(queries.principles_update, [b.name, b.statement, b.rationale, b.implications, b.is_approved, b.approve_document, req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.delete('/api/principles/:id', async (req, res) => {
  try {
    const r = await pool.query(queries.principles_delete, [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});

// --- Architecture decisions v2: principle (ADRP) + applied (ADRA) + increments ---
/** ID сохранённого заключения в path (отсекает undefined/new из ошибочного URL). */
function parseAppliedRecordId(raw, res) {
  if (raw == null || raw === '' || String(raw).trim() === '' || raw === 'undefined' || raw === 'new') {
    res.status(400).json({
      error: 'Сначала сохраните заключение или откройте запись на редактирование — без id нельзя добавлять решения.',
    });
    return null;
  }
  const n = Number(String(raw).trim());
  if (!Number.isInteger(n) || n < 1) {
    res.status(400).json({ error: 'Некорректный идентификатор записи заключения.' });
    return null;
  }
  return n;
}

/** FK bigint из тела запроса; node-pg + undefined даёт в PG строку "undefined". */
function normalizeOptionalBigint(v) {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'string' && (v.trim() === '' || v === 'undefined' || v === 'null')) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

app.get('/api/adr-statuses', async (req, res) => {
  try {
    const r = await pool.query(queries.adr_statuses_select);
    res.json(r.rows);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});

app.get('/api/decisions/principle', async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const excel = req.query.excel === '1' || req.query.excel === 'true';
    const q = search ? queries.adrs_principle_select_search : queries.adrs_principle_select;
    const params = search ? ['%' + search + '%'] : [];
    const result = await pool.query(q, params);
    const rows = result.rows;
    if (excel) {
      const buf = buildExcelBuffer(rows, 'Принципиальные решения');
      res.setHeader('Content-Disposition', 'attachment; filename=decisions-principle.xlsx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buf);
    }
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.get('/api/decisions/principle/:id', async (req, res) => {
  try {
    const r = await pool.query(queries.adrs_principle_get, [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.post('/api/decisions/principle', async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.name) return res.status(400).json({ error: 'name required' });
    const adrpPrefix = getParam('ADR_ADRP_PREFIX', 'ADRP-') || 'ADRP-';
    const r = await pool.query(queries.adrs_principle_insert, [adrpPrefix, b.name, b.context, b.decision, b.consequences, b.ar_adr_statuses_id, b.author]);
    res.status(201).json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create' }); }
});
app.put('/api/decisions/principle/:id', async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.name) return res.status(400).json({ error: 'name required' });
    const r = await pool.query(queries.adrs_principle_update, [b.name, b.context, b.decision, b.consequences, b.ar_adr_statuses_id, b.author, req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.delete('/api/decisions/principle/:id', async (req, res) => {
  try {
    const r = await pool.query(queries.adrs_principle_delete, [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});

app.get('/api/decisions/applied', async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const excel = req.query.excel === '1' || req.query.excel === 'true';
    const q = search ? queries.adrs_applied_select_search : queries.adrs_applied_select;
    const params = search ? ['%' + search + '%'] : [];
    const result = await pool.query(q, params);
    const rows = result.rows;
    if (excel) {
      const buf = buildExcelBuffer(rows, 'Прикладные решения');
      res.setHeader('Content-Disposition', 'attachment; filename=decisions-applied.xlsx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buf);
    }
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.get('/api/decisions/applied/:id', async (req, res) => {
  try {
    const r = await pool.query(queries.adrs_applied_get, [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.post('/api/decisions/applied', async (req, res) => {
  try {
    const b = req.body || {};
    const adraPrefix = getParam('ADR_ADRA_PREFIX', 'ADRA-') || 'ADRA-';
    const r = await pool.query(queries.adrs_applied_insert, [adraPrefix, b.task_name, b.task_link, b.conclusion, b.ar_adr_statuses_id, b.author]);
    res.status(201).json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create' }); }
});
app.put('/api/decisions/applied/:id', async (req, res) => {
  try {
    const b = req.body || {};
    const r = await pool.query(queries.adrs_applied_update, [b.task_name, b.task_link, b.conclusion, b.ar_adr_statuses_id, b.author, req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.delete('/api/decisions/applied/:id', async (req, res) => {
  try {
    const r = await pool.query(queries.adrs_applied_delete, [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});

// Полное сохранение архитектурного заключения: основная запись + инкременты с системами и интеграциями
app.post('/api/decisions/applied/full', async (req, res) => {
  const client = await pool.connect();
  try {
    const b = req.body || {};
    const { task_name, task_link, conclusion, ar_adr_statuses_id, author, increments = [] } = b;
    const adraPrefix = getParam('ADR_ADRA_PREFIX', 'ADRA-') || 'ADRA-';
    const r = await client.query(queries.adrs_applied_insert, [adraPrefix, task_name || '', task_link || '', conclusion || '', ar_adr_statuses_id || null, author || '']);
    const appliedId = r.rows[0].id;
    for (let i = 0; i < increments.length; i++) {
      const inc = increments[i];
      const incR = await client.query(queries.adr_increments_insert, [
        appliedId,
        inc.order_index ?? i + 1,
        inc.name || '',
        normalizeOptionalBigint(inc.ar_adr_increment_types_id),
      ]);
      const incId = incR.rows[0].id;
      const systems = inc.systems || [];
      const relations = inc.relations || [];
      for (const s of systems) {
        await client.query(queries.adr_increment_systems_insert, [incId, s.ar_systems_id, s.ar_adr_increment_system_statuses_id || null, s.comment || '']);
      }
      for (const rel of relations) {
        await client.query(queries.adr_increment_relations_insert, [incId, rel.from_ar_systems_id || null, rel.to_ar_systems_id || null, rel.name || '', rel.description || '', rel.ar_adr_increment_relation_statuses_id || null]);
      }
    }
    client.release();
    res.status(201).json({ id: appliedId, code: r.rows[0].code });
  } catch (err) {
    client.release();
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to create' });
  }
});

/** Создать записи в реестре интеграций по связям инкрементов заключения (задача #20 п.5–6). Не дублирует потоки по уже обработанным relation_id. */
async function createFlowsFromConclusion(client, appliedId) {
  const incs = await client.query(queries.adr_increments_by_applied, [appliedId]);
  for (const inc of incs.rows) {
    const rels = await client.query(queries.adr_increment_relations_by_increment, [inc.id]);
    for (const rel of rels.rows) {
      if (rel.from_ar_systems_id == null || rel.to_ar_systems_id == null) continue;
      const exists = await client.query(queries.integration_flow_exists_by_relation_id, [rel.id]);
      if (exists.rows.length > 0) continue;
      const flowMapRaw = getParam('ADR_FLOW_STATUS_MAP', null);
      const flowMap = flowMapRaw && typeof flowMapRaw === 'object' && Object.keys(flowMapRaw).length
        ? flowMapRaw
        : DEFAULT_FLOW_STATUS_MAP_BY_CODE;
      const flowStatusId = resolveFlowStatusIdFromMap(flowMap, rel, 1);
      await client.query(queries.integration_flows_insert_from_conclusion, [
        rel.from_ar_systems_id,
        rel.to_ar_systems_id,
        rel.name || '',
        rel.description || '',
        flowStatusId,
        appliedId,
        rel.id,
      ]);
    }
  }
}

app.put('/api/decisions/applied/:id/full', async (req, res) => {
  const client = await pool.connect();
  try {
    const appliedId = req.params.id;
    const b = req.body || {};
    const { task_name, task_link, conclusion, ar_adr_statuses_id, author, increments = [] } = b;

    const current = await client.query(queries.adrs_applied_get, [appliedId]);
    if (current.rows.length === 0) { client.release(); return res.status(404).json({ error: 'Not found' }); }
    const currentRow = current.rows[0];
    const currentStatusCode = (currentRow.status_code || getAdrStatusCodeById(currentRow.ar_adr_statuses_id) || '').trim();
    const draftStatusCode = String(getParam('ADR_DRAFT_STATUS_CODE', DEFAULT_DRAFT_STATUS_CODE) || DEFAULT_DRAFT_STATUS_CODE).trim();
    const isDraft = currentStatusCode === draftStatusCode;

    const payloadIsStatusOnly = b.increments === undefined;
    if (!isDraft || payloadIsStatusOnly) {
      // П.5: не в черновике — только статус; или черновик, но прислан только смена статуса (без increments) — не затирать данные
      const upd = await client.query(queries.adrs_applied_update, [
        payloadIsStatusOnly ? (currentRow.task_name ?? '') : (task_name || ''),
        payloadIsStatusOnly ? (currentRow.task_link ?? '') : (task_link || ''),
        payloadIsStatusOnly ? (currentRow.conclusion ?? '') : (conclusion || ''),
        ar_adr_statuses_id ?? currentRow.ar_adr_statuses_id,
        payloadIsStatusOnly ? (currentRow.author ?? '') : (author || ''),
        appliedId,
      ]);
      if (upd.rowCount === 0) { client.release(); return res.status(404).json({ error: 'Not found' }); }
    } else {
      const upd = await client.query(queries.adrs_applied_update, [task_name || '', task_link || '', conclusion || '', ar_adr_statuses_id || null, author || '', appliedId]);
      if (upd.rowCount === 0) { client.release(); return res.status(404).json({ error: 'Not found' }); }
      const incs = await client.query(queries.adr_increments_by_applied, [appliedId]);
      for (const inc of incs.rows) {
        await client.query(queries.adr_increment_relations_delete_by_increment, [inc.id]);
        await client.query(queries.adr_increment_systems_delete_by_increment, [inc.id]);
        await client.query(queries.adr_increments_delete, [inc.id]);
      }
      for (let i = 0; i < increments.length; i++) {
        const inc = increments[i];
        const incR = await client.query(queries.adr_increments_insert, [
        appliedId,
        inc.order_index ?? i + 1,
        inc.name || '',
        normalizeOptionalBigint(inc.ar_adr_increment_types_id),
      ]);
        const incId = incR.rows[0].id;
        const systems = inc.systems || [];
        const relations = inc.relations || [];
        for (const s of systems) {
          await client.query(queries.adr_increment_systems_insert, [incId, s.ar_systems_id, s.ar_adr_increment_system_statuses_id || null, s.comment || '']);
        }
        for (const rel of relations) {
          await client.query(queries.adr_increment_relations_insert, [incId, rel.from_ar_systems_id || null, rel.to_ar_systems_id || null, rel.name || '', rel.description || '', rel.ar_adr_increment_relation_statuses_id || null]);
        }
      }
    }

    const newStatusId = ar_adr_statuses_id ?? current.rows[0].ar_adr_statuses_id;
    if (newStatusId) {
      const approvedCodes = getParam('ADR_APPROVED_STATUS_CODES', DEFAULT_APPROVED_STATUS_CODES);
      const statusRow = await client.query(queries.adr_status_get_name, [newStatusId]);
      const st = statusRow.rows[0] || {};
      const newCode = (st.code || getAdrStatusCodeById(newStatusId) || '').trim();
      const triggerFlows = Array.isArray(approvedCodes) && approvedCodes.map(String).includes(newCode);
      if (triggerFlows) await createFlowsFromConclusion(client, appliedId);
    }

    client.release();
    res.json({ id: appliedId });
  } catch (err) {
    client.release();
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to update' });
  }
});

app.get('/api/adr-increment-types', async (req, res) => {
  try {
    const r = await pool.query(queries.adr_increment_types_select);
    res.json(r.rows);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});

app.get('/api/decisions/applied/:id/increments', async (req, res) => {
  try {
    const appliedId = parseAppliedRecordId(req.params.id, res);
    if (appliedId == null) return;
    const r = await pool.query(queries.adr_increments_by_applied, [appliedId]);
    res.json(r.rows);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.post('/api/decisions/applied/:id/increments', async (req, res) => {
  try {
    const appliedId = parseAppliedRecordId(req.params.id, res);
    if (appliedId == null) return;
    const b = req.body || {};
    const typeId = normalizeOptionalBigint(b.ar_adr_increment_types_id);
    const r = await pool.query(queries.adr_increments_insert, [
      appliedId,
      b.order_index ?? 1,
      b.name,
      typeId,
    ]);
    res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to create' });
  }
});
app.put('/api/decisions/applied/:appliedId/increments/:id', async (req, res) => {
  try {
    const appliedId = parseAppliedRecordId(req.params.appliedId, res);
    if (appliedId == null) return;
    const b = req.body || {};
    const typeId = normalizeOptionalBigint(b.ar_adr_increment_types_id);
    const r = await pool.query(queries.adr_increments_update, [b.order_index ?? 1, b.name, typeId, req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.delete('/api/decisions/applied/:appliedId/increments/:id', async (req, res) => {
  try {
    const appliedId = parseAppliedRecordId(req.params.appliedId, res);
    if (appliedId == null) return;
    const r = await pool.query(queries.adr_increments_delete, [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});

app.get('/api/increments/:id/systems', async (req, res) => {
  try {
    const r = await pool.query(queries.adr_increment_systems_by_increment, [req.params.id]);
    res.json(r.rows);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.post('/api/increments/:id/systems', async (req, res) => {
  try {
    const { ar_systems_id, ar_adr_increment_system_statuses_id, comment } = req.body || {};
    if (!ar_systems_id) return res.status(400).json({ error: 'ar_systems_id required' });
    const r = await pool.query(queries.adr_increment_systems_insert, [req.params.id, ar_systems_id, ar_adr_increment_system_statuses_id, comment]);
    res.status(201).json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create' }); }
});
app.delete('/api/increments/:incrementId/systems/:rowId', async (req, res) => {
  try {
    const r = await pool.query(queries.adr_increment_systems_delete, [req.params.rowId]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});

app.get('/api/ar-systems/:systemId/system-functions', async (req, res) => {
  try {
    const r = await pool.query(queries.system_functions_by_system, [req.params.systemId]);
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

app.post('/api/ar-systems/:systemId/system-functions', async (req, res) => {
  try {
    const systemId = req.params.systemId;
    const { name, description } = req.body || {};
    const n = (name && String(name).trim()) || '';
    if (!n) return res.status(400).json({ error: 'name required' });
    const r = await pool.query(queries.system_functions_insert, [systemId, n, description]);
    res.status(201).json(r.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Функция с таким названием уже существует для этой системы.' });
    }
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to create' });
  }
});

/** Массовое удаление функций каталога ИС. Нельзя, если функция выбрана в заключении (см. FK RESTRICT). */
app.delete('/api/ar-systems/:systemId/system-functions', async (req, res) => {
  try {
    const systemId = req.params.systemId;
    const raw = req.body && req.body.ids;
    const ids = Array.isArray(raw)
      ? raw.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0)
      : [];
    if (ids.length === 0) return res.status(400).json({ error: 'ids required (non-empty array)' });

    const usageQ = await pool.query(queries.system_functions_increment_usage_for_delete, [systemId, ids]);
    if (usageQ.rowCount > 0) {
      const usages = usageQ.rows.map((row) => ({
        ar_adrs_applied_id: row.ar_adrs_applied_id,
        adr_code: row.adr_code,
        adr_task_name: row.adr_task_name,
        ar_adr_increment_id: row.ar_adr_increment_id,
        increment_name: row.increment_name,
        ar_system_functions_id: row.ar_system_functions_id,
        function_name: row.function_name,
      }));
      const adrCodes = [...new Set(usages.map((u) => String(u.adr_code || '').trim()).filter(Boolean))].sort();
      const adrList =
        adrCodes.length <= 5 ? adrCodes.join(', ') : `${adrCodes.slice(0, 5).join(', ')}… (+${adrCodes.length - 5})`;
      return res.status(409).json({
        error:
          'Удаление невозможно: выбранные функции используются в архитектурных заключениях. Сначала уберите их в форме соответствующего заключения (раздел систем инкремента).',
        adr_codes: adrCodes,
        usages,
        message: `Обнаружено в ADR: ${adrList}.`,
      });
    }

    const r = await pool.query(queries.system_functions_delete_many, [systemId, ids]);
    if (r.rowCount === 0) {
      return res.status(404).json({ error: 'Функции не найдены или не принадлежат этой системе' });
    }
    res.json({ deleted: r.rowCount, ids: r.rows.map((row) => row.id) });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(409).json({
        error:
          'Удаление невозможно: функции всё ещё связаны с заключениями (ограничение в БД). Обновите страницу и проверьте выбор функций в ADR.',
      });
    }
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to delete' });
  }
});

app.get('/api/adr-increment-systems/:rowId/function-selection', async (req, res) => {
  try {
    const rowId = req.params.rowId;
    const rowQ = await pool.query(queries.adr_increment_system_get_by_id, [rowId]);
    if (rowQ.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    const row = rowQ.rows[0];
    const sysId = row.ar_systems_id;
    const [catQ, juncQ] = await Promise.all([
      pool.query(queries.system_functions_by_system, [sysId]),
      pool.query(queries.adr_increment_system_functions_ordered, [rowId]),
    ]);
    const catalog = catQ.rows;
    const idToFn = new Map(catalog.map((f) => [Number(f.id), f]));
    const orderedIds = juncQ.rows.map((j) => Number(j.ar_system_functions_id));
    const selected_ordered = orderedIds.map((fid) => idToFn.get(fid)).filter(Boolean);
    res.json({
      ar_adr_increment_system_id: row.id,
      ar_systems_id: sysId,
      comment: row.comment || '',
      catalog,
      selected_ordered,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

app.put('/api/adr-increment-systems/:rowId/function-selection', async (req, res) => {
  const client = await pool.connect();
  try {
    const rowId = req.params.rowId;
    let orderedIds =
      req.body && Array.isArray(req.body.ordered_function_ids)
        ? req.body.ordered_function_ids.map((x) => Number(x)).filter((n) => Number.isFinite(n))
        : [];
    const seen = new Set();
    orderedIds = orderedIds.filter((id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    const rowQ = await client.query(queries.adr_increment_system_get_by_id, [rowId]);
    if (rowQ.rowCount === 0) {
      client.release();
      return res.status(404).json({ error: 'Not found' });
    }
    const row = rowQ.rows[0];
    const sysId = row.ar_systems_id;
    await client.query('BEGIN');
    await client.query(queries.adr_increment_system_functions_delete_by_row, [rowId]);
    const names = [];
    for (let i = 0; i < orderedIds.length; i++) {
      const fid = orderedIds[i];
      const chk = await client.query(queries.system_functions_by_ids_system, [sysId, [fid]]);
      if (chk.rowCount === 0) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(400).json({ error: `Функция id=${fid} не принадлежит этой системе` });
      }
      names.push(chk.rows[0].name);
      await client.query(queries.adr_increment_system_functions_insert_row, [rowId, fid, i]);
    }
    const comment = formatSystemFunctionsComment(names);
    await client.query(queries.adr_increment_systems_update_comment, [comment, rowId]);
    await client.query('COMMIT');
    const out = await client.query(queries.adr_increment_system_get_by_id, [rowId]);
    client.release();
    res.json(out.rows[0]);
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) { /* */ }
    try {
      client.release();
    } catch (_) { /* */ }
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to save' });
  }
});

app.get('/api/increments/:id/relations', async (req, res) => {
  try {
    const r = await pool.query(queries.adr_increment_relations_by_increment, [req.params.id]);
    res.json(r.rows);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.post('/api/increments/:id/relations', async (req, res) => {
  try {
    const b = req.body || {};
    const r = await pool.query(queries.adr_increment_relations_insert, [req.params.id, b.from_ar_systems_id, b.to_ar_systems_id, b.name, b.description, b.ar_adr_increment_relation_statuses_id]);
    res.status(201).json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create' }); }
});
app.put('/api/increments/:incrementId/relations/:id', async (req, res) => {
  try {
    const b = req.body || {};
    const r = await pool.query(queries.adr_increment_relations_update, [b.from_ar_systems_id, b.to_ar_systems_id, b.name, b.description, b.ar_adr_increment_relation_statuses_id, req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.delete('/api/increments/:incrementId/relations/:id', async (req, res) => {
  try {
    const r = await pool.query(queries.adr_increment_relations_delete, [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});

async function loadIncrementDiagramContext(incrementId) {
  const inc = await pool.query(queries.adr_increment_get, [incrementId]);
  if (inc.rowCount === 0) return null;
  const [sys, rel] = await Promise.all([
    pool.query(queries.adr_increment_systems_by_increment, [incrementId]),
    pool.query(queries.adr_increment_relations_by_increment, [incrementId]),
  ]);
  return { increment: inc.rows[0], systems: sys.rows, relations: rel.rows };
}

function solutionNameFromIncrement(inc) {
  const n = (inc && (inc.name || '').trim()) || '';
  return n || 'Решение';
}

app.get('/api/increments/:incrementId/diagrams', async (req, res) => {
  try {
    const incrementId = req.params.incrementId;
    const inc = await pool.query(queries.adr_increment_get, [incrementId]);
    if (inc.rowCount === 0) return res.status(404).json({ error: 'Increment not found' });
    const r = await pool.query(queries.adr_increment_diagrams_list_meta, [incrementId]);
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

app.get('/api/increments/:incrementId/diagrams/:diagramId', async (req, res) => {
  try {
    const incrementId = req.params.incrementId;
    const diagramId = req.params.diagramId;
    const r = await pool.query(queries.adr_increment_diagrams_get, [diagramId, incrementId]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

app.post('/api/increments/:incrementId/diagrams', async (req, res) => {
  try {
    const incrementId = req.params.incrementId;
    const ctx = await loadIncrementDiagramContext(incrementId);
    if (!ctx) return res.status(404).json({ error: 'Increment not found' });
    const mv = await pool.query(queries.adr_increment_diagrams_max_version, [incrementId]);
    const nextV = (mv.rows[0].max_v || 0) + 1;
    const vLabel = `v${nextV}`;
    const solutionName = solutionNameFromIncrement(ctx.increment);
    // Новая версия диаграммы: только данные инкремента из БД (buildMxfile), без merge со старыми mxfile.
    const mxfile = buildMxfile({
      systems: ctx.systems,
      relations: ctx.relations,
      solutionName,
      versionLabel: vLabel,
      getParam,
    });
    const ins = await pool.query(queries.adr_increment_diagrams_insert, [incrementId, nextV, mxfile, null]);
    res.status(201).json(ins.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to create diagram' });
  }
});

app.post('/api/increments/:incrementId/diagrams/:diagramId/merge', async (req, res) => {
  try {
    const incrementId = req.params.incrementId;
    const diagramId = req.params.diagramId;
    const ctx = await loadIncrementDiagramContext(incrementId);
    if (!ctx) return res.status(404).json({ error: 'Increment not found' });
    const cur = await pool.query(queries.adr_increment_diagrams_get, [diagramId, incrementId]);
    if (cur.rowCount === 0) return res.status(404).json({ error: 'Diagram not found' });
    const row = cur.rows[0];
    const solutionName = solutionNameFromIncrement(ctx.increment);
    const vLabel = `v${row.version_no}`;
    const merged = mergeMxfileWithData(row.mxfile, ctx.systems, ctx.relations, solutionName, vLabel, getParam);
    const upd = await pool.query(queries.adr_increment_diagrams_update_mxfile, [merged, null, diagramId, incrementId]);
    res.json(upd.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Merge failed' });
  }
});

app.put('/api/increments/:incrementId/diagrams/:diagramId', async (req, res) => {
  try {
    const incrementId = req.params.incrementId;
    const diagramId = req.params.diagramId;
    const mxfile = req.body && typeof req.body.mxfile === 'string' ? req.body.mxfile : '';
    if (!mxfile.trim()) return res.status(400).json({ error: 'mxfile required' });
    const lastEditedBy = req.body && req.body.last_edited_by != null ? String(req.body.last_edited_by).trim() : '';
    const r = await pool.query(queries.adr_increment_diagrams_update_mxfile, [mxfile, lastEditedBy || null, diagramId, incrementId]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Update failed' });
  }
});

app.delete('/api/increments/:incrementId/diagrams/:diagramId', async (req, res) => {
  try {
    const r = await pool.query(queries.adr_increment_diagrams_delete, [req.params.diagramId, req.params.incrementId]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Справочники для инкрементов (системы в решении, интеграции в решении) — используются в форме прикладного решения и в разделе Справочники
app.get('/api/adr-system-statuses', async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const excel = req.query.excel === '1' || req.query.excel === 'true';
    const q = queries.adr_increment_system_statuses_select;
    const result = await pool.query(q);
    let rows = result.rows;
    if (search) rows = rows.filter(r => (r.name || '').toLowerCase().includes(search.toLowerCase()) || (r.description || '').toLowerCase().includes(search.toLowerCase()));
    if (excel) {
      const buf = buildExcelBuffer(rows, 'Статусы систем в решении');
      res.setHeader('Content-Disposition', 'attachment; filename=adr-system-statuses.xlsx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buf);
    }
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.post('/api/adr-system-statuses', async (req, res) => {
  try {
    const { code, name, description } = req.body || {};
    if (!name || !code || !String(code).trim()) return res.status(400).json({ error: 'name and code required' });
    const r = await pool.query(queries.adr_increment_system_statuses_insert, [String(code).trim(), name, description]);
    res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') return res.status(409).json({ error: 'code must be unique' });
    res.status(500).json({ error: 'Failed to create' });
  }
});
app.put('/api/adr-system-statuses/:id', async (req, res) => {
  try {
    const { code, name, description } = req.body || {};
    if (!name || !code || !String(code).trim()) return res.status(400).json({ error: 'name and code required' });
    const r = await pool.query(queries.adr_increment_system_statuses_update, [String(code).trim(), name, description, req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') return res.status(409).json({ error: 'code must be unique' });
    res.status(500).send('Server error');
  }
});
app.delete('/api/adr-system-statuses/:id', async (req, res) => {
  try {
    const r = await pool.query(queries.adr_increment_system_statuses_delete, [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});

app.get('/api/adr-relation-statuses', async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const excel = req.query.excel === '1' || req.query.excel === 'true';
    const q = queries.adr_increment_relation_statuses_select;
    const result = await pool.query(q);
    let rows = result.rows;
    if (search) {
      const s = search.toLowerCase();
      rows = rows.filter(r => (r.name || '').toLowerCase().includes(s) || (r.code || '').toLowerCase().includes(s) || (r.description || '').toLowerCase().includes(s));
    }
    if (excel) {
      const buf = buildExcelBuffer(rows, 'Статусы интеграций в решении');
      res.setHeader('Content-Disposition', 'attachment; filename=adr-relation-statuses.xlsx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buf);
    }
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.post('/api/adr-relation-statuses', async (req, res) => {
  try {
    const { code, name, description } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    if (!code || !String(code).trim()) return res.status(400).json({ error: 'code required' });
    const r = await pool.query(queries.adr_increment_relation_statuses_insert, [String(code).trim(), name, description]);
    await loadRefCodes(pool);
    res.status(201).json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message || 'Failed to create' }); }
});
app.put('/api/adr-relation-statuses/:id', async (req, res) => {
  try {
    const { code, name, description } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    if (!code || !String(code).trim()) return res.status(400).json({ error: 'code required' });
    const r = await pool.query(queries.adr_increment_relation_statuses_update, [String(code).trim(), name, description, req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    await loadRefCodes(pool);
    res.json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.delete('/api/adr-relation-statuses/:id', async (req, res) => {
  try {
    const r = await pool.query(queries.adr_increment_relation_statuses_delete, [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    await loadRefCodes(pool);
    res.status(204).send();
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});

// --- Classificators, System assignments ---
app.get('/api/classificators', async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const excel = req.query.excel === '1' || req.query.excel === 'true';
    const q = search ? queries.classificators_select_search : queries.classificators_select;
    const params = search ? ['%' + search + '%'] : [];
    const result = await pool.query(q, params);
    const rows = result.rows;
    if (excel) { const buf = buildExcelBuffer(rows, 'Классификаторы'); res.setHeader('Content-Disposition', 'attachment; filename=classificators.xlsx'); res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); return res.send(buf); }
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.post('/api/classificators', async (req, res) => {
  try {
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const r = await pool.query(queries.classificators_insert, [name]);
    res.status(201).json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create' }); }
});
app.put('/api/classificators/:id', async (req, res) => {
  try {
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const r = await pool.query(queries.classificators_update, [name, req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.delete('/api/classificators/:id', async (req, res) => {
  try {
    const r = await pool.query(queries.classificators_delete, [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});

app.get('/api/system-assignments', async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const excel = req.query.excel === '1' || req.query.excel === 'true';
    const q = search ? queries.system_assignments_select_search : queries.system_assignments_select;
    const params = search ? ['%' + search + '%'] : [];
    const result = await pool.query(q, params);
    const rows = result.rows;
    if (excel) { const buf = buildExcelBuffer(rows, 'Назначения систем'); res.setHeader('Content-Disposition', 'attachment; filename=system-assignments.xlsx'); res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); return res.send(buf); }
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.post('/api/system-assignments', async (req, res) => {
  try {
    const { name, description } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const r = await pool.query(queries.system_assignments_insert, [name, description]);
    res.status(201).json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create' }); }
});
app.put('/api/system-assignments/:id', async (req, res) => {
  try {
    const { name, description } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const r = await pool.query(queries.system_assignments_update, [name, description, req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.delete('/api/system-assignments/:id', async (req, res) => {
  try {
    const r = await pool.query(queries.system_assignments_delete, [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});

// --- Systems–Technologies: метамодель (ar_metamodel_relations), коды SYS_TECH_STACK / MODULE_TECH_STACK (issues #44, #45) ---
function getSysTechRelationCode() {
  const v = getParam('SYS_TECH_STACK_RELATION_CODE', 'system_technology');
  return v && String(v).trim() !== '' ? String(v).trim() : 'system_technology';
}
function getModuleTechRelationCode() {
  const v = getParam('MODULE_TECH_STACK_RELATION_CODE', 'module_technology');
  return v && String(v).trim() !== '' ? String(v).trim() : 'module_technology';
}

app.get('/api/systems-technologies', async (req, res) => {
  try {
    const systemId = req.query.system_id;
    const excel = req.query.excel === '1' || req.query.excel === 'true';
    const sysCode = getSysTechRelationCode();
    const modCode = getModuleTechRelationCode();
    let result;
    if (systemId) {
      const pr = await pool.query('SELECT parent_ar_systems_id FROM archrep.ar_systems WHERE id = $1', [systemId]);
      if (pr.rows.length === 0) {
        result = { rows: [] };
      } else {
        const isModule = pr.rows[0].parent_ar_systems_id != null;
        const fromType = isModule ? 'subsystem' : 'system';
        const relCode = isModule ? modCode : sysCode;
        result = await pool.query(queries.systems_tech_metamodel_by_system, [systemId, fromType, relCode]);
      }
    } else {
      result = await pool.query(queries.systems_tech_metamodel_select_all, [sysCode, modCode]);
    }
    const rows = result.rows;
    if (excel) {
      const buf = buildExcelBuffer(rows, 'Системы-Технологии');
      res.setHeader('Content-Disposition', 'attachment; filename=systems-technologies.xlsx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buf);
    }
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});
app.post('/api/systems-technologies', async (req, res) => {
  try {
    const { systems_id, technologies_id } = req.body || {};
    if (!systems_id || !technologies_id) return res.status(400).json({ error: 'systems_id and technologies_id required' });
    const pr = await pool.query('SELECT parent_ar_systems_id FROM archrep.ar_systems WHERE id = $1', [systems_id]);
    if (pr.rows.length === 0) return res.status(400).json({ error: 'Система не найдена' });
    const isModule = pr.rows[0].parent_ar_systems_id != null;
    const fromType = isModule ? 'subsystem' : 'system';
    const relCode = isModule ? getModuleTechRelationCode() : getSysTechRelationCode();
    const dup = await pool.query(queries.metamodel_relations_find_system_tech, [systems_id, fromType, technologies_id, relCode]);
    if (dup.rows.length > 0) {
      return res.status(409).json({ error: 'Связь системы с этой технологией уже существует' });
    }
    const r = await pool.query(queries.metamodel_relations_insert, [
      fromType,
      systems_id,
      'technology',
      technologies_id,
      relCode,
      '',
      '',
      null,
      null,
      null,
    ]);
    const row = r.rows[0];
    res.status(201).json({
      id: row.id,
      systems_id: row.from_entity_id,
      technologies_id: row.to_entity_id,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to create' });
  }
});
app.delete('/api/systems-technologies/:id', async (req, res) => {
  try {
    const sysCode = getSysTechRelationCode();
    const modCode = getModuleTechRelationCode();
    const cur = await pool.query(queries.metamodel_relations_get, [req.params.id]);
    if (cur.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const row = cur.rows[0];
    const okStack =
      row.to_entity_type === 'technology' &&
      ((row.from_entity_type === 'system' && row.relation_type === sysCode) ||
        (row.from_entity_type === 'subsystem' && row.relation_type === modCode));
    if (!okStack) {
      return res.status(404).json({ error: 'Not found' });
    }
    const r = await pool.query(queries.metamodel_relations_delete, [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// --- Integration flows (реестр интеграций) ---
app.get('/api/integration-flows', async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const systemId = req.query.system_id;
    const excel = req.query.excel === '1' || req.query.excel === 'true';
    let result;
    if (systemId) {
      result = await pool.query(queries.integration_flows_by_system, [systemId]);
    } else {
      const q = search ? queries.integration_flows_select_search : queries.integration_flows_select;
      const params = search ? ['%' + search + '%'] : [];
      result = await pool.query(q, params);
    }
    const rows = result.rows;
    if (excel) {
      const buf = buildExcelBuffer(rows, 'Интеграционные потоки');
      res.setHeader('Content-Disposition', 'attachment; filename=integration-flows.xlsx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buf);
    }
    res.json(rows);
  } catch (err) {
    console.error('Integration flows error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});
app.get('/api/integration-flows/:id', async (req, res) => {
  try {
    const r = await pool.query(queries.integration_flows_get, [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.post('/api/integration-flows', async (req, res) => {
  try {
    const b = req.body || {};
    if (b.source_ar_systems_id == null || b.target_ar_systems_id == null) return res.status(400).json({ error: 'source_ar_systems_id and target_ar_systems_id required' });
    const r = await pool.query(queries.integration_flows_insert, [b.source_ar_systems_id, b.target_ar_systems_id, b.ar_integration_flow_event_types_id, b.transferred_data, b.transfer_method, b.periodicity || null, b.ar_integration_flow_statuses_id]);
    res.status(201).json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create' }); }
});
app.put('/api/integration-flows/:id', async (req, res) => {
  try {
    const b = req.body || {};
    if (b.source_ar_systems_id == null || b.target_ar_systems_id == null) return res.status(400).json({ error: 'source_ar_systems_id and target_ar_systems_id required' });
    const r = await pool.query(queries.integration_flows_update, [b.source_ar_systems_id, b.target_ar_systems_id, b.ar_integration_flow_event_types_id, b.transferred_data, b.transfer_method, b.periodicity || null, b.ar_integration_flow_statuses_id, req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.delete('/api/integration-flows/:id', async (req, res) => {
  try {
    const r = await pool.query(queries.integration_flows_delete, [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});

app.get('/api/integration-flow-event-types', async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const excel = req.query.excel === '1' || req.query.excel === 'true';
    const q = search ? queries.integration_flow_event_types_select_search : queries.integration_flow_event_types_select;
    const params = search ? ['%' + search + '%'] : [];
    const result = await pool.query(q, params);
    const rows = result.rows;
    if (excel) { const buf = buildExcelBuffer(rows, 'Типы событий интеграций'); res.setHeader('Content-Disposition', 'attachment; filename=integration-flow-event-types.xlsx'); res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); return res.send(buf); }
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.post('/api/integration-flow-event-types', async (req, res) => {
  try {
    const { name, description } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const r = await pool.query(queries.integration_flow_event_types_insert, [name, description]);
    res.status(201).json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create' }); }
});
app.put('/api/integration-flow-event-types/:id', async (req, res) => {
  try {
    const { name, description } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const r = await pool.query(queries.integration_flow_event_types_update, [name, description, req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.delete('/api/integration-flow-event-types/:id', async (req, res) => {
  try {
    const r = await pool.query(queries.integration_flow_event_types_delete, [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});

app.get('/api/integration-flow-statuses', async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const excel = req.query.excel === '1' || req.query.excel === 'true';
    const q = search ? queries.integration_flow_statuses_select_search : queries.integration_flow_statuses_select;
    const params = search ? ['%' + search + '%'] : [];
    const result = await pool.query(q, params);
    const rows = result.rows;
    if (excel) { const buf = buildExcelBuffer(rows, 'Статусы интеграционных потоков'); res.setHeader('Content-Disposition', 'attachment; filename=integration-flow-statuses.xlsx'); res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); return res.send(buf); }
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.post('/api/integration-flow-statuses', async (req, res) => {
  try {
    const { code, name, description } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    if (!code || !String(code).trim()) return res.status(400).json({ error: 'code required' });
    const r = await pool.query(queries.integration_flow_statuses_insert, [String(code).trim(), name, description]);
    await loadRefCodes(pool);
    res.status(201).json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message || 'Failed to create' }); }
});
app.put('/api/integration-flow-statuses/:id', async (req, res) => {
  try {
    const { code, name, description } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    if (!code || !String(code).trim()) return res.status(400).json({ error: 'code required' });
    const r = await pool.query(queries.integration_flow_statuses_update, [String(code).trim(), name, description, req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    await loadRefCodes(pool);
    res.json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.delete('/api/integration-flow-statuses/:id', async (req, res) => {
  try {
    const r = await pool.query(queries.integration_flow_statuses_delete, [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    await loadRefCodes(pool);
    res.status(204).send();
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});

// --- Architecture debt registry (issue #23) ---
app.get('/api/ar-gaps', async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const excel = req.query.excel === '1' || req.query.excel === 'true';
    const q = search ? queries.gaps_select_search : queries.gaps_select;
    const params = search ? ['%' + search + '%'] : [];
    const r = await pool.query(q, params);
    const rows = r.rows;
    if (excel) {
      const buf = buildExcelBuffer(rows, 'Архитектурный долг');
      res.setHeader('Content-Disposition', 'attachment; filename=architecture-debt.xlsx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buf);
    }
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.get('/api/ar-gaps/:id', async (req, res) => {
  try {
    const r = await pool.query(queries.gaps_get, [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.post('/api/ar-gaps', async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.name) return res.status(400).json({ error: 'name required' });
    const gapPrefix = getParam('GAP_CODE_PREFIX', 'GAP-') || 'GAP-';
    const r = await pool.query(queries.gaps_insert, [
      gapPrefix, b.name, b.description || '', b.consequences || '', b.ar_impact_level_types_id, b.remediation_effort || '',
      b.target_date || '', b.ar_gap_states_id, b.resolved_date || '', b.ar_adr_statuses_id, b.ar_gap_types_id, b.source || '',
      b.responsible_person || '',
    ]);
    res.status(201).json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create' }); }
});
app.put('/api/ar-gaps/:id', async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.name) return res.status(400).json({ error: 'name required' });
    const r = await pool.query(queries.gaps_update, [
      b.name, b.description || '', b.consequences || '', b.ar_impact_level_types_id, b.remediation_effort || '',
      b.target_date || '', b.ar_gap_states_id, b.resolved_date || '', b.ar_adr_statuses_id, b.ar_gap_types_id, b.source || '',
      b.responsible_person || '',
      req.params.id,
    ]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.delete('/api/ar-gaps/:id', async (req, res) => {
  try {
    const r = await pool.query(queries.gaps_delete, [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.get('/api/ar-gaps/:id/relations', async (req, res) => {
  try {
    const r = await pool.query(queries.metamodel_relations_by_from, ['gap', req.params.id]);
    res.json(r.rows);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.post('/api/ar-gaps/:id/relations', async (req, res) => {
  try {
    const b = req.body || {};
    if (b.to_entity_type == null || b.to_entity_id == null || !b.relation_type) return res.status(400).json({ error: 'to_entity_type, to_entity_id, relation_type required' });
    const r = await pool.query(queries.metamodel_relations_insert, ['gap', parseInt(req.params.id, 10), b.to_entity_type, b.to_entity_id, b.relation_type, b.name || '', b.description || '', b.payload ? JSON.stringify(b.payload) : null, null, null]);
    res.status(201).json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create' }); }
});

// Refs: gap types, impact level types, gap states
app.get('/api/ar-gap-types', async (req, res) => {
  try { const r = await pool.query(queries.gap_types_select); res.json(r.rows); } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.get('/api/ar-gap-types/:id', async (req, res) => {
  try { const r = await pool.query(queries.gap_types_get, [req.params.id]); if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' }); res.json(r.rows[0]); } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.post('/api/ar-gap-types', async (req, res) => {
  try { const { name, description } = req.body || {}; if (!name) return res.status(400).json({ error: 'name required' }); const r = await pool.query(queries.gap_types_insert, [name, description || '']); res.status(201).json(r.rows[0]); } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create' }); }
});
app.put('/api/ar-gap-types/:id', async (req, res) => {
  try { const { name, description } = req.body || {}; if (!name) return res.status(400).json({ error: 'name required' }); const r = await pool.query(queries.gap_types_update, [name, description || '', req.params.id]); if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' }); res.json(r.rows[0]); } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.delete('/api/ar-gap-types/:id', async (req, res) => {
  try { const r = await pool.query(queries.gap_types_delete, [req.params.id]); if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' }); res.status(204).send(); } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.get('/api/ar-impact-level-types', async (req, res) => {
  try { const r = await pool.query(queries.impact_level_types_select); res.json(r.rows); } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.get('/api/ar-impact-level-types/:id', async (req, res) => {
  try { const r = await pool.query(queries.impact_level_types_get, [req.params.id]); if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' }); res.json(r.rows[0]); } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.post('/api/ar-impact-level-types', async (req, res) => {
  try { const { name, description } = req.body || {}; if (!name) return res.status(400).json({ error: 'name required' }); const r = await pool.query(queries.impact_level_types_insert, [name, description || '']); res.status(201).json(r.rows[0]); } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create' }); }
});
app.put('/api/ar-impact-level-types/:id', async (req, res) => {
  try { const { name, description } = req.body || {}; if (!name) return res.status(400).json({ error: 'name required' }); const r = await pool.query(queries.impact_level_types_update, [name, description || '', req.params.id]); if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' }); res.json(r.rows[0]); } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.delete('/api/ar-impact-level-types/:id', async (req, res) => {
  try { const r = await pool.query(queries.impact_level_types_delete, [req.params.id]); if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' }); res.status(204).send(); } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.get('/api/ar-gap-states', async (req, res) => {
  try { const r = await pool.query(queries.gap_states_select); res.json(r.rows); } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.get('/api/ar-gap-states/:id', async (req, res) => {
  try { const r = await pool.query(queries.gap_states_get, [req.params.id]); if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' }); res.json(r.rows[0]); } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.post('/api/ar-gap-states', async (req, res) => {
  try { const { name, description } = req.body || {}; if (!name) return res.status(400).json({ error: 'name required' }); const r = await pool.query(queries.gap_states_insert, [name, description || '']); res.status(201).json(r.rows[0]); } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create' }); }
});
app.put('/api/ar-gap-states/:id', async (req, res) => {
  try { const { name, description } = req.body || {}; if (!name) return res.status(400).json({ error: 'name required' }); const r = await pool.query(queries.gap_states_update, [name, description || '', req.params.id]); if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' }); res.json(r.rows[0]); } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.delete('/api/ar-gap-states/:id', async (req, res) => {
  try { const r = await pool.query(queries.gap_states_delete, [req.params.id]); if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' }); res.status(204).send(); } catch (err) { console.error(err); res.status(500).send('Server error'); }
});

// --- Settings parameters (issue #27) ---
function maskSecretParam(row) {
  if (row && row.is_secret && row.value) {
    return { ...row, value: '********' };
  }
  return row;
}
app.get('/api/settings-parameters', async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const q = search ? queries.settings_parameters_select_search : queries.settings_parameters_select;
    const params = search ? ['%' + search + '%'] : [];
    const r = await pool.query(q, params);
    res.json(r.rows.map(maskSecretParam));
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.get('/api/settings-parameters/:id', async (req, res) => {
  try {
    const r = await pool.query(queries.settings_parameters_get, [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(maskSecretParam(r.rows[0]));
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.post('/api/settings-parameters', async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.code || !b.code.trim()) return res.status(400).json({ error: 'code required' });
    const code = String(b.code || '').trim();
    const valueType = (b.value_type || 'string').toLowerCase();
    const value = valueType === 'json' || valueType === 'string_list' ? (typeof b.value === 'string' ? b.value : JSON.stringify(b.value == null ? '' : b.value)) : String(b.value ?? '');
    if (code.startsWith('DISP_')) {
      const vr = validateTemplateValue(code, value);
      if (!vr.ok) return res.status(400).json({ error: vr.error });
    }
    const r = await pool.query(queries.settings_parameters_insert, [code, b.description || '', value, b.value_type || 'string', b.group || '', b.is_secret === true, b.read_only === true]);
    res.status(201).json(maskSecretParam(r.rows[0]));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create' }); }
});
app.put('/api/settings-parameters/:id', async (req, res) => {
  try {
    const b = req.body || {};
    const rGet = await pool.query(queries.settings_parameters_get, [req.params.id]);
    if (rGet.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (rGet.rows[0].read_only) return res.status(400).json({ error: 'Parameter is read-only' });
    const valueType = (b.value_type || rGet.rows[0].value_type || 'string').toLowerCase();
    const value = valueType === 'json' || valueType === 'string_list' ? (typeof b.value === 'string' ? b.value : JSON.stringify(b.value == null ? '' : b.value)) : String(b.value ?? '');
    const code = String(rGet.rows[0].code || '');
    if (code.startsWith('DISP_')) {
      const vr = validateTemplateValue(code, value);
      if (!vr.ok) return res.status(400).json({ error: vr.error });
    }
    const r = await pool.query(queries.settings_parameters_update, [req.params.id, b.description ?? rGet.rows[0].description, value, b.value_type ?? rGet.rows[0].value_type, b.group != null ? b.group : rGet.rows[0].group, b.is_secret !== undefined ? b.is_secret : rGet.rows[0].is_secret, b.read_only !== undefined ? b.read_only : rGet.rows[0].read_only]);
    res.json(maskSecretParam(r.rows[0]));
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.delete('/api/settings-parameters/:id', async (req, res) => {
  try {
    const rGet = await pool.query(queries.settings_parameters_get, [req.params.id]);
    if (rGet.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (rGet.rows[0].read_only) return res.status(400).json({ error: 'Cannot delete read-only parameter' });
    const r = await pool.query(queries.settings_parameters_delete, [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});

// --- TOGAF Metamodel (task #14) ---
app.get('/api/togaf/entity-types', async (req, res) => {
  try {
    const r = await pool.query(queries.metamodel_entity_types_select);
    res.json(r.rows);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.get('/api/togaf/entity-types/:id', async (req, res) => {
  try {
    const r = await pool.query(queries.metamodel_entity_types_get, [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.post('/api/togaf/entity-types', async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.code || !b.name) return res.status(400).json({ error: 'code and name required' });
    const r = await pool.query(queries.metamodel_entity_types_insert, [b.code, b.name, b.table_name || '', b.description || '']);
    res.status(201).json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create' }); }
});
app.put('/api/togaf/entity-types/:id', async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.code || !b.name) return res.status(400).json({ error: 'code and name required' });
    const r = await pool.query(queries.metamodel_entity_types_update, [b.code, b.name, b.table_name || '', b.description || '', req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.delete('/api/togaf/entity-types/:id', async (req, res) => {
  try {
    const r = await pool.query(queries.metamodel_entity_types_delete, [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});

app.get('/api/togaf/relation-types', async (req, res) => {
  try {
    const r = await pool.query(queries.metamodel_relation_types_select);
    res.json(r.rows);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.get('/api/togaf/relation-types/:id', async (req, res) => {
  try {
    const r = await pool.query(queries.metamodel_relation_types_get, [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.post('/api/togaf/relation-types', async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.code || !b.name) return res.status(400).json({ error: 'code and name required' });
    if (b.from_entity_type_id == null || b.to_entity_type_id == null) return res.status(400).json({ error: 'from_entity_type_id and to_entity_type_id required' });
    const r = await pool.query(queries.metamodel_relation_types_insert, [b.code, b.name, b.description || '', b.from_entity_type_id, b.to_entity_type_id]);
    res.status(201).json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create' }); }
});
app.put('/api/togaf/relation-types/:id', async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.code || !b.name) return res.status(400).json({ error: 'code and name required' });
    if (b.from_entity_type_id == null || b.to_entity_type_id == null) return res.status(400).json({ error: 'from_entity_type_id and to_entity_type_id required' });
    const r = await pool.query(queries.metamodel_relation_types_update, [b.code, b.name, b.description || '', b.from_entity_type_id, b.to_entity_type_id, req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.delete('/api/togaf/relation-types/:id', async (req, res) => {
  try {
    const r = await pool.query(queries.metamodel_relation_types_delete, [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
/** Типы связей метамодели, создаваемые только проекцией из ar_integration_flows (issues #33, #56). */
const INTEGRATION_FLOW_METAMODEL_RELATION_TYPES = new Set([
  'integration_flow',
  'integration_flow_system_module',
  'integration_flow_module_system',
  'integration_flow_module_module',
])
function isMetamodelIntegrationFlowProjection(row) {
  return row && row.reference_to_baserow != null && INTEGRATION_FLOW_METAMODEL_RELATION_TYPES.has(row.relation_type)
}

app.get('/api/togaf/relations', async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const q = search ? queries.metamodel_relations_select_search : queries.metamodel_relations_select;
    const params = search ? ['%' + search + '%'] : [];
    const r = await pool.query(q, params);
    res.json(r.rows);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.get('/api/togaf/relations/:id', async (req, res) => {
  try {
    const r = await pool.query(queries.metamodel_relations_get, [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
/** Массовая пересборка проекций integration_flow из ar_integration_flows (issue #33). См. issue #35 для UI. */
app.post('/api/togaf/metamodel/rebuild-integration-flow-projections', async (req, res) => {
  try {
    await pool.query('SELECT archrep.rebuild_integration_flow_metamodel_relations()');
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'rebuild failed' });
  }
});
app.post('/api/togaf/relations', async (req, res) => {
  try {
    const b = req.body || {};
    if (b.from_entity_type == null || b.from_entity_id == null || b.to_entity_type == null || b.to_entity_id == null || !b.relation_type) return res.status(400).json({ error: 'from_entity_type, from_entity_id, to_entity_type, to_entity_id, relation_type required' });
    const rt = String(b.relation_type).trim()
    if (INTEGRATION_FLOW_METAMODEL_RELATION_TYPES.has(rt)) {
      return res.status(400).json({
        error: 'Проекции интеграционных потоков (integration_flow*) создаются только из реестра ar_integration_flows (триггер БД).',
      });
    }
    const r = await pool.query(queries.metamodel_relations_insert, [b.from_entity_type, b.from_entity_id, b.to_entity_type, b.to_entity_id, b.relation_type, b.name, b.description, b.payload ? JSON.stringify(b.payload) : null, b.displayed_name != null ? b.displayed_name : null, b.reference_to_baserow != null ? b.reference_to_baserow : null]);
    res.status(201).json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create' }); }
});
app.put('/api/togaf/relations/:id', async (req, res) => {
  try {
    const b = req.body || {};
    if (b.from_entity_type == null || b.from_entity_id == null || b.to_entity_type == null || b.to_entity_id == null || !b.relation_type) return res.status(400).json({ error: 'from_entity_type, from_entity_id, to_entity_type, to_entity_id, relation_type required' });
    const cur = await pool.query(queries.metamodel_relations_get, [req.params.id]);
    if (cur.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const row = cur.rows[0];
    if (isMetamodelIntegrationFlowProjection(row)) {
      return res.status(400).json({
        error: 'Проекция интеграционного потока управляется из реестра потоков. Пересборка: POST /api/togaf/metamodel/rebuild-integration-flow-projections',
      });
    }
    const disp = b.displayed_name !== undefined ? b.displayed_name : row.displayed_name;
    const refBase = b.reference_to_baserow !== undefined ? b.reference_to_baserow : row.reference_to_baserow;
    const r = await pool.query(queries.metamodel_relations_update, [b.from_entity_type, b.from_entity_id, b.to_entity_type, b.to_entity_id, b.relation_type, b.name, b.description, b.payload ? JSON.stringify(b.payload) : null, disp, refBase, req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.delete('/api/togaf/relations/:id', async (req, res) => {
  try {
    const cur = await pool.query(queries.metamodel_relations_get, [req.params.id]);
    if (cur.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const row = cur.rows[0];
    if (isMetamodelIntegrationFlowProjection(row)) {
      return res.status(400).json({
        error: 'Проекция интеграционного потока удаляется при удалении потока или через пересборку метамодели.',
      });
    }
    const r = await pool.query(queries.metamodel_relations_delete, [req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});

// TOGAF refs: organization unit categories, actor types, business service statuses
app.get('/api/togaf/refs/organization-unit-categories', async (req, res) => {
  try { const r = await pool.query(queries.togaf_organization_unit_categories_select); res.json(r.rows); } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.get('/api/togaf/refs/organization-unit-categories/:id', async (req, res) => {
  try { const r = await pool.query(queries.togaf_organization_unit_categories_get, [req.params.id]); if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' }); res.json(r.rows[0]); } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.post('/api/togaf/refs/organization-unit-categories', async (req, res) => {
  try { const { code, name, description } = req.body || {}; if (!name) return res.status(400).json({ error: 'name required' }); const r = await pool.query(queries.togaf_organization_unit_categories_insert, [code, name, description]); res.status(201).json(r.rows[0]); } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create' }); }
});
app.put('/api/togaf/refs/organization-unit-categories/:id', async (req, res) => {
  try { const { code, name, description } = req.body || {}; if (!name) return res.status(400).json({ error: 'name required' }); const r = await pool.query(queries.togaf_organization_unit_categories_update, [code, name, description, req.params.id]); if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' }); res.json(r.rows[0]); } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.delete('/api/togaf/refs/organization-unit-categories/:id', async (req, res) => {
  try { const r = await pool.query(queries.togaf_organization_unit_categories_delete, [req.params.id]); if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' }); res.status(204).send(); } catch (err) { console.error(err); res.status(500).send('Server error'); }
});

app.get('/api/togaf/refs/actor-types', async (req, res) => {
  try { const r = await pool.query(queries.togaf_actor_types_select); res.json(r.rows); } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.get('/api/togaf/refs/actor-types/:id', async (req, res) => {
  try { const r = await pool.query(queries.togaf_actor_types_get, [req.params.id]); if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' }); res.json(r.rows[0]); } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.post('/api/togaf/refs/actor-types', async (req, res) => {
  try { const { code, name, description } = req.body || {}; if (!name) return res.status(400).json({ error: 'name required' }); const r = await pool.query(queries.togaf_actor_types_insert, [code, name, description]); res.status(201).json(r.rows[0]); } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create' }); }
});
app.put('/api/togaf/refs/actor-types/:id', async (req, res) => {
  try { const { code, name, description } = req.body || {}; if (!name) return res.status(400).json({ error: 'name required' }); const r = await pool.query(queries.togaf_actor_types_update, [code, name, description, req.params.id]); if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' }); res.json(r.rows[0]); } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.delete('/api/togaf/refs/actor-types/:id', async (req, res) => {
  try { const r = await pool.query(queries.togaf_actor_types_delete, [req.params.id]); if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' }); res.status(204).send(); } catch (err) { console.error(err); res.status(500).send('Server error'); }
});

app.get('/api/togaf/refs/business-service-statuses', async (req, res) => {
  try { const r = await pool.query(queries.togaf_business_service_statuses_select); res.json(r.rows); } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.get('/api/togaf/refs/business-service-statuses/:id', async (req, res) => {
  try { const r = await pool.query(queries.togaf_business_service_statuses_get, [req.params.id]); if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' }); res.json(r.rows[0]); } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.post('/api/togaf/refs/business-service-statuses', async (req, res) => {
  try { const { name, description } = req.body || {}; if (!name) return res.status(400).json({ error: 'name required' }); const r = await pool.query(queries.togaf_business_service_statuses_insert, [name, description]); res.status(201).json(r.rows[0]); } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create' }); }
});
app.put('/api/togaf/refs/business-service-statuses/:id', async (req, res) => {
  try { const { name, description } = req.body || {}; if (!name) return res.status(400).json({ error: 'name required' }); const r = await pool.query(queries.togaf_business_service_statuses_update, [name, description, req.params.id]); if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' }); res.json(r.rows[0]); } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.delete('/api/togaf/refs/business-service-statuses/:id', async (req, res) => {
  try { const r = await pool.query(queries.togaf_business_service_statuses_delete, [req.params.id]); if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' }); res.status(204).send(); } catch (err) { console.error(err); res.status(500).send('Server error'); }
});

// TOGAF business entities: organization units, actors, business services, business functions
app.get('/api/togaf/organization-units', async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const q = search ? queries.togaf_organization_units_select_search : queries.togaf_organization_units_select;
    const params = search ? ['%' + search + '%'] : [];
    const r = await pool.query(q, params);
    res.json(r.rows);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.get('/api/togaf/organization-units/:id', async (req, res) => {
  try { const r = await pool.query(queries.togaf_organization_units_get, [req.params.id]); if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' }); res.json(r.rows[0]); } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.post('/api/togaf/organization-units', async (req, res) => {
  try {
    const b = req.body || {}; if (!b.code || !b.name) return res.status(400).json({ error: 'code and name required' });
    const r = await pool.query(queries.togaf_organization_units_insert, [b.code, b.name, b.fullname, b.parent_id, b.description, b.leader, b.organization_unit_categories_id]);
    res.status(201).json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create' }); }
});
app.put('/api/togaf/organization-units/:id', async (req, res) => {
  try {
    const b = req.body || {}; if (!b.code || !b.name) return res.status(400).json({ error: 'code and name required' });
    const r = await pool.query(queries.togaf_organization_units_update, [b.code, b.name, b.fullname, b.parent_id, b.description, b.leader, b.organization_unit_categories_id, req.params.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' }); res.json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.delete('/api/togaf/organization-units/:id', async (req, res) => {
  try { const r = await pool.query(queries.togaf_organization_units_delete, [req.params.id]); if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' }); res.status(204).send(); } catch (err) { console.error(err); res.status(500).send('Server error'); }
});

app.get('/api/togaf/actors', async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const q = search ? queries.togaf_actors_select_search : queries.togaf_actors_select;
    const params = search ? ['%' + search + '%'] : [];
    const r = await pool.query(q, params);
    res.json(r.rows);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.get('/api/togaf/actors/:id', async (req, res) => {
  try { const r = await pool.query(queries.togaf_actors_get, [req.params.id]); if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' }); res.json(r.rows[0]); } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.post('/api/togaf/actors', async (req, res) => {
  try { const b = req.body || {}; if (!b.code || !b.name) return res.status(400).json({ error: 'code and name required' }); const r = await pool.query(queries.togaf_actors_insert, [b.code, b.name, b.description, b.organization_unit_id, b.actor_type_id, b.source]); res.status(201).json(r.rows[0]); } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create' }); }
});
app.put('/api/togaf/actors/:id', async (req, res) => {
  try { const b = req.body || {}; if (!b.code || !b.name) return res.status(400).json({ error: 'code and name required' }); const r = await pool.query(queries.togaf_actors_update, [b.code, b.name, b.description, b.organization_unit_id, b.actor_type_id, b.source, req.params.id]); if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' }); res.json(r.rows[0]); } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.delete('/api/togaf/actors/:id', async (req, res) => {
  try { const r = await pool.query(queries.togaf_actors_delete, [req.params.id]); if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' }); res.status(204).send(); } catch (err) { console.error(err); res.status(500).send('Server error'); }
});

app.get('/api/togaf/business-services', async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const q = search ? queries.togaf_business_services_select_search : queries.togaf_business_services_select;
    const params = search ? ['%' + search + '%'] : [];
    const r = await pool.query(q, params);
    res.json(r.rows);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.get('/api/togaf/business-services/:id', async (req, res) => {
  try { const r = await pool.query(queries.togaf_business_services_get, [req.params.id]); if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' }); res.json(r.rows[0]); } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.post('/api/togaf/business-services', async (req, res) => {
  try { const b = req.body || {}; if (!b.code || !b.name) return res.status(400).json({ error: 'code and name required' }); const r = await pool.query(queries.togaf_business_services_insert, [b.code, b.name, b.fullname, b.description, b.ar_organization_units_id, b.ar_business_service_statuses_id, b.source, b.category]); res.status(201).json(r.rows[0]); } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create' }); }
});
app.put('/api/togaf/business-services/:id', async (req, res) => {
  try { const b = req.body || {}; if (!b.code || !b.name) return res.status(400).json({ error: 'code and name required' }); const r = await pool.query(queries.togaf_business_services_update, [b.code, b.name, b.fullname, b.description, b.ar_organization_units_id, b.ar_business_service_statuses_id, b.source, b.category, req.params.id]); if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' }); res.json(r.rows[0]); } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.delete('/api/togaf/business-services/:id', async (req, res) => {
  try { const r = await pool.query(queries.togaf_business_services_delete, [req.params.id]); if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' }); res.status(204).send(); } catch (err) { console.error(err); res.status(500).send('Server error'); }
});

app.get('/api/togaf/business-functions', async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const q = search ? queries.togaf_business_functions_select_search : queries.togaf_business_functions_select;
    const params = search ? ['%' + search + '%'] : [];
    const r = await pool.query(q, params);
    res.json(r.rows);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.get('/api/togaf/business-functions/:id', async (req, res) => {
  try { const r = await pool.query(queries.togaf_business_functions_get, [req.params.id]); if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' }); res.json(r.rows[0]); } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.post('/api/togaf/business-functions', async (req, res) => {
  try { const b = req.body || {}; if (!b.code || !b.name) return res.status(400).json({ error: 'code and name required' }); const r = await pool.query(queries.togaf_business_functions_insert, [b.code, b.name, b.description, b.parent_id, b.ar_organization_units_id, b.source, b.category]); res.status(201).json(r.rows[0]); } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create' }); }
});
app.put('/api/togaf/business-functions/:id', async (req, res) => {
  try { const b = req.body || {}; if (!b.code || !b.name) return res.status(400).json({ error: 'code and name required' }); const r = await pool.query(queries.togaf_business_functions_update, [b.code, b.name, b.description, b.parent_id, b.ar_organization_units_id, b.source, b.category, req.params.id]); if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' }); res.json(r.rows[0]); } catch (err) { console.error(err); res.status(500).send('Server error'); }
});
app.delete('/api/togaf/business-functions/:id', async (req, res) => {
  try { const r = await pool.query(queries.togaf_business_functions_delete, [req.params.id]); if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' }); res.status(204).send(); } catch (err) { console.error(err); res.status(500).send('Server error'); }
});

(async () => {
  await loadParams(pool);
  try {
    await loadRefCodes(pool);
  } catch (e) {
    console.warn('refCodes load failed (run migration archrep_issue31_adr_ref_codes.sql?):', e.message);
  }
  mountFrontendStatic();
  const port = Number(process.env.SERVER_PORT) || Number(getParam('ARR_SERVER_PORT', 3000)) || 3000;
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
})();

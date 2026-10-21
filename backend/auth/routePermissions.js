'use strict';

/**
 * method + path → required permissions.
 * Первый подходящий rule. Нет rule → deny (auth on).
 *
 * Rule fields:
 * - permissions: string[] — все нужны (AND)
 * - anyOf: string[] — достаточно одного (lookup / срез карточки)
 * - requireQuery: string[] — rule матчится только если query-ключи непусты
 * - exportPermission — при ?excel=1|true вместо обычных permissions
 *
 * Реестр ≠ lookup / вкладки-срезы: docs/access-control-design.md §10.6
 */

const PUBLIC_PATHS = new Set([
  '/api/health',
  '/api/health/db',
  '/api/config',
  '/api/auth/login',
  '/api/auth/oidc/login',
  '/api/auth/oidc/callback',
]);

function re(prefix) {
  const esc = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${esc}(?:/|$)`);
}

function listPath(prefix) {
  const esc = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${esc}/?$`);
}

function read(prefix, perm) {
  return {
    methods: ['GET'],
    pattern: re(prefix),
    permissions: [perm],
    exportPermission: perm.endsWith(':read') ? perm.replace(/:read$/, ':export') : null,
  };
}

function write(prefix, perm) {
  return { methods: ['POST', 'PUT', 'PATCH'], pattern: re(prefix), permissions: [perm] };
}

function del(prefix, perm) {
  return { methods: ['DELETE'], pattern: re(prefix), permissions: [perm] };
}

function crud(prefix, resource, { withExport = true } = {}) {
  const r = read(prefix, `${resource}:read`);
  if (!withExport) r.exportPermission = null;
  return [r, write(prefix, `${resource}:write`), del(prefix, `${resource}:delete`)];
}

/** GET список для FK: реестр `*:read` или хост-форма с правом read. */
function listLookup(prefix, exportPermission, anyOf) {
  return {
    methods: ['GET'],
    pattern: listPath(prefix),
    anyOf: [...anyOf],
    exportPermission: exportPermission || null,
  };
}

function refLookup(prefix, ...hostReads) {
  return {
    methods: ['GET'],
    pattern: listPath(prefix),
    anyOf: ['references:read', ...hostReads],
  };
}

const SYSTEM_FK_READS = [
  'system:read',
  'integration_flow:read',
  'web_resource:read',
  'adr_applied:read',
  'gap:read',
];

const OU_FK_READS = [
  'organization_unit:read',
  'actor:read',
  'business_service:read',
  'business_function:read',
  'domain:write',
  'certificate:write',
];

const PARTNER_FK_READS = ['partner:read', 'system:read', 'technology:read', 'domain:write', 'certificate:write'];

const EMPLOYEE_FK_READS = ['employee:read', 'system:read', 'domain:write', 'certificate:write'];

const TECHNOLOGY_FK_READS = ['technology:read', 'system:read'];

/** @type {{ methods: string[], pattern: RegExp, permissions?: string[], anyOf?: string[], exportPermission?: string|null, requireQuery?: string[] }[]} */
const RULES = [
  { methods: ['GET'], pattern: /^\/api\/auth\/me$/, permissions: [] },
  { methods: ['POST'], pattern: /^\/api\/auth\/change-password$/, permissions: [] },

  // ИИ-архитектор (ядро, issue #78): панель чата, история диалогов, SSE-чат.
  // Гейт UI — SYS_AI_ENABLED; серверный доступ — ai_architect:use. Данные внутри инструментов
  // дополнительно проверяются по правам чтения ресурсов (docs/ai-architect.md §4).
  { methods: ['POST'], pattern: re('/api/ai/chat'), permissions: ['ai_architect:use'] },
  { methods: ['GET', 'POST', 'DELETE'], pattern: re('/api/ai/conversations'), permissions: ['ai_architect:use'] },
  { methods: ['GET'], pattern: /^\/api\/ai\/status$/, permissions: ['ai_architect:use'] },

  { methods: ['GET'], pattern: /^\/api\/admin\/users(?:\/|$)/, permissions: ['users:read'], exportPermission: 'users:export' },
  { methods: ['POST'], pattern: /^\/api\/admin\/users$/, permissions: ['users:write'] },
  { methods: ['PUT', 'PATCH'], pattern: /^\/api\/admin\/users\/\d+$/, permissions: ['users:write'] },
  { methods: ['DELETE'], pattern: /^\/api\/admin\/users\/\d+$/, permissions: ['users:delete'] },
  { methods: ['PUT'], pattern: /^\/api\/admin\/users\/\d+\/roles$/, permissions: ['roles:assign'] },
  { methods: ['GET'], pattern: /^\/api\/admin\/permissions(?:\/|$)/, permissions: ['roles:read'] },
  { methods: ['GET'], pattern: /^\/api\/admin\/roles(?:\/|$)/, permissions: ['roles:read'] },
  { methods: ['POST'], pattern: /^\/api\/admin\/roles$/, permissions: ['roles:write'] },
  { methods: ['PUT', 'PATCH'], pattern: /^\/api\/admin\/roles\/\d+$/, permissions: ['roles:write'] },
  { methods: ['PUT'], pattern: /^\/api\/admin\/roles\/\d+\/permissions$/, permissions: ['roles:write'] },
  { methods: ['DELETE'], pattern: /^\/api\/admin\/roles\/\d+$/, permissions: ['roles:write'] },

  { methods: ['GET'], pattern: /^\/api\/admin\/restart-node\/status$/, permissions: ['system_admin:restart'] },
  { methods: ['POST'], pattern: /^\/api\/admin\/restart-node$/, permissions: ['system_admin:restart'] },

  { methods: ['GET'], pattern: /^\/api\/import\//, permissions: ['import:execute'] },
  { methods: ['POST'], pattern: /^\/api\/import\/validate$/, permissions: ['import:execute'] },
  { methods: ['POST'], pattern: /^\/api\/import\/apply$/, permissions: ['import:execute'] },

  { methods: ['GET'], pattern: re('/api/settings-parameters'), permissions: ['settings_parameters:read'] },
  { methods: ['POST', 'PUT', 'PATCH', 'DELETE'], pattern: re('/api/settings-parameters'), permissions: ['settings_parameters:write'] },

  { methods: ['POST'], pattern: /^\/api\/togaf\/metamodel\/rebuild/, permissions: ['metamodel:rebuild'] },

  { methods: ['GET'], pattern: re('/api/jobs'), permissions: ['jobs:read'] },
  { methods: ['GET'], pattern: /^\/api\/jobs\/\d+\/runs$/, permissions: ['jobs:read'] },
  { methods: ['POST'], pattern: /^\/api\/jobs\/\d+\/run$/, permissions: ['jobs:execute'] },
  { methods: ['PATCH'], pattern: /^\/api\/jobs\/\d+$/, permissions: ['jobs:execute'] },

  // Domain
  ...crud('/api/principles', 'principle'),
  ...crud('/api/decisions/principle', 'adr_principle'),
  ...crud('/api/decisions/applied', 'adr_applied'),
  { methods: ['GET'], pattern: re('/api/increments'), permissions: ['adr_applied:read'] },
  { methods: ['POST', 'PUT', 'PATCH'], pattern: re('/api/increments'), permissions: ['adr_applied:write'] },
  { methods: ['DELETE'], pattern: re('/api/increments'), permissions: ['adr_applied:write'] },
  { methods: ['GET'], pattern: re('/api/adr-increment-systems'), permissions: ['adr_applied:read'] },
  { methods: ['POST', 'PUT', 'PATCH'], pattern: re('/api/adr-increment-systems'), permissions: ['adr_applied:write'] },
  { methods: ['DELETE'], pattern: re('/api/adr-increment-systems'), permissions: ['adr_applied:write'] },

  ...crud('/api/ar-gaps', 'gap'),

  listLookup('/api/ar-systems', 'system:export', SYSTEM_FK_READS),
  ...crud('/api/ar-systems', 'system'),
  { methods: ['POST'], pattern: re('/api/add-ar-systems'), permissions: ['system:write'] },
  { methods: ['GET', 'PUT'], pattern: re('/api/update-ar-systems'), permissions: ['system:write'] },
  {
    methods: ['GET'],
    pattern: re('/api/parent-systems'),
    anyOf: SYSTEM_FK_READS,
  },
  { methods: ['GET'], pattern: re('/api/systems-technologies'), permissions: ['system:read'] },
  { methods: ['POST'], pattern: re('/api/systems-technologies'), permissions: ['system:write'] },
  { methods: ['DELETE'], pattern: re('/api/systems-technologies'), permissions: ['system:write'] },

  ...crud('/api/system-functions', 'system_function', { withExport: false }),

  {
    methods: ['GET'],
    pattern: listPath('/api/integration-flows'),
    requireQuery: ['system_id'],
    anyOf: ['integration_flow:read', 'system:read', 'adr_applied:read'],
  },
  ...crud('/api/integration-flows', 'integration_flow'),
  ...crud('/api/togaf/web-resources', 'web_resource'),
  listLookup('/api/togaf/domains', 'domain:export', ['domain:read', 'web_resource:write', 'certificate:write']),
  ...crud('/api/togaf/domains', 'domain'),
  listLookup('/api/togaf/certificates', 'certificate:export', ['certificate:read', 'domain:read', 'partner:read', 'employee:read']),
  ...crud('/api/togaf/certificates', 'certificate'),

  // Каталог инфраструктуры (Netbox) — только чтение; синхронизация запускается заданием (jobs:execute)
  { methods: ['GET'], pattern: re('/api/infrastructure'), permissions: ['infrastructure:read'] },

  listLookup('/api/partners', 'partner:export', PARTNER_FK_READS),
  ...crud('/api/partners', 'partner'),
  listLookup('/api/ar-employees', 'employee:export', EMPLOYEE_FK_READS),
  ...crud('/api/ar-employees', 'employee'),
  listLookup('/api/technologies', 'technology:export', TECHNOLOGY_FK_READS),
  ...crud('/api/technologies', 'technology'),

  listLookup('/api/togaf/organization-units', 'organization_unit:export', OU_FK_READS),
  ...crud('/api/togaf/organization-units', 'organization_unit'),
  ...crud('/api/togaf/actors', 'actor'),
  ...crud('/api/togaf/business-services', 'business_service'),
  listLookup('/api/togaf/business-functions', 'business_function:export', [
    'business_function:read',
    'organization_unit:read',
  ]),
  ...crud('/api/togaf/business-functions', 'business_function'),

  // Удаление ребра с карточки gap (и реестр связей): host write или metamodel_relation:delete
  {
    methods: ['DELETE'],
    pattern: re('/api/togaf/relations'),
    anyOf: ['metamodel_relation:delete', 'gap:write'],
  },
  ...crud('/api/togaf/relations', 'metamodel_relation'),

  // Analytics / dashboards
  { methods: ['GET'], pattern: re('/api/dashboard'), permissions: ['dashboard:read'] },
  { methods: ['GET'], pattern: re('/api/dashboards'), permissions: ['dashboard:read'] },
  { methods: ['GET'], pattern: re('/api/analytics'), permissions: ['analytics:read'] },
  { methods: ['GET'], pattern: re('/api/graph'), permissions: ['analytics:read'] },
  { methods: ['GET'], pattern: re('/api/tech-radar'), permissions: ['tech_radar:read'] },
  { methods: ['GET'], pattern: re('/api/goals'), permissions: ['goals:read'] },

  // Metamodel catalog (+ lookup для picker на карточке gap / связей)
  {
    methods: ['GET'],
    pattern: re('/api/togaf/entity-types'),
    anyOf: ['metamodel_catalog:read', 'gap:read', 'metamodel_relation:read'],
  },
  { methods: ['POST', 'PUT', 'PATCH', 'DELETE'], pattern: re('/api/togaf/entity-types'), permissions: ['metamodel_catalog:write'] },
  {
    methods: ['GET'],
    pattern: re('/api/togaf/relation-types'),
    anyOf: ['metamodel_catalog:read', 'gap:read', 'metamodel_relation:read'],
  },
  { methods: ['POST', 'PUT', 'PATCH', 'DELETE'], pattern: re('/api/togaf/relation-types'), permissions: ['metamodel_catalog:write'] },

  // References lookups for host forms
  refLookup('/api/owners', 'system:read'),
  refLookup('/api/system-statuses', 'system:read'),
  refLookup('/api/hosting-types', 'system:read'),
  {
    methods: ['GET'],
    pattern: listPath('/api/ar-vendors'),
    anyOf: ['references:read', ...PARTNER_FK_READS],
  },
  refLookup('/api/technology-classes', 'technology:read'),
  refLookup('/api/technology-statuses', 'technology:read'),
  refLookup('/api/technology-types', 'technology:read'),
  refLookup('/api/adr-statuses', 'adr_principle:read', 'adr_applied:read', 'gap:read'),
  refLookup('/api/adr-increment-types', 'adr_applied:read'),
  refLookup('/api/adr-system-statuses', 'adr_applied:read'),
  refLookup('/api/adr-relation-statuses', 'adr_applied:read'),
  refLookup('/api/adr-system-function-statuses', 'adr_applied:read'),
  refLookup('/api/system-function-statuses', 'adr_applied:read'),
  refLookup('/api/integration-flow-event-types', 'integration_flow:read'),
  refLookup('/api/integration-flow-statuses', 'integration_flow:read'),
  refLookup('/api/ar-gap-types', 'gap:read'),
  refLookup('/api/ar-impact-level-types', 'gap:read'),
  refLookup('/api/ar-gap-states', 'gap:read'),
  refLookup('/api/togaf/web-resource-statuses', 'web_resource:read'),
  refLookup('/api/togaf/web-resource-categories', 'web_resource:read'),
  refLookup('/api/togaf/web-resource-stage-types', 'web_resource:read'),
  refLookup('/api/togaf/domain-statuses', 'domain:read'),

  // References (справочники) — полный CRUD
  ...refCrud('/api/owners'),
  ...refCrud('/api/system-statuses'),
  ...refCrud('/api/hosting-types'),
  ...refCrud('/api/ar-vendors'),
  ...refCrud('/api/technology-classes'),
  ...refCrud('/api/technology-statuses'),
  ...refCrud('/api/technology-types'),
  ...refCrud('/api/adr-statuses'),
  ...refCrud('/api/adr-increment-types'),
  ...refCrud('/api/adr-system-statuses'),
  ...refCrud('/api/adr-relation-statuses'),
  ...refCrud('/api/adr-system-function-statuses'),
  ...refCrud('/api/system-function-statuses'),
  ...refCrud('/api/classificators'),
  ...refCrud('/api/system-assignments'),
  ...refCrud('/api/integration-flow-event-types'),
  ...refCrud('/api/integration-flow-statuses'),
  ...refCrud('/api/ar-gap-types'),
  ...refCrud('/api/ar-impact-level-types'),
  ...refCrud('/api/ar-gap-states'),
  ...refCrud('/api/togaf/web-resource-statuses'),
  ...refCrud('/api/togaf/web-resource-categories'),
  ...refCrud('/api/togaf/web-resource-stage-types'),
  ...refCrud('/api/togaf/domain-statuses'),
  {
    methods: ['GET'],
    pattern: re('/api/togaf/refs'),
    anyOf: ['references:read', ...OU_FK_READS],
  },
  { methods: ['POST', 'PUT', 'PATCH', 'DELETE'], pattern: re('/api/togaf/refs'), permissions: ['references:write'] },
];

function refCrud(prefix) {
  return [
    { methods: ['GET'], pattern: re(prefix), permissions: ['references:read'] },
    { methods: ['POST', 'PUT', 'PATCH', 'DELETE'], pattern: re(prefix), permissions: ['references:write'] },
  ];
}

function isPublicPath(pathname) {
  return PUBLIC_PATHS.has(pathname);
}

function queryHas(query, key) {
  const v = query[key];
  return v != null && String(v).trim() !== '';
}

function resolveRequiredPermissions(method, pathname, query = {}) {
  const m = String(method || 'GET').toUpperCase();
  for (const rule of RULES) {
    if (!rule.methods.includes(m)) continue;
    if (!rule.pattern.test(pathname)) continue;
    if (Array.isArray(rule.requireQuery) && rule.requireQuery.length) {
      if (!rule.requireQuery.every((k) => queryHas(query, k))) continue;
    }
    if (
      m === 'GET' &&
      rule.exportPermission &&
      (query.excel === '1' || query.excel === 'true')
    ) {
      return [rule.exportPermission];
    }
    if (Array.isArray(rule.anyOf) && rule.anyOf.length) {
      return { anyOf: [...rule.anyOf] };
    }
    return [...(rule.permissions || [])];
  }
  return null;
}

module.exports = {
  PUBLIC_PATHS,
  isPublicPath,
  resolveRequiredPermissions,
  RULES,
};

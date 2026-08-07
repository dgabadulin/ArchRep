/**
 * Каталог permissions и матрица роль→permission (docs/access-control-design.md §4–5).
 * Используется для сидов и runtime (open mode / проверки).
 */

const ROLES = [
  { code: 'VIEWER', name: 'Наблюдатель', description: 'Чтение каталогов и аналитики' },
  { code: 'ARCHITECT', name: 'Архитектор', description: 'CRUD доменных реестров' },
  { code: 'REPOSITORY_ADMIN', name: 'Администратор репозитория', description: 'Параметры, справочники, сервисные операции, пользователи' },
  { code: 'SYSTEM_ADMIN', name: 'Администратор платформы', description: 'Полный доступ включая restart API' },
];

/** @type {string[]} */
const ALL_PERMISSIONS = [
  'principle:read', 'principle:write', 'principle:delete', 'principle:export',
  'adr_principle:read', 'adr_principle:write', 'adr_principle:delete', 'adr_principle:export',
  'adr_applied:read', 'adr_applied:write', 'adr_applied:delete', 'adr_applied:export',
  'gap:read', 'gap:write', 'gap:delete', 'gap:export',
  'organization_unit:read', 'organization_unit:write', 'organization_unit:delete', 'organization_unit:export',
  'actor:read', 'actor:write', 'actor:delete', 'actor:export',
  'business_service:read', 'business_service:write', 'business_service:delete', 'business_service:export',
  'business_function:read', 'business_function:write', 'business_function:delete', 'business_function:export',
  'goals:read',
  'system:read', 'system:write', 'system:delete', 'system:export',
  'system_function:read', 'system_function:write', 'system_function:delete',
  'integration_flow:read', 'integration_flow:write', 'integration_flow:delete', 'integration_flow:export',
  'web_resource:read', 'web_resource:write', 'web_resource:delete', 'web_resource:export',
  'partner:read', 'partner:write', 'partner:delete', 'partner:export',
  'employee:read', 'employee:write', 'employee:delete', 'employee:export',
  'technology:read', 'technology:write', 'technology:delete', 'technology:export',
  'tech_radar:read',
  'analytics:read',
  'dashboard:read',
  'metamodel_relation:read', 'metamodel_relation:write', 'metamodel_relation:delete', 'metamodel_relation:export',
  'metamodel:rebuild',
  'references:read', 'references:write',
  'metamodel_catalog:read', 'metamodel_catalog:write',
  'settings_parameters:read', 'settings_parameters:write',
  'service_operations:execute',
  'import:execute',
  'users:read', 'users:write', 'users:delete', 'users:export',
  'roles:read', 'roles:assign', 'roles:write',
  'system_admin:restart',
];

function reExport(prefix) {
  return [`${prefix}:read`, `${prefix}:export`];
}

function fullCrud(prefix, { withExport = true } = {}) {
  const list = [`${prefix}:read`, `${prefix}:write`, `${prefix}:delete`];
  if (withExport) list.push(`${prefix}:export`);
  return list;
}

const VIEWER = [
  ...reExport('principle'),
  ...reExport('adr_principle'),
  'adr_applied:read', 'adr_applied:export',
  ...reExport('gap'),
  ...reExport('organization_unit'),
  ...reExport('actor'),
  ...reExport('business_service'),
  ...reExport('business_function'),
  'goals:read',
  ...reExport('system'),
  'system_function:read',
  ...reExport('integration_flow'),
  ...reExport('web_resource'),
  ...reExport('partner'),
  ...reExport('employee'),
  ...reExport('technology'),
  'tech_radar:read',
  'analytics:read',
  'dashboard:read',
  ...reExport('metamodel_relation'),
  'references:read',
  'metamodel_catalog:read',
];

const ARCHITECT = [
  ...VIEWER,
  ...fullCrud('principle'),
  ...fullCrud('adr_principle'),
  'adr_applied:write', 'adr_applied:delete',
  ...fullCrud('gap'),
  ...fullCrud('organization_unit'),
  ...fullCrud('actor'),
  ...fullCrud('business_service'),
  ...fullCrud('business_function'),
  ...fullCrud('system'),
  'system_function:write', 'system_function:delete',
  ...fullCrud('integration_flow'),
  ...fullCrud('web_resource'),
  ...fullCrud('partner'),
  ...fullCrud('employee'),
  ...fullCrud('technology'),
  ...fullCrud('metamodel_relation'),
];

const REPOSITORY_ADMIN = [
  ...ARCHITECT,
  'references:write',
  'metamodel_catalog:write',
  'settings_parameters:read', 'settings_parameters:write',
  'service_operations:execute',
  'import:execute',
  'metamodel:rebuild',
  'users:read', 'users:write', 'users:delete', 'users:export',
  'roles:read', 'roles:assign', 'roles:write',
];

/** Полный каталог: роль «Администратор платформы» не должна терять доменные права при правках матрицы. */
const SYSTEM_ADMIN = [...ALL_PERMISSIONS];

const ROLE_PERMISSIONS = {
  VIEWER: unique(VIEWER),
  ARCHITECT: unique(ARCHITECT),
  REPOSITORY_ADMIN: unique(REPOSITORY_ADMIN),
  SYSTEM_ADMIN: unique(SYSTEM_ADMIN),
};

function unique(arr) {
  return [...new Set(arr)];
}

module.exports = {
  ROLES,
  ALL_PERMISSIONS,
  ROLE_PERMISSIONS,
};

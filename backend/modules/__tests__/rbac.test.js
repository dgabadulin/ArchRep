'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveRequiredPermissions } = require('../../auth/routePermissions');
const { ALL_PERMISSIONS, ROLE_PERMISSIONS } = require('../../auth/permissionsCatalog');

test('RBAC: GET /api/drawio-pro/manifest требует adr_applied:read или drawio_pro:manage', () => {
  const res = resolveRequiredPermissions('GET', '/api/drawio-pro/manifest', {});
  assert.deepEqual(res, { anyOf: ['adr_applied:read', 'drawio_pro:manage'] });
});

test('RBAC: POST /api/drawio-pro/{parse,validate,payload} требует adr_applied:write', () => {
  for (const action of ['parse', 'validate', 'payload']) {
    const res = resolveRequiredPermissions('POST', `/api/drawio-pro/${action}`, {});
    assert.deepEqual(res, { anyOf: ['adr_applied:write', 'drawio_pro:manage'] });
  }
});

test('RBAC: неизвестный маршрут модуля остаётся deny-by-default', () => {
  assert.equal(resolveRequiredPermissions('GET', '/api/unknown-module/x', {}), null);
});

test('RBAC: право drawio_pro:manage есть в каталоге и выдаётся архитекторам', () => {
  assert.ok(ALL_PERMISSIONS.includes('drawio_pro:manage'));
  assert.ok(ROLE_PERMISSIONS.ARCHITECT.includes('drawio_pro:manage'));
  assert.ok(ROLE_PERMISSIONS.REPOSITORY_ADMIN.includes('drawio_pro:manage'));
  assert.ok(!ROLE_PERMISSIONS.VIEWER.includes('drawio_pro:manage'));
});

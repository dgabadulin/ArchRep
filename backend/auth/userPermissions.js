'use strict';

const { ALL_PERMISSIONS } = require('./permissionsCatalog');

async function loadUserAuthContext(pool, userId) {
  const userRes = await pool.query(
    `SELECT id, login, email, display_name, is_active, must_change_password, auth_provider, last_login_at
     FROM archrep.ar_app_users WHERE id = $1`,
    [userId]
  );
  if (userRes.rows.length === 0) return null;
  const user = userRes.rows[0];
  if (!user.is_active) return null;

  const rolesRes = await pool.query(
    `SELECT r.code
     FROM archrep.ar_user_roles ur
     JOIN archrep.ar_roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1 AND r.is_active = true
     ORDER BY r.code`,
    [userId]
  );
  const roles = rolesRes.rows.map((r) => r.code);

  const permsRes = await pool.query(
    `SELECT DISTINCT p.code
     FROM archrep.ar_user_roles ur
     JOIN archrep.ar_role_permissions rp ON rp.role_id = ur.role_id
     JOIN archrep.ar_permissions p ON p.id = rp.permission_id
     JOIN archrep.ar_roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1 AND r.is_active = true AND p.is_active = true
     ORDER BY p.code`,
    [userId]
  );
  const permissions = permsRes.rows.map((r) => r.code);

  return {
    user: {
      id: user.id,
      login: user.login,
      email: user.email,
      display_name: user.display_name,
      must_change_password: user.must_change_password,
      auth_provider: user.auth_provider,
      last_login_at: user.last_login_at,
    },
    roles,
    permissions,
  };
}

function openAccessContext() {
  return {
    auth_enabled: false,
    user: {
      id: null,
      login: 'anonymous',
      email: null,
      display_name: 'Anonymous',
      must_change_password: false,
      auth_provider: 'open',
      last_login_at: null,
    },
    roles: ['OPEN_ACCESS'],
    permissions: [...ALL_PERMISSIONS],
  };
}

function hasAllPermissions(userPermissions, required) {
  const set = new Set(userPermissions || []);
  if (set.has('*')) return { ok: true, missing: [] };
  const requiredList = Array.isArray(required) ? required : [required];
  const missing = requiredList.filter((p) => !set.has(p));
  return { ok: missing.length === 0, missing, required: requiredList };
}

/** Достаточно одного из списка (lookup / срез карточки). */
function hasAnyPermission(userPermissions, anyOf) {
  const set = new Set(userPermissions || []);
  const requiredList = Array.isArray(anyOf) ? anyOf : [anyOf];
  if (set.has('*')) return { ok: true, missing: [], required: requiredList, mode: 'anyOf' };
  if (requiredList.some((p) => set.has(p))) {
    return { ok: true, missing: [], required: requiredList, mode: 'anyOf' };
  }
  return { ok: false, missing: requiredList, required: requiredList, mode: 'anyOf' };
}

module.exports = {
  loadUserAuthContext,
  openAccessContext,
  hasAllPermissions,
  hasAnyPermission,
};

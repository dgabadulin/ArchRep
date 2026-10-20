'use strict';

const { parseBoolEnv } = require('./authConfig');
const { hashPassword } = require('./password');
const { ROLES, ALL_PERMISSIONS, ROLE_PERMISSIONS } = require('./permissionsCatalog');

async function ensureRolesAndPermissions(pool) {
  for (const r of ROLES) {
    await pool.query(
      `INSERT INTO archrep.ar_roles (code, name, description, is_system, is_active)
       VALUES ($1, $2, $3, true, true)
       ON CONFLICT (code) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         is_system = true,
         is_active = true`,
      [r.code, r.name, r.description || null]
    );
  }
  for (const code of ALL_PERMISSIONS) {
    await pool.query(
      `INSERT INTO archrep.ar_permissions (code, description, is_active)
       VALUES ($1, NULL, true)
       ON CONFLICT (code) DO NOTHING`,
      [code]
    );
  }
  for (const [roleCode, perms] of Object.entries(ROLE_PERMISSIONS)) {
    // SYSTEM_ADMIN: всегда полный каталог (иначе Save схем/ADRA ломается после ручного edit роли в UI)
    if (roleCode === 'SYSTEM_ADMIN') {
      const roleRes = await pool.query(`SELECT id FROM archrep.ar_roles WHERE code = 'SYSTEM_ADMIN'`);
      if (roleRes.rows.length) {
        const roleId = roleRes.rows[0].id;
        await pool.query(`DELETE FROM archrep.ar_role_permissions WHERE role_id = $1`, [roleId]);
        for (const permCode of ALL_PERMISSIONS) {
          await pool.query(
            `INSERT INTO archrep.ar_role_permissions (role_id, permission_id)
             SELECT $1, p.id FROM archrep.ar_permissions p WHERE p.code = $2
             ON CONFLICT DO NOTHING`,
            [roleId, permCode]
          );
        }
      }
      continue;
    }
    for (const permCode of perms) {
      await pool.query(
        `INSERT INTO archrep.ar_role_permissions (role_id, permission_id)
         SELECT r.id, p.id
         FROM archrep.ar_roles r, archrep.ar_permissions p
         WHERE r.code = $1 AND p.code = $2
         ON CONFLICT DO NOTHING`,
        [roleCode, permCode]
      );
    }
  }
}

async function upsertBootstrapUser(pool, { login, password, displayName, mustChange, resetPasswords }) {
  if (!password) {
    console.log(`[auth bootstrap] skip ${login}: password env not set`);
    return;
  }
  const existing = await pool.query(
    `SELECT id, password_hash FROM archrep.ar_app_users WHERE login = $1`,
    [login]
  );

  if (existing.rows.length > 0) {
    const userId = existing.rows[0].id;
    // Уже есть: роли не трогаем (даже если SYSTEM_ADMIN сняли вручную).
    if (resetPasswords) {
      const hash = await hashPassword(password);
      await pool.query(
        `UPDATE archrep.ar_app_users
         SET password_hash = $1, must_change_password = $2, updated_at = now(), is_active = true
         WHERE id = $3`,
        [hash, mustChange, userId]
      );
      console.log(`[auth bootstrap] reset password for ${login} (roles unchanged)`);
    } else {
      console.log(`[auth bootstrap] user ${login} already exists — skip create/roles`);
    }
    return;
  }

  const roleRes = await pool.query(`SELECT id FROM archrep.ar_roles WHERE code = 'SYSTEM_ADMIN'`);
  if (roleRes.rows.length === 0) {
    console.warn(`[auth bootstrap] SYSTEM_ADMIN role missing, skip ${login}`);
    return;
  }
  const roleId = roleRes.rows[0].id;
  const hash = await hashPassword(password);
  const ins = await pool.query(
    `INSERT INTO archrep.ar_app_users
       (login, display_name, password_hash, auth_provider, is_active, must_change_password)
     VALUES ($1, $2, $3, 'local', true, $4)
     RETURNING id`,
    [login, displayName, hash, mustChange]
  );
  const userId = ins.rows[0].id;
  await pool.query(
    `INSERT INTO archrep.ar_user_roles (user_id, role_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [userId, roleId]
  );
  console.log(`[auth bootstrap] created user ${login} with SYSTEM_ADMIN`);
}

async function bootstrapAuth(pool) {
  try {
    const check = await pool.query(
      `SELECT to_regclass('archrep.ar_app_users') AS t`
    );
    if (!check.rows[0] || !check.rows[0].t) {
      console.warn('[auth bootstrap] tables missing — run RBAC migration first');
      return;
    }
    await ensureRolesAndPermissions(pool);

    const mustChange = parseBoolEnv(process.env.AUTH_BOOTSTRAP_MUST_CHANGE_PASSWORD, false);
    const resetPasswords = parseBoolEnv(process.env.AUTH_BOOTSTRAP_RESET_PASSWORDS, false);
    const demoPassword = process.env.AUTH_BOOTSTRAP_DEMO_PASSWORD;
    const aradminPassword = process.env.AUTH_BOOTSTRAP_ARADMIN_PASSWORD;

    await upsertBootstrapUser(pool, {
      login: 'demo',
      password: demoPassword,
      displayName: 'Demo',
      mustChange,
      resetPasswords,
    });
    await upsertBootstrapUser(pool, {
      login: 'aradmin',
      password: aradminPassword,
      displayName: 'AR Admin',
      mustChange,
      resetPasswords,
    });
  } catch (err) {
    console.error('[auth bootstrap] failed:', err.message);
  }
}

module.exports = { bootstrapAuth, ensureRolesAndPermissions };

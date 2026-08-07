'use strict';

const express = require('express');
const { hashPassword } = require('./password');
const { buildExcelBuffer } = require('../excelHelper');

function publicUser(row) {
  return {
    id: row.id,
    login: row.login,
    email: row.email,
    display_name: row.display_name,
    auth_provider: row.auth_provider,
    is_active: row.is_active,
    must_change_password: row.must_change_password,
    last_login_at: row.last_login_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    roles: row.roles || [],
  };
}

function createAdminRouter(pool) {
  const router = express.Router();

  router.get('/users', async (req, res) => {
    try {
      const excel = req.query.excel === '1' || req.query.excel === 'true';
      const r = await pool.query(
        `SELECT u.id, u.login, u.email, u.display_name, u.auth_provider, u.is_active,
                u.must_change_password, u.last_login_at, u.created_at, u.updated_at,
                COALESCE(
                  (SELECT array_agg(ro.code ORDER BY ro.code)
                   FROM archrep.ar_user_roles ur
                   JOIN archrep.ar_roles ro ON ro.id = ur.role_id
                   WHERE ur.user_id = u.id),
                  ARRAY[]::varchar[]
                ) AS roles
         FROM archrep.ar_app_users u
         ORDER BY u.login`
      );
      const rows = r.rows.map(publicUser);
      if (excel) {
        const flat = rows.map((u) => ({
          login: u.login,
          display_name: u.display_name,
          email: u.email || '',
          roles: (u.roles || []).join(', '),
          is_active: u.is_active ? 'Да' : 'Нет',
          must_change_password: u.must_change_password ? 'Да' : 'Нет',
          last_login_at: u.last_login_at || '',
          auth_provider: u.auth_provider || '',
        }));
        const buf = buildExcelBuffer(flat, 'Пользователи');
        res.setHeader('Content-Disposition', 'attachment; filename=app-users.xlsx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        return res.send(buf);
      }
      res.json(rows);
    } catch (err) {
      console.error('GET /api/admin/users', err);
      res.status(500).json({ error: 'Failed to list users' });
    }
  });

  router.get('/users/:id', async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT u.id, u.login, u.email, u.display_name, u.auth_provider, u.is_active,
                u.must_change_password, u.last_login_at, u.created_at, u.updated_at,
                COALESCE(
                  (SELECT array_agg(ro.code ORDER BY ro.code)
                   FROM archrep.ar_user_roles ur
                   JOIN archrep.ar_roles ro ON ro.id = ur.role_id
                   WHERE ur.user_id = u.id),
                  ARRAY[]::varchar[]
                ) AS roles
         FROM archrep.ar_app_users u
         WHERE u.id = $1`,
        [req.params.id]
      );
      if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      res.json(publicUser(r.rows[0]));
    } catch (err) {
      console.error('GET /api/admin/users/:id', err);
      res.status(500).json({ error: 'Failed' });
    }
  });

  router.post('/users', async (req, res) => {
    try {
      const b = req.body || {};
      const login = String(b.login || '').trim();
      const displayName = String(b.display_name || '').trim();
      const password = b.password != null ? String(b.password) : '';
      if (!login || !displayName || !password || password.length < 8) {
        return res.status(400).json({ error: 'login, display_name, password (min 8) required' });
      }
      const hash = await hashPassword(password);
      const createdBy = req.user && req.user.id ? req.user.id : null;
      const r = await pool.query(
        `INSERT INTO archrep.ar_app_users
           (login, email, display_name, password_hash, auth_provider, is_active, must_change_password, created_by_user_id)
         VALUES ($1, $2, $3, $4, 'local', COALESCE($5, true), COALESCE($6, false), $7)
         RETURNING id, login, email, display_name, auth_provider, is_active, must_change_password,
                   last_login_at, created_at, updated_at`,
        [
          login,
          b.email || null,
          displayName,
          hash,
          b.is_active,
          b.must_change_password,
          createdBy,
        ]
      );
      const user = publicUser({ ...r.rows[0], roles: [] });
      if (Array.isArray(b.roles) && b.roles.length) {
        await setUserRoles(pool, user.id, b.roles, createdBy);
        user.roles = b.roles;
      }
      res.status(201).json(user);
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'login or email already exists' });
      console.error('POST /api/admin/users', err);
      res.status(500).json({ error: 'Failed to create user' });
    }
  });

  router.put('/users/:id', async (req, res) => {
    try {
      const b = req.body || {};
      const id = Number(req.params.id);
      const fields = [];
      const params = [];
      let i = 1;
      if (b.email !== undefined) { fields.push(`email = $${i++}`); params.push(b.email || null); }
      if (b.display_name !== undefined) { fields.push(`display_name = $${i++}`); params.push(String(b.display_name).trim()); }
      if (b.is_active !== undefined) { fields.push(`is_active = $${i++}`); params.push(Boolean(b.is_active)); }
      if (b.must_change_password !== undefined) {
        fields.push(`must_change_password = $${i++}`);
        params.push(Boolean(b.must_change_password));
      }
      if (b.password) {
        if (String(b.password).length < 8) {
          return res.status(400).json({ error: 'password min 8' });
        }
        const hash = await hashPassword(String(b.password));
        fields.push(`password_hash = $${i++}`);
        params.push(hash);
      }
      if (fields.length) {
        fields.push('updated_at = now()');
        params.push(id);
        const r = await pool.query(
          `UPDATE archrep.ar_app_users SET ${fields.join(', ')} WHERE id = $${i}
           RETURNING id, login, email, display_name, auth_provider, is_active, must_change_password,
                     last_login_at, created_at, updated_at`,
          params
        );
        if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
      }
      if (Array.isArray(b.roles)) {
        await setUserRoles(pool, id, b.roles, req.user && req.user.id);
      }
      const get = await pool.query(
        `SELECT u.*, COALESCE(
           (SELECT array_agg(ro.code ORDER BY ro.code)
            FROM archrep.ar_user_roles ur
            JOIN archrep.ar_roles ro ON ro.id = ur.role_id
            WHERE ur.user_id = u.id),
           ARRAY[]::varchar[]
         ) AS roles
         FROM archrep.ar_app_users u WHERE u.id = $1`,
        [id]
      );
      if (get.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      res.json(publicUser(get.rows[0]));
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'login or email already exists' });
      console.error('PUT /api/admin/users/:id', err);
      res.status(500).json({ error: 'Failed to update user' });
    }
  });

  router.delete('/users/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (req.user && req.user.id === id) {
        return res.status(400).json({ error: 'Cannot delete yourself' });
      }
      const r = await pool.query(`DELETE FROM archrep.ar_app_users WHERE id = $1`, [id]);
      if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
      res.status(204).send();
    } catch (err) {
      console.error('DELETE /api/admin/users/:id', err);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  });

  router.put('/users/:id/roles', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const roles = (req.body && req.body.roles) || [];
      if (!Array.isArray(roles)) return res.status(400).json({ error: 'roles array required' });
      await setUserRoles(pool, id, roles, req.user && req.user.id);
      res.json({ ok: true, roles });
    } catch (err) {
      console.error('PUT /api/admin/users/:id/roles', err);
      res.status(500).json({ error: 'Failed to assign roles' });
    }
  });

  router.get('/permissions', async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT id, code, description, is_active
         FROM archrep.ar_permissions
         WHERE is_active = true
         ORDER BY code`
      );
      res.json(r.rows);
    } catch (err) {
      console.error('GET /api/admin/permissions', err);
      res.status(500).json({ error: 'Failed to list permissions' });
    }
  });

  router.get('/roles', async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT r.id, r.code, r.name, r.description, r.is_system, r.is_active,
                COALESCE(
                  (SELECT array_agg(p.code ORDER BY p.code)
                   FROM archrep.ar_role_permissions rp
                   JOIN archrep.ar_permissions p ON p.id = rp.permission_id
                   WHERE rp.role_id = r.id AND p.is_active = true),
                  ARRAY[]::varchar[]
                ) AS permissions
         FROM archrep.ar_roles r
         ORDER BY r.code`
      );
      res.json(r.rows);
    } catch (err) {
      console.error('GET /api/admin/roles', err);
      res.status(500).json({ error: 'Failed to list roles' });
    }
  });

  router.get('/roles/:id', async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT r.id, r.code, r.name, r.description, r.is_system, r.is_active,
                COALESCE(
                  (SELECT array_agg(p.code ORDER BY p.code)
                   FROM archrep.ar_role_permissions rp
                   JOIN archrep.ar_permissions p ON p.id = rp.permission_id
                   WHERE rp.role_id = r.id AND p.is_active = true),
                  ARRAY[]::varchar[]
                ) AS permissions
         FROM archrep.ar_roles r
         WHERE r.id = $1`,
        [req.params.id]
      );
      if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      res.json(r.rows[0]);
    } catch (err) {
      console.error('GET /api/admin/roles/:id', err);
      res.status(500).json({ error: 'Failed' });
    }
  });

  router.put('/roles/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const b = req.body || {};
      const name = b.name != null ? String(b.name).trim() : null;
      if (!name) return res.status(400).json({ error: 'name required' });
      const description = b.description !== undefined ? (b.description || null) : null;
      const r = await pool.query(
        `UPDATE archrep.ar_roles
         SET name = $1,
             description = $2,
             is_active = COALESCE($3, is_active)
         WHERE id = $4
         RETURNING id`,
        [name, description, b.is_active, id]
      );
      if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
      if (Array.isArray(b.permissions)) {
        await setRolePermissions(pool, id, b.permissions);
      }
      const full = await pool.query(
        `SELECT r.id, r.code, r.name, r.description, r.is_system, r.is_active,
                COALESCE(
                  (SELECT array_agg(p.code ORDER BY p.code)
                   FROM archrep.ar_role_permissions rp
                   JOIN archrep.ar_permissions p ON p.id = rp.permission_id
                   WHERE rp.role_id = r.id AND p.is_active = true),
                  ARRAY[]::varchar[]
                ) AS permissions
         FROM archrep.ar_roles r WHERE r.id = $1`,
        [id]
      );
      res.json(full.rows[0]);
    } catch (err) {
      console.error('PUT /api/admin/roles/:id', err);
      res.status(500).json({ error: 'Failed to update role' });
    }
  });

  router.put('/roles/:id/permissions', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const permissions = (req.body && req.body.permissions) || [];
      if (!Array.isArray(permissions)) {
        return res.status(400).json({ error: 'permissions array required' });
      }
      const exists = await pool.query(`SELECT id FROM archrep.ar_roles WHERE id = $1`, [id]);
      if (exists.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      await setRolePermissions(pool, id, permissions);
      res.json({ ok: true, permissions: [...new Set(permissions.map(String))] });
    } catch (err) {
      console.error('PUT /api/admin/roles/:id/permissions', err);
      res.status(500).json({ error: 'Failed to update role permissions' });
    }
  });

  return router;
}

async function setUserRoles(pool, userId, roleCodes, assignedBy) {
  const unique = [...new Set(roleCodes.map((c) => String(c).trim()).filter(Boolean))];
  await pool.query('BEGIN');
  try {
    await pool.query(`DELETE FROM archrep.ar_user_roles WHERE user_id = $1`, [userId]);
    for (const code of unique) {
      const rr = await pool.query(`SELECT id FROM archrep.ar_roles WHERE code = $1`, [code]);
      if (rr.rows.length === 0) continue;
      await pool.query(
        `INSERT INTO archrep.ar_user_roles (user_id, role_id, assigned_by_user_id)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [userId, rr.rows[0].id, assignedBy || null]
      );
    }
    await pool.query('COMMIT');
  } catch (e) {
    await pool.query('ROLLBACK');
    throw e;
  }
}

async function setRolePermissions(pool, roleId, permissionCodes) {
  const unique = [...new Set(permissionCodes.map((c) => String(c).trim()).filter(Boolean))];
  await pool.query('BEGIN');
  try {
    await pool.query(`DELETE FROM archrep.ar_role_permissions WHERE role_id = $1`, [roleId]);
    for (const code of unique) {
      const pr = await pool.query(
        `SELECT id FROM archrep.ar_permissions WHERE code = $1 AND is_active = true`,
        [code]
      );
      if (pr.rows.length === 0) continue;
      await pool.query(
        `INSERT INTO archrep.ar_role_permissions (role_id, permission_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [roleId, pr.rows[0].id]
      );
    }
    await pool.query('COMMIT');
  } catch (e) {
    await pool.query('ROLLBACK');
    throw e;
  }
}

module.exports = { createAdminRouter };

'use strict';

const express = require('express');
const { isAuthEnabled, assertAuthConfig } = require('./authConfig');
const { verifyPassword, hashPassword } = require('./password');
const { signJwt } = require('./jwt');
const { loadUserAuthContext, openAccessContext } = require('./userPermissions');

function createAuthRouter(pool) {
  const router = express.Router();

  router.post('/login', async (req, res) => {
    try {
      if (!isAuthEnabled()) {
        return res.status(400).json({ error: 'Auth disabled', message: 'AUTH_ENABLED is false' });
      }
      assertAuthConfig();
      const login = String((req.body && req.body.login) || '').trim();
      const password = (req.body && req.body.password) != null ? String(req.body.password) : '';
      if (!login || !password) {
        return res.status(400).json({ error: 'login and password required' });
      }

      const r = await pool.query(
        `SELECT id, login, display_name, password_hash, is_active
         FROM archrep.ar_app_users WHERE lower(login) = lower($1)`,
        [login]
      );
      if (r.rows.length === 0 || !r.rows[0].is_active) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      const row = r.rows[0];
      if (!row.password_hash || !(await verifyPassword(password, row.password_hash))) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const ctx = await loadUserAuthContext(pool, row.id);
      if (!ctx) return res.status(401).json({ error: 'Invalid credentials' });

      await pool.query(
        `UPDATE archrep.ar_app_users SET last_login_at = now(), updated_at = now() WHERE id = $1`,
        [row.id]
      );

      const token = signJwt({
        sub: String(row.id),
        login: ctx.user.login,
        display_name: ctx.user.display_name,
        roles: ctx.roles,
      });

      return res.json({
        access_token: token,
        token_type: 'Bearer',
        user: ctx.user,
        roles: ctx.roles,
        permissions: ctx.permissions,
      });
    } catch (err) {
      console.error('POST /api/auth/login', err);
      return res.status(500).json({ error: 'Login failed' });
    }
  });

  router.get('/me', async (req, res) => {
    try {
      if (!isAuthEnabled()) {
        return res.json(openAccessContext());
      }
      if (!req.auth || !req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      return res.json({
        auth_enabled: true,
        user: req.user,
        roles: req.roles || [],
        permissions: req.permissions || [],
      });
    } catch (err) {
      console.error('GET /api/auth/me', err);
      return res.status(500).json({ error: 'Failed' });
    }
  });

  router.post('/change-password', async (req, res) => {
    try {
      if (!isAuthEnabled()) {
        return res.status(400).json({ error: 'Auth disabled' });
      }
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const currentPassword = req.body && req.body.current_password != null
        ? String(req.body.current_password) : '';
      const newPassword = req.body && req.body.new_password != null
        ? String(req.body.new_password) : '';
      if (!currentPassword || !newPassword || newPassword.length < 8) {
        return res.status(400).json({ error: 'current_password and new_password (min 8) required' });
      }
      const r = await pool.query(
        `SELECT password_hash FROM archrep.ar_app_users WHERE id = $1`,
        [req.user.id]
      );
      if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      if (!(await verifyPassword(currentPassword, r.rows[0].password_hash))) {
        return res.status(401).json({ error: 'Invalid current password' });
      }
      const hash = await hashPassword(newPassword);
      await pool.query(
        `UPDATE archrep.ar_app_users
         SET password_hash = $1, must_change_password = false, updated_at = now()
         WHERE id = $2`,
        [hash, req.user.id]
      );
      return res.json({ ok: true });
    } catch (err) {
      console.error('POST /api/auth/change-password', err);
      return res.status(500).json({ error: 'Failed' });
    }
  });

  return router;
}

module.exports = { createAuthRouter };

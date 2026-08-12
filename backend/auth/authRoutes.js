'use strict';

const express = require('express');
const { isAuthEnabled, assertAuthConfig } = require('./authConfig');
const { verifyPassword, hashPassword } = require('./password');
const { signJwt } = require('./jwt');
const { loadUserAuthContext, openAccessContext } = require('./userPermissions');
const {
  assertKeycloakRuntimeConfig,
  getKeycloakAppPublicUrl,
} = require('./keycloakConfig');
const { beginAuthorization, finishAuthorization, takePendingState } = require('./oidcClient');
const { resolveUserFromOidcClaims } = require('./oidcUser');

/** Только относительный путь приложения (anti open-redirect). */
function safeAppRedirect(raw) {
  const s = raw == null ? '/' : String(raw);
  if (!s.startsWith('/') || s.startsWith('//')) return '/';
  return s;
}

function resolveFrontendBase(req) {
  const fromEnv = getKeycloakAppPublicUrl();
  if (fromEnv) return fromEnv;
  const origin = req.get('origin');
  if (origin && /^https?:\/\//i.test(origin)) return origin.replace(/\/+$/, '');
  const ref = req.get('referer');
  if (ref) {
    try {
      const u = new URL(ref);
      return `${u.protocol}//${u.host}`;
    } catch {
      /* ignore */
    }
  }
  const xfProto = (req.get('x-forwarded-proto') || req.protocol || 'http').split(',')[0].trim();
  const xfHost = (req.get('x-forwarded-host') || req.get('host') || '').split(',')[0].trim();
  if (xfHost) return `${xfProto}://${xfHost}`.replace(/\/+$/, '');
  return '';
}

function redirectToFrontend(res, req, pathAndQuery) {
  const base = resolveFrontendBase(req);
  const path = pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`;
  if (!base) {
    return res.status(500).json({
      error: 'KEYCLOAK_APP_PUBLIC_URL не задан и не удалось вывести URL фронта',
    });
  }
  return res.redirect(302, `${base}${path}`);
}

function createAuthRouter(pool) {
  const router = express.Router();

  router.get('/oidc/login', async (req, res) => {
    try {
      if (!isAuthEnabled()) {
        return res.status(400).json({ error: 'Auth disabled' });
      }
      assertAuthConfig();
      assertKeycloakRuntimeConfig();
      const redirect = safeAppRedirect(req.query.redirect);
      const promptRaw = req.query.prompt != null ? String(req.query.prompt).trim() : '';
      const prompt = promptRaw === 'none' ? 'none' : '';
      const authorizeUrl = await beginAuthorization({ redirect, prompt });
      return res.redirect(302, authorizeUrl);
    } catch (err) {
      console.error('GET /api/auth/oidc/login', err);
      const status = err.status || 500;
      if (req.accepts('html')) {
        return redirectToFrontend(
          res,
          req,
          `/login?sso_error=${encodeURIComponent(err.message || 'OIDC login failed')}`
        );
      }
      return res.status(status).json({ error: err.message || 'OIDC login failed' });
    }
  });

  router.get('/oidc/callback', async (req, res) => {
    let frontendRedirect = '/';
    try {
      if (!isAuthEnabled()) {
        return res.status(400).json({ error: 'Auth disabled' });
      }
      assertAuthConfig();
      assertKeycloakRuntimeConfig();

      const state = req.query.state != null ? String(req.query.state) : '';
      const errCode = req.query.error != null ? String(req.query.error) : '';
      if (errCode) {
        const pending = takePendingState(state);
        frontendRedirect = safeAppRedirect(pending && pending.redirect);
        const desc = req.query.error_description != null
          ? String(req.query.error_description)
          : errCode;
        if (errCode === 'login_required' || errCode === 'interaction_required' || errCode === 'consent_required') {
          return redirectToFrontend(
            res,
            req,
            `/login?sso_silent=failed&redirect=${encodeURIComponent(frontendRedirect)}`
          );
        }
        return redirectToFrontend(
          res,
          req,
          `/login?sso_error=${encodeURIComponent(desc)}&redirect=${encodeURIComponent(frontendRedirect)}`
        );
      }

      const code = req.query.code != null ? String(req.query.code) : '';
      if (!code || !state) {
        return redirectToFrontend(res, req, '/login?sso_error=missing_code_or_state');
      }

      const finished = await finishAuthorization({ code, state });
      const appRedirect = safeAppRedirect(finished.redirect);
      frontendRedirect = appRedirect;
      const userId = await resolveUserFromOidcClaims(pool, finished.claims);
      const ctx = await loadUserAuthContext(pool, userId);
      if (!ctx) {
        return redirectToFrontend(res, req, '/login?sso_error=user_inactive');
      }

      const token = signJwt({
        sub: String(userId),
        login: ctx.user.login,
        display_name: ctx.user.display_name,
        roles: ctx.roles,
      });

      // token в hash — не уходит на сервер при последующих запросах
      const hash = new URLSearchParams({
        access_token: token,
        redirect: appRedirect,
      }).toString();
      return redirectToFrontend(res, req, `/login/oidc-callback#${hash}`);
    } catch (err) {
      console.error('GET /api/auth/oidc/callback', err);
      const msg = err.message || 'OIDC callback failed';
      return redirectToFrontend(
        res,
        req,
        `/login?sso_error=${encodeURIComponent(msg)}&redirect=${encodeURIComponent(frontendRedirect)}`
      );
    }
  });

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
      if (req.user.auth_provider === 'keycloak') {
        return res.status(400).json({
          error: 'Смена пароля недоступна для пользователей SSO',
          message: 'Смена пароля недоступна для пользователей SSO',
        });
      }
      const currentPassword = req.body && req.body.current_password != null
        ? String(req.body.current_password) : '';
      const newPassword = req.body && req.body.new_password != null
        ? String(req.body.new_password) : '';
      if (!currentPassword || !newPassword || newPassword.length < 8) {
        return res.status(400).json({ error: 'current_password and new_password (min 8) required' });
      }
      const r = await pool.query(
        `SELECT password_hash, auth_provider FROM archrep.ar_app_users WHERE id = $1`,
        [req.user.id]
      );
      if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      if (r.rows[0].auth_provider === 'keycloak' || !r.rows[0].password_hash) {
        return res.status(400).json({
          error: 'Смена пароля недоступна для пользователей SSO',
          message: 'Смена пароля недоступна для пользователей SSO',
        });
      }
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

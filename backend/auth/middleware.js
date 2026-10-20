'use strict';

const { isAuthEnabled } = require('./authConfig');
const { verifyJwt } = require('./jwt');
const {
  loadUserAuthContext,
  openAccessContext,
  hasAllPermissions,
  hasAnyPermission,
} = require('./userPermissions');
const { isPublicPath, resolveRequiredPermissions } = require('./routePermissions');

function formatForbiddenRu(required, missing, mode) {
  const codes = (Array.isArray(missing) && missing.length)
    ? missing
    : (Array.isArray(required) ? required : []);
  const clean = codes.filter((c) => c && !String(c).startsWith('<'));
  if (mode === 'anyOf' && clean.length) {
    return `Недостаточно привилегий. Требуется одно из разрешений: ${clean.join(', ')}. Обратитесь к администратору.`;
  }
  if (clean.length === 1) {
    return `Недостаточно привилегий. Требуемое разрешение: ${clean[0]}. Обратитесь к администратору.`;
  }
  if (clean.length > 1) {
    return `Недостаточно привилегий. Требуемые разрешения: ${clean.join(', ')}. Обратитесь к администратору.`;
  }
  return 'Недостаточно привилегий. Обратитесь к администратору.';
}

function sendForbidden(res, required, missing, mode) {
  const message = formatForbiddenRu(required, missing, mode);
  return res.status(403).json({
    error: message,
    message,
    required_permissions: required,
    missing_permissions: missing,
    ...(mode === 'anyOf' ? { required_mode: 'anyOf' } : {}),
  });
}

function createAuthMiddleware(pool) {
  return async function authMiddleware(req, res, next) {
    try {
      if (!req.path.startsWith('/api')) return next();

      const authOn = isAuthEnabled();
      req.authEnabled = authOn;

      if (!authOn) {
        req.auth = openAccessContext();
        req.user = req.auth.user;
        req.permissions = req.auth.permissions;
        req.roles = req.auth.roles;
        return next();
      }

      if (isPublicPath(req.path)) {
        return next();
      }

      const header = req.headers.authorization || '';
      const m = /^Bearer\s+(.+)$/i.exec(header);
      if (!m) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Bearer token required' });
      }
      const payload = verifyJwt(m[1]);
      if (!payload || payload.sub == null) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
      }

      const ctx = await loadUserAuthContext(pool, Number(payload.sub));
      if (!ctx) {
        return res.status(401).json({ error: 'Unauthorized', message: 'User inactive or not found' });
      }

      req.auth = { auth_enabled: true, ...ctx };
      req.user = ctx.user;
      req.permissions = ctx.permissions;
      req.roles = ctx.roles;

      const required = resolveRequiredPermissions(req.method, req.path, req.query || {});
      if (required === null) {
        return sendForbidden(res, ['<mapped-route>'], ['<no-permission-mapping>']);
      }
      if (Array.isArray(required) && required.length === 0) {
        return next();
      }

      if (required && required.anyOf) {
        const result = hasAnyPermission(req.permissions, required.anyOf);
        if (!result.ok) {
          return sendForbidden(res, result.required, result.missing, 'anyOf');
        }
        return next();
      }

      // import apply: also require resource write when entity_type known
      let checkList = Array.isArray(required) ? required : [];
      if (
        req.method === 'POST' &&
        req.path === '/api/import/apply' &&
        req.body &&
        req.body.entity_type
      ) {
        const writePerm = `${String(req.body.entity_type)}:write`;
        checkList = [...new Set([...checkList, writePerm])];
      }

      const result = hasAllPermissions(req.permissions, checkList);
      if (!result.ok) {
        return sendForbidden(res, result.required, result.missing);
      }
      return next();
    } catch (err) {
      console.error('authMiddleware', err);
      return res.status(500).json({ error: 'Auth error' });
    }
  };
}

function requirePermission(...codes) {
  return (req, res, next) => {
    if (!isAuthEnabled()) return next();
    const result = hasAllPermissions(req.permissions || [], codes);
    if (!result.ok) return sendForbidden(res, result.required, result.missing);
    return next();
  };
}

module.exports = {
  createAuthMiddleware,
  requirePermission,
  sendForbidden,
};

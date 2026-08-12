'use strict';

/**
 * Связка / JIT пользователя после успешного OIDC.
 * Роли при JIT: только VIEWER. Повторный вход роли не меняет.
 */

function pickLogin(claims) {
  const preferred = String(claims.preferred_username || '').trim();
  if (preferred) return preferred.slice(0, 100);
  const email = String(claims.email || '').trim();
  if (email) return email.slice(0, 100);
  const sub = String(claims.sub || '').trim();
  return (`kc_${sub}`).slice(0, 100);
}

function pickDisplayName(claims, login) {
  const name = String(claims.name || '').trim();
  if (name) return name.slice(0, 255);
  const gn = String(claims.given_name || '').trim();
  const fn = String(claims.family_name || '').trim();
  const full = `${gn} ${fn}`.trim();
  if (full) return full.slice(0, 255);
  return login.slice(0, 255);
}

/**
 * @param {import('pg').Pool} pool
 * @param {Record<string, any>} claims
 * @returns {Promise<number>} user id
 */
async function resolveUserFromOidcClaims(pool, claims) {
  const sub = String(claims.sub || '').trim();
  if (!sub) {
    throw Object.assign(new Error('В ID Token нет sub'), { status: 401 });
  }
  const emailRaw = claims.email != null ? String(claims.email).trim() : '';
  const email = emailRaw ? emailRaw.slice(0, 255) : null;
  const login = pickLogin(claims);
  const displayName = pickDisplayName(claims, login);

  const bySub = await pool.query(
    `SELECT id FROM archrep.ar_app_users WHERE keycloak_sub = $1`,
    [sub]
  );
  if (bySub.rows.length) {
    const id = bySub.rows[0].id;
    await pool.query(
      `UPDATE archrep.ar_app_users SET
         display_name = COALESCE(NULLIF($2,''), display_name),
         email = COALESCE($3, email),
         auth_provider = CASE WHEN auth_provider = 'local' THEN 'hybrid' ELSE auth_provider END,
         last_login_at = now(),
         updated_at = now(),
         is_active = true
       WHERE id = $1`,
      [id, displayName, email]
    );
    return id;
  }

  if (email) {
    const byEmail = await pool.query(
      `SELECT id, keycloak_sub FROM archrep.ar_app_users WHERE lower(email) = lower($1)`,
      [email]
    );
    if (byEmail.rows.length) {
      const row = byEmail.rows[0];
      if (row.keycloak_sub && row.keycloak_sub !== sub) {
        throw Object.assign(
          new Error('Email уже привязан к другому keycloak_sub. Обратитесь к администратору.'),
          { status: 409 }
        );
      }
      await pool.query(
        `UPDATE archrep.ar_app_users SET
           keycloak_sub = $2,
           display_name = COALESCE(NULLIF($3,''), display_name),
           auth_provider = CASE WHEN auth_provider = 'local' THEN 'hybrid' ELSE 'keycloak' END,
           last_login_at = now(),
           updated_at = now(),
           is_active = true
         WHERE id = $1`,
        [row.id, sub, displayName]
      );
      return row.id;
    }
  }

  // JIT
  const roleRes = await pool.query(`SELECT id FROM archrep.ar_roles WHERE code = 'VIEWER' AND is_active = true`);
  if (!roleRes.rows.length) {
    throw Object.assign(new Error('Роль VIEWER не найдена в БД'), { status: 500 });
  }

  let finalLogin = login;
  const loginClash = await pool.query(
    `SELECT id FROM archrep.ar_app_users WHERE lower(login) = lower($1)`,
    [finalLogin]
  );
  if (loginClash.rows.length) {
    finalLogin = (`${login}_${sub.slice(0, 8)}`).slice(0, 100);
  }

  const ins = await pool.query(
    `INSERT INTO archrep.ar_app_users
       (login, email, display_name, password_hash, auth_provider, keycloak_sub, is_active, must_change_password)
     VALUES ($1, $2, $3, NULL, 'keycloak', $4, true, false)
     RETURNING id`,
    [finalLogin, email, displayName, sub]
  );
  const userId = ins.rows[0].id;
  await pool.query(
    `INSERT INTO archrep.ar_user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [userId, roleRes.rows[0].id]
  );
  await pool.query(
    `UPDATE archrep.ar_app_users SET last_login_at = now(), updated_at = now() WHERE id = $1`,
    [userId]
  );
  return userId;
}

module.exports = { resolveUserFromOidcClaims, pickLogin, pickDisplayName };

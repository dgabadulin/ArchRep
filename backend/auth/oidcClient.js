'use strict';

const crypto = require('crypto');
const { requestJson } = require('./httpJson');
const {
  getKeycloakIssuer,
  getDiscoveryUrl,
  getKeycloakClientId,
  getKeycloakClientSecret,
  getKeycloakRedirectUri,
} = require('./keycloakConfig');

function assertAudience(claims) {
  const clientId = getKeycloakClientId();
  if (!clientId || !claims || claims.aud == null) return;
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.map(String).includes(clientId)) {
    throw Object.assign(new Error('ID Token aud не совпадает с KEYCLOAK_CLIENT_ID'), { status: 401 });
  }
}

/** @type {{ fetchedAt: number, doc: any } | null} */
let discoveryCache = null;
const DISCOVERY_TTL_MS = 10 * 60 * 1000;

/** state → { codeVerifier, nonce, redirect, prompt, createdAt } */
const pendingStates = new Map();
const STATE_TTL_MS = 10 * 60 * 1000;

function b64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function randomString(bytes = 32) {
  return b64url(crypto.randomBytes(bytes));
}

function pkceChallenge(verifier) {
  return b64url(crypto.createHash('sha256').update(verifier).digest());
}

function purgeExpiredStates() {
  const now = Date.now();
  for (const [k, v] of pendingStates.entries()) {
    if (!v || now - v.createdAt > STATE_TTL_MS) pendingStates.delete(k);
  }
}

async function loadDiscovery(force = false) {
  const now = Date.now();
  if (!force && discoveryCache && now - discoveryCache.fetchedAt < DISCOVERY_TTL_MS) {
    return discoveryCache.doc;
  }
  const url = getDiscoveryUrl();
  if (!url) throw Object.assign(new Error('Issuer/discovery URL пуст'), { status: 500 });
  const res = await requestJson('GET', url);
  if (res.status < 200 || res.status >= 300 || !res.json) {
    throw Object.assign(
      new Error(`OIDC discovery failed HTTP ${res.status}`),
      { status: 502, body: res.text }
    );
  }
  discoveryCache = { fetchedAt: now, doc: res.json };
  return res.json;
}

function decodeJwtPayload(jwt) {
  if (!jwt || typeof jwt !== 'string') return null;
  const parts = jwt.split('.');
  if (parts.length < 2) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    return JSON.parse(Buffer.from(b64 + pad, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

/**
 * @param {{ redirect?: string, prompt?: string }} opts
 * @returns {Promise<string>} authorize URL
 */
async function beginAuthorization({ redirect = '/', prompt } = {}) {
  purgeExpiredStates();
  const disc = await loadDiscovery();
  const authEndpoint = disc.authorization_endpoint;
  if (!authEndpoint) throw Object.assign(new Error('authorization_endpoint missing'), { status: 502 });

  const state = randomString(24);
  const nonce = randomString(24);
  const codeVerifier = randomString(48);
  const codeChallenge = pkceChallenge(codeVerifier);
  pendingStates.set(state, {
    codeVerifier,
    nonce,
    redirect: redirect || '/',
    prompt: prompt || '',
    createdAt: Date.now(),
  });

  const u = new URL(authEndpoint);
  u.searchParams.set('client_id', getKeycloakClientId());
  u.searchParams.set('redirect_uri', getKeycloakRedirectUri());
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', 'openid profile email');
  u.searchParams.set('state', state);
  u.searchParams.set('nonce', nonce);
  u.searchParams.set('code_challenge', codeChallenge);
  u.searchParams.set('code_challenge_method', 'S256');
  if (prompt) u.searchParams.set('prompt', prompt);
  return u.toString();
}

/** Забрать pending по state (для error=login_required без token exchange). */
function takePendingState(state) {
  purgeExpiredStates();
  if (!state) return null;
  const pending = pendingStates.get(state);
  pendingStates.delete(state);
  return pending || null;
}

/**
 * @param {{ code: string, state: string }}
 */
async function finishAuthorization({ code, state }) {
  const pending = takePendingState(state);
  if (!pending) {
    throw Object.assign(new Error('Недействительный или просроченный state OIDC'), { status: 400 });
  }
  const disc = await loadDiscovery();
  const tokenEndpoint = disc.token_endpoint;
  if (!tokenEndpoint) throw Object.assign(new Error('token_endpoint missing'), { status: 502 });

  const res = await requestJson('POST', tokenEndpoint, {
    form: {
      grant_type: 'authorization_code',
      code,
      redirect_uri: getKeycloakRedirectUri(),
      client_id: getKeycloakClientId(),
      client_secret: getKeycloakClientSecret(),
      code_verifier: pending.codeVerifier,
    },
  });
  if (res.status < 200 || res.status >= 300 || !res.json || !res.json.id_token) {
    const msg = (res.json && (res.json.error_description || res.json.error)) || res.text || 'token exchange failed';
    throw Object.assign(new Error(String(msg)), { status: 401, oidc: res.json });
  }

  let claims = decodeJwtPayload(res.json.id_token) || {};
  if ((!claims.email || !claims.preferred_username) && res.json.access_token && disc.userinfo_endpoint) {
    try {
      const ui = await requestJson('GET', disc.userinfo_endpoint, {
        headers: { Authorization: `Bearer ${res.json.access_token}` },
      });
      if (ui.status >= 200 && ui.status < 300 && ui.json && typeof ui.json === 'object') {
        claims = { ...ui.json, ...claims };
      }
    } catch (e) {
      console.warn('OIDC userinfo failed:', e.message);
    }
  }

  const issuer = getKeycloakIssuer();
  if (claims.iss && issuer && String(claims.iss).replace(/\/+$/, '') !== issuer) {
    throw Object.assign(new Error('ID Token iss не совпадает с KEYCLOAK_ISSUER'), { status: 401 });
  }
  if (pending.nonce && claims.nonce && claims.nonce !== pending.nonce) {
    throw Object.assign(new Error('ID Token nonce mismatch'), { status: 401 });
  }
  assertAudience(claims);

  return {
    claims,
    redirect: pending.redirect || '/',
    prompt: pending.prompt || '',
  };
}

module.exports = {
  loadDiscovery,
  beginAuthorization,
  finishAuthorization,
  takePendingState,
  decodeJwtPayload,
};

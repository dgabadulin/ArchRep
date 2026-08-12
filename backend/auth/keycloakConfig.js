'use strict';

const { getParam } = require('../settingsParams');
const { parseBoolEnv } = require('./authConfig');

function envTrim(name) {
  const v = process.env[name];
  if (v == null || String(v).trim() === '') return '';
  return String(v).trim();
}

/** env > параметр БД > default */
function envOrParam(envName, paramCode, defaultValue = '') {
  const fromEnv = envTrim(envName);
  if (fromEnv) return fromEnv;
  const fromDb = getParam(paramCode, undefined);
  if (fromDb != null && String(fromDb).trim() !== '') return String(fromDb).trim();
  return defaultValue;
}

function isKeycloakEnabled() {
  const fromEnv = process.env.KEYCLOAK_ENABLED;
  if (fromEnv !== undefined && fromEnv !== null && String(fromEnv).trim() !== '') {
    return parseBoolEnv(fromEnv, false);
  }
  const fromDb = getParam('SEC_KEYCLOAK_ENABLED', false);
  if (typeof fromDb === 'boolean') return fromDb;
  return parseBoolEnv(fromDb, false);
}

function getKeycloakLoginMode() {
  const mode = String(envOrParam('KEYCLOAK_LOGIN_MODE', 'SEC_KEYCLOAK_LOGIN_MODE', 'button')).toLowerCase();
  if (mode === 'auto' || mode === 'silent' || mode === 'button') return mode;
  return 'button';
}

function getKeycloakIssuer() {
  return envOrParam('KEYCLOAK_ISSUER', 'SEC_KEYCLOAK_ISSUER', '').replace(/\/+$/, '');
}

function getKeycloakClientId() {
  return envTrim('KEYCLOAK_CLIENT_ID');
}

function getKeycloakClientSecret() {
  return envTrim('KEYCLOAK_CLIENT_SECRET');
}

/** Куда вернуть браузер после успешного OIDC (фронт). */
function getKeycloakAppPublicUrl() {
  return envTrim('KEYCLOAK_APP_PUBLIC_URL').replace(/\/+$/, '');
}

/**
 * Callback API для KC Valid Redirect URI.
 * Явный KEYCLOAK_REDIRECT_URI; иначе {KEYCLOAK_APP_PUBLIC_URL}/api/auth/oidc/callback.
 */
function getKeycloakRedirectUri() {
  const explicit = envTrim('KEYCLOAK_REDIRECT_URI');
  if (explicit) return explicit;
  const base = getKeycloakAppPublicUrl();
  if (!base) return '';
  return `${base}/api/auth/oidc/callback`;
}

function getDiscoveryUrl(issuer) {
  const base = (issuer || getKeycloakIssuer()).replace(/\/+$/, '');
  if (!base) return '';
  return `${base}/.well-known/openid-configuration`;
}

function assertKeycloakRuntimeConfig() {
  if (!isKeycloakEnabled()) {
    const err = new Error('Keycloak SSO выключен (SEC_KEYCLOAK_ENABLED / KEYCLOAK_ENABLED)');
    err.status = 400;
    throw err;
  }
  if (!getKeycloakIssuer()) {
    const err = new Error('Не задан KEYCLOAK_ISSUER / SEC_KEYCLOAK_ISSUER');
    err.status = 500;
    throw err;
  }
  if (!getKeycloakClientId() || !getKeycloakClientSecret()) {
    const err = new Error('Нужны KEYCLOAK_CLIENT_ID и KEYCLOAK_CLIENT_SECRET в env');
    err.status = 500;
    throw err;
  }
  if (!getKeycloakRedirectUri()) {
    const err = new Error(
      'Не задан KEYCLOAK_REDIRECT_URI (или KEYCLOAK_APP_PUBLIC_URL для сборки …/api/auth/oidc/callback) в env контейнера'
    );
    err.status = 500;
    throw err;
  }
}

function publicKeycloakFlags() {
  return {
    keycloak_enabled: isKeycloakEnabled(),
    keycloak_login_mode: getKeycloakLoginMode(),
  };
}

module.exports = {
  isKeycloakEnabled,
  getKeycloakLoginMode,
  getKeycloakIssuer,
  getKeycloakClientId,
  getKeycloakClientSecret,
  getKeycloakRedirectUri,
  getKeycloakAppPublicUrl,
  getDiscoveryUrl,
  assertKeycloakRuntimeConfig,
  publicKeycloakFlags,
};

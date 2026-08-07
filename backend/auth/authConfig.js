'use strict';

function parseBoolEnv(raw, defaultValue) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return defaultValue;
  const v = String(raw).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return defaultValue;
}

function isAuthEnabled() {
  return parseBoolEnv(process.env.AUTH_ENABLED, false);
}

function getJwtSecret() {
  return String(process.env.JWT_SECRET || '').trim();
}

function getJwtExpiresSec() {
  const n = Number(process.env.JWT_EXPIRES_SEC);
  return Number.isFinite(n) && n > 0 ? n : 8 * 60 * 60;
}

function assertAuthConfig() {
  if (!isAuthEnabled()) return;
  if (!getJwtSecret()) {
    throw new Error('AUTH_ENABLED=true требует JWT_SECRET в env');
  }
}

module.exports = {
  parseBoolEnv,
  isAuthEnabled,
  getJwtSecret,
  getJwtExpiresSec,
  assertAuthConfig,
};

'use strict';

const crypto = require('crypto');
const { getJwtSecret, getJwtExpiresSec } = require('./authConfig');

function b64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function b64urlJson(obj) {
  return b64url(JSON.stringify(obj));
}

function signJwt(payload, options = {}) {
  const secret = options.secret || getJwtSecret();
  if (!secret) throw new Error('JWT_SECRET is empty');
  const expiresSec = options.expiresSec != null ? options.expiresSec : getJwtExpiresSec();
  const now = Math.floor(Date.now() / 1000);
  const body = {
    iss: 'isar-local',
    iat: now,
    exp: now + expiresSec,
    ...payload,
  };
  const header = b64urlJson({ alg: 'HS256', typ: 'JWT' });
  const mid = b64urlJson(body);
  const data = `${header}.${mid}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest();
  return `${data}.${b64url(sig)}`;
}

function verifyJwt(token, options = {}) {
  const secret = options.secret || getJwtSecret();
  if (!secret || !token) return null;
  const parts = String(token).split('.');
  if (parts.length !== 3) return null;
  const [header, mid, sig] = parts;
  const data = `${header}.${mid}`;
  const expected = b64url(crypto.createHmac('sha256', secret).update(data).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try {
    const b64 = mid.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    payload = JSON.parse(Buffer.from(b64 + pad, 'base64').toString('utf8'));
  } catch {
    return null;
  }
  if (!payload || typeof payload !== 'object') return null;
  if (payload.exp != null && Number(payload.exp) < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

module.exports = { signJwt, verifyJwt };

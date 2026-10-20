'use strict';

const https = require('https');
const http = require('http');
const { URL } = require('url');

/**
 * Minimal GET/POST JSON without fetch (совместимо с Node 16+).
 * @returns {Promise<{ status: number, json: any, text: string }>}
 */
function requestJson(method, urlStr, { headers = {}, body = null, form = null } = {}) {
  return new Promise((resolve, reject) => {
    let u;
    try {
      u = new URL(urlStr);
    } catch (e) {
      reject(e);
      return;
    }
    const lib = u.protocol === 'http:' ? http : https;
    let payload = null;
    const hdrs = { Accept: 'application/json', ...headers };
    if (form && typeof form === 'object') {
      payload = new URLSearchParams(form).toString();
      hdrs['Content-Type'] = 'application/x-www-form-urlencoded';
      hdrs['Content-Length'] = Buffer.byteLength(payload);
    } else if (body != null) {
      payload = typeof body === 'string' ? body : JSON.stringify(body);
      hdrs['Content-Type'] = 'application/json';
      hdrs['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = lib.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || (u.protocol === 'http:' ? 80 : 443),
        path: u.pathname + u.search,
        method,
        headers: hdrs,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = text ? JSON.parse(text) : null;
          } catch {
            json = null;
          }
          resolve({ status: res.statusCode || 0, json, text });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

module.exports = { requestJson };

'use strict';

/**
 * HTTP-клиент Netbox для синхронизации каталога инфраструктуры.
 * Токен передаётся ТОЛЬКО через переменную окружения NETBOX_TOKEN и не сохраняется в БД.
 * Базовый URL и флаги — параметры ar_settings_parameters (см. docs/infrastructure-registry-netbox.md).
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const { getParam } = require('./settingsParams');

/** Коды типов (ar_infrastructure_object_types.code) → путь API Netbox. */
const KIND_ENDPOINTS = {
  virtual_server: '/api/virtualization/virtual-machines/',
  physical_server: '/api/dcim/devices/',
};

/** Страховка от бесконечной пагинации. */
const MAX_PAGES = 500;

function envTrim(name) {
  const v = process.env[name];
  return v == null ? '' : String(v).trim();
}

function parseBool(value, defaultValue) {
  if (value == null || value === '') return defaultValue;
  if (typeof value === 'boolean') return value;
  const s = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(s)) return true;
  if (['false', '0', 'no', 'off'].includes(s)) return false;
  return defaultValue;
}

/**
 * Конфигурация синхронизации. Ошибки конфигурации — с status 400, чтобы сообщение
 * попало в историю задания без stack trace.
 */
function loadNetboxConfig() {
  const baseUrl = String(getParam('NETBOX_URL', '') || envTrim('NETBOX_URL') || '')
    .trim()
    .replace(/\/+$/, '');
  const token = envTrim('NETBOX_TOKEN');
  const missing = [];
  if (!baseUrl) missing.push('NETBOX_URL (параметр)');
  if (!token) missing.push('NETBOX_TOKEN (переменная окружения)');
  if (missing.length) {
    const err = new Error(`Netbox не настроен: не задано ${missing.join(', ')}`);
    err.status = 400;
    throw err;
  }

  return {
    baseUrl,
    token,
    tagPrefix: String(getParam('NETBOX_TAG_PREFIX', 'IS:') || 'IS:').trim(),
    includeVms: parseBool(getParam('NETBOX_INCLUDE_VMS', true), true),
    includeDevices: parseBool(getParam('NETBOX_INCLUDE_DEVICES', true), true),
    pageSize: Math.max(1, Math.min(Number(getParam('NETBOX_PAGE_SIZE', 100)) || 100, 1000)),
    verifyTls: parseBool(getParam('NETBOX_VERIFY_TLS', true), true),
    timeoutMs: Math.max(1000, Number(getParam('NETBOX_REQUEST_TIMEOUT_MS', 30000)) || 30000),
  };
}

/** Список видов, включённых в синхронизацию (в порядке обработки). */
function enabledKinds(cfg) {
  const kinds = [];
  if (cfg.includeVms) kinds.push('virtual_server');
  if (cfg.includeDevices) kinds.push('physical_server');
  return kinds;
}

/**
 * GET JSON с таймаутом, проверкой TLS и ручным следованием redirect (Netbox часто
 * перенаправляет http→https или добавляет слэш).
 * @param {URL} url
 * @param {ReturnType<typeof loadNetboxConfig>} cfg
 */
function requestJson(url, cfg, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'http:' ? http : https;
    const options = {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Token ${cfg.token}`,
        'User-Agent': 'ISAR-ArchRep/1.0',
      },
    };
    if (url.protocol === 'https:') options.rejectUnauthorized = cfg.verifyTls;

    const req = transport.request(url, options, (res) => {
      const status = res.statusCode || 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        if (redirectsLeft <= 0) {
          reject(new Error(`Netbox: слишком много redirect для ${url.pathname}`));
          return;
        }
        let next;
        try {
          next = new URL(res.headers.location, url);
        } catch (e) {
          reject(new Error(`Netbox: некорректный redirect ${res.headers.location}`));
          return;
        }
        resolve(requestJson(next, cfg, redirectsLeft - 1));
        return;
      }

      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
        if (body.length > 50 * 1024 * 1024) {
          req.destroy(new Error('Netbox: ответ больше 50 МБ'));
        }
      });
      res.on('end', () => {
        if (status < 200 || status >= 300) {
          const snippet = body.replace(/\s+/g, ' ').slice(0, 300);
          const err = new Error(
            `Netbox ${status} ${url.pathname}${url.search}: ${snippet || res.statusMessage || 'ошибка'}`,
          );
          err.status = status === 401 || status === 403 ? 502 : 502;
          reject(err);
          return;
        }
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (e) {
          reject(new Error(`Netbox: некорректный JSON в ${url.pathname}`));
        }
      });
    });

    req.setTimeout(cfg.timeoutMs, () => {
      req.destroy(new Error(`Netbox: таймаут ${cfg.timeoutMs} мс (${url.pathname})`));
    });
    req.on('error', reject);
    req.end();
  });
}

/**
 * Прочитать все страницы объектов вида.
 * @param {'virtual_server'|'physical_server'} kindCode
 * @param {ReturnType<typeof loadNetboxConfig>} cfg
 * @returns {Promise<object[]>}
 */
async function fetchNetboxObjects(kindCode, cfg) {
  const endpoint = KIND_ENDPOINTS[kindCode];
  if (!endpoint) throw new Error(`Неизвестный вид объекта инфраструктуры: ${kindCode}`);

  let next = new URL(endpoint, cfg.baseUrl);
  next.searchParams.set('limit', String(cfg.pageSize));
  const items = [];
  let pages = 0;

  while (next) {
    pages += 1;
    if (pages > MAX_PAGES) {
      throw new Error(`Netbox: превышено ${MAX_PAGES} страниц для ${kindCode}`);
    }
    const data = await requestJson(next, cfg);
    const results = Array.isArray(data)
      ? data
      : Array.isArray(data && data.results)
        ? data.results
        : [];
    items.push(...results);
    next = data && data.next ? new URL(String(data.next), cfg.baseUrl) : null;
  }

  return items;
}

/**
 * Коды систем из тегов Netbox: имя тега `IS:<КОД>` (регистр не важен), префикс — параметр.
 * Slug не используется: он производный (`isadab`) и не позволяет восстановить код.
 * @param {Array<{name?:string}|string>} tags
 * @param {string} prefix
 * @returns {string[]} уникальные коды в исходном написании
 */
function parseSystemCodes(tags, prefix) {
  const p = String(prefix || 'IS:').trim().toUpperCase();
  if (!p) return [];
  const out = new Map();
  for (const tag of Array.isArray(tags) ? tags : []) {
    const name = typeof tag === 'string' ? tag : tag && tag.name;
    if (name == null) continue;
    const text = String(name).trim();
    if (!text || !text.toUpperCase().startsWith(p)) continue;
    const code = text.slice(p.length).trim();
    if (!code) continue;
    const key = code.toLowerCase();
    if (!out.has(key)) out.set(key, code);
  }
  return [...out.values()];
}

function stripIpMask(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  const slash = s.indexOf('/');
  return slash > 0 ? s.slice(0, slash) : s;
}

function firstIp(obj) {
  const source = obj || {};
  for (const candidate of [source.primary_ip4, source.primary_ip, source.primary_ip6]) {
    if (!candidate) continue;
    if (typeof candidate === 'string') return stripIpMask(candidate);
    if (candidate.address) return stripIpMask(candidate.address);
  }
  return null;
}

function refName(ref) {
  if (ref == null) return '';
  if (typeof ref === 'string') return ref.trim();
  return String(ref.name || ref.label || ref.value || '').trim();
}

function statusLabel(status) {
  if (status == null) return '';
  if (typeof status === 'string') return status.trim();
  return String(status.label || status.value || '').trim();
}

/**
 * Нормализовать объект Netbox в поля реестра.
 * @param {'virtual_server'|'physical_server'} kindCode
 * @param {object} obj
 * @param {{tagPrefix:string}} cfg
 */
function buildNetboxItem(kindCode, obj, cfg) {
  const source = obj && typeof obj === 'object' ? obj : {};
  const isVm = kindCode === 'virtual_server';
  const memoryMb = Number(source.memory);
  const { config_context, local_context_data, ...payload } = source; // eslint-disable-line no-unused-vars

  return {
    kind: kindCode,
    external_id: Number(source.id),
    name: String(source.name || source.display || `#${source.id}`).trim(),
    description: String(source.description || '').trim(),
    primary_ip: firstIp(source),
    status: statusLabel(source.status),
    site: refName(source.site),
    cluster: isVm ? refName(source.cluster) : '',
    platform: refName(source.platform),
    tenant: refName(source.tenant),
    vcpus: isVm && source.vcpus != null && Number.isFinite(Number(source.vcpus)) ? Number(source.vcpus) : null,
    memory_gb:
      isVm && Number.isFinite(memoryMb) && memoryMb > 0
        ? Math.round((memoryMb / 1024) * 100) / 100
        : null,
    disk_gb:
      isVm && source.disk != null && Number.isFinite(Number(source.disk)) ? Number(source.disk) : null,
    netbox_updated_at: source.last_updated || null,
    tag_codes: parseSystemCodes(source.tags, cfg && cfg.tagPrefix),
    payload,
  };
}

/**
 * Ссылка «Открыть в Netbox» для строки реестра (строится на бэкенде, URL не отдаётся фронту).
 * @param {{ type_code?: string, external_id?: number|string }} row
 * @param {string} baseUrl
 */
function netboxObjectWebUrl(row, baseUrl) {
  const base = String(baseUrl || '').trim().replace(/\/+$/, '');
  if (!base || !row || row.external_id == null) return null;
  if (row.type_code === 'virtual_server') {
    return `${base}/virtualization/virtual-machines/${row.external_id}/`;
  }
  if (row.type_code === 'physical_server') {
    return `${base}/dcim/devices/${row.external_id}/`;
  }
  return null;
}

/** Коды систем из набора имён тегов (read-only API каталога отдаёт tag_names из payload). */
function tagCodesFromPayload(tagNames, prefix) {
  return parseSystemCodes(tagNames, prefix);
}

module.exports = {
  KIND_ENDPOINTS,
  parseSystemCodes,
  buildNetboxItem,
  netboxObjectWebUrl,
  tagCodesFromPayload,
  loadNetboxConfig,
  enabledKinds,
  fetchNetboxObjects,
  requestJson,
};

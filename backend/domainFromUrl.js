/**
 * Извлечение и нормализация имени домена (#67).
 * См. docs/domain-registry-schema.md §8.
 */
const { domainToUnicode, domainToASCII } = require('node:url');

/**
 * Punycode (xn--…) → Unicode для отображения и хранения (газель-некст.рф вместо xn--…).
 * @param {string|null|undefined} raw
 * @returns {string|null}
 */
function normalizeDomainName(raw) {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  s = s.toLowerCase();
  try {
    const u = domainToUnicode(s);
    if (u) s = u.toLowerCase();
  } catch {
    /* оставить как есть */
  }
  return s || null;
}

/**
 * Варианты имени для поиска в БД (Unicode + punycode — для записей до нормализации).
 * @param {string|null|undefined} raw
 * @returns {string[]}
 */
function domainNameLookupVariants(raw) {
  const primary = normalizeDomainName(raw);
  if (!primary) return [];
  const set = new Set([primary]);
  const rawLower = String(raw || '').trim().toLowerCase();
  if (rawLower) set.add(rawLower);
  try {
    const ascii = domainToASCII(primary);
    if (ascii) set.add(ascii.toLowerCase());
  } catch {
    /* ignore */
  }
  return [...set];
}

/**
 * @param {import('pg').Pool|import('pg').PoolClient} db
 * @param {object} queries
 * @param {string} rawName
 * @returns {Promise<object|null>}
 */
async function findDomainRowByName(db, queries, rawName) {
  for (const key of domainNameLookupVariants(rawName)) {
    const r = await db.query(queries.domains_get_by_name, [key]);
    if (r.rowCount > 0) return r.rows[0];
  }
  return null;
}

/**
 * @param {string|null|undefined} urlOrHost
 * @returns {string|null} normalized domain name or null
 */
function extractDomainNameFromUrl(urlOrHost) {
  if (urlOrHost == null) return null;
  let s = String(urlOrHost).trim();
  if (!s) return null;

  let host = '';
  try {
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(s)) {
      host = new URL(s).hostname || '';
    } else if (s.includes('/') || s.includes('?')) {
      host = new URL('http://' + s).hostname || '';
    } else {
      host = s.split('/')[0].split('?')[0];
      const colon = host.lastIndexOf(':');
      if (colon > 0 && /^\d+$/.test(host.slice(colon + 1))) {
        host = host.slice(0, colon);
      }
    }
  } catch {
    return null;
  }

  host = String(host || '').trim().toLowerCase();
  if (!host) return null;
  if (host.startsWith('[') && host.endsWith(']')) return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return null;

  if (host.startsWith('www.')) host = host.slice(4);
  if (!host || host === 'localhost') return null;

  const dots = (host.match(/\./g) || []).length;
  if (dots === 0) return null;

  let extracted = host;
  if (dots >= 2) {
    let seen = 0;
    for (let i = host.length - 1; i >= 0; i -= 1) {
      if (host[i] === '.') {
        seen += 1;
        if (seen === 2) {
          extracted = host.slice(i + 1);
          break;
        }
      }
    }
  }

  return normalizeDomainName(extracted);
}

module.exports = {
  normalizeDomainName,
  domainNameLookupVariants,
  findDomainRowByName,
  extractDomainNameFromUrl,
};

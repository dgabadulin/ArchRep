'use strict';

/**
 * Минимальный semver для проверки `requiresCore` модулей (docs/modules-contract.md §11).
 *
 * Без внешних зависимостей — ядро не тянет пакет `semver` ради одной проверки.
 * Поддерживаются формы, которые реально пишут в манифестах модулей:
 *
 *   `*`, `x`, `1`, `1.2`, `1.2.3`
 *   `>=1.0`, `>1.0`, `<=2.0`, `<2`, `=1.2.3`
 *   `^1.2.3` (>=1.2.3 <2.0.0; для 0.x — как в npm)
 *   `~1.2.3` (>=1.2.3 <1.3.0)
 *   `1.x`, `1.2.x`
 *   несколько условий через пробел (AND) и альтернативы через `||` (OR)
 *
 * Неподдерживаемая форма диапазона — `{ ok: false, reason }`: модуль не запускается
 * (fail-closed для модуля, ядро продолжает работу).
 */

const VERSION_RE = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+][0-9A-Za-z.-]+)?$/;
const PARTIAL_RE = /^v?(\d+|[xX*])(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?/;

/**
 * @param {string} input
 * @returns {{major:number, minor:number, patch:number, partial?:boolean}|null}
 */
function parseVersion(input) {
  if (input == null) return null;
  const s = String(input).trim();
  if (!s) return null;
  const full = VERSION_RE.exec(s);
  if (full) {
    return { major: Number(full[1]), minor: Number(full[2]), patch: Number(full[3]) };
  }
  const partial = PARTIAL_RE.exec(s);
  if (!partial) return null;
  const num = (val) => (val == null || /^[xX*]$/.test(val) ? null : Number(val));
  const major = num(partial[1]);
  if (major == null) return null;
  const minor = num(partial[2]);
  const patch = num(partial[3]);
  return { major, minor: minor == null ? 0 : minor, patch: patch == null ? 0 : patch, partial: true };
}

/** @returns {number} -1 | 0 | 1 */
function compare(a, b) {
  const av = [a.major, a.minor, a.patch];
  const bv = [b.major, b.minor, b.patch];
  for (let i = 0; i < 3; i += 1) {
    if (av[i] < bv[i]) return -1;
    if (av[i] > bv[i]) return 1;
  }
  return 0;
}

function v(major, minor, patch) {
  return { major, minor, patch };
}

/**
 * Разобрать один компаратор в интервал.
 * @param {string} token
 * @returns {{min?:object, max?:object, minInclusive?:boolean, maxInclusive?:boolean}|null}
 *   null — компаратор не распознан.
 */
function parseComparator(token) {
  const raw = String(token || '').trim();
  if (!raw) return null;
  if (raw === '*' || raw === 'x' || raw === 'X') return {};

  const m = /^(>=|<=|>|<|=|\^|~)?\s*(.+)$/.exec(raw);
  if (!m) return null;
  const op = m[1] || '=';
  const versionText = m[2].trim();
  const base = parseVersion(versionText);
  if (!base) return null;

  if (op === '>=') return { min: base, minInclusive: true };
  if (op === '>') return { min: base, minInclusive: false };
  if (op === '<=') return { max: base, maxInclusive: true };
  if (op === '<') return { max: base, maxInclusive: false };

  if (op === '=') {
    // `1.x` / `1.2.x` — диапазон, а не точная версия (npm-семантика wildcard).
    if (/^v?\d+\.[xX*]$/.test(versionText)) {
      return { min: v(base.major, 0, 0), minInclusive: true, max: v(base.major + 1, 0, 0), maxInclusive: false };
    }
    if (/^v?\d+$/.test(versionText)) {
      return { min: v(base.major, 0, 0), minInclusive: true, max: v(base.major + 1, 0, 0), maxInclusive: false };
    }
    if (/^v?\d+\.\d+$/.test(versionText)) {
      return {
        min: v(base.major, base.minor, 0),
        minInclusive: true,
        max: v(base.major, base.minor + 1, 0),
        maxInclusive: false,
      };
    }
    return { min: base, minInclusive: true, max: base, maxInclusive: true };
  }

  if (op === '~') {
    // ~1.2.3 → >=1.2.3 <1.3.0 ; ~1.2 → >=1.2.0 <1.3.0 ; ~1 → >=1.0.0 <2.0.0
    const upper = /^v?\d+$/.test(versionText) ? v(base.major + 1, 0, 0) : v(base.major, base.minor + 1, 0);
    return { min: base, minInclusive: true, max: upper, maxInclusive: false };
  }

  if (op === '^') {
    // ^1.2.3 → >=1.2.3 <2.0.0 ; ^0.2.3 → >=0.2.3 <0.3.0 ; ^0.0.3 → >=0.0.3 <0.0.4
    let upper;
    if (base.major > 0) upper = v(base.major + 1, 0, 0);
    else if (base.minor > 0) upper = v(0, base.minor + 1, 0);
    else upper = v(0, 0, base.patch + 1);
    return { min: base, minInclusive: true, max: upper, maxInclusive: false };
  }

  return null;
}

function inInterval(version, interval) {
  if (interval.min) {
    const cmp = compare(version, interval.min);
    if (cmp < 0 || (cmp === 0 && interval.minInclusive === false)) return false;
  }
  if (interval.max) {
    const cmp = compare(version, interval.max);
    if (cmp > 0 || (cmp === 0 && interval.maxInclusive === false)) return false;
  }
  return true;
}

/**
 * Проверить версию на соответствие диапазону.
 * @param {string} version — версия ядра
 * @param {string} range — `requiresCore` из манифеста
 * @returns {{ok:boolean, reason?:string}}
 */
function satisfies(version, range) {
  const parsed = parseVersion(version);
  if (!parsed) return { ok: false, reason: `версия «${version}» не semver` };

  const rawRange = range == null || String(range).trim() === '' ? '*' : String(range).trim();
  const alternatives = rawRange.split('||').map((s) => s.trim()).filter(Boolean);
  if (!alternatives.length) alternatives.push('*');

  let lastReason = '';
  for (const alternative of alternatives) {
    const tokens = alternative.split(/\s+/).filter(Boolean);
    let matched = true;
    let broken = false;
    for (const token of tokens) {
      const interval = parseComparator(token);
      if (!interval) {
        broken = true;
        lastReason = `неподдерживаемый диапазон «${alternative}» (условие «${token}»). ` +
          'Допустимы формы: >=1.0, ^1.0, ~1.0, 1.x, точная версия, несколько условий через пробел или ||.';
        break;
      }
      if (!inInterval(parsed, interval)) {
        matched = false;
        break;
      }
    }
    if (broken) continue;
    if (matched) return { ok: true };
    lastReason = `версия ядра ${version} не попадает в диапазон «${alternative}»`;
  }
  return { ok: false, reason: lastReason || `версия ядра ${version} не попадает в «${rawRange}»` };
}

module.exports = {
  parseVersion,
  compare,
  parseComparator,
  satisfies,
};

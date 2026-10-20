#!/usr/bin/env node
'use strict';

/**
 * Проверка RBAC-покрытия маршрутов (см. docs/adding-new-api-endpoint.md).
 *
 * 1) Кросс-файловый поиск всех /api-маршрутов (index.js + подключаемые роутеры)
 *    и проверка, что для каждого есть правило в routePermissions.js
 *    (иначе middleware вернёт 403 «Недостаточно привилегий» — deny by default).
 * 2) Проверка, что все коды прав из RULES присутствуют в ALL_PERMISSIONS
 *    (permissionsCatalog.js) — иначе право «забыли» добавить в каталог.
 *
 * Запуск: `npm run check:routes`. При находках — код выхода 1.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const perm = require(path.join(ROOT, 'backend', 'auth', 'routePermissions.js'));
const { ALL_PERMISSIONS } = require(path.join(ROOT, 'backend', 'auth', 'permissionsCatalog.js'));

const INDEX = 'backend/index.js';
const indexSrc = fs.readFileSync(path.join(ROOT, INDEX), 'utf8');

// Роутеры, подключаемые через app.use('/api/...', createXxxRouter(...)).
const routerFileByName = {
  createAuthRouter: 'backend/auth/authRoutes.js',
  createAdminRouter: 'backend/auth/adminRoutes.js',
  createJobsRouter: 'backend/jobsRoutes.js',
  createAiRouter: 'backend/ai/aiRoutes.js',
};

const mounts = []; // { file, prefix }
{
  const reUse = /app\.use\(\s*'(\/api\/[^']*)'\s*,\s*(create\w+Router)/g;
  let m;
  while ((m = reUse.exec(indexSrc)) !== null) {
    const file = routerFileByName[m[2]];
    if (file) mounts.push({ file, prefix: m[1] });
  }
}

function prefixForFile(file) {
  const hit = mounts.find((x) => x.file === file);
  return hit ? hit.prefix : '';
}

// Сбор маршрутов (method + path).
const files = [...new Set([INDEX, ...mounts.map((x) => x.file)])];
const routes = [];
for (const f of files) {
  const full = path.join(ROOT, f);
  if (!fs.existsSync(full)) continue;
  const src = fs.readFileSync(full, 'utf8');
  const prefix = prefixForFile(f);
  const re = /(?:app|router)\.(get|post|put|patch|delete)\(\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const method = m[1].toUpperCase();
    let p = m[2];
    if (prefix) p = prefix + (p === '/' ? '' : p);
    routes.push({ method, path: p, file: f });
  }
}

const apiRoutes = routes.filter((r) => r.path.startsWith('/api'));

/**
 * Пути-образцы для правила RBAC. Правила в routePermissions.js описаны «боевыми» путями
 * (например, `^/api/jobs/[0-9]+$`), а в исходниках маршрут объявлен шаблоном (`/api/jobs/:id`):
 * литеральный `:id` ни одному правилу не соответствует и даёт ложное «НЕ ПОКРЫТ».
 * Поэтому проверяем шаблон, затем подстановки: `:id` → `1`, прочие параметры → `sample`.
 */
function candidatePaths(routePath) {
  if (!routePath.includes(':')) return [routePath];
  const sample = routePath.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (m, name) =>
    /id$/i.test(name) ? '1' : 'sample',
  );
  const ones = routePath.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, '1');
  return [routePath, sample, ones];
}

/** Требуемые права для маршрута: берём первый вариант пути, который матчится правилом. */
function requiredPermissionsFor(route) {
  for (const candidate of candidatePaths(route.path)) {
    const required = perm.resolveRequiredPermissions(route.method, candidate, {});
    if (required !== null) return required;
  }
  return null;
}


// 1) Непокрытые маршруты.
const uncovered = [];
for (const r of apiRoutes) {
  if (perm.isPublicPath(r.path)) continue;
  const required = requiredPermissionsFor(r);
  if (required === null) uncovered.push(r);
}
uncovered.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

// 2) Права из RULES, которых нет в ALL_PERMISSIONS.
const usedPerms = new Set();
for (const rule of perm.RULES) {
  for (const code of rule.permissions || []) usedPerms.add(code);
  for (const code of rule.anyOf || []) usedPerms.add(code);
  if (rule.exportPermission) usedPerms.add(rule.exportPermission);
}
const allPerms = new Set(ALL_PERMISSIONS);
const unknownPerms = [...usedPerms].filter((c) => !allPerms.has(c)).sort();

// Отчёт.
let failed = false;
console.log(`[check:routes] /api-маршрутов: ${apiRoutes.length}`);
console.log(`[check:routes] непокрытых правилами: ${uncovered.length}`);
for (const u of uncovered) {
  console.log(`  НЕ ПОКРЫТ: ${u.method} ${u.path}   [${u.file}]`);
}
if (uncovered.length) failed = true;

console.log(`[check:routes] прав в RULES вне ALL_PERMISSIONS: ${unknownPerms.length}`);
for (const c of unknownPerms) {
  console.log(`  НЕИЗВЕСТНОЕ ПРАВО: ${c} (добавьте в backend/auth/permissionsCatalog.js)`);
}
if (unknownPerms.length) failed = true;

if (failed) {
  console.error('[check:routes] FAIL');
  process.exit(1);
}
console.log('[check:routes] OK');

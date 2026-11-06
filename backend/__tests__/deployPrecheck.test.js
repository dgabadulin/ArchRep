'use strict';

/**
 * Тесты преддеплойной проверки `infra/prod/deploy-precheck.ps1` (issue #96, режимы strict/ahead/dirty).
 *
 * Проверяем поведение, а не текст скрипта: собираем одноразовый git-репозиторий
 * (origin + тег v4.1.0 + package.json), прогоняем скрипт и читаем KEY=VALUE-файл, который
 * он отдаёт `deploy.bat`. Регрессия: `dirty`-деплой на коммите-теге отклонялся, потому что
 * ожидаемая версия сравнивалась со строкой, уже содержащей суффикс `+dirty.<sha>`
 * (docs/versioning.md §4 требует сравнения с базовым тегом).
 *
 * Нужны git и PowerShell (pwsh в CI, powershell.exe на Windows); без них тесты помечаются
 * пропущенными, чтобы не ломать `npm test` на «голой» машине.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const PRECHECK = path.join(ROOT, 'infra', 'prod', 'deploy-precheck.ps1');

/** PowerShell: на Windows обычно powershell.exe, в CI (ubuntu) — pwsh. */
function resolvePowerShell() {
  const candidates = process.platform === 'win32' ? ['powershell.exe', 'pwsh.exe'] : ['pwsh', 'powershell'];
  let lastError = '';
  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ['-NoProfile', '-Command', 'exit 0'], { encoding: 'utf8' });
    if (probe.status === 0) return { cmd: candidate };
    lastError = probe.error ? probe.error.code : `exit ${probe.status}`;
  }
  const reason =
    lastError === 'ENOENT'
      ? 'PowerShell не установлен'
      : `PowerShell недоступен для дочерних процессов (${lastError})`;
  return { cmd: null, reason };
}

const PS = resolvePowerShell();
const GIT_OK = spawnSync('git', ['--version'], { encoding: 'utf8' }).status === 0;
const skip = !PS.cmd ? PS.reason : !GIT_OK ? 'git не найден' : false;

/** git в фикстуре: без глобального конфига и подписи коммитов. */
function git(cwd, args) {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(res.status, 0, `git ${args.join(' ')} → ${res.status}\n${res.stderr || ''}`);
  return (res.stdout || '').trim();
}


/**
 * Одноразовый репозиторий: HEAD на теге `v4.1.0`, package.json = 4.1.0, есть upstream.
 * @param {{ version?: string, tag?: string }} opts
 */
function makeRepo({ version = '4.1.0', tag = 'v4.1.0' } = {}) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'isar-gate-'));
  const origin = path.join(base, 'origin.git');
  const repo = path.join(base, 'repo');
  fs.mkdirSync(repo);

  git(base, ['init', '--bare', '-q', origin]);
  git(repo, ['init', '-q', '-b', 'main']);
  git(repo, ['config', 'user.email', 'test@example.com']);
  git(repo, ['config', 'user.name', 'deploy gate test']);
  git(repo, ['config', 'commit.gpgsign', 'false']);

  fs.mkdirSync(path.join(repo, 'infra', 'prod'), { recursive: true });
  fs.copyFileSync(PRECHECK, path.join(repo, 'infra', 'prod', 'deploy-precheck.ps1'));
  fs.writeFileSync(path.join(repo, 'package.json'), `${JSON.stringify({ name: 'archrep', version }, null, 2)}\n`);
  fs.writeFileSync(path.join(repo, 'README.md'), 'fixture\n');

  git(repo, ['add', '-A']);
  git(repo, ['commit', '-q', '-m', 'init']);
  git(repo, ['tag', '-a', tag, '-m', tag.replace(/^v/, '')]);
  git(repo, ['remote', 'add', 'origin', origin]);
  git(repo, ['push', '-q', '-u', 'origin', 'main']);

  return { base, repo };
}

/** Коммит «после тега», запушенный в origin: иначе гейт верно ругается на unpushed. */
function commitAndPush(repo, file = 'after-tag.txt') {
  fs.writeFileSync(path.join(repo, file), 'after tag\n');
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-q', '-m', 'after tag']);
  git(repo, ['push', '-q', 'origin', 'main']);
}

/** Прогон гейта: код возврата, вывод и разобранный KEY=VALUE-файл. */
function runGate(repo, gate) {
  const outFile = path.join(path.dirname(repo), `version-${gate}.env`);
  const args = [
    '-NoProfile',
    '-NonInteractive',
    '-File',
    path.join(repo, 'infra', 'prod', 'deploy-precheck.ps1'),
    '-RepoRoot',
    repo,
    '-OutFile',
    outFile,
    '-Gate',
    gate,
  ];
  if (process.platform === 'win32' && /powershell\.exe$/i.test(PS.cmd)) args.unshift('-ExecutionPolicy', 'Bypass');

  const res = spawnSync(PS.cmd, args, { encoding: 'utf8' });
  const values = {};
  if (fs.existsSync(outFile)) {
    for (const line of fs.readFileSync(outFile, 'utf8').split(/\r?\n/)) {
      const eq = line.indexOf('=');
      if (eq > 0) values[line.slice(0, eq)] = line.slice(eq + 1);
    }
  }
  return { status: res.status, stdout: `${res.stdout || ''}${res.stderr || ''}`, values };
}

function cleanup(base, t) {
  t.after(() => {
    try {
      fs.rmSync(base, { recursive: true, force: true });
    } catch (_) {
      /* Windows может держать дескриптор git-процесса — каталог останется в tmp */
    }
  });
}

test('deploy-precheck: release — чистый репозиторий ровно на теге', { skip }, (t) => {
  const { base, repo } = makeRepo();
  cleanup(base, t);

  const r = runGate(repo, 'strict');
  assert.equal(r.status, 0, r.stdout);
  assert.equal(r.values.APP_DEPLOY_STATE, 'release');
  assert.equal(r.values.APP_VERSION, '4.1.0');
  assert.equal(r.values.APP_IMAGE_TAG, '4.1.0');
  assert.equal(r.values.APP_BASE_TAG, 'v4.1.0');
  assert.equal(r.values.APP_CHANNEL, 'stable');
  assert.equal(r.values.APP_DIRTY_FILES, '0');
});

test('deploy-precheck: dirty на теге проходит (регрессия: суффикс в ожидаемой версии)', { skip }, (t) => {
  const { base, repo } = makeRepo();
  cleanup(base, t);
  fs.appendFileSync(path.join(repo, 'README.md'), 'dirty\n');

  const r = runGate(repo, 'dirty');
  assert.equal(r.status, 0, `dirty-деплой на теге должен проходить:\n${r.stdout}`);
  assert.equal(r.values.APP_DEPLOY_STATE, 'dirty');
  assert.equal(r.values.APP_BASE_TAG, 'v4.1.0');
  assert.match(r.values.APP_VERSION, /^4\.1\.0\+dirty\.[0-9a-f]{7,}$/);
  assert.match(r.values.APP_IMAGE_TAG, /^4\.1\.0-dirty\.[0-9a-f]{7,}$/);
  assert.equal(r.values.APP_DIRTY_FILES, '1');
  assert.equal(r.values.APP_CHANNEL, 'dev', 'dirty-деплой не может считаться stable');
});

test('deploy-precheck: strict отклоняет грязное дерево', { skip }, (t) => {
  const { base, repo } = makeRepo();
  cleanup(base, t);
  fs.appendFileSync(path.join(repo, 'README.md'), 'dirty\n');

  const r = runGate(repo, 'strict');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /Working tree is dirty/);
});

test('deploy-precheck: ahead — коммит после тега (запушенный)', { skip }, (t) => {
  const { base, repo } = makeRepo();
  cleanup(base, t);
  commitAndPush(repo);

  const r = runGate(repo, 'ahead');
  assert.equal(r.status, 0, r.stdout);
  assert.equal(r.values.APP_DEPLOY_STATE, 'ahead');
  assert.equal(r.values.APP_AHEAD_COMMITS, '1');
  assert.match(r.values.APP_VERSION, /^4\.1\.0\+1\.g[0-9a-f]{7,}$/);
});

test('deploy-precheck: ahead + грязное дерево остаётся dirty и не теряет номер сборки', { skip }, (t) => {
  const { base, repo } = makeRepo();
  cleanup(base, t);
  commitAndPush(repo);
  fs.appendFileSync(path.join(repo, 'README.md'), 'dirty\n');

  const r = runGate(repo, 'dirty');
  assert.equal(r.status, 0, r.stdout);
  assert.equal(r.values.APP_DEPLOY_STATE, 'dirty');
  assert.equal(r.values.APP_AHEAD_COMMITS, '1');
  assert.match(r.values.APP_VERSION, /^4\.1\.0\+1\.g[0-9a-f]{7,}\.dirty$/);
});

test('deploy-precheck: package.json не равен базовому тегу → стоп', { skip }, (t) => {
  const { base, repo } = makeRepo({ version: '4.2.0' });
  cleanup(base, t);

  const r = runGate(repo, 'strict');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /package\.json version \(4\.2\.0\)/);
  assert.match(r.stdout, /expected \(4\.1\.0\)/);
});

test('deploy-precheck: strict требует тег на HEAD', { skip }, (t) => {
  const { base, repo } = makeRepo();
  cleanup(base, t);
  commitAndPush(repo);

  const r = runGate(repo, 'strict');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /HEAD is not tagged/);
});

// Страховка для сред без PowerShell (локальный Windows с запретом на запуск PS из node):
// проверяет инвариант там, где поведенческие кейсы выше пропущены.
test('deploy-precheck: ожидаемая версия package.json берётся из базового тега', () => {
  const src = fs.readFileSync(PRECHECK, 'utf8');
  assert.match(
    src,
    /\$expectedPkg\s*=\s*\$baseTag\s*-replace/,
    'ожидаемая версия должна вычисляться из базового тега (docs/versioning.md §4)',
  );
  assert.doesNotMatch(
    src,
    /\$expectedPkg\s*=\s*\$version/,
    'нельзя сравнивать package.json с версией сборки: суффиксы +N.g<sha> и +dirty.<sha> ломают dirty-деплой',
  );
});

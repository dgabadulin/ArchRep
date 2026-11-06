#!/usr/bin/env bash
# Выполняется на удалённом Linux-хосте из каталога ~/DEPLOY_REMOTE_DIR (например ~/isar).
set -euo pipefail

# Диагностика: при падении любого шага печатаем самую частую причину — рассинхрон пароля роли БД (28P01).
trap '_rc=$?; if [[ "${_rc}" -ne 0 ]]; then
  echo "[demo] ERROR: деплой прерван (код ${_rc}). Частая причина — пароль роли БД не совпадает с"
  echo "[demo] POSTGRES_PASSWORD (28P01): как синхронизировать пароль — см. infra/demo/DEPLOYMENT.md §7."
fi' EXIT

REMOTE_DIR="${ISAR_REMOTE_DIR:-isar}"
DEPLOY_MODE="${DEPLOY_MODE:-full}"
ALLOW_DB_RESEED="${ALLOW_DB_RESEED:-false}"

if [[ "${DEPLOY_MODE}" != "full" && "${DEPLOY_MODE}" != "api-only" ]]; then
  echo "[demo] ERROR: DEPLOY_MODE должен быть 'full' или 'api-only', получено: ${DEPLOY_MODE}"
  exit 1
fi
if [[ "${ALLOW_DB_RESEED}" != "true" && "${ALLOW_DB_RESEED}" != "false" ]]; then
  echo "[demo] ERROR: ALLOW_DB_RESEED должен быть 'true' или 'false', получено: ${ALLOW_DB_RESEED}"
  exit 1
fi

cd "${HOME}/${REMOTE_DIR}"

# Секреты стенда живут вне git: deploy.bat кладёт их в .env.demo.secret (корень каталога деплоя).
# Склеиваем шаблон + секреты, ПРЕДВАРИТЕЛЬНО убрав из шаблона ключи, которые есть в секретах:
# так результат не зависит от того, какой из дублей «побеждает» (bash source vs compose env_file/--env-file).
# Файл env.demo в архиве перезаписывается при каждом деплое, поэтому склейка всегда собирается заново.
if [[ -f .env.demo.secret ]]; then
  echo "[demo] Склейка infra/demo/env.demo + .env.demo.secret (ключи секретов перекрывают шаблон)..."
  sed 's/\r$//' .env.demo.secret > infra/demo/env.demo.secret.tmp
  grep -E '^[A-Za-z_][A-Za-z0-9_]*=' infra/demo/env.demo.secret.tmp | cut -d= -f1 | sort -u > infra/demo/env.demo.keys.tmp
  awk 'BEGIN { while ((getline k < "infra/demo/env.demo.keys.tmp") > 0) drop[k] = 1 }
       /^[A-Za-z_][A-Za-z0-9_]*=/ { key = $0; sub(/=.*/, "", key); if (key in drop) next }
       { print }' infra/demo/env.demo > infra/demo/env.demo.merged.tmp
  {
    cat infra/demo/env.demo.merged.tmp
    printf '\n# --- секреты стенда: .env.demo.secret (доставлен deploy.bat) ---\n'
    cat infra/demo/env.demo.secret.tmp
  } > infra/demo/env.demo
  rm -f infra/demo/env.demo.secret.tmp infra/demo/env.demo.keys.tmp infra/demo/env.demo.merged.tmp
else
  echo "[demo] WARN: .env.demo.secret не найден — используются плейсхолдеры из infra/demo/env.demo."
fi

# env.demo может приехать с Windows (CRLF); иначе source даёт «$'\r': command not found»
set -a
# shellcheck disable=SC1091
source <(sed 's/\r$//' infra/demo/env.demo)
set +a

# Плейсхолдер ловим до сборки образа: иначе падение случится на db:migrate с невнятным 28P01.
if [[ -z "${POSTGRES_PASSWORD:-}" || "${POSTGRES_PASSWORD}" == "CHANGE_ME" ]]; then
  echo "[demo] ERROR: POSTGRES_PASSWORD не задан (или равен CHANGE_ME)."
  echo "[demo] Заполните .env.demo.secret рядом с deploy-обёрткой (файл в .gitignore) и повторите деплой."
  exit 1
fi

COMPOSE=(docker compose -f infra/demo/docker-compose.yml --env-file infra/demo/env.demo)
DUMP_REL="DB/schema/demo/dump-archrep.sql"

if [[ "${DEPLOY_MODE}" == "full" ]]; then
  echo "[demo] Режим full: полный деплой с импортом дампа."
  echo "[demo] Подъём postgres и drawio..."
  "${COMPOSE[@]}" up -d postgres drawio
else
  echo "[demo] Режим api-only: обновление только ar-api, БД не пересоздаётся."
  echo "[demo] Подъём postgres (без drawio)..."
  "${COMPOSE[@]}" up -d postgres
fi

# pg_isready НЕ аутентифицируется (проверяет только «сервер принимает соединения»), поэтому раньше
# деплой «успешно» проходил этот шаг и падал позже на db:migrate с 28P01. Проверяем реальный коннект:
# psql из отдельного контейнера того же образа по сети — внутри самого контейнера сокет = trust,
# и пароль там не проверяется.
echo "[demo] Ожидание готовности Postgres и проверка пароля ${POSTGRES_USER}..."
for i in $(seq 1 60); do
  if "${COMPOSE[@]}" run --rm --no-deps --entrypoint psql \
       -e PGPASSWORD="${POSTGRES_PASSWORD}" postgres \
       -h postgres -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c 'select 1' >/dev/null 2>&1; then
    echo "[demo] Postgres готов, пароль принят."
    break
  fi
  if [[ "${i}" -eq 60 ]]; then
    echo "[demo] ERROR: Postgres не принимает пароль пользователя ${POSTGRES_USER} (или не поднялся за 120 с)."
    echo "[demo] POSTGRES_PASSWORD действует только при первом initdb: у уже созданного тома pgdata_demo"
    echo "[demo] пароль роли нужно синхронизировать. Локальный сокет в контейнере = trust, старый пароль не нужен:"
    echo "  cd ~/${REMOTE_DIR} \\"
    echo "  docker compose -f infra/demo/docker-compose.yml --env-file infra/demo/env.demo exec -T postgres \\"
    echo "    psql -U ${POSTGRES_USER} -d postgres -c \"ALTER ROLE ${POSTGRES_USER} WITH PASSWORD '<пароль из .env.demo.secret>';\""
    exit 1
  fi
  sleep 2
done

if [[ "${DEPLOY_MODE}" == "full" ]]; then
  if [[ "${ALLOW_DB_RESEED}" != "true" ]]; then
    echo "[demo] ERROR: Для режима full нужно явное подтверждение ALLOW_DB_RESEED=true."
    echo "[demo] Подсказка: задайте ALLOW_DB_RESEED=true в deploy-обёртке или в окружении перед запуском."
    exit 1
  fi
  if [[ ! -f "${DUMP_REL}" ]]; then
    echo "[demo] ERROR: не найден дамп ${DUMP_REL}"
    exit 1
  fi

  # Дамп ссылается на OWNER TO postgres; при POSTGRES_USER=isar роль postgres в кластере не создаётся.
  echo "[demo] Служебная роль postgres (если ещё нет) для совместимости с дампом..."
  "${COMPOSE[@]}" exec -T postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -v ON_ERROR_STOP=1 -c \
    "DO \$bd\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN CREATE ROLE postgres WITH SUPERUSER NOLOGIN; END IF; END \$bd\$;"

  echo "[demo] Остановка ar-api (если был), чтобы снять соединения с БД перед пересозданием..."
  "${COMPOSE[@]}" stop ar-api 2>/dev/null || true

  echo "[demo] Пересоздание БД archrep (DROP IF EXISTS)..."
  "${COMPOSE[@]}" exec -T postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -v ON_ERROR_STOP=1 \
    -c "DROP DATABASE IF EXISTS archrep WITH (FORCE);"

  echo "[demo] Импорт дампа (может занять время)..."
  "${COMPOSE[@]}" exec -T postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -v ON_ERROR_STOP=1 \
    < "${DUMP_REL}"
fi

echo "[demo] Сборка образа ar-api для запуска миграций..."
"${COMPOSE[@]}" build ar-api

echo "[demo] Прогон node-pg-migrate (db:migrate) в БД archrep..."
# Вариант A: без JS template literal — иначе внешний bash (set -u) ловит ${u} и `` ` `` как подстановки.
"${COMPOSE[@]}" run --rm --no-deps ar-api sh -lc "set -e; npm install --include=dev; export DB_HOST=\${DB_HOST:-postgres}; export DB_PORT=\${DB_PORT:-5432}; export DB_NAME=\${DB_NAME:-archrep}; export DATABASE_URL=\$(node -e 'const u=encodeURIComponent(process.env.DB_USER||\"postgres\"); const p=encodeURIComponent(process.env.DB_PASSWORD||\"\"); const h=process.env.DB_HOST||\"postgres\"; const port=process.env.DB_PORT||\"5432\"; const db=process.env.DB_NAME||\"archrep\"; process.stdout.write(\"postgres://\"+u+\":\"+p+\"@\"+h+\":\"+port+\"/\"+db);'); npm run db:migrate"

echo "[demo] Сборка и запуск ar-api..."
"${COMPOSE[@]}" up -d ar-api

echo "[demo] Готово (${DEPLOY_MODE})."
echo "  API:    http://$(hostname -I 2>/dev/null | awk '{print $1}'):3000   (или по DNS/IP сервера)"
echo "  Drawio: http://$(hostname -I 2>/dev/null | awk '{print $1}'):8080"

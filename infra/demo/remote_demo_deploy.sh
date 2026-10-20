#!/usr/bin/env bash
# Выполняется на удалённом Linux-хосте из каталога ~/DEPLOY_REMOTE_DIR (например ~/isar).
set -euo pipefail

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

# env.demo может приехать с Windows (CRLF); иначе source даёт «$'\r': command not found»
set -a
# shellcheck disable=SC1091
source <(sed 's/\r$//' infra/demo/env.demo)
set +a

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

echo "[demo] Ожидание готовности Postgres..."
for i in $(seq 1 60); do
  if "${COMPOSE[@]}" exec -T postgres pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" >/dev/null 2>&1; then
    echo "[demo] Postgres готов."
    break
  fi
  if [[ "${i}" -eq 60 ]]; then
    echo "[demo] ERROR: Postgres не поднялся за отведённое время."
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

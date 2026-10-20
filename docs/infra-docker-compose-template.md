# Шаблон структуры: Docker Compose + PostgreSQL под текущий проект (ArchRep)

**Договорённости (demo):**

- Один вход для разработчика: **`deploy_demo`** (например `infra/demo/deploy_demo.bat`) — поднимает контейнеры, ждёт Postgres, **накатывает SQL в фиксированном порядке**, при необходимости пересобирает API.
- **Compose** остаётся коротким: сервисы и сеть, без «магии» схемы в `docker-entrypoint-initdb.d` как единственного источника правды.
- Для демо **допустимо хранить в Git** файл **`infra/demo/env.demo`** с паролями к локальной/пустой БД — только для изолированной демо-среды, не для prod.

**Prod:** секреты и реальные env **вне Git** (как в `deploy.bat` / файлы на сервере).

Целевая структура: `infra/demo` и `infra/prod` (с общими файлами в `infra/common`). Для demo-файла сеть лучше объявлять **внутри compose** (`driver: bridge`), чтобы не требовать `docker network create`.

Draw.io для demo живёт в общем `docker-compose` (дополнительный файл для него не обязателен).

---

## Дерево каталогов (рекомендуемое)

```
projects/
├── infra/
│   ├── common/
│   │   ├── dockerfile                # сборка backend + frontend-v3 (общее для demo/prod)
│   │   └── README.md                 # общие договорённости по сети/образам
│   ├── demo/
│   │   ├── docker-compose.yml        # postgres + ar-api + drawio
│   │   ├── env.demo                  # демо-переменные (POSTGRES_*, DB_*)
│   │   ├── deploy_demo.bat           # Windows: up → wait → psql по списку SQL → (re)start API
│   │   └── deploy_demo.sh            # опционально: то же для Linux/CI
│   ├── prod/
│   │   ├── deploy.bat                # текущая реализация prod-деплоя по SSH
│   │   ├── linux_deploy.bat          # альтернативный prod-скрипт (если используется)
│   │   ├── docker-compose.yml        # опционально: prod-compose с образом из registry
│   │   └── README.md                 # инструкции по деплою/эксплуатации prod
│   └── .env.example                  # указатель/напоминание про prod vs demo
├── DB/
│   ├── schema/                       # источник правды по DDL (как сейчас)
│   ├── scripts/                      # утилиты/разовые скрипты
│   └── deploy/
│       └── demo/
│           ├── README.md             # порядок файлов в sql/, идемпотентность, сброс volume
│           ├── sql/
│           │   ├── 01_extensions.sql   # опционально
│           │   ├── 02_schema.sql     # DDL / \i кускам из DB/schema
│           │   └── 03_seed_demo.sql  # обезличенный seed
│           └── scripts/
│               └── wait-for-postgres.cmd   # опционально: pg_isready через docker compose exec
├── .env.example                      # корень: шаблон без секретов prod
└── docs/
    └── infra-docker-compose-template.md   # этот файл
```

**В Git (в т.ч. публично — по вашей политике для demo):**

- `infra/common/dockerfile`, `infra/demo/docker-compose.yml`, `infra/demo/deploy_demo.*` (без прод-секретов; демо-пароли только через `infra/demo/env.demo` или явные non-secret placeholder в compose).
- **`infra/demo/env.demo`** — пароли к **демо**-Postgres и `DB_*` для API; не содержать прод-ключей, SMTP с реальными кредами, внешних токенов.
- SQL для демо-наката — **`DB/deploy/demo/sql/*.sql`** (при необходимости — явный список путей к `DB/schema/*.sql` из `02_schema.sql` через `\i`).
- Документация, `.env.example`.

**Не в Git (prod и чувствительное):**

- `/opt/isar/.env.prod`, `.env.production` на сервере и т.п. — реальные секреты.
- Полные дампы с ПДн, бэкапы, ключи внешних систем.

**Артефакты (опционально):** образ в registry, тяжёлые дампы — вне репозитория.

---

## Роль `deploy_demo`

Логическая последовательность (один скрипт, понятные шаги):

1. **`docker compose -f infra/demo/docker-compose.yml --env-file infra/demo/env.demo up -d --build`** (или `build` отдельно — по желанию). Рабочая директория — **корень репозитория** (или в `deploy_demo` задать `REPO_ROOT` и вызывать compose с `-f` от него).
2. **Ожидание Postgres:** цикл `docker compose ... exec postgres pg_isready ...` (или `DB/deploy/demo/scripts/wait-for-postgres.cmd`) с таймаутом.
3. **Накат SQL:** для каждого файла из **`DB/deploy/demo/sql/`** в порядке имён (`01_*.sql`, `02_*.sql`, …), из корня репозитория — например  
   `docker compose ... exec -T postgres psql -U … -d … -f /path/in/container`  
   (если в compose смонтирован каталог `DB/deploy/demo/sql`), либо передача stdin:  
   `docker compose ... exec -T postgres psql -U … -d … < DB\deploy\demo\sql\01_extensions.sql`.  
   Порядок файлов в `sql/` — **единственный контракт** «как поднять схему с нуля».
4. При необходимости **перезапуск** `ar-api`, если он стартовал до готовности схемы (или шаг 2–3 до `up` ar-api — на ваш выбор: проще сначала postgres, потом миграции, потом API).
5. **Draw.io** поднимается вместе с demo в том же compose (отдельный `-f` не нужен).

Плюс такого подхода: накат **повторяем** после правки SQL без обязательного `docker compose down -v` (в отличие от чистого `initdb`, который выполняется только на пустом volume). Минус: скрипты должны быть **идемпотентны** (`IF NOT EXISTS`, миграции с версией, или явный флаг «полный сброс» в отдельной команде).

---

## Пример `infra/demo/docker-compose.yml` (скелет)

Postgres **без** обязательного монтирования всей схемы в `/docker-entrypoint-initdb.d` — схему накатывает `deploy_demo`. При желании в `initdb` можно оставить только пустой `CREATE DATABASE` / расширения — но источник правды по шагам — скрипт деплоя.

```yaml
services:
  postgres:
    image: postgres:17
    container_name: ar-postgres-demo
    restart: unless-stopped
    env_file:
      - env.demo
    environment:
      # POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB — из env.demo
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - pgdata_demo:/var/lib/postgresql/data
    networks:
      - ar-network
    healthcheck:
      # $$ — литеральный $ в контейнере; подставятся env из образа/ env_file
      test: ["CMD-SHELL", "pg_isready -U \"$$POSTGRES_USER\" -d \"$$POSTGRES_DB\""]
      interval: 5s
      timeout: 5s
      retries: 15

  ar-api:
    build:
      context: ../..
      dockerfile: infra/common/dockerfile
    image: ar-api-image:demo
    container_name: ar-api-container
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    ports:
      - "3000:3000"
    env_file:
      - env.demo
    environment:
      NODE_ENV: production
      SERVER_PORT: "3000"
      DB_HOST: postgres
      DB_PORT: "5432"
      DB_USER: ${POSTGRES_USER}
      DB_PASSWORD: ${POSTGRES_PASSWORD}
      DB_NAME: ${POSTGRES_DB}
    networks:
      - ar-network

  # Draw.io в том же файле demo-compose
  drawio:
    image: jgraph/drawio:latest
    container_name: ar-drawio-demo
    restart: unless-stopped
    ports:
      # Уберите или сузьте до 127.0.0.1, если доступ только через nginx к ar-api
      - "8080:8080"
    networks:
      - ar-network

volumes:
  pgdata_demo:

networks:
  ar-network:
    driver: bridge
```

Из **SPA/API** к контейнеру по имени сервиса: базовый URL вида `http://drawio:8080` (только внутри сети `ar-network`). Для браузера пользователя — прокси с хоста (nginx) или проброс порта `8080` на localhost.

**Пример `infra/demo/env.demo` (фрагмент, коммитится):**

```dotenv
POSTGRES_USER=archrep
POSTGRES_PASSWORD=CHANGE_ME
POSTGRES_DB=archrep_demo
# при необходимости дублируйте DB_* для приложения или задавайте только в compose через POSTGRES_*
```

Убедитесь, что имена переменных совпадают с тем, что читает backend в контейнере (часто копируют `DB_*` в `env.demo` явно, если приложение не подставляет их из `POSTGRES_*`).

---

## Draw.io (diagrams.net) для embed

Для demo draw.io поднимается в том же `infra/demo/docker-compose.yml`, в одной сети с `ar-api` и `postgres`.
Это убирает лишнюю точку отказа (забыли второй compose-файл) и упрощает `deploy_demo`.

---

## Обновление только `ar-api` (без Postgres и drawio)

Compose **не требует** пересобирать все сервисы. Из **корня репозитория** (с теми же `-f` и `--env-file`, что в `deploy_demo`):

```bash
docker compose -f infra/demo/docker-compose.yml --env-file infra/demo/env.demo up -d --build ar-api
```

Том БД и контейнер `postgres` (и `drawio`, если в том же файле) обычно **не трогаются**. Отдельно: `docker compose ... build ar-api` затем `up -d ar-api`.

**Prod** с образом из registry: `docker compose ... pull ar-api && docker compose ... up -d ar-api` (без `build` на сервере).

---

## Пример `infra/prod/docker-compose.yml` (без изменений по смыслу)

- Образ из registry (опционально без `build` на сервере).
- **`env_file` только на сервере**, не в репозитории.

```yaml
services:
  ar-api:
    image: ghcr.io/your-org/archrep-api:1.0.0
    container_name: ar-api-container
    restart: always
    env_file:
      - /opt/isar/.env.prod
    ports:
      - "3000:3000"
    networks:
      - ar-network

networks:
  ar-network:
    external: true
```

Postgres на prod — отдельный сервис или managed DB; в `.env.prod` задаётся реальный `DB_HOST`.

---

## Связка с приложением

| Переменная      | Demo                         | Prod              |
|----------------|------------------------------|-------------------|
| `DB_HOST`      | имя сервиса `postgres`       | хост БД           |
| `DB_PORT`      | `5432`                       | порт              |
| `DB_NAME`      | как в `env.demo` / `POSTGRES_DB` | из секрета    |
| `DB_USER` / `DB_PASSWORD` | из `env.demo`     | из секрета        |
| `NODE_ENV`     | `production` в образе        | `production`      |

---

## Сброс демо-данных

Полный сброс БД: `docker compose -f infra/demo/docker-compose.yml --env-file infra/demo/env.demo down -v`, затем снова **`deploy_demo`**.

---

## Команды-шпаргалка

```bat
REM Основной путь для разработчика (Windows)
infra\demo\deploy_demo.bat
```

```bash
# Ручной подъём без скрипта (если SQL уже накатан)
docker compose -f infra/demo/docker-compose.yml --env-file infra/demo/env.demo up -d --build

docker compose -f infra/demo/docker-compose.yml --env-file infra/demo/env.demo logs -f ar-api

# Только пересборка/перезапуск API (демо)
docker compose -f infra/demo/docker-compose.yml --env-file infra/demo/env.demo up -d --build ar-api
```

Те же вызовы из **cmd** (одной строкой без `#`):

```bat
docker compose -f infra/demo/docker-compose.yml --env-file infra/demo/env.demo up -d --build ar-api
```

---

*Документ можно дополнять реальными именами сервисов, путём к `DB/deploy/demo/sql/` и ссылкой на `infra/prod/deploy.bat` для prod.*

## Архитектурный репозиторий (BFF + БД)

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

Этот репозиторий содержит прототип архитектурного репозитория для корпоративных и системных архитекторов:

- **Backend**: Node.js + Express (`index.js`, `queries.js`) поверх PostgreSQL (схемы `archrep`, `archrep_test`).
- **БД**: SQL‑схемы и дампы в каталоге `DB/`.
- **Инфраструктура**: Docker/Docker Compose для локального и серверного развёртывания.

Цель — предоставить единое хранилище данных об ИС, технологиях, партнёрах и связанных справочниках, с удобным API и UI.

---

## Структура репозитория

Подробное описание — в **[docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md)** (текущее состояние, целевая структура, этапы перехода).

**Сейчас в корне:**

- `package.json` — точка входа: `npm start` → `node backend/index.js`.
- `.env.example` — шаблон переменных; скопируйте в `.env.development` / `.env.production` локально (эти файлы не коммитятся).
- `backend/` — код API (index.js, queries.js, views, public).
- `db/schema/` — DDL схемы (например `archrep_test.sql`).
- `infra/` — инфраструктура по подпапкам: `common/` (dockerfile), `prod/` (deploy), `demo/` (demo compose и env); шаблон env — корневой `.env.example`.
- `DB/` — прежнее место DDL (дубликат в `db/schema/`); дампы по-прежнему в .gitignore.
- `docs/` — документация, промпты.

**Целевые каталоги (уже созданы, код пока в корне):**

| Каталог | Назначение |
|--------|------------|
| `backend/` | BFF/REST API — сюда будет перенесён Node.js‑код. |
| `frontend-v3/` | Веб‑интерфейс (Vue 3 + Vite); сборка → `frontend-v3-dist/`, отдаётся с `/`. |
| `db/` | DDL, миграции и скрипты по БД (текущий `DB/` → `db/schema/`). |
| `infra/` | Docker, деплой, примеры env. |
| `docs/` | Документация, архитектура, промпты (`docs/prompts/`). |

---

## Как запустить backend локально

### 1. Зависимости

- Node.js LTS (18+).
- Docker + Docker Compose (для PostgreSQL и/или самого сервиса).

**Установка npm-зависимостей после клонирования:** каталог `node_modules` в репозиторий не входит — зависимости ставятся локально по `package-lock.json`. Предпочтительно **`npm ci`** (ровно версии из lock-файла; перед этим не должно быть `node_modules`, либо удалите его).

Из **корня репозитория**:

```bash
npm ci
```

Для разработки UI (Vite, `frontend-v3`):

```bash
cd frontend-v3
npm ci
cd ..
```

Сборка Docker-образа (`infra/common/dockerfile`) сама выполняет `npm ci` внутри контейнера для корня и для `frontend-v3`.

### 2. Настройка переменных окружения

Используется подход с `.env.<NODE_ENV>`:

- Скопируйте `.env.example` в `.env.development` (локально) или `.env.production` (сервер); секреты не хранить в Git.

Ключевые переменные:

- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` — доступ к PostgreSQL.
- `SERVER_PORT` — порт HTTP‑сервера (по умолчанию 3000).

### 3. Запуск в dev‑режиме

Из **корня репозитория**:

```bash
npm start
```

или

```bash
NODE_ENV=development node backend/index.js
```

(.env берётся из корня: `.env.development` / `.env.production`.)

### 4. Запуск через Docker Compose

Из **корня репозитория**:

```bash
docker compose -f infra/prod/docker-compose.yml up --build -d
```

Пересборка и перезапуск контейнера (Windows): запусти `infra/restart.bat` (скрипт сам перейдёт в корень и соберёт образ по `infra/common/dockerfile`).

### 5. Деплой на свой сервер по SSH (одна команда)

Перед запуском задайте переменные окружения (в **cmd**), например:

```cmd
set DEPLOY_SSH_USER=your_linux_user
set DEPLOY_SSH_JUMP_HOST=your_jump_host
set DEPLOY_SSH_TARGET_HOST=your_server_hostname
```

Затем из корня репозитория:

```cmd
infra\prod\deploy.bat
```

или `npm run deploy`. Скрипт копирует проект на сервер, собирает образ (backend + собранный frontend) и запускает контейнер на порту 3000. Настройка SSH без пароля — **[infra/README-deploy-ssh.txt](infra/README-deploy-ssh.txt)**. Подробнее — **[docs/GITFLOW.md](docs/GITFLOW.md)**.

---

## API (текущее состояние)

Основные эндпоинты (упрощённо, см. `index.js`):

- `GET /` — health‑check.
- `GET /api/ar-systems` — список систем (`archrep.ar_systems` и связанные справочники).
- `PUT /api/update-ar-systems/:id` — обновление системы по `id`.
- `POST /api/add-ar-systems` — добавление системы.
- `GET /api/parent-systems` — справочник родительских систем.
- `GET /api/system-statuses` — справочник статусов систем.
- `GET /api/hosting-types` — справочник типов хостинга.
- `GET /api/owners` — владельцы/бизнес‑домены.
- `GET /api/ar-vendors` — партнёры/вендоры.

По мере развития метамодели под TOGAF здесь появятся эндпоинты для процессов, интерфейсов, стандартов, governance и т.д.

---

## GitFlow и работа с GitLab

Рекомендуемый процесс:

- **Основные ветки**
  - `main` — стабильная прод‑версия.
  - `develop` — интеграция фич (dev‑среда).
- **Feature‑ветки**
  - `feature/<task-id>-<short-name>` — новые фичи/улучшения.
- **Hotfix‑ветки**
  - `hotfix/<short-name>` — экстренные исправления в `main`.

Базовый цикл:

1. Заводим задачу в GitLab (issue).
2. Создаём ветку от `develop`: `feature/123-archrep-togaf-metamodel`.
3. Делаем коммиты с осмысленными сообщениями (напр. `feat: add hosting types endpoint`).
4. Открываем Merge Request в GitLab → ревью → merge в `develop`.
5. Периодически выпускаем релизы: merge `develop` → `main` с тегами (`v1.0.0` и т.п.).

---

## Работа с промптами и ИИ

Чтобы сделать работу с ИИ воспроизводимой и понятной:

- Храним рабочие промпты в `docs/prompts/`:
  - `backend_refactor.md` — сценарий рефакторинга backend.
  - `db_cleanup.md` — промпт для очистки/миграций БД.
  - `ui_design.md` — промпт для проектирования экранов UI.
- В каждом промпте фиксируем:
  - контекст (схемы, файлы, ограничения),
  - желаемый формат ответа,
  - критерии «готовности» результата.

Эти файлы коммитятся в Git и служат живой документацией архитектурной практики.

---

## Дальнейшие шаги развития

- Расширить метамодель и схему БД под TOGAF (домены, процессы, интерфейсы, стандарты, governance‑лог).
- Выделить код backend в отдельную папку `backend/` и навести модульную структуру.
- Добавить полноценный фронтенд для архитекторов (SPA/Low‑code).
- Настроить GitLab CI/CD (сборка контейнера, миграции БД, деплой на тест/прод).

---

## Лицензия

Проект распространяется под лицензией **Apache License 2.0** — см. [LICENSE](./LICENSE) и [NOTICE](./NOTICE).

Код и зависимости ядра свободно используются, модифицируются и распространяются при условии сохранения уведомлений об авторстве (лицензия Apache 2.0, раздел 4). Платные модули экосистемы (Open Core) распространяются отдельно на своих условиях.


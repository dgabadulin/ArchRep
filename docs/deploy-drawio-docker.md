# Развёртывание Draw.io (diagrams.net) в Docker и подключение к сети `ar-network`

Инструкция для собственного инстанса Draw.io, доступного контейнерам приложения ИСАР по одной Docker-сети с API (как в `infra/demo/docker-compose.yml`).

## Именование сети

В проекте используется **внешняя** сеть с ключом `ar-network` в Compose:

```yaml
networks:
  ar-network:
    external: true
```

Имя сети в Docker — строка **1:1** с тем, что ожидает Compose. Если на сервере сеть создана как `ar_network` (подчёркивание), либо переименуйте/создайте сеть с нужным именем, либо в сервисе укажите явное имя:

```yaml
networks:
  drawio-net:
    name: ar_network   # фактическое имя в Docker
    external: true
```

Дальше в примерах используется имя **`ar-network`** — подставьте своё, если оно другое.

## Предварительные условия

- Установлен Docker (и при использовании Compose v2 — плагин `docker compose`).
- Сеть `ar-network` уже существует **или** будет создана командой ниже.
- Образ: официальный **`jgraph/drawio`** ([Docker Hub](https://hub.docker.com/r/jgraph/drawio)).

## Шаг 1. Создать сеть (если ещё нет)

На сервере:

```bash
docker network inspect ar-network >/dev/null 2>&1 || docker network create ar-network
```

Проверка:

```bash
docker network ls | findstr ar-network
```

(В PowerShell можно: `docker network ls | Select-String ar-network`.)

## Шаг 2. Запуск только Draw.io (`docker run`)

Минимальный запуск с подключением к существующей сети:

```bash
docker run -d --name ar-drawio --restart unless-stopped ^
  --network ar-network ^
  -p 8080:8080 ^
  jgraph/drawio:latest
```

- Внутри сети контейнер будет доступен другим сервисам по **hostname** `ar-drawio` и порту **8080** (например `http://ar-drawio:8080`).
- Публикация `-p 8080:8080` нужна для доступа с хоста или снаружи; если доступ только через reverse-proxy в другом контейнере в той же сети, порт на хосте можно не публиковать.

Проверка с хоста: открыть в браузере `http://<сервер>:8080`.

## Шаг 3. Вариант через Compose (рекомендуется для постоянной эксплуатации)

Готовый фрагмент включён в demo-стек: `infra/demo/docker-compose.yml` (сервис `drawio`).

Запуск **рядом** с основным стеком (из корня репозитория):

```bash
docker compose -f infra/demo/docker-compose.yml --env-file infra/demo/env.demo up -d drawio
```

Остановка:

```bash
docker compose -f infra/demo/docker-compose.yml --env-file infra/demo/env.demo stop drawio
```

`down` **не удаляет** внешнюю сеть `ar-network`.

## Интеграция с приложением (кратко)

- Для **iframe / embed** с фронта укажите базовый URL инстанса (публичный DNS или внутренний URL прокси), параметры embed описаны в [Embed mode](https://www.drawio.com/doc/faq/embed-mode).
- Для вызовов **между контейнерами** используйте имя сервиса из compose (`drawio`) или `container_name` (`ar-drawio`) и порт **8080**.

Пример внутреннего URL для BFF/фронта за reverse-proxy: `https://drawio.<ваш-домен>/` — прокси сам прокидывает на `http://ar-drawio:8080`.

## Nginx: только порт 443, путь `/drawio/`

Да, можно: пользователи заходят по **`https://сервер/drawio/`** (порт **443**), наружу **8080 не открывают** — Draw.io слушает только на **localhost** (или в Docker-сети), а наружу смотрит **nginx с TLS**.

### Поддомен vs подпуть

| Вариант | URL | Замечание |
|--------|-----|-----------|
| **Поддомен** | `https://drawio.example.com/` | Чаще **без сюрпризов**: бэкенд отдаёт приложение с корня `/`, не нужно подменять пути к `/js`, `/styles`. |
| **Путь** | `https://example.com/drawio/` | Удобно одним доменом; иногда приложение отдаёт ссылки с корня `/` — тогда часть статики может запрашиваться не как `/drawio/...`. Если после настройки страница «ломается», используйте поддомен или проверьте обновления образа `jgraph/drawio`. |

### Пример `location` для пути `/drawio/`

Draw.io в контейнере ожидает запросы **как к корню сайта** (`/`). Префикс `/drawio/` nginx снимает и передаёт на бэкенд:

```nginx
# Внутри server { listen 443 ssl; ... }

location /drawio/ {
    proxy_pass http://127.0.0.1:8080/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Prefix /drawio;
    # при необходимости для отдельных сборок:
    # proxy_redirect off;
}
```

Редирект с корня пути на со слэшем (чтобы относительные ссылки вели в `/drawio/`):

```nginx
location = /drawio {
    return 301 /drawio/;
}
```

После правок: `sudo nginx -t` и `sudo systemctl reload nginx`.

### Пример для поддомена (проще в поддержке)

```nginx
server {
    listen 443 ssl;
    server_name drawio.example.com;

    location / {
        proxy_pass http://127.0.0.1:8080/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Во фронте/embed тогда базовый URL: `https://drawio.example.com/` (или с параметрами embed).

### Фаервол

Разрешите снаружи только **443/tcp** (и **80** — если нужен редирект на HTTPS). Порт **8080** на хосте можно не публиковать (`-p 8080:8080` убрать), если nginx и Draw.io на **одном хосте** — тогда в `proxy_pass` достаточно `127.0.0.1:8080`. Если nginx в другом контейнере — используйте имя сервиса Draw.io в общей Docker-сети и порт **8080** только между контейнерами.

## Безопасность и эксплуатация

- По умолчанию Draw.io в контейнере **без встроенной аутентификации** — не выставляйте порт в интернет без ограничений; предпочтительно: только внутренняя сеть + Nginx/Traefik с TLS и при необходимости SSO/Basic auth.
- Обновления образа: периодически `docker pull jgraph/drawio:latest` и пересоздание контейнера (или зафиксируйте digest/тег версии для воспроизводимости).
- Ресурсы: для редкого редактирования достаточно дефолтных лимитов; при большом числе одновременных пользователей смотрите на CPU/RAM хоста.
- **CORS и CSP:** при встраивании с другого origin настройте заголовки на прокси и список разрешённых origin для `postMessage` по документации embed.

## Устранение проблем

| Симптом | Что проверить |
|--------|----------------|
| Другой контейнер не резолвит `ar-drawio` | Оба контейнера в `docker network inspect ar-network` в одной сети; одно имя хоста — из `container_name` или имени сервиса Compose. |
| `external network ar-network not found` | Сеть не создана — выполните шаг 1. |
| Пустая страница за прокси | Путь `/` и WebSocket (если используется) должны проксироваться; для Tomcat в образе обычно достаточно обычного HTTP reverse-proxy на 8080. |

## Связанные материалы в проекте

- Сеть API: `infra/demo/docker-compose.yml` (`ar-api` и `drawio` в `ar-network`).
- Обсуждение встраивания Draw.io: `docs/architecture-diagram-component.md` (раздел Draw.io).

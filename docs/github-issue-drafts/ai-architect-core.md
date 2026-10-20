## Цель

Встроить в ядро ИСАР **ИИ-агента «ИИ-архитектор»**: кнопка в фиксированном футере левого меню открывает выдвижную чат-панель, которая через агентный цикл отвечает на вопросы по данным репозитория и **умеет открывать/заполнять экранные формы** реестров и архитектурных заключений.

## Контекст (зачем)

1. Данные репозитория (ИС, технологии, долг, заключения, метрики) уже доступны через BFF, но поиск требует знания разделов и фильтров. Архитектору нужен диалоговый вход: «покажи системы без владельца», «какие технологии в статусе X», «открой заключение ADRA-…».
2. Требуется **агентный цикл** (LLM + инструменты), а не «чат про общую архитектуру»: ответы должны опираться на фактические данные ИСАР и права пользователя.
3. LLM — **on-prem** Qwen3.5-397B (OpenAI-совместимый `/v1/chat/completions`), ключ только в env сервера.

## Принятые решения (согласовано с заказчиком)

| Вопрос | Решение |
|--------|---------|
| Провайдер / модель | on-prem `https://ai.example.com/api/v1`, модель `Qwen/Qwen3.5-397B-A17B-FP8` |
| Агентный цикл | обязателен (tool-calling); при отсутствии `tools` у сервера — fallback на JSON-режим «инструмент по контракту» |
| Инструменты | **безопасные read-only обёртки** над `backend/queries.js` (никакой SQL-генерации от модели), с проверкой прав пользователя |
| Панель | Hybrid: десктоп — третьим flex-ребёнком с resize/push 380–420px; узкие экраны — full-screen overlay; на `minimalLayout` маршрутах скрыта |
| Жизненный цикл | панель — часть `LayoutV3.vue`, переживает переходы по разделам |
| История | бессрочно, в БД (`ar_ai_*`), схема `archrep` |
| Гейт | permission `ai_architect:use` + параметр `SYS_AI_ENABLED`; ключ `AI_API_KEY` — только env |
| Запись данных | **никогда** самим агентом: только UI-действие `open_form` / `prefill_form`, пользователь подтверждает сохранение в форме |
| Стартовый набор форм | системы + архитектурные заключения (ADR/заключения) |

## Архитектура (кратко)

- Функция **ядра** (не модуль по `docs/modules-contract.md`): маршруты `/api/ai/*`, права `ai_architect:*`, параметры `SYS_AI_*`, таблицы в схеме `archrep`. Используются существующие механизмы ядра: `PUBLIC_CONFIG_DEFAULTS`/`GET /api/config`, `routePermissions.js` + `permissionsCatalog.js` + `npm run check:routes`, `ar_settings_parameters`, dual-миграции.
- Backend: изолированный `backend/ai/` (`config`, `provider`, `tools`, `prompt`, `conversations`, `aiService`, `aiRoutes`), монтирование `app.use('/api/ai', createAiRouter(pool, queries))` **после** auth-middleware.
- Транспорт: `POST /api/ai/chat` — SSE (`meta`/`delta`/`tool`/`action`/`done`/`error`).
- UI-действия: сервер возвращает типизированное действие `{ type: 'open_form' | 'prefill_form', entityType, entityId?, mode, label, permission }`; фронт **перепроверяет права** и маппит `entityType → route` через реестр `frontend-v3/src/config/aiActions.js`.
- БД: `archrep.ar_ai_conversations`, `archrep.ar_ai_messages` (dual-миграция).

## Scope (эта задача)

1. Спека `docs/ai-architect.md` + раздел ADR (почему ядро, а не модуль; почему read-only инструменты; почему prefill, а не запись).
2. Dual-миграция `ar_ai_conversations` / `ar_ai_messages`.
3. RBAC: право `ai_architect:use` (+ матрица ролей), правила `/api/ai/*`, `npm run check:routes` зелёный.
4. Параметры `SYS_AI_*` (`PUBLIC_CONFIG_DEFAULTS` + `frontend-v3/src/config/params.js`), серверные секреты в `.env.example`.
5. Backend-модуль `backend/ai/`: агентный цикл, провайдер, инструменты-обёртки над `queries.js`, история диалогов, SSE.
6. Frontend: кнопка в футере `LayoutV3.vue`, `AiArchitectPanel.vue` (push/resizable + overlay), `AiActionCard.vue`, `useAiPanel.js`, `aiActions.js`, `api/aiClient.js`.
7. Prefill: архитектурные заключения — через существующий контракт `?payload=` (`DecisionAppliedForm.vue`); системы — поддержка того же `?payload=` в `SystemForm.vue`.

## Вне scope

- RAG/эмбеддинги, генерация SQL моделью, запись данных агентом без формы, мобильный UX, i18n.
- Rate-limit и стоимость токенов (отдельная задача при необходимости).

## Критерии готовности

- [ ] Спека `docs/ai-architect.md` (со ссылкой на этот issue) и ADR-раздел.
- [ ] Dual-миграция БД; история диалогов сохраняется и восстанавливается после перезагрузки страницы.
- [ ] `ai_architect:use` в каталоге прав и матрице ролей; правила `/api/ai/*` в `routePermissions.js`; `npm run check:routes` — OK.
- [ ] `SYS_AI_ENABLED=false` по умолчанию: кнопка панели не показывается; при включении — панель работает.
- [ ] Инструменты возвращают только данные, доступные текущему пользователю (проверка прав на сервере) и никогда не пишут в БД.
- [ ] Агент открывает формы (`open_form`) и заполняет черновики (`prefill_form`) с подтверждением пользователя в форме.
- [ ] Ключ LLM не попадает ни в `/api/config`, ни во фронт.

## Ссылки

- `docs/adding-new-api-endpoint.md` — чек-лист маршрут↔RBAC.
- `docs/access-control-design.md` — RBAC/deny-by-default.
- `docs/modules-contract.md` — почему это функция ядра, а не модуль (ADR в спеке).
- `backend/queries.js` — источник данных для инструментов.
- `docs/issue-51-applied-conclusion-diagrams.md` — контракт `?payload=` в форме заключения (prefill).

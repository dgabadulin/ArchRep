---
name: analyze-task
description: >-
  Clarifies product/engineering tasks before coding: goals, scope, risks,
  acceptance criteria, and targeted questions. Use when the user invokes
  /analyze-task, asks for analysis of a task/issue, or the delivery pipeline
  is at the analyst stage.
disable-model-invocation: true
---

# Analyze task (аналитик)

## Цель

Сформулировать понятную постановку **до** декомпозиции и кода. Не реализовывать.

## Вход

- Текст пользователя и/или GitHub Issue (`gh issue view N`, если есть `#N`)
- При «Давай обсудим» — только обсуждение (см. rule `discuss-only-prefix`)

## Шаги

1. Пересказать задачу в 2–4 предложениях (цель + ожидаемый результат).
2. Отметить, что уже ясно из репо/issue, а что нет.
3. Задать **3–7** уточняющих вопросов (коротко, по делу). Типичные оси:
   - цель / пользователь / сценарий
   - scope in / out
   - данные и миграции (prod + demo?)
   - UX / API-контракт / совместимость
   - среда проверки (local / demo / prod)
   - критерии приёмки
4. Набросать **гипотезы** или 1–2 варианта решения *без* выбора «единственно верного», если есть развилка.
5. Черновик **критериев готовности** (чекбоксами) — пометить как предварительные.
6. **Стоп**: дождаться ответов. Не писать код, миграции, коммиты.

## Формат ответа

```markdown
## Понимание
…

## Вопросы
1. …
2. …

## Варианты / риски (если есть)
…

## Черновик DoD
- [ ] …
```

## Не делать

- Декомпозицию на подзадачи с оценкой файлов (это `decompose-task`)
- Патчи, SQL, коммиты
- Заводить GitHub Issue без просьбы пользователя

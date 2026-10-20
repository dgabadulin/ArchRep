'use strict';

const express = require('express');

const { getAiConfig } = require('./aiConfig');
const { createToolRunner } = require('./tools');
const conversationStore = require('./conversations');
const { runAgent } = require('./aiService');

/**
 * HTTP-роутер ИИ-архитектора (issue #78, docs/ai-architect.md §3.1/§7).
 * Монтируется в index.js как `app.use('/api/ai', createAiRouter(pool, queries))` — после auth-middleware,
 * поэтому право `ai_architect:use` уже проверено по routePermissions.js (deny-by-default).
 * Транспорт чата — SSE: события `meta` / `delta` / `tool` / `action` / `notice` / `reset` / `done` / `error`.
 */

const MAX_MESSAGE_CHARS = 8000;
const HEARTBEAT_MS = 15000;

function userLoginOf(req) {
  const user = req.user || {};
  return String(user.login || user.email || user.id || 'anonymous');
}

function disabledResponse(res) {
  return res.status(503).json({
    error: 'ИИ-архитектор выключен (параметр SYS_AI_ENABLED=false).',
    code: 'AI_DISABLED',
  });
}

function serverError(res, err) {
  console.error('aiRoutes', err);
  return res.status(500).json({ error: (err && err.message) || 'Server error' });
}

function createAiRouter(pool, queries) {
  const router = express.Router();

  router.get('/status', (req, res) => {
    const cfg = getAiConfig();
    if (!cfg.enabled) return disabledResponse(res);
    const runner = createToolRunner({ pool, queries, permissions: req.permissions || [] });
    return res.json({
      enabled: true,
      configured: Boolean(cfg.apiKey && cfg.model),
      model: cfg.model || null,
      title: cfg.title,
      panel_width: cfg.panelWidth,
      history_limit: cfg.historyLimit,
      max_iterations: cfg.maxIterations,
      entity_types: runner.allowedTypes(),
      tools: runner.definitions.map((t) => (t.function && t.function.name) || t.name),
    });
  });

  router.get('/conversations', async (req, res) => {
    if (!getAiConfig().enabled) return disabledResponse(res);
    try {
      const limit = Number(req.query.limit) || 30;
      const rows = await conversationStore.listConversations(pool, userLoginOf(req), limit);
      res.json(rows);
    } catch (err) {
      serverError(res, err);
    }
  });

  router.post('/conversations', async (req, res) => {
    if (!getAiConfig().enabled) return disabledResponse(res);
    try {
      const title = req.body && req.body.title ? String(req.body.title).slice(0, 200) : 'Новый диалог';
      const row = await conversationStore.createConversation(pool, userLoginOf(req), title);
      res.status(201).json(row);
    } catch (err) {
      serverError(res, err);
    }
  });

  router.get('/conversations/:id', async (req, res) => {
    if (!getAiConfig().enabled) return disabledResponse(res);
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) return res.status(400).json({ error: 'Некорректный id диалога' });
      const conversation = await conversationStore.getConversation(pool, id, userLoginOf(req));
      if (!conversation) return res.status(404).json({ error: 'Диалог не найден' });
      const messages = await conversationStore.loadMessages(pool, id, 300);
      return res.json({ conversation, messages });
    } catch (err) {
      return serverError(res, err);
    }
  });

  router.delete('/conversations/:id', async (req, res) => {
    if (!getAiConfig().enabled) return disabledResponse(res);
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) return res.status(400).json({ error: 'Некорректный id диалога' });
      const okDeleted = await conversationStore.deleteConversation(pool, id, userLoginOf(req));
      if (!okDeleted) return res.status(404).json({ error: 'Диалог не найден' });
      return res.json({ deleted: true, id });
    } catch (err) {
      return serverError(res, err);
    }
  });

  router.post('/chat', async (req, res) => {
    const cfg = getAiConfig();
    if (!cfg.enabled) return disabledResponse(res);

    const message = String((req.body && req.body.message) || '').trim();
    if (!message) return res.status(400).json({ error: 'Поле message обязательно', code: 'AI_EMPTY_MESSAGE' });
    if (message.length > MAX_MESSAGE_CHARS) {
      return res.status(413).json({
        error: `Сообщение слишком длинное (максимум ${MAX_MESSAGE_CHARS} символов)`,
        code: 'AI_MESSAGE_TOO_LONG',
      });
    }
    if (!cfg.apiKey) {
      return res.status(503).json({
        error: 'ИИ-архитектор не настроен: на сервере не задан AI_API_KEY.',
        code: 'AI_NOT_CONFIGURED',
      });
    }
    if (!cfg.model) {
      return res.status(503).json({
        error:
          'ИИ-архитектор не настроен: не задана модель. Укажите SYS_AI_MODEL в env или параметр SYS_AI_MODEL в настройках (Настройки → Параметры).',
        code: 'AI_NOT_CONFIGURED',
      });
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    const abort = { aborted: false };
    const emit = (event, payload) => {
      if (abort.aborted || res.writableEnded) return;
      try {
        res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
      } catch (e) {
        abort.aborted = true;
      }
    };

    const heartbeat = setInterval(() => {
      if (abort.aborted || res.writableEnded) return;
      try {
        res.write(': ping\n\n');
      } catch (e) {
        abort.aborted = true;
      }
    }, HEARTBEAT_MS);

    res.on('close', () => {
      if (!res.writableEnded) abort.aborted = true;
    });

    try {
      await runAgent({
        pool,
        queries,
        user: req.user,
        permissions: req.permissions || [],
        roles: req.roles || [],
        conversationId: (req.body && req.body.conversation_id) || null,
        message,
        emit,
        signal: abort,
      });
    } catch (err) {
      console.error('aiRoutes /chat', err);
      emit('error', {
        message: (err && err.message) || 'Ошибка обращения к модели',
        code: (err && err.code) || 'AI_ERROR',
      });
    } finally {
      clearInterval(heartbeat);
      if (!res.writableEnded) res.end();
    }
  });

  return router;
}

module.exports = { createAiRouter };

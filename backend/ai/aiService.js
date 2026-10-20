'use strict';

const { getAiConfig } = require('./aiConfig');
const { streamChat, AiProviderError } = require('./provider');
const { buildSystemPrompt } = require('./prompt');
const { createToolRunner } = require('./tools');
const conversations = require('./conversations');

/**
 * Агентный цикл ИИ-архитектора (issue #78, docs/ai-architect.md §6).
 * Только чтение: инструменты — обёртки над queries.js; действия open_form/prefill_form/open_view
 * не выполняются на сервере, а отправляются в UI как карточки подтверждения.
 */

const TOOL_RESULT_MAX_CHARS = 12000;

function safeJson(value) {
  try {
    return JSON.stringify(value);
  } catch (e) {
    return String(value);
  }
}

function clip(text, max = TOOL_RESULT_MAX_CHARS) {
  const s = String(text == null ? '' : text);
  return s.length > max ? `${s.slice(0, max)}…(усечено)` : s;
}

/** Компактное сообщение о результате инструмента для БД и эмита в UI. */
function summarizeToolResult(name, res) {
  if (!res.ok) return `Ошибка: ${res.error}`;
  const r = res.result || {};
  switch (name) {
    case 'search_entities': {
      const found = (r.results || []).map((g) => `${g.entityLabel}: ${g.total}`).join(', ');
      return `Поиск «${r.query}» — ${found || 'ничего не найдено'}`;
    }
    case 'list_entities':
      return `Реестр «${r.entityLabel || r.entityType}»: всего ${r.total == null ? 0 : r.total}, показано ${(r.items || []).length}`;
    case 'get_entity':
      return `Запись ${r.entityType} #${r.id}: «${r.label || ''}»`;
    case 'get_home_stats':
      return `KPI главной: ${(r.kpiTiles || []).map((t) => `${t.title} = ${t.value}`).join('; ')}`;
    case 'get_relations': {
      const entity = r.entity || {};
      const who = `${entity.entityType || ''} #${entity.id == null ? '' : entity.id}${entity.label ? ` «${entity.label}»` : ''}`;
      return `Связи ${who}: всего ${r.total == null ? 0 : r.total}, показано ${(r.items || []).length}`;
    }
    case 'search_relations':
      return `Поиск связей «${r.query}»: всего ${r.total == null ? 0 : r.total}, показано ${(r.items || []).length}`;
    case 'list_relation_types':
      return `Типы связей метамодели: всего ${r.total == null ? 0 : r.total}, показано ${(r.items || []).length}`;
    case 'list_entity_types':
      return `Типы сущностей метамодели: всего ${r.total == null ? 0 : r.total}, показано ${(r.items || []).length}`;
    case 'list_adr_increment_statuses':
      return r.summary ? `Справочники контура инкремента — ${r.summary}` : 'Справочники контура инкремента';
    case 'open_form':
    case 'open_view':
    case 'prefill_form':
      return r.message || 'Подготовлено действие для формы';
    default:
      return 'Инструмент выполнен';
  }
}

/** Пользователь просит открыть или показать зависимости/граф — повод приложить фокус аналитики. */
function wantsDependencyFocus(text) {
  const t = String(text == null ? '' : text).toLowerCase();
  if (!t) return false;
  return /зависим/.test(t) || /граф/.test(t) || /анализ\s+связ/.test(t);
}

/** Есть ли уже среди действий хода переход на экран «Анализ зависимостей». */
function hasAnalyticsAction(actions) {
  return (
    Array.isArray(actions) && actions.some((a) => a && a.type === 'open_view' && a.entityType === 'analytics')
  );
}

/**
 * Последняя сущность, для которой считались связи: сначала из текущего хода (`get_relations`),
 * затем из истории (`payload.result.entity`). Нужна, чтобы приложить переход на граф без участия модели.
 */
function lastRelationsEntity({ relationsEntities, history } = {}) {
  const list = Array.isArray(relationsEntities) ? relationsEntities : [];
  if (list.length) return list[list.length - 1];
  const rows = Array.isArray(history) ? history : [];
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const row = rows[i];
    if (!row || row.role !== 'tool' || row.tool_name !== 'get_relations') continue;
    const entity = row.payload && row.payload.result && row.payload.result.entity;
    if (entity && entity.entityType && Number.isFinite(Number(entity.id))) return entity;
  }
  return null;
}

/** История диалога → сообщения модели (tool-строки передаём как текст для непрерывности). */
function toLlmHistory(rows) {
  const out = [];
  for (const row of rows) {
    if (row.role === 'user') {
      out.push({ role: 'user', content: row.content || '' });
    } else if (row.role === 'assistant') {
      if (row.content) out.push({ role: 'assistant', content: row.content });
    } else if (row.role === 'tool') {
      out.push({
        role: 'user',
        content: `[Результат инструмента ${row.tool_name || ''}] ${clip(safeJson(row.payload), 2000)}`,
      });
    }
  }
  return out;
}

function toOpenAiToolCall(call) {
  return {
    id: call.id,
    type: 'function',
    function: { name: call.name, arguments: call.raw || safeJson(call.arguments || {}) },
  };
}

/** Разбор JSON-ответа модели в режиме без tool-calling. */
function parseFallbackJson(raw) {
  let text = String(raw == null ? '' : raw).trim();
  if (!text) return null;
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(text);
  if (fence) text = fence[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (e) {
    return null;
  }
}

function userLoginOf(user) {
  if (!user) return 'anonymous';
  return String(user.login || user.email || user.id || 'anonymous');
}

function displayNameOf(user) {
  if (!user) return null;
  return user.display_name || user.login || null;
}


/**
 * Выполнение одного инструмента: права, эмит событий в SSE и запись в историю.
 */
async function executeToolCall({ runner, pool, conversationId, emitEvent, actions, llmMessages, fallback, name, args, toolCallId, parseError, relationsEntities }) {
  let res;
  if (parseError) {
    res = { ok: false, error: `Не удалось разобрать аргументы инструмента «${name}»: ${parseError}. Повтори вызов с корректным JSON.` };
  } else {
    res = await runner.run(name, args);
  }
  // Сущность со связями из этого хода — для детерминированного фокуса графа (см. runAgent).
  if (!parseError && res && res.ok && name === 'get_relations' && res.result && res.result.entity) {
    if (Array.isArray(relationsEntities)) relationsEntities.push(res.result.entity);
  }
  const payload = res.ok ? res.result || {} : { error: res.error };
  const summary = summarizeToolResult(name, res);

  if (res.action) {
    actions.push(res.action);
    emitEvent('action', res.action);
  }
  emitEvent('tool', {
    name,
    arguments: args || {},
    ok: Boolean(res.ok),
    summary,
    ...(res.ok ? {} : { error: res.error }),
  });

  await conversations.appendMessage(pool, conversationId, {
    role: 'tool',
    content: summary,
    toolName: name,
    payload: { result: payload, ...(res.action ? { action: res.action } : {}) },
  });

  const serialized = clip(safeJson(payload));
  if (fallback || !toolCallId) {
    llmMessages.push({ role: 'user', content: `[Результат инструмента ${name}] ${serialized}` });
  } else {
    llmMessages.push({ role: 'tool', tool_call_id: toolCallId, content: serialized });
  }
  return res;
}

/**
 * Основной агентный цикл.
 * @param {{ pool, queries, user, permissions, roles, conversationId, message, emit, signal }} params
 * @returns {Promise<{conversationId:number, message:string, actions:Array, finishReason:string}>}
 */
async function runAgent({ pool, queries, user, permissions, roles, conversationId, message, emit, signal }) {
  const cfg = getAiConfig();
  const emitEvent = typeof emit === 'function' ? emit : () => {};
  const text = String(message == null ? '' : message).trim();
  if (!text) throw new Error('Пустое сообщение');

  const userLogin = userLoginOf(user);
  const { conversation, created } = await conversations.getOrCreateConversation(pool, userLogin, conversationId, text);
  emitEvent('meta', {
    conversation_id: conversation.id,
    title: conversation.title,
    created,
    model: cfg.model,
  });
  await conversations.appendMessage(pool, conversation.id, { role: 'user', content: text });

  const runner = createToolRunner({ pool, queries, permissions });
  const promptBase = {
    userName: displayNameOf(user),
    roles,
    today: new Date().toISOString().slice(0, 10),
    allowedTypes: runner.allowedTypes(),
  };
  const history = await conversations.loadRecentMessages(pool, conversation.id, cfg.historyLimit);
  const llmMessages = [
    { role: 'system', content: buildSystemPrompt(promptBase) },
    ...toLlmHistory(history),
  ];

  const actions = [];
  const relationsEntities = [];
  const ctx = {
    runner,
    pool,
    conversationId: conversation.id,
    emitEvent,
    actions,
    relationsEntities,
    llmMessages,
    fallback: false,
  };

  let assistantText = '';
  let finished = false;
  let fallback = false;
  let toolRounds = 0;
  let calls = 0;
  const maxCalls = cfg.maxIterations + 3;

  while (calls < maxCalls && !finished) {
    if (signal && signal.aborted) break;
    calls += 1;
    ctx.fallback = fallback;
    const useTools = !fallback && toolRounds < cfg.maxIterations;
    const out = await streamChat(
      { messages: llmMessages, tools: useTools ? runner.definitions : [] },
      { onTextDelta: fallback ? null : (chunk) => emitEvent('delta', { text: chunk }) },
    );



    // Провайдер не принимает `tools` — переключаемся на JSON-протокол и повторяем шаг.
    if (out.toolsUnsupported && !fallback) {
      fallback = true;
      ctx.fallback = true;
      emitEvent('reset', {});
      emitEvent('notice', {
        code: 'AI_TOOLS_UNSUPPORTED',
        message: 'Провайдер не поддержал вызов инструментов — продолжаю в режиме JSON.',
      });
      llmMessages[0] = { role: 'system', content: buildSystemPrompt({ ...promptBase, toolsUnsupported: true }) };
      continue;
    }

    if (fallback) {
      const parsed = parseFallbackJson(out.content);
      const toolName = parsed && typeof parsed.tool === 'string' && parsed.tool ? parsed.tool : null;
      if (toolName && toolRounds < cfg.maxIterations) {
        toolRounds += 1;
        await executeToolCall({
          ...ctx,
          name: toolName,
          args: parsed.arguments && typeof parsed.arguments === 'object' ? parsed.arguments : {},
          toolCallId: null,
        });
        continue;
      }
      assistantText =
        parsed && typeof parsed.answer === 'string' && parsed.answer.trim()
          ? parsed.answer.trim()
          : String(out.content || '').trim();
      finished = true;
      continue;
    }

    if (out.toolCalls.length) {
      toolRounds += 1;
      llmMessages.push({
        role: 'assistant',
        content: out.content || '',
        tool_calls: out.toolCalls.map(toOpenAiToolCall),
      });
      for (const call of out.toolCalls) {
        await executeToolCall({
          ...ctx,
          name: call.name,
          args: call.arguments || {},
          toolCallId: call.id,
          parseError: call.parseError,
        });
      }
      continue;
    }

    assistantText = String(out.content || '').trim();
    finished = true;
  }

  // Детерминированный фокус графа. Модель часто НЕ прикладывает переход на повторных запросах
  // (отвечает из истории и не вызывает инструменты), а иногда и утверждает, что экран уже открыт.
  // В этом случае прикладываем `open_view` на «Анализ зависимостей» сами — по последней сущности
  // со связями (этот ход → история). Право `analytics:read` проверяет `runOpenView`.
  if (wantsDependencyFocus(text) && !hasAnalyticsAction(actions)) {
    const entity = lastRelationsEntity({ relationsEntities, history });
    if (entity) {
      const focusRes = await runner.run('open_view', {
        entityType: 'analytics',
        focusEntityType: entity.entityType,
        focusIds: [entity.id],
      });
      if (focusRes && focusRes.ok && focusRes.action) {
        actions.push(focusRes.action);
        emitEvent('action', focusRes.action);
      }
    }
  }

  if (!finished) {
    assistantText =
      assistantText ||
      'Достигнут лимит шагов обработки запроса. Уточните вопрос или попросите продолжить с уже найденными данными.';
    emitEvent('delta', { text: assistantText });
  }

  if (assistantText) {
    await conversations.appendMessage(pool, conversation.id, {
      role: 'assistant',
      content: assistantText,
      payload: actions.length ? { actions } : null,
    });
  }
  await conversations.touchConversation(pool, conversation.id);

  const finishReason = finished ? 'stop' : 'limit';
  emitEvent('done', {
    conversation_id: conversation.id,
    title: conversation.title,
    message: assistantText,
    actions,
    finish_reason: finishReason,
  });

  return { conversationId: conversation.id, message: assistantText, actions, finishReason };
}

module.exports = {
  runAgent,
  parseFallbackJson,
  toLlmHistory,
  summarizeToolResult,
  executeToolCall,
  wantsDependencyFocus,
  hasAnalyticsAction,
  lastRelationsEntity,
  AiProviderError,
};

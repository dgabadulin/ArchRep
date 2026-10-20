'use strict';

const { getAiConfig } = require('./aiConfig');

/**
 * Провайдер LLM для ИИ-архитектора (issue #78).
 * OpenAI-совместимый `/chat/completions` со стримингом SSE.
 * Модель ничего не пишет в БД: только текст + запросы инструментов (см. tools.js).
 */

class AiProviderError extends Error {
  constructor(message, { status = 502, code = 'AI_PROVIDER_ERROR' } = {}) {
    super(message);
    this.name = 'AiProviderError';
    this.status = status;
    this.code = code;
  }
}

function truncate(value, max = 500) {
  const s = String(value == null ? '' : value);
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function chatCompletionsUrl(baseUrl) {
  const base = String(baseUrl || '').replace(/\/+$/, '');
  if (!base) return '';
  return /\/chat\/completions$/.test(base) ? base : `${base}/chat/completions`;
}

function mergeToolCallDeltas(acc, deltas) {
  if (!Array.isArray(deltas)) return acc;
  for (const d of deltas) {
    if (!d) continue;
    const idx = Number.isInteger(d.index) ? d.index : acc.length;
    while (acc.length <= idx) acc.push({ id: '', name: '', args: '' });
    const slot = acc[idx];
    if (d.id) slot.id = d.id;
    if (d.function && d.function.name) slot.name = slot.name + d.function.name;
    if (d.function && d.function.arguments) slot.args += d.function.arguments;
  }
  return acc;
}

/** Приводит накопленные tool_calls к контракту { id, name, arguments }. */
function finalizeToolCalls(acc) {
  const out = [];
  acc.forEach((t, i) => {
    if (!t || !t.name) return;
    const raw = String(t.args || '').trim();
    let args = {};
    let parseError = null;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        args = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
      } catch (e) {
        parseError = 'Некорректный JSON в аргументах инструмента';
      }
    }
    out.push({ id: t.id || `call_${i}`, name: t.name, arguments: args, raw, parseError });
  });
  return out;
}


/** Разбор SSE-потока OpenAI-совместимого API. */
async function readSseStream(res, onTextDelta) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  const toolAcc = [];
  let content = '';
  let finishReason = null;
  let buffer = '';

  const handleChunk = (payload) => {
    if (!payload || payload === '[DONE]') return;
    let parsed = null;
    try {
      parsed = JSON.parse(payload);
    } catch (e) {
      return;
    }
    const choice = parsed.choices && parsed.choices[0];
    if (!choice) return;
    if (choice.finish_reason) finishReason = choice.finish_reason;
    const delta = choice.delta || {};
    if (typeof delta.content === 'string' && delta.content) {
      content += delta.content;
      if (typeof onTextDelta === 'function') onTextDelta(delta.content);
    }
    mergeToolCallDeltas(toolAcc, delta.tool_calls);
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep = buffer.indexOf('\n\n');
    while (sep !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      for (const line of frame.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':') || trimmed.startsWith('event:')) continue;
        if (trimmed.startsWith('data:')) handleChunk(trimmed.slice(5).trim());
      }
      sep = buffer.indexOf('\n\n');
    }
  }
  const tail = buffer.trim();
  if (tail.startsWith('data:')) handleChunk(tail.slice(5).trim());

  return { content, toolCalls: finalizeToolCalls(toolAcc), finishReason };
}

/** Ответ, пришедший не потоком (некоторые шлюзы игнорируют stream:true). */
function readJsonResponse(payload) {
  const choice = payload && payload.choices && payload.choices[0];
  const msg = (choice && choice.message) || {};
  const toolCalls = Array.isArray(msg.tool_calls)
    ? msg.tool_calls
        .map((t, i) => {
          const raw = String((t.function && t.function.arguments) || '').trim();
          let args = {};
          if (raw) {
            try {
              args = JSON.parse(raw);
            } catch (e) {
              args = {};
            }
          }
          return {
            id: t.id || `call_${i}`,
            name: (t.function && t.function.name) || '',
            arguments: args && typeof args === 'object' ? args : {},
            raw,
            parseError: null,
          };
        })
        .filter((t) => t.name)
    : [];
  return {
    content: typeof msg.content === 'string' ? msg.content : '',
    toolCalls,
    finishReason: (choice && choice.finish_reason) || null,
  };
}

async function postChat(payload, onTextDelta) {
  const cfg = getAiConfig();
  const url = chatCompletionsUrl(cfg.baseUrl);
  if (!url) throw new AiProviderError('Не задан AI_BASE_URL', { status: 503, code: 'AI_NOT_CONFIGURED' });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream, application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    if (e && (e.name === 'AbortError' || e.name === 'TimeoutError')) {
      throw new AiProviderError('Превышен таймаут ответа модели', { status: 504, code: 'AI_TIMEOUT' });
    }
    throw new AiProviderError(`Не удалось подключиться к модели: ${e && e.message}`, {
      status: 502,
      code: 'AI_UNREACHABLE',
    });
  }

  try {
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const err = new AiProviderError(`Модель вернула ${res.status}: ${truncate(text, 400)}`, {
        status: res.status === 429 ? 429 : 502,
        code: 'AI_UPSTREAM',
      });
      err.upstreamStatus = res.status;
      throw err;
    }
    const contentType = String(res.headers.get('content-type') || '');
    if (contentType.includes('application/json')) {
      const payloadJson = await res.json();
      return readJsonResponse(payloadJson);
    }
    return await readSseStream(res, onTextDelta);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Один вызов модели.
 * @returns {Promise<{content:string, toolCalls:Array, toolsUnsupported:boolean}>}
 *   `toolsUnsupported=true` — сервер не принимает массив `tools`, вызывающий код
 *   переключается на JSON-фолбэк (docs/ai-architect.md §6.3).
 */
async function streamChat({ messages, tools }, handlers = {}) {
  const cfg = getAiConfig();
  if (!cfg.apiKey) {
    throw new AiProviderError('ИИ-архитектор не настроен: не задан AI_API_KEY', {
      status: 503,
      code: 'AI_NOT_CONFIGURED',
    });
  }
  if (!cfg.model) {
    throw new AiProviderError(
      'ИИ-архитектор не настроен: не задана модель — укажите SYS_AI_MODEL в env или параметр SYS_AI_MODEL в настройках',
      { status: 503, code: 'AI_NOT_CONFIGURED' }
    );
  }
  const payload = {
    model: cfg.model,
    messages,
    stream: true,
    temperature: cfg.temperature,
    max_tokens: cfg.maxTokens,
  };
  const list = Array.isArray(tools) ? tools : [];
  if (list.length) {
    payload.tools = list;
    payload.tool_choice = 'auto';
  }

  try {
    const out = await postChat(payload, handlers.onTextDelta);
    return { content: out.content, toolCalls: out.toolCalls, toolsUnsupported: false };
  } catch (e) {
    const upstream = e && e.upstreamStatus;
    if (list.length && (upstream === 400 || upstream === 422)) {
      const retry = { ...payload };
      delete retry.tools;
      delete retry.tool_choice;
      const out = await postChat(retry, handlers.onTextDelta);
      return { content: out.content, toolCalls: [], toolsUnsupported: true };
    }
    throw e;
  }
}

module.exports = { streamChat, AiProviderError, chatCompletionsUrl };

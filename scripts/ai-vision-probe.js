#!/usr/bin/env node
'use strict';

/**
 * Проверка поддержки изображений (vision) у модели ИИ-архитектора (issue #95, п.3).
 *
 * Зачем: прикрепление изображений в чате включается параметром `SYS_AI_VISION_ENABLED`.
 * Включать его «на всякий случай» нельзя: если модель не принимает `image_url`, каждый
 * запрос с картинкой будет падать. Этот скрипт даёт однозначный ответ.
 *
 * Запуск (на сервере, где заданы env модели):
 *   node scripts/ai-vision-probe.js
 *   node scripts/ai-vision-probe.js --model Qwen/Qwen2.5-VL-7B-Instruct
 *
 * Переменные: `AI_BASE_URL`, `AI_API_KEY`, `SYS_AI_MODEL` (или флаг `--model`).
 * Секреты не печатаются. Код выхода: 0 — изображения поддерживаются, 1 — нет, 2 — ошибка проверки.
 */

const { chatCompletionsUrl } = require('../backend/ai/provider');

/** 1×1 PNG — минимальная валидная картинка для пробы. */
const PIXEL_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

function argValue(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return '';
}

function fail(message, code = 2) {
  console.error(`vision: error — ${message}`);
  process.exit(code);
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log('Usage: node scripts/ai-vision-probe.js [--model <name>]');
    return;
  }

  const baseUrl = String(process.env.AI_BASE_URL || '').trim();
  const apiKey = String(process.env.AI_API_KEY || '').trim();
  const model = String(argValue('model') || process.env.SYS_AI_MODEL || '').trim();

  if (!baseUrl) fail('не задан AI_BASE_URL (env API)');
  if (!apiKey) fail('не задан AI_API_KEY (env API)');
  if (!model) fail('не задана модель: SYS_AI_MODEL или --model');

  const url = chatCompletionsUrl(baseUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  console.log(`[vision-probe] model=${model} url=${url}`);

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        max_tokens: 16,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Ответь одним словом: какой цвет на изображении?' },
              { type: 'image_url', image_url: { url: `data:image/png;base64,${PIXEL_PNG}` } },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    fail(`запрос не выполнен: ${(e && e.message) || e}`);
  }
  clearTimeout(timer);

  const text = await res.text().catch(() => '');
  if (res.ok) {
    let answer = '';
    try {
      const json = JSON.parse(text);
      const msg = json && json.choices && json.choices[0] && json.choices[0].message;
      answer = String((msg && msg.content) || '').slice(0, 200);
    } catch (_) {
      answer = String(text).slice(0, 200);
    }
    console.log(`vision: supported — модель приняла image_url. Ответ: ${answer || '(пусто)'}`);
    console.log('Включите параметр SYS_AI_VISION_ENABLED=true (Настройки → Параметры, группа «ИИ-архитектор»).');
    return;
  }

  const snippet = String(text).slice(0, 400);
  const mentionsContent = /image_url|image|content|multimodal|vision|unsupported|not supported/i.test(snippet);
  if ((res.status === 400 || res.status === 422) && mentionsContent) {
    console.log(`vision: not supported — модель отклонила изображение (HTTP ${res.status}).`);
    console.log(`Ответ модели: ${snippet}`);
    console.log('Оставьте SYS_AI_VISION_ENABLED=false: текстовые вложения продолжат работать.');
    process.exit(1);
  }

  fail(`неожиданный ответ HTTP ${res.status}: ${snippet}`, 2);
}

main().catch((e) => fail((e && e.message) || String(e)));

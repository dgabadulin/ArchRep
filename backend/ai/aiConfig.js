'use strict';

const { getParam } = require('../settingsParams');

/**
 * ИИ-архитектор (issue #78): конфигурация.
 *
 * Секреты (`AI_API_KEY`, `AI_BASE_URL`) — только env сервера, в `/api/config` не публикуются.
 * Публичные параметры `SYS_AI_*` — из `ar_settings_parameters` (см. `PUBLIC_CONFIG_DEFAULTS` в index.js).
 * Приоритет: env → параметр БД → дефолт в коде (docs/ai-architect.md §5).
 *
 * Исключение: `SYS_AI_MODEL` — дефолта в коде НЕТ. Имя модели задаётся только в env (`SYS_AI_MODEL`)
 * или в параметре БД `SYS_AI_MODEL` (группа «ИИ-архитектор»); если не задано нигде — функция считается
 * ненастроенной (503 `AI_NOT_CONFIGURED`), чтобы провайдер не получал пустое имя модели.
 */

/** Дефолты публичных параметров (должны совпадать с официальными сидами в DB/scripts). */
const PUBLIC_DEFAULTS = {
  SYS_AI_ENABLED: false,
  /** Имя модели: значение приходит из env или параметра БД, дефолт в коде не хранится (см. комментарий выше). */
  SYS_AI_MODEL: '',
  SYS_AI_TITLE: 'ИИ-архитектор',
  SYS_AI_PANEL_WIDTH: 400,
  SYS_AI_HISTORY_LIMIT: 20,
  /**
   * Ограничения структурного черновика `prefill_form` (issue #91). Используются ИИ-архитектором
   * при генерации ADR: сервер проверяет предложенный состав заключения по этим лимитам и бюджету размера
   * (`backend/ai/tools.js`), а значения уходят и в описание инструмента для модели.
   */
  SYS_AI_PREFILL_MAX_INCREMENTS: 10,
  SYS_AI_PREFILL_MAX_SYSTEMS: 30,
  SYS_AI_PREFILL_MAX_FUNCTIONS: 20,
  SYS_AI_PREFILL_MAX_RELATIONS: 30,
  /** Бюджет структурной части черновика по размеру JSON (символы) — черновик открывается ссылкой `?payload=`. */
  SYS_AI_PREFILL_MAX_JSON_CHARS: 5000,
  /** Максимум id в фокусе экрана «Анализ зависимостей» (диплинк `?entity=&ids=`) — согласован с фронтом. */
  SYS_AI_FOCUS_MAX_IDS: 50,
};

/** Серверные дефолты (только env). */
const ENV_DEFAULTS = {
  // Адрес LLM-шлюза задаётся только через env (`.env.production` / secret store); в коде значения нет.
  AI_BASE_URL: '',
  AI_TIMEOUT_MS: 120000,
  AI_MAX_TOKENS: 2048,
  AI_TEMPERATURE: 0.2,
  AI_MAX_ITERATIONS: 6,
};

function parseBool(value, def = false) {
  if (value == null || String(value).trim() === '') return def;
  const v = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on', 'да'].includes(v)) return true;
  if (['0', 'false', 'no', 'off', 'нет'].includes(v)) return false;
  return def;
}

function envStr(name) {
  const raw = process.env[name];
  return raw == null ? '' : String(raw).trim();
}

function envNum(name, def) {
  const raw = envStr(name);
  if (!raw) return def;
  const v = Number(raw);
  return Number.isFinite(v) ? v : def;
}

function clamp(v, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.min(Math.max(n, min), max);
}

function enabledFromEnv() {
  const raw = envStr('SYS_AI_ENABLED');
  return raw === '' ? null : parseBool(raw, false);
}

/** Функция включена (кнопка/панель/маршруты). Приоритет: env → БД → дефолт. */
function isEnabled() {
  const env = enabledFromEnv();
  if (env !== null) return env;
  return Boolean(getParam('SYS_AI_ENABLED', PUBLIC_DEFAULTS.SYS_AI_ENABLED));
}

/** Имя модели из env (приоритет). Пустая строка — если переменная не задана. */
function modelFromEnv() {
  return envStr('SYS_AI_MODEL');
}

/**
 * Имя модели: env `SYS_AI_MODEL` → параметр БД `SYS_AI_MODEL` → `''`.
 * Дефолта в коде нет; пустое значение = функция не настроена (проверяется в provider.js / aiRoutes.js).
 */
function resolveModel() {
  const env = modelFromEnv();
  if (env) return env;
  return String(getParam('SYS_AI_MODEL', PUBLIC_DEFAULTS.SYS_AI_MODEL) || '').trim();
}

/** Полная серверная конфигурация (в том числе секреты) — только для backend. */
function getAiConfig() {
  const model = resolveModel();
  const title = String(getParam('SYS_AI_TITLE', PUBLIC_DEFAULTS.SYS_AI_TITLE) || PUBLIC_DEFAULTS.SYS_AI_TITLE).trim();
  return {
    enabled: isEnabled(),
    baseUrl: envStr('AI_BASE_URL') || ENV_DEFAULTS.AI_BASE_URL,
    apiKey: envStr('AI_API_KEY'),
    model,
    title: title || PUBLIC_DEFAULTS.SYS_AI_TITLE,
    panelWidth: clamp(getParam('SYS_AI_PANEL_WIDTH', PUBLIC_DEFAULTS.SYS_AI_PANEL_WIDTH), 380, 720),
    historyLimit: clamp(getParam('SYS_AI_HISTORY_LIMIT', PUBLIC_DEFAULTS.SYS_AI_HISTORY_LIMIT), 4, 100),
    timeoutMs: clamp(envNum('AI_TIMEOUT_MS', ENV_DEFAULTS.AI_TIMEOUT_MS), 5000, 600000),
    maxTokens: clamp(envNum('AI_MAX_TOKENS', ENV_DEFAULTS.AI_MAX_TOKENS), 256, 32768),
    temperature: clamp(envNum('AI_TEMPERATURE', ENV_DEFAULTS.AI_TEMPERATURE), 0, 2),
    maxIterations: clamp(envNum('AI_MAX_ITERATIONS', ENV_DEFAULTS.AI_MAX_ITERATIONS), 1, 12),
  };
}

/** Переопределение публичных значений из env (аналог DRAWIO_EMBED_BASE / TECH_RADAR_EMBED_URL). */
function aiPublicEnvOverrides(out) {
  const env = enabledFromEnv();
  if (env !== null) out.SYS_AI_ENABLED = env;
  const model = modelFromEnv();
  if (model) out.SYS_AI_MODEL = model;
  return out;
}

module.exports = {
  PUBLIC_DEFAULTS,
  ENV_DEFAULTS,
  getAiConfig,
  isEnabled,
  aiPublicEnvOverrides,
  resolveModel,
  parseBool,
};

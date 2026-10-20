'use strict';

/**
 * История диалогов ИИ-архитектора (issue #78).
 * Таблицы: archrep.ar_ai_conversations / archrep.ar_ai_messages (dual-миграция 20261001120000).
 * Все выборки — строго по user_login текущего пользователя.
 */

const SQL = {
  insertConversation: `
    INSERT INTO archrep.ar_ai_conversations (user_login, title)
    VALUES ($1, $2)
    RETURNING id, title, created_at, updated_at`,
  getConversation: `
    SELECT id, user_login, title, created_at, updated_at
    FROM archrep.ar_ai_conversations
    WHERE id = $1 AND user_login = $2`,
  listConversations: `
    SELECT id, title, created_at, updated_at
    FROM archrep.ar_ai_conversations
    WHERE user_login = $1
    ORDER BY updated_at DESC
    LIMIT $2`,
  touchConversation: `
    UPDATE archrep.ar_ai_conversations
    SET updated_at = now()
    WHERE id = $1`,
  deleteConversation: `
    DELETE FROM archrep.ar_ai_conversations
    WHERE id = $1 AND user_login = $2`,
  insertMessage: `
    INSERT INTO archrep.ar_ai_messages (conversation_id, role, content, tool_name, payload)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, role, content, tool_name, payload, created_at`,
  listMessages: `
    SELECT id, role, content, tool_name, payload, created_at
    FROM archrep.ar_ai_messages
    WHERE conversation_id = $1
    ORDER BY id
    LIMIT $2`,
  recentMessages: `
    SELECT id, role, content, tool_name, payload, created_at
    FROM (
      SELECT id, role, content, tool_name, payload, created_at
      FROM archrep.ar_ai_messages
      WHERE conversation_id = $1
      ORDER BY id DESC
      LIMIT $2
    ) t
    ORDER BY id`,
};

function deriveTitle(text, max = 80) {
  const clean = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
  if (!clean) return 'Новый диалог';
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

async function createConversation(pool, userLogin, title) {
  const res = await pool.query(SQL.insertConversation, [userLogin, deriveTitle(title)]);
  return res.rows[0];
}

async function listConversations(pool, userLogin, limit = 30) {
  const res = await pool.query(SQL.listConversations, [userLogin, Math.min(Math.max(limit, 1), 100)]);
  return res.rows;
}

async function getConversation(pool, conversationId, userLogin) {
  const res = await pool.query(SQL.getConversation, [conversationId, userLogin]);
  return res.rows[0] || null;
}

/** Возвращает диалог пользователя, создавая новый при отсутствии/чужом id. */
async function getOrCreateConversation(pool, userLogin, conversationId, firstMessage) {
  const id = Number.parseInt(conversationId, 10);
  if (Number.isFinite(id)) {
    const existing = await getConversation(pool, id, userLogin);
    if (existing) return { conversation: existing, created: false };
  }
  const created = await createConversation(pool, userLogin, firstMessage);
  return { conversation: created, created: true };
}

async function touchConversation(pool, conversationId) {
  await pool.query(SQL.touchConversation, [conversationId]);
}

async function deleteConversation(pool, conversationId, userLogin) {
  const res = await pool.query(SQL.deleteConversation, [conversationId, userLogin]);
  return res.rowCount > 0;
}

async function appendMessage(pool, conversationId, { role, content = '', toolName = null, payload = null }) {
  const res = await pool.query(SQL.insertMessage, [conversationId, role, content, toolName, payload]);
  return res.rows[0];
}

async function loadMessages(pool, conversationId, limit = 200) {
  const res = await pool.query(SQL.listMessages, [conversationId, Math.min(Math.max(limit, 1), 500)]);
  return res.rows;
}

async function loadRecentMessages(pool, conversationId, limit = 20) {
  const res = await pool.query(SQL.recentMessages, [conversationId, Math.min(Math.max(limit, 1), 100)]);
  return res.rows;
}

module.exports = {
  SQL,
  deriveTitle,
  createConversation,
  listConversations,
  getConversation,
  getOrCreateConversation,
  touchConversation,
  deleteConversation,
  appendMessage,
  loadMessages,
  loadRecentMessages,
};

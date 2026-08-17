'use strict';

const { sendEmail } = require('../mail/mailer');

function parseRecipients(raw) {
  if (!raw) return [];
  return String(raw)
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function daysUntil(dateValue) {
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(d);
  exp.setHours(0, 0, 0, 0);
  return Math.round((exp - today) / (24 * 60 * 60 * 1000));
}

function formatDateRu(dateValue) {
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return String(dateValue);
  return d.toLocaleDateString('ru-RU');
}

function buildEmailHtml(domains, thresholdDays) {
  const rows = domains
    .map((d) => {
      const days = daysUntil(d.expires_at);
      return `<tr>
        <td>${escapeHtml(d.name)}</td>
        <td>${formatDateRu(d.expires_at)}</td>
        <td>${days != null ? days : '—'}</td>
        <td>${escapeHtml(d.status_name || d.status_code || '—')}</td>
        <td>${escapeHtml(d.registrar_name || '—')}</td>
        <td>${escapeHtml(d.business_owner_name || '—')}</td>
      </tr>`;
    })
    .join('');
  return `<!DOCTYPE html><html><body>
    <p>Домены с истекающим сроком регистрации (в течение ${thresholdDays} дней):</p>
    <table border="1" cellpadding="6" cellspacing="0">
      <thead><tr>
        <th>Домен</th><th>Окончание</th><th>Дней</th><th>Статус</th><th>Регистратор</th><th>Владелец</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p><small>ИСАР — автоматическое уведомление Job Runner</small></p>
  </body></html>`;
}

function buildEmailText(domains, thresholdDays) {
  const lines = [
    `Домены с истекающим сроком (в течение ${thresholdDays} дней):`,
    '',
    ...domains.map((d) => {
      const days = daysUntil(d.expires_at);
      return `- ${d.name} | ${formatDateRu(d.expires_at)} | ${days != null ? days : '?'} дн. | ${d.status_name || d.status_code || ''}`;
    }),
  ];
  return lines.join('\n');
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function findDomainsExpiringWithin(pool, queries, thresholdDays) {
  const days = Math.max(0, Number(thresholdDays) || 0);
  const r = await pool.query(queries.domains_select_expiring, [days]);
  return r.rows;
}

async function notifyExpiringDomains(pool, queries, { thresholdDays, recipientsRaw }) {
  const domains = await findDomainsExpiringWithin(pool, queries, thresholdDays);
  const recipients = parseRecipients(recipientsRaw);

  if (domains.length === 0) {
    return {
      domains_found: 0,
      email_sent: false,
      threshold_days: thresholdDays,
    };
  }

  if (!recipients.length) {
    return {
      domains_found: domains.length,
      email_sent: false,
      skip_reason: 'no_recipient',
      threshold_days: thresholdDays,
    };
  }

  const subject = `[ИСАР] Истекают сроки доменов (${domains.length})`;
  const text = buildEmailText(domains, thresholdDays);
  const html = buildEmailHtml(domains, thresholdDays);
  const mailResult = await sendEmail({ to: recipients, subject, text, html });

  return {
    domains_found: domains.length,
    email_sent: true,
    recipients,
    threshold_days: thresholdDays,
    domain_ids: domains.map((d) => d.id),
    message_id: mailResult.messageId,
  };
}

module.exports = {
  findDomainsExpiringWithin,
  notifyExpiringDomains,
  parseRecipients,
  daysUntil,
};

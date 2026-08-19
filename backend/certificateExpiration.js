'use strict';

const { sendEmail } = require('./mail/mailer');
const { parseRecipients, daysUntil } = require('./domainExpiration');

function formatDateRu(dateValue) {
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return String(dateValue);
  return d.toLocaleDateString('ru-RU');
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildEmailHtml(certificates, thresholdDays) {
  const rows = certificates
    .map((c) => {
      const days = daysUntil(c.expires_at);
      return `<tr>
        <td>${escapeHtml(c.domain_name)}</td>
        <td>${escapeHtml(c.code)}</td>
        <td>${formatDateRu(c.expires_at)}</td>
        <td>${days != null ? days : '—'}</td>
        <td>${escapeHtml(c.responsible_name || '—')}</td>
      </tr>`;
    })
    .join('');
  return `<!DOCTYPE html><html><body>
    <p>Сертификаты с истекающим сроком действия (в течение ${thresholdDays} дней):</p>
    <table border="1" cellpadding="6" cellspacing="0">
      <thead><tr>
        <th>Домен</th><th>Код сертификата</th><th>Окончание</th><th>Дней</th><th>Ответственный</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p><small>ИСАР — автоматическое уведомление Job Runner</small></p>
  </body></html>`;
}

function buildEmailText(certificates, thresholdDays) {
  const lines = [
    `Сертификаты с истекающим сроком действия (в течение ${thresholdDays} дней):`,
    '',
    ...certificates.map((c) => {
      const days = daysUntil(c.expires_at);
      return `- ${c.domain_name} | ${c.code} | ${formatDateRu(c.expires_at)} | ${days != null ? days : '?'} дн. | ${c.responsible_name || ''}`;
    }),
  ];
  return lines.join('\n');
}

async function findCertificatesExpiringWithin(pool, queries, thresholdDays) {
  const days = Math.max(0, Number(thresholdDays) || 0);
  const r = await pool.query(queries.certificates_select_expiring, [days]);
  return r.rows;
}

async function notifyExpiringCertificates(pool, queries, { thresholdDays, recipientsRaw }) {
  const certificates = await findCertificatesExpiringWithin(pool, queries, thresholdDays);
  const recipients = parseRecipients(recipientsRaw);

  if (certificates.length === 0) {
    return {
      certificates_found: 0,
      email_sent: false,
      threshold_days: thresholdDays,
    };
  }

  if (!recipients.length) {
    return {
      certificates_found: certificates.length,
      email_sent: false,
      skip_reason: 'no_recipient',
      threshold_days: thresholdDays,
    };
  }

  const subject = `[ИСАР] Истекают сроки сертификатов (${certificates.length})`;
  const text = buildEmailText(certificates, thresholdDays);
  const html = buildEmailHtml(certificates, thresholdDays);
  const mailResult = await sendEmail({ to: recipients, subject, text, html });

  return {
    certificates_found: certificates.length,
    email_sent: true,
    recipients,
    threshold_days: thresholdDays,
    certificate_ids: certificates.map((c) => c.id),
    message_id: mailResult.messageId,
  };
}

module.exports = {
  findCertificatesExpiringWithin,
  notifyExpiringCertificates,
};

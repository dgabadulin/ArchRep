'use strict';

const { sendEmail } = require('./mail/mailer');
const { parseRecipients } = require('./domainExpiration');

const MIN_INTERVAL_SECONDS = 3600;
const DEFAULT_INTERVAL_SECONDS = 86400;

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDateRu(dateValue) {
  if (!dateValue) return '—';
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return String(dateValue);
  return d.toLocaleDateString('ru-RU');
}

function placementIntervalSeconds(raw, fallbackSeconds) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < MIN_INTERVAL_SECONDS) {
    const fb = Number(fallbackSeconds);
    if (Number.isFinite(fb) && fb >= MIN_INTERVAL_SECONDS) return Math.floor(fb);
    return DEFAULT_INTERVAL_SECONDS;
  }
  return Math.floor(n);
}

function resolvePrimaryRecipients(certificate, fallbackRaw) {
  const direct = String(certificate.responsible_email || '').trim();
  if (direct) return [direct];
  return parseRecipients(fallbackRaw);
}

function buildSystemsTableRows(webResources) {
  if (!webResources.length) {
    return {
      html: '<p>На домене нет опубликованных веб-ресурсов.</p>',
      text: 'На домене нет опубликованных веб-ресурсов.',
    };
  }

  const htmlRows = webResources
    .map((wr) => `<tr>
      <td>${escapeHtml(wr.root_system_name)}</td>
      <td>${escapeHtml(wr.module_name || '—')}</td>
      <td>${escapeHtml(wr.web_resource_label)}</td>
      <td>${escapeHtml(wr.publication_url || '—')}</td>
      <td>${escapeHtml(wr.it_lead_name || '—')}</td>
    </tr>`)
    .join('');

  const textRows = webResources.map((wr) => [
    wr.root_system_name,
    wr.module_name || '—',
    wr.web_resource_label,
    wr.publication_url || '—',
    wr.it_lead_name || '—',
  ].join(' | ')).join('\n');

  return {
    html: `<table border="1" cellpadding="6" cellspacing="0">
      <thead><tr>
        <th>Корневая ИС</th><th>Модуль</th><th>Веб-ресурс</th><th>URL публикации</th><th>Ответственный от ИТ</th>
      </tr></thead>
      <tbody>${htmlRows}</tbody>
    </table>`,
    text: `ИС, опубликованные на домене:\n${textRows}`,
  };
}

function buildEmailContent(certificate, webResources) {
  const systems = buildSystemsTableRows(webResources);
  const wildcard = certificate.wildcard_flag ? 'Да' : 'Нет';
  const ca = certificate.ca_name || '—';

  const text = [
    `Размещён сертификат ${certificate.code} для домена ${certificate.domain_name}.`,
    '',
    `Код: ${certificate.code}`,
    `Домен: ${certificate.domain_name}`,
    `Дата выпуска: ${formatDateRu(certificate.issued_at)}`,
    `Дата окончания: ${formatDateRu(certificate.expires_at)}`,
    `Wildcard: ${wildcard}`,
    `Сертификационный центр: ${ca}`,
    `Ссылка на размещение: ${certificate.placement_url}`,
    '',
    systems.text,
    '',
    'ИСАР — автоматическое уведомление Job Runner',
  ].join('\n');

  const html = `<!DOCTYPE html><html><body>
    <p>Размещён сертификат <strong>${escapeHtml(certificate.code)}</strong> для домена <strong>${escapeHtml(certificate.domain_name)}</strong>.</p>
    <ul>
      <li>Дата выпуска: ${formatDateRu(certificate.issued_at)}</li>
      <li>Дата окончания: ${formatDateRu(certificate.expires_at)}</li>
      <li>Wildcard: ${wildcard}</li>
      <li>Сертификационный центр: ${escapeHtml(ca)}</li>
      <li>Ссылка на размещение: ${escapeHtml(certificate.placement_url)}</li>
    </ul>
    <p><strong>ИС, опубликованные на домене</strong></p>
    ${systems.html}
    <p><small>ИСАР — автоматическое уведомление Job Runner</small></p>
  </body></html>`;

  return {
    subject: `[ИСАР] Размещён сертификат: ${certificate.domain_name} (${certificate.code})`,
    text,
    html,
  };
}

async function findPendingPlacementCertificates(pool, queries) {
  const r = await pool.query(queries.certificates_select_pending_placement_notify);
  return r.rows;
}

async function findPublishedWebResourcesForDomain(pool, queries, domainId) {
  const r = await pool.query(queries.certificates_select_published_web_resources_by_domain, [domainId]);
  return r.rows.map((row) => ({
    ...row,
    web_resource_label: row.short_name || row.code || `WR-${row.id}`,
  }));
}

async function markPlacementNotified(pool, queries, certificateId) {
  await pool.query(queries.certificates_mark_placement_notified, [certificateId]);
}

async function notifyCertificatePlacements(pool, queries, {
  fallbackEmailRaw,
  additionalEmailRaw,
}) {
  const certificates = await findPendingPlacementCertificates(pool, queries);
  const result = {
    certificates_pending: certificates.length,
    emails_sent: 0,
    skipped_no_recipient: 0,
    certificate_ids: [],
    errors: [],
  };

  if (certificates.length === 0) {
    return result;
  }

  for (const certificate of certificates) {
    const to = resolvePrimaryRecipients(certificate, fallbackEmailRaw);
    const cc = parseRecipients(additionalEmailRaw);

    if (!to.length) {
      result.skipped_no_recipient += 1;
      continue;
    }

    let webResources;
    try {
      webResources = await findPublishedWebResourcesForDomain(pool, queries, certificate.ar_domains_id);
    } catch (err) {
      result.errors.push({ certificate_id: certificate.id, message: err.message || String(err) });
      continue;
    }

    const { subject, text, html } = buildEmailContent(certificate, webResources);

    try {
      await sendEmail({ to, cc: cc.length ? cc : undefined, subject, text, html });
      await markPlacementNotified(pool, queries, certificate.id);
      result.emails_sent += 1;
      result.certificate_ids.push(certificate.id);
    } catch (err) {
      result.errors.push({ certificate_id: certificate.id, message: err.message || String(err) });
    }
  }

  return result;
}

module.exports = {
  MIN_INTERVAL_SECONDS,
  DEFAULT_INTERVAL_SECONDS,
  placementIntervalSeconds,
  findPendingPlacementCertificates,
  findPublishedWebResourcesForDomain,
  notifyCertificatePlacements,
  buildEmailContent,
};

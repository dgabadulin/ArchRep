'use strict';

const { notifyCertificatePlacements } = require('../../certificatePlacementNotify');

async function certificatePlacementNotify(ctx) {
  const fallbackEmailRaw = ctx.getParam('CHK_CERT_PLACEMENT_EMAIL', '');
  const additionalEmailRaw = ctx.getParam('CHK_CERT_PLACEMENT_EMAIL_ADD', '');

  const result = await notifyCertificatePlacements(ctx.pool, ctx.queries, {
    fallbackEmailRaw,
    additionalEmailRaw,
  });

  let message;
  if (result.certificates_pending === 0) {
    message = 'Сертификатов с новым размещением не найдено';
  } else if (result.emails_sent === 0 && result.skipped_no_recipient > 0 && !result.errors.length) {
    message = `Ожидало отправки: ${result.certificates_pending}; пропущено (нет получателя): ${result.skipped_no_recipient}`;
  } else if (result.emails_sent > 0) {
    message = `Отправлено писем: ${result.emails_sent} из ${result.certificates_pending}`;
    if (result.skipped_no_recipient) {
      message += `; пропущено (нет получателя): ${result.skipped_no_recipient}`;
    }
    if (result.errors.length) {
      message += `; ошибок: ${result.errors.length}`;
    }
  } else if (result.errors.length) {
    message = `Ошибки отправки: ${result.errors.length}`;
  } else {
    message = `Ожидало отправки: ${result.certificates_pending}`;
  }

  return { ...result, message };
}

module.exports = { certificatePlacementNotify };

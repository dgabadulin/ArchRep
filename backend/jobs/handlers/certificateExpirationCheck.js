'use strict';

const { notifyExpiringCertificates } = require('../../certificateExpiration');

async function certificateExpirationCheck(ctx) {
  const thresholdDays = Number(ctx.getParam('CHK_CERT_EXPIRATION', 30)) || 30;
  const recipientsRaw = ctx.getParam('CHK_CERT_EXPIRATION_EMAIL', '');

  const result = await notifyExpiringCertificates(ctx.pool, ctx.queries, {
    thresholdDays,
    recipientsRaw,
  });

  let message;
  if (result.certificates_found === 0) {
    message = 'Истекающих сертификатов не найдено';
  } else if (!result.email_sent && result.skip_reason === 'no_recipient') {
    message = `Найдено ${result.certificates_found} сертификат(ов); email не отправлен — не задан CHK_CERT_EXPIRATION_EMAIL`;
  } else if (result.email_sent) {
    message = `Отправлено уведомление по ${result.certificates_found} сертификатам`;
  } else {
    message = `Найдено ${result.certificates_found} сертификат(ов)`;
  }

  return { ...result, message };
}

module.exports = { certificateExpirationCheck };

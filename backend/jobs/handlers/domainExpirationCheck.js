'use strict';

const { notifyExpiringDomains } = require('../domainExpiration');

/**
 * @param {import('./context').JobContext} ctx
 */
async function domainExpirationCheck(ctx) {
  const thresholdDays = Number(ctx.getParam('CHK_DOMAIN_EXPIRATION', 30)) || 30;
  const recipientsRaw = ctx.getParam('CHK_DOMAIN_EXPIRATION_EMAIL', '');

  const result = await notifyExpiringDomains(ctx.pool, ctx.queries, {
    thresholdDays,
    recipientsRaw,
  });

  let message = '';
  if (result.domains_found === 0) {
    message = 'Доменов в окне нет';
  } else if (!result.email_sent && result.skip_reason === 'no_recipient') {
    message = `Найдено ${result.domains_found} домен(ов); email не отправлен — не задан CHK_DOMAIN_EXPIRATION_EMAIL`;
  } else if (result.email_sent) {
    message = `Отправлено письмо: ${result.domains_found} домен(ов)`;
  }

  return { ...result, message };
}

module.exports = { domainExpirationCheck };

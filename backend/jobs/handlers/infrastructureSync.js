'use strict';

const { syncInfrastructureFromNetbox } = require('../../infrastructureSync');

/**
 * Задание «Синхронизация каталога инфраструктуры (Netbox)».
 * Вся логика — в переиспользуемой операции; handler только передаёт контекст и сообщение.
 */
async function infrastructureSync(ctx) {
  const summary = await syncInfrastructureFromNetbox(ctx.pool, {
    queries: ctx.queries,
    log: ctx.log,
  });
  return summary;
}

module.exports = { infrastructureSync };

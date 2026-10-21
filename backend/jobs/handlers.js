'use strict';

const { getParam } = require('../settingsParams');
const { domainExpirationCheck } = require('./handlers/domainExpirationCheck');
const { certificateExpirationCheck } = require('./handlers/certificateExpirationCheck');
const { certificatePlacementNotify } = require('./handlers/certificatePlacementNotify');
const { infrastructureSync } = require('./handlers/infrastructureSync');

/** @type {Record<string, (ctx: import('./context').JobContext) => Promise<object>>} */
const handlers = {
  domain_expiration_check: domainExpirationCheck,
  certificate_expiration_check: certificateExpirationCheck,
  certificate_placement_notify: certificatePlacementNotify,
  infrastructure_sync: infrastructureSync,
};

function getHandler(code) {
  return handlers[code] || null;
}

function listHandlerCodes() {
  return Object.keys(handlers);
}

module.exports = {
  handlers,
  getHandler,
  listHandlerCodes,
};

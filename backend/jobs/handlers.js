'use strict';

const { getParam } = require('../settingsParams');
const { domainExpirationCheck } = require('./handlers/domainExpirationCheck');
const { certificateExpirationCheck } = require('./handlers/certificateExpirationCheck');

/** @type {Record<string, (ctx: import('./context').JobContext) => Promise<object>>} */
const handlers = {
  domain_expiration_check: domainExpirationCheck,
  certificate_expiration_check: certificateExpirationCheck,
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

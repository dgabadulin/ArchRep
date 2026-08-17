'use strict';

const { getParam } = require('../settingsParams');
const { domainExpirationCheck } = require('./handlers/domainExpirationCheck');

/** @type {Record<string, (ctx: import('./context').JobContext) => Promise<object>>} */
const handlers = {
  domain_expiration_check: domainExpirationCheck,
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

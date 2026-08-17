const web_resource = require('./web_resource');
const gap = require('./gap');
const adr_principle = require('./adr_principle');
const principle = require('./principle');
const technology = require('./technology');
const system = require('./system');
const organization_unit = require('./organization_unit');
const actor = require('./actor');
const business_service = require('./business_service');
const business_function = require('./business_function');
const domain = require('./domain');

const byCode = {
  web_resource,
  gap,
  adr_principle,
  principle,
  technology,
  system,
  organization_unit,
  actor,
  business_service,
  business_function,
  domain,
};

function getImportEntity(code) {
  return byCode[String(code || '').trim()] || null;
}

function listSupportedEntityCodes() {
  return Object.keys(byCode);
}

module.exports = {
  byCode,
  getImportEntity,
  listSupportedEntityCodes,
};

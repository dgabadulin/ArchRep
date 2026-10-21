const { getParam } = require('./settingsParams');

const TEMPLATE_DEFS = {
  DISP_SYSTEM_TEMPLATE: { fields: ['code', 'name', 'fullname'], fallback: '{name}' },
  DISP_SUBSYSTEM_TEMPLATE: { fields: ['code', 'name', 'fullname'], fallback: '{name}' },
  DISP_TECHNOLOGY_TEMPLATE: { fields: ['name'], fallback: '{name}' },
  DISP_INFRA_TEMPLATE: { fields: ['name', 'primary_ip', 'status', 'site', 'type_name'], fallback: '{name}' },
  DISP_PARTNER_TEMPLATE: { fields: ['name'], fallback: '{name}' },
  DISP_OWNER_TEMPLATE: { fields: ['name', 'leader'], fallback: '{name}' },
  DISP_HOSTING_TYPE_TEMPLATE: { fields: ['name'], fallback: '{name}' },
  DISP_SYSTEM_STATUS_TEMPLATE: { fields: ['name', 'description'], fallback: '{name}' },
  DISP_TECH_CLASS_TEMPLATE: { fields: ['name', 'description'], fallback: '{name}' },
  DISP_TECH_TYPE_TEMPLATE: { fields: ['name', 'description'], fallback: '{name}' },
  DISP_TECH_STATUS_TEMPLATE: { fields: ['name', 'fullname'], fallback: '{name}' },
  DISP_ADR_STATUS_TEMPLATE: { fields: ['code', 'name'], fallback: '{name}' },
  DISP_ADR_SYSTEM_STATUS_TEMPLATE: { fields: ['name'], fallback: '{name}' },
  DISP_ADR_REL_STATUS_TEMPLATE: { fields: ['code', 'name'], fallback: '{name}' },
  DISP_ADR_INCREMENT_TYPE_TEMPLATE: { fields: ['name'], fallback: '{name}' },
  DISP_ADRP_TEMPLATE: { fields: ['code', 'name'], fallback: '{name}' },
  DISP_ADRA_TEMPLATE: { fields: ['code', 'task_name'], fallback: '{task_name}' },
  DISP_GAP_TEMPLATE: { fields: ['code', 'name'], fallback: '{name}' },
  DISP_WEB_RESOURCE_TEMPLATE: {
    fields: [
      'code',
      'short_name',
      'purpose',
      'publication_url',
      'publication_request_number',
      'publication_date',
      'status_name',
      'status_code',
      'category_name',
      'category_code',
      'stage_type_name',
      'stage_type_code',
      'system_name',
      'system_code',
      'system_fullname',
      'parent_system_name',
      'id',
    ],
    fallback: '{short_name}',
  },
  DISP_WEB_RESOURCE_STATUS_TEMPLATE: { fields: ['code', 'name'], fallback: '{name}' },
  DISP_WEB_RESOURCE_CATEGORY_TEMPLATE: { fields: ['code', 'name'], fallback: '{name}' },
  DISP_WEB_RESOURCE_STAGE_TYPE_TEMPLATE: { fields: ['code', 'name'], fallback: '{name}' },
  DISP_DOMAIN_TEMPLATE: {
    fields: [
      'name', 'purpose', 'status_name', 'status_code',
      'registrar_name', 'company_name', 'business_owner_name',
      'registered_at', 'expires_at', 'id',
    ],
    fallback: '{name}',
  },
  DISP_CERTIFICATE_TEMPLATE: {
    fields: [
      'code', 'domain_name', 'ca_name', 'issued_at', 'expires_at',
      'wildcard_flag', 'placement_url', 'responsible_name', 'id',
    ],
    fallback: '{code}',
  },
  DISP_DOMAIN_STATUS_TEMPLATE: { fields: ['code', 'name'], fallback: '{name}' },
  DISP_GAP_TYPE_TEMPLATE: { fields: ['name'], fallback: '{name}' },
  DISP_IMPACT_LEVEL_TEMPLATE: { fields: ['name'], fallback: '{name}' },
  DISP_GAP_STATE_TEMPLATE: { fields: ['name'], fallback: '{name}' },
  DISP_FLOW_EVENT_TYPE_TEMPLATE: { fields: ['name'], fallback: '{name}' },
  DISP_FLOW_STATUS_TEMPLATE: { fields: ['code', 'name'], fallback: '{name}' },
  /** Проекция integration_flow в ar_metamodel_relations.displayed_name (issue #33); плейсхолдеры подставляются в SQL, валидация — здесь и в API настроек. */
  DISP_INTEGRATION_FLOW_NAME: {
    fields: [
      'source_name',
      'target_name',
      'source_code',
      'target_code',
      'status_name',
      'event_type_name',
      'transferred_data',
      'transfer_method',
      'periodicity',
      'id',
    ],
    fallback: '{source_name} → {target_name}',
  },
  DISP_ORG_UNIT_TEMPLATE: { fields: ['name', 'fullname'], fallback: '{name}' },
  DISP_ORG_UNIT_CATEGORY_TEMPLATE: { fields: ['name'], fallback: '{name}' },
  DISP_ACTOR_TEMPLATE: { fields: ['name'], fallback: '{name}' },
  DISP_ACTOR_TYPE_TEMPLATE: { fields: ['name'], fallback: '{name}' },
  DISP_BUSINESS_SERVICE_TEMPLATE: { fields: ['name', 'fullname'], fallback: '{name}' },
  DISP_BUSINESS_SERVICE_STATUS_TEMPLATE: { fields: ['name'], fallback: '{name}' },
  DISP_BUSINESS_FUNCTION_TEMPLATE: { fields: ['name'], fallback: '{name}' },
  DISP_EMPLOYEE_TEMPLATE: { fields: ['full_name', 'employee_number', 'email', 'status'], fallback: '{full_name} [[({status})]]' },
  DISP_META_ENTITY_TYPE_TEMPLATE: { fields: ['code', 'name'], fallback: '{name}' },
  DISP_META_REL_TYPE_TEMPLATE: { fields: ['code', 'name'], fallback: '{name}' },
};

const ENTITY_TO_TEMPLATE = {
  system: 'DISP_SYSTEM_TEMPLATE',
  subsystem: 'DISP_SUBSYSTEM_TEMPLATE',
  system_child: 'DISP_SUBSYSTEM_TEMPLATE',
  technology: 'DISP_TECHNOLOGY_TEMPLATE',
  infrastructure_object: 'DISP_INFRA_TEMPLATE',
  partner: 'DISP_PARTNER_TEMPLATE',
  owner: 'DISP_OWNER_TEMPLATE',
  hosting_type: 'DISP_HOSTING_TYPE_TEMPLATE',
  system_status: 'DISP_SYSTEM_STATUS_TEMPLATE',
  tech_class: 'DISP_TECH_CLASS_TEMPLATE',
  tech_type: 'DISP_TECH_TYPE_TEMPLATE',
  tech_status: 'DISP_TECH_STATUS_TEMPLATE',
  adr_status: 'DISP_ADR_STATUS_TEMPLATE',
  adr_system_status: 'DISP_ADR_SYSTEM_STATUS_TEMPLATE',
  adr_relation_status: 'DISP_ADR_REL_STATUS_TEMPLATE',
  adr_increment_type: 'DISP_ADR_INCREMENT_TYPE_TEMPLATE',
  adrp: 'DISP_ADRP_TEMPLATE',
  adra: 'DISP_ADRA_TEMPLATE',
  gap: 'DISP_GAP_TEMPLATE',
  web_resource: 'DISP_WEB_RESOURCE_TEMPLATE',
  web_resource_status: 'DISP_WEB_RESOURCE_STATUS_TEMPLATE',
  web_resource_category: 'DISP_WEB_RESOURCE_CATEGORY_TEMPLATE',
  web_resource_stage_type: 'DISP_WEB_RESOURCE_STAGE_TYPE_TEMPLATE',
  domain: 'DISP_DOMAIN_TEMPLATE',
  certificate: 'DISP_CERTIFICATE_TEMPLATE',
  domain_status: 'DISP_DOMAIN_STATUS_TEMPLATE',
  gap_type: 'DISP_GAP_TYPE_TEMPLATE',
  impact_level: 'DISP_IMPACT_LEVEL_TEMPLATE',
  gap_state: 'DISP_GAP_STATE_TEMPLATE',
  flow_event_type: 'DISP_FLOW_EVENT_TYPE_TEMPLATE',
  flow_status: 'DISP_FLOW_STATUS_TEMPLATE',
  org_unit: 'DISP_ORG_UNIT_TEMPLATE',
  org_unit_category: 'DISP_ORG_UNIT_CATEGORY_TEMPLATE',
  actor: 'DISP_ACTOR_TEMPLATE',
  actor_type: 'DISP_ACTOR_TYPE_TEMPLATE',
  business_service: 'DISP_BUSINESS_SERVICE_TEMPLATE',
  business_service_status: 'DISP_BUSINESS_SERVICE_STATUS_TEMPLATE',
  business_function: 'DISP_BUSINESS_FUNCTION_TEMPLATE',
  employee: 'DISP_EMPLOYEE_TEMPLATE',
  meta_entity_type: 'DISP_META_ENTITY_TYPE_TEMPLATE',
  meta_relation_type: 'DISP_META_REL_TYPE_TEMPLATE',
};

function isFilled(value) {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  return true;
}

function renderPart(template, row, usedFields) {
  return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (_, field) => {
    usedFields.push(field);
    const value = row[field];
    return value == null ? '' : String(value);
  });
}

function renderTemplate(template, row) {
  let out = String(template);
  out = out.replace(/\[\[([\s\S]*?)\]\]/g, (_, inner) => {
    const used = [];
    const rendered = renderPart(inner, row, used);
    if (used.length === 0) return rendered;
    return used.every((f) => isFilled(row[f])) ? rendered : '';
  });
  const used = [];
  out = renderPart(out, row, used);
  return out.replace(/\s{2,}/g, ' ').trim();
}

function getTemplateCode(entityKey) {
  return ENTITY_TO_TEMPLATE[entityKey];
}

function getTemplateForEntity(entityKey) {
  const templateCode = getTemplateCode(entityKey);
  if (!templateCode) return null;
  const def = TEMPLATE_DEFS[templateCode];
  const configured = getParam(templateCode, def.fallback);
  if (typeof configured !== 'string' || !configured.trim()) return def.fallback;
  return configured;
}

function applyDisplayNameRow(row, entityKey) {
  if (!row || typeof row !== 'object') return row;
  const template = getTemplateForEntity(entityKey);
  if (!template) return row;
  const rendered = renderTemplate(template, row);
  const fallback = row.name ?? row.task_name ?? row.code ?? '';
  return { ...row, display_name: rendered || String(fallback || '') };
}

function applyDisplayName(data, entityKey) {
  if (Array.isArray(data)) return data.map((row) => applyDisplayNameRow(row, entityKey));
  return applyDisplayNameRow(data, entityKey);
}

function validateTemplateValue(templateCode, value) {
  const def = TEMPLATE_DEFS[templateCode];
  if (!def) return { ok: false, error: `Unknown template code: ${templateCode}` };
  const text = String(value ?? '');
  const opens = (text.match(/\[\[/g) || []).length;
  const closes = (text.match(/\]\]/g) || []).length;
  if (opens !== closes) return { ok: false, error: 'Invalid conditional block syntax: [[...]] mismatch' };
  const placeholders = [...text.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((m) => m[1]);
  const unknown = placeholders.filter((f) => !def.fields.includes(f));
  if (unknown.length > 0) {
    return { ok: false, error: `Template uses non-whitelisted fields: ${[...new Set(unknown)].join(', ')}` };
  }
  return { ok: true };
}

module.exports = {
  TEMPLATE_DEFS,
  applyDisplayName,
  validateTemplateValue,
};

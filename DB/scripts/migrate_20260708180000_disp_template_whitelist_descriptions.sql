-- DISP_*: дополнить description перечнем разрешённых плейсхолдеров (whitelist из backend/displayName.js TEMPLATE_DEFS).
-- Идемпотентно: при повторном накате старый суффикс «. Разрешенные значения: …» заменяется.

WITH defs (code, allowed_fields) AS (
  VALUES
    ('DISP_SYSTEM_TEMPLATE', '{code}, {name}, {fullname}'),
    ('DISP_SUBSYSTEM_TEMPLATE', '{code}, {name}, {fullname}'),
    ('DISP_TECHNOLOGY_TEMPLATE', '{name}'),
    ('DISP_PARTNER_TEMPLATE', '{name}'),
    ('DISP_OWNER_TEMPLATE', '{name}, {leader}'),
    ('DISP_HOSTING_TYPE_TEMPLATE', '{name}'),
    ('DISP_SYSTEM_STATUS_TEMPLATE', '{name}, {description}'),
    ('DISP_TECH_CLASS_TEMPLATE', '{name}, {description}'),
    ('DISP_TECH_TYPE_TEMPLATE', '{name}, {description}'),
    ('DISP_TECH_STATUS_TEMPLATE', '{name}, {fullname}'),
    ('DISP_ADR_STATUS_TEMPLATE', '{code}, {name}'),
    ('DISP_ADR_SYSTEM_STATUS_TEMPLATE', '{name}'),
    ('DISP_ADR_REL_STATUS_TEMPLATE', '{code}, {name}'),
    ('DISP_ADR_INCREMENT_TYPE_TEMPLATE', '{name}'),
    ('DISP_ADRP_TEMPLATE', '{code}, {name}'),
    ('DISP_ADRA_TEMPLATE', '{code}, {task_name}'),
    ('DISP_GAP_TEMPLATE', '{code}, {name}'),
    ('DISP_WEB_RESOURCE_TEMPLATE', '{code}, {short_name}, {purpose}, {publication_url}, {publication_request_number}, {publication_date}, {status_name}, {status_code}, {category_name}, {category_code}, {stage_type_name}, {stage_type_code}, {system_name}, {system_code}, {system_fullname}, {parent_system_name}, {id}'),
    ('DISP_WEB_RESOURCE_STATUS_TEMPLATE', '{code}, {name}'),
    ('DISP_WEB_RESOURCE_CATEGORY_TEMPLATE', '{code}, {name}'),
    ('DISP_WEB_RESOURCE_STAGE_TYPE_TEMPLATE', '{code}, {name}'),
    ('DISP_GAP_TYPE_TEMPLATE', '{name}'),
    ('DISP_IMPACT_LEVEL_TEMPLATE', '{name}'),
    ('DISP_GAP_STATE_TEMPLATE', '{name}'),
    ('DISP_FLOW_EVENT_TYPE_TEMPLATE', '{name}'),
    ('DISP_FLOW_STATUS_TEMPLATE', '{code}, {name}'),
    ('DISP_INTEGRATION_FLOW_NAME', '{source_name}, {target_name}, {source_code}, {target_code}, {status_name}, {event_type_name}, {transferred_data}, {transfer_method}, {periodicity}, {id}'),
    ('DISP_ORG_UNIT_TEMPLATE', '{name}, {fullname}'),
    ('DISP_ORG_UNIT_CATEGORY_TEMPLATE', '{name}'),
    ('DISP_ACTOR_TEMPLATE', '{name}'),
    ('DISP_ACTOR_TYPE_TEMPLATE', '{name}'),
    ('DISP_BUSINESS_SERVICE_TEMPLATE', '{name}, {fullname}'),
    ('DISP_BUSINESS_SERVICE_STATUS_TEMPLATE', '{name}'),
    ('DISP_BUSINESS_FUNCTION_TEMPLATE', '{name}'),
    ('DISP_EMPLOYEE_TEMPLATE', '{full_name}, {status}'),
    ('DISP_META_ENTITY_TYPE_TEMPLATE', '{code}, {name}'),
    ('DISP_META_REL_TYPE_TEMPLATE', '{code}, {name}')
),
prepared AS (
  SELECT
    p.id,
    trim(trailing FROM regexp_replace(COALESCE(p.description, ''), '\s*\. Разрешенные значения:.*$', '')) AS base_description,
    d.allowed_fields
  FROM archrep.ar_settings_parameters p
  JOIN defs d ON d.code = p.code
)
UPDATE archrep.ar_settings_parameters p
SET
  description = prepared.base_description || '. Разрешенные значения: ' || prepared.allowed_fields,
  updated_at = CURRENT_TIMESTAMP
FROM prepared
WHERE p.id = prepared.id;

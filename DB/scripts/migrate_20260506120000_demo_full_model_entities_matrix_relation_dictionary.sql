-- Словарь типов связей метамодели по docs/demo-full-model-entities-matrix.md §3.1 и §3.2.
-- Рекомендуется накатывать после migrate_20260504120000_section32_metamodel_types_and_fk_projections.sql
-- (триггеры проекций по FK для §3.2); этот скрипт не создаёт функции/триггеры, только словарь типов.
-- 1) Тип сущности employee (если ещё не заведён — см. migrate_20260501120000_ar_employees_system_leads.sql).
-- 2) INSERT недостающих строк ar_metamodel_relation_types для §3.1 (старые БД без части типов).
-- 3) UPDATE name, description для всех кодов §3.1 и §3.2 по тексту матрицы (идемпотентно по смыслу).
-- Зависимости: базовые ar_metamodel_entity_types (system, subsystem, gap, …); для §3.1 п.10–13 — employee.
-- После наката: перезапуск backend (кэш типов метамодели).

-- ---------------------------------------------------------------------------
-- Тип сущности employee (при отсутствии)
-- ---------------------------------------------------------------------------
INSERT INTO archrep.ar_metamodel_entity_types (code, name, table_name, description)
SELECT 'employee', 'Сотрудник', 'ar_employees', 'Справочник сотрудников (ответственные ИТ/бизнес)'
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_metamodel_entity_types WHERE code = 'employee');

INSERT INTO archrep.ar_metamodel_entity_types (code, name, table_name, description)
SELECT 'partner', 'Партнёр', 'ar_partners', 'Контрагент (вендор, интегратор, поддержка)'
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_metamodel_entity_types WHERE code = 'partner');

INSERT INTO archrep.ar_metamodel_entity_types (code, name, table_name, description)
SELECT 'system_function', 'Функция ИС', 'ar_system_functions', 'Прикладная функция в каталоге ИС'
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_metamodel_entity_types WHERE code = 'system_function');

INSERT INTO archrep.ar_metamodel_entity_types (code, name, table_name, description)
SELECT 'adr_principle', 'ADRP (прикладной принцип)', 'ar_adrs_principle', 'Архитектурное решение-принцип'
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_metamodel_entity_types WHERE code = 'adr_principle');

-- ---------------------------------------------------------------------------
-- §3.1 — INSERT типов связей (если отсутствуют)
-- Направление system_module: в БД «от» = subsystem, «к» = system (иерархия parent_ar_systems_id).
-- ---------------------------------------------------------------------------
INSERT INTO archrep.ar_metamodel_relation_types (code, name, description, from_entity_type_id, to_entity_type_id)
SELECT v.code, v.name, v.description, f.id, t.id
FROM (
  VALUES
    ('gap-system'::varchar, 'Относится к'::varchar, 'Арх. долг относится к системе'::varchar, 'gap'::varchar, 'system'::varchar),
    ('system_module', 'Модуль системы', 'Связь формируется автоматически из ar_systems.parent_ar_systems_id', 'subsystem', 'system'),
    ('applied_gap', 'Фиксирует арх.долг', 'Архитектурное заключение фиксирует арх.долг', 'applied', 'gap'),
    ('integration_flow', 'Интеграционный поток', 'Проекция из ar_integration_flows; синхронизация триггером и пересборкой', 'system', 'system'),
    ('module_technology', 'Использует', 'Модуль использует технологию', 'subsystem', 'technology'),
    ('system_technology', 'Использует', 'Связь информационной системы с элементом технологического стека', 'system', 'technology'),
    ('integration_flow_system_module', 'Интеграционный поток (Система → Модуль)', 'Проекция из ar_integration_flows; синхронизация триггером и пересборкой', 'system', 'subsystem'),
    ('integration_flow_module_system', 'Интеграционный поток (Модуль → Система)', 'Проекция из ar_integration_flows; синхронизация триггером и пересборкой', 'subsystem', 'system'),
    ('integration_flow_module_module', 'Интеграционный поток (Модуль → Модуль)', 'Проекция из ar_integration_flows; синхронизация триггером и пересборкой', 'subsystem', 'subsystem'),
    ('subsystem_it_lead', 'ИТ-лид модуля', 'Ответственный от ИТ (модуль)', 'subsystem', 'employee'),
    ('system_it_lead', 'ИТ-лид ИС', 'Ответственный от ИТ (корневая система)', 'system', 'employee'),
    ('subsystem_business_lead', 'Бизнес-лид модуля', 'Ответственный от бизнеса (модуль)', 'subsystem', 'employee'),
    ('system_business_lead', 'Бизнес-лид ИС', 'Ответственный от бизнеса (корневая система)', 'system', 'employee')
) AS v(code, name, description, from_code, to_code)
JOIN archrep.ar_metamodel_entity_types f ON f.code = v.from_code
JOIN archrep.ar_metamodel_entity_types t ON t.code = v.to_code
WHERE NOT EXISTS (
  SELECT 1 FROM archrep.ar_metamodel_relation_types r
  WHERE r.code = v.code AND r.from_entity_type_id = f.id AND r.to_entity_type_id = t.id
);

-- ---------------------------------------------------------------------------
-- §3.2 — INSERT типов связей (если migrate_20260504120000 ещё не накатывали)
-- ---------------------------------------------------------------------------
INSERT INTO archrep.ar_metamodel_relation_types (code, name, description, from_entity_type_id, to_entity_type_id)
SELECT v.code, v.name, v.description, f.id, t.id
FROM (
  SELECT * FROM (VALUES
    ('organization_unit_business_service'::varchar, 'Отвечает за'::varchar, 'Орг. единица владеет бизнес-сервисом'::varchar, 'organization_unit'::varchar, 'business_service'::varchar),
    ('organization_unit_business_function', 'Отвечает за', 'Орг. единица владеет бизнес-функцией', 'organization_unit', 'business_function'),
    ('actor_business_function', 'Отвечает за', 'Заинтересованное лицо исполняет бизнес-функцию', 'actor', 'business_function'),
    ('business_function_business_service', 'Поддерживает сервис', 'Бизнес-функция обеспечивает бизнес-сервис', 'business_function', 'business_service'),
    ('system_business_service', 'Обеспечивает продукт', 'ИС реализует бизнес-сервис', 'system', 'business_service'),
    ('system_business_function', 'Реализует бизнес-функцию', 'ИС реализует бизнес-функцию', 'system', 'business_function'),
    ('system_system_function', 'Содержит функцию ИС', 'Система включает функцию ИС; в БД — ar_system_functions.ar_systems_id', 'system', 'system_function'),
    ('system_function_business_function', 'Реализует бизнес-функцию', 'Функция ИС покрывает бизнес-функцию', 'system_function', 'business_function'),
    ('system_function_business_service', 'Обеспечивает продукт', 'Функция ИС обеспечивает бизнес-сервис', 'system_function', 'business_service'),
    ('actor_system_function', 'Использует функцию ИС', 'Действующее лицо опирается на возможность системы', 'actor', 'system_function'),
    ('adr_applied_adr_principle', 'Соблюдает принцип', 'ADRA опирается на ADRP', 'applied', 'adr_principle'),
    ('system_partner_vendor', 'Вендор', 'Корневая ИС — вендор (контрагент)', 'system', 'partner'),
    ('system_partner_implementer', 'Интегратор', 'Корневая ИС — интегратор / поставщик внедрения', 'system', 'partner'),
    ('system_partner_supporter', 'Поддерживает', 'Корневая ИС — партнёр по поддержке', 'system', 'partner'),
    ('subsystem_partner_vendor', 'Вендор', 'Модуль (подсистема) — вендор', 'subsystem', 'partner'),
    ('subsystem_partner_implementer', 'Интегратор', 'Модуль — интегратор / поставщик внедрения', 'subsystem', 'partner'),
    ('subsystem_partner_supporter', 'Поддерживает', 'Модуль — партнёр по поддержке', 'subsystem', 'partner'),
    ('technology_partner_vendor', 'Вендор', 'Технология — вендор (поставщик технологии)', 'technology', 'partner')
  ) AS x(code, name, description, from_code, to_code)
) v
JOIN archrep.ar_metamodel_entity_types f ON f.code = v.from_code
JOIN archrep.ar_metamodel_entity_types t ON t.code = v.to_code
WHERE NOT EXISTS (
  SELECT 1 FROM archrep.ar_metamodel_relation_types r
  WHERE r.code = v.code AND r.from_entity_type_id = f.id AND r.to_entity_type_id = t.id
);

INSERT INTO archrep.ar_metamodel_relation_types (code, name, description, from_entity_type_id, to_entity_type_id)
SELECT 'system_system_function', 'Содержит функцию ИС', 'Модуль включает функцию ИС; в БД — ar_system_functions.ar_systems_id', sf.id, tf.id
FROM archrep.ar_metamodel_entity_types sf
CROSS JOIN archrep.ar_metamodel_entity_types tf
WHERE sf.code = 'subsystem' AND tf.code = 'system_function'
  AND NOT EXISTS (
    SELECT 1 FROM archrep.ar_metamodel_relation_types r
    WHERE r.code = 'system_system_function' AND r.from_entity_type_id = sf.id AND r.to_entity_type_id = tf.id
  );

-- ---------------------------------------------------------------------------
-- UPDATE подписей по матрице (все строки с данным code получают одинаковые name/description)
-- ---------------------------------------------------------------------------
UPDATE archrep.ar_metamodel_relation_types r
SET name = m.name, description = m.description
FROM (
  VALUES
    ('gap-system'::varchar, 'Относится к'::varchar, 'Арх. долг относится к системе'::varchar),
    ('system_module', 'Модуль системы', 'Связь формируется автоматически из ar_systems.parent_ar_systems_id'),
    ('applied_gap', 'Фиксирует арх.долг', 'Архитектурное заключение фиксирует арх.долг'),
    ('integration_flow', 'Интеграционный поток', 'Проекция из ar_integration_flows; синхронизация триггером и пересборкой'),
    ('module_technology', 'Использует', 'Модуль использует технологию'),
    ('system_technology', 'Использует', 'Связь информационной системы с элементом технологического стека'),
    ('integration_flow_system_module', 'Интеграционный поток (Система → Модуль)', 'Проекция из ar_integration_flows; синхронизация триггером и пересборкой'),
    ('integration_flow_module_system', 'Интеграционный поток (Модуль → Система)', 'Проекция из ar_integration_flows; синхронизация триггером и пересборкой'),
    ('integration_flow_module_module', 'Интеграционный поток (Модуль → Модуль)', 'Проекция из ar_integration_flows; синхронизация триггером и пересборкой'),
    ('subsystem_it_lead', 'ИТ-лид модуля', 'Ответственный от ИТ (модуль)'),
    ('system_it_lead', 'ИТ-лид ИС', 'Ответственный от ИТ (корневая система)'),
    ('subsystem_business_lead', 'Бизнес-лид модуля', 'Ответственный от бизнеса (модуль)'),
    ('system_business_lead', 'Бизнес-лид ИС', 'Ответственный от бизнеса (корневая система)'),
    ('organization_unit_business_service', 'Отвечает за', 'Орг. единица владеет бизнес-сервисом'),
    ('organization_unit_business_function', 'Отвечает за', 'Орг. единица владеет бизнес-функцией'),
    ('actor_business_function', 'Отвечает за', 'Заинтересованное лицо исполняет бизнес-функцию'),
    ('business_function_business_service', 'Поддерживает сервис', 'Бизнес-функция обеспечивает бизнес-сервис'),
    ('system_business_service', 'Обеспечивает продукт', 'ИС реализует бизнес-сервис'),
    ('system_business_function', 'Реализует бизнес-функцию', 'ИС реализует бизнес-функцию'),
    ('system_system_function', 'Содержит функцию ИС', 'Связь через ar_system_functions.ar_systems_id (корневая ИС или модуль как владелец функции)'),
    ('system_function_business_function', 'Реализует бизнес-функцию', 'Функция ИС покрывает бизнес-функцию'),
    ('system_function_business_service', 'Обеспечивает продукт', 'Функция ИС обеспечивает бизнес-сервис'),
    ('actor_system_function', 'Использует функцию ИС', 'Действующее лицо опирается на возможность системы'),
    ('adr_applied_adr_principle', 'Соблюдает принцип', 'ADRA опирается на ADRP'),
    ('system_partner_vendor', 'Вендор', 'Корневая ИС — вендор (контрагент); проекция FK vendor_ar_partners_id'),
    ('system_partner_implementer', 'Интегратор', 'Корневая ИС — интегратор / поставщик внедрения; проекция FK supplier_ar_partners_id'),
    ('system_partner_supporter', 'Поддерживает', 'Корневая ИС — партнёр по поддержке; проекция FK supporter_ar_partners_id'),
    ('subsystem_partner_vendor', 'Вендор', 'Модуль — вендор; проекция FK vendor_ar_partners_id'),
    ('subsystem_partner_implementer', 'Интегратор', 'Модуль — интегратор / поставщик внедрения; проекция FK supplier_ar_partners_id'),
    ('subsystem_partner_supporter', 'Поддерживает', 'Модуль — партнёр по поддержке; проекция FK supporter_ar_partners_id'),
    ('technology_partner_vendor', 'Вендор', 'Технология — вендор (поставщик технологии); проекция FK vendor_ar_partners_id на ar_technologies')
) AS m(code, name, description)
WHERE r.code = m.code;

/**
 * Свойства объектов анализатора зависимостей (issue #116).
 *
 * Блок «Свойства» палитры показывает те же данные, что раньше открывались по ПКМ → «Просмотр»,
 * но в формате «ключ → значение». Идентификаторы разрешаются **на клиенте**, без бэкенда:
 *
 *   1. «парное» человекочитаемое поле в ответе detail-эндпоинта (`status`, `owner`, `parent_name`, …);
 *   2. уже загруженный объект графа с той же парой (тип, id) — его `name` (display_name);
 *   3. иначе — исходное значение (как в БД).
 *
 * Правило сознательно не ходит в БД за справочниками, которых нет на графе: такие id показываются
 * как есть. Систематическое разрешение справочников — отдельная задача (см. issue #116, п. «обсудить»).
 */

/** Русские подписи частых технических полей. Остальные ключи показываются как есть. */
export const FIELD_LABELS = {
  id: 'Идентификатор',
  code: 'Код',
  name: 'Наименование',
  display_name: 'Отображаемое имя',
  fullname: 'Полное наименование',
  full_name: 'ФИО',
  short_name: 'Краткое наименование',
  task_name: 'Наименование задачи',
  task_link: 'Ссылка на задачу',
  description: 'Описание',
  comment: 'Комментарий',
  purpose: 'Назначение',
  statement: 'Формулировка',
  rationale: 'Обоснование',
  implications: 'Последствия',
  conclusion: 'Заключение',
  context: 'Контекст',
  decision: 'Решение',
  consequences: 'Последствия',
  author: 'Автор',
  status: 'Статус',
  status_name: 'Статус',
  owner: 'Функциональная вертикаль',
  owner_name: 'Функциональная вертикаль',
  parent_name: 'Родительский объект',
  vendor: 'Вендор',
  supplier: 'Интегратор',
  supporter: 'Поддержка',
  hosting: 'Хостинг',
  active: 'Активен',
  employee_number: 'Табельный номер',
  email: 'Электронная почта',
  leader: 'Руководитель',
  category_name: 'Категория',
  actor_type_name: 'Тип действующего лица',
  organization_unit_name: 'Организационная единица',
  impact_level_name: 'Уровень влияния',
  gap_state_name: 'Состояние арх. долга',
  adr_status_name: 'Статус',
  gap_type_name: 'Тип арх. долга',
  system_name: 'Информационная система',
  system_code: 'Код ИС',
  system_fullname: 'Полное наименование ИС',
  domain_name: 'Домен',
  ca_name: 'Удостоверяющий центр',
  responsible_name: 'Ответственный',
  registrar_name: 'Регистратор',
  company_name: 'Организация',
  status_code: 'Код статуса',
  publication_url: 'URL публикации',
  publication_date: 'Дата публикации',
  publication_request_number: 'Номер заявки на публикацию',
  registered_at: 'Дата регистрации',
  expires_at: 'Дата окончания',
  issued_at: 'Дата выпуска',
  wildcard_flag: 'Wildcard-сертификат',
  placement_url: 'URL размещения',
  primary_ip: 'Основной IP',
  site: 'Площадка',
  cluster: 'Кластер',
  platform: 'Платформа',
  tenant: 'Арендатор',
  vcpus: 'vCPU',
  memory_gb: 'Память, ГБ',
  disk_gb: 'Диск, ГБ',
  source: 'Источник данных',
  external_id: 'Внешний идентификатор',
  synced_at: 'Синхронизировано',
  netbox_updated_at: 'Обновлено в Netbox',
  created_at: 'Создано',
  updated_at: 'Изменено',
  payload: 'Данные (JSON)',
  reference_to_baserow: 'Ссылка на источник',
  relation_type: 'Тип связи',
  relation_type_name: 'Наименование типа связи',
  relation_type_managed: 'Связь автоматическая (managed)',
  from_entity_type: 'Тип источника',
  from_entity_id: 'Источник',
  to_entity_type: 'Тип приёмника',
  to_entity_id: 'Приёмник',
  from_entity_name: 'Источник (наименование)',
  to_entity_name: 'Приёмник (наименование)',
  relation_type_display_name: 'Тип связи (подпись)',
  bundled: 'Пучок потоков',
  memberRelationIds: 'Связи в пучке',
  relationId: 'Идентификатор связи',
  technologies: 'Технологии (текст)',
  external_system: 'Внешняя система',
  remediation_effort: 'Трудоёмкость устранения',
};

/** Поля, которые показываем первыми (порядок = приоритет), остальные — по алфавиту. */
export const PRIMARY_FIELDS = [
  'name', 'display_name', 'fullname', 'full_name', 'short_name', 'task_name', 'code',
  'status', 'status_name', 'owner', 'owner_name', 'parent_name',
  'vendor', 'supplier', 'supporter', 'hosting',
  'description', 'comment', 'purpose', 'statement', 'decision', 'conclusion',
];

/**
 * Явные соответствия «поле-идентификатор → поле-подпись» (когда имя подписи не выводится из ключа).
 * Значения — массив кандидатов: берётся первый непустой.
 */
export const FK_LABEL_FIELDS = {
  // ИС и модули (systems_get отдаёт подписи рядом с id)
  ar_system_statuses_id: ['status'],
  vendor_ar_partners_id: ['vendor'],
  supplier_ar_partners_id: ['supplier'],
  supporter_ar_partners_id: ['supporter'],
  ar_system_owners_id: ['owner'],
  ar_system_hosting_types_id: ['hosting'],
  parent_ar_systems_id: ['parent_name'],
  // технологии: detail-эндпоинт делает `SELECT *`, подписи есть только в списке
  technology_classes_id: ['technology_class_name'],
  technology_types_id: ['technology_type_name'],
  technology_statuses_id: ['technology_status_name'],
  // архитектурный долг
  ar_impact_level_types_id: ['impact_level_name'],
  ar_gap_states_id: ['gap_state_name'],
  ar_gap_types_id: ['gap_type_name'],
  // бизнес-сервисы, функции ИС
  ar_business_service_statuses_id: ['status_name'],
  ar_system_function_statuses_id: ['status_name'],
  // веб-ресурсы, домены, сертификаты
  ar_domains_id: ['domain_name'],
  ar_web_resource_statuses_id: ['status_name'],
  ar_web_resource_categories_id: ['category_name'],
  ar_web_resource_stage_types_id: ['stage_type_name'],
  ar_domain_statuses_id: ['status_name'],
  responsible_ar_employees_id: ['responsible_name'],
  registrar_ar_partners_id: ['registrar_name'],
  ca_ar_partners_id: ['ca_name'],
  company_ar_organization_units_id: ['company_name'],
  business_owner_ar_employees_id: ['business_owner_name'],
  // справочники и сводные поля
  ar_adr_statuses_id: ['adr_status_name', 'status_name'],
  organization_unit_categories_id: ['category_name'],
  ar_organizations_units_id: ['owner_name'],
  ar_systems_id: ['system_name'],
  ar_infrastructure_object_types_id: ['type_name'],
};

/** Тип сущности для FK: позволяет подставить подпись из уже загруженного объекта графа. */
export const FK_ENTITY_TYPES = {
  parent_ar_systems_id: 'system',
  ar_systems_id: 'system',
  ar_domains_id: 'domain',
  ar_web_resources_id: 'web_resource',
  responsible_ar_employees_id: 'employee',
  business_owner_ar_employees_id: 'employee',
  vendor_ar_partners_id: 'partner',
  supplier_ar_partners_id: 'partner',
  supporter_ar_partners_id: 'partner',
  ca_ar_partners_id: 'partner',
  registrar_ar_partners_id: 'partner',
  ar_organization_units_id: 'organization_unit',
  organization_unit_id: 'organization_unit',
  company_ar_organization_units_id: 'organization_unit',
};

/** Множественное → единственное для вывода имени поля-подписи (`domains` → `domain`). */
function singular(word) {
  const w = String(word || '');
  if (!w) return w;
  if (/ies$/i.test(w)) return `${w.slice(0, -3)}y`;
  if (/(ses|xes|zes|ches|shes)$/i.test(w)) return w.slice(0, -2);
  if (/s$/i.test(w)) return w.slice(0, -1);
  return w;
}

/**
 * Кандидаты имени поля-подписи для ключа `…_id`:
 * сначала явная карта, затем вывод из самого ключа (`status_id` → `status`).
 */
export function labelFieldCandidates(key) {
  const out = [];
  const explicit = FK_LABEL_FIELDS[key];
  if (Array.isArray(explicit)) out.push(...explicit);
  const base = String(key).replace(/_id$/i, '');
  const variants = new Set([
    base,
    base.replace(/^ar_/, ''),
    singular(base),
    singular(base.replace(/^ar_/, '')),
  ]);
  for (const v of variants) {
    out.push(`${v}_name`, `${v}_display_name`, `${v}_title`, `${v}_fullname`, v);
  }
  return out;
}

/** Подпись ключа свойства: русская из словаря, иначе сам ключ. */
export function fieldLabel(key) {
  return FIELD_LABELS[key] || key;
}

/**
 * Форматирование значения для таблицы «ключ → значение».
 * @returns {{ text: string, kind: 'empty'|'text'|'json', hint?: string }}
 */
export function formatValue(value) {
  if (value === null || value === undefined || value === '') return { text: '—', kind: 'empty' };
  if (typeof value === 'boolean') return { text: value ? 'Да' : 'Нет', kind: 'text' };
  if (typeof value === 'number') return { text: String(value), kind: 'text' };
  if (typeof value === 'object') return { text: JSON.stringify(value, null, 2), kind: 'json' };
  const s = String(value);
  const dt = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(s);
  if (dt) return { text: `${dt[3]}.${dt[2]}.${dt[1]} ${dt[4]}:${dt[5]}`, kind: 'text', hint: s };
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (d) return { text: `${d[3]}.${d[2]}.${d[1]}`, kind: 'text', hint: s };
  return { text: s, kind: 'text' };
}

/** Подпись объекта графа по паре (тип, id), если узел присутствует на схеме. */
function graphNodeLabel(nodes, entityType, entityId) {
  if (!entityType || entityId === null || entityId === undefined) return null;
  const node = nodes && nodes[`${entityType}:${entityId}`];
  const name = node && node.name ? String(node.name).trim() : '';
  return name || null;
}

/**
 * Разрешение значения поля-идентификатора.
 * @returns {{ text: string, hint: string }|null} null — подписи нет, показываем исходное значение.
 */
export function resolveIdentifier(key, value, row, nodes) {
  if (!/_id$/i.test(key) || value === null || value === undefined || value === '') return null;
  for (const candidate of labelFieldCandidates(key)) {
    if (candidate === key) continue;
    const v = row ? row[candidate] : null;
    if (v !== null && v !== undefined && String(v).trim() !== '') {
      return { text: `${String(v).trim()} (id ${value})`, hint: `${key} = ${value}` };
    }
  }
  const entityType = FK_ENTITY_TYPES[key];
  const fromGraph = graphNodeLabel(nodes, entityType, value);
  if (fromGraph) return { text: `${fromGraph} (id ${value})`, hint: `${entityType}:${value}` };
  return null;
}

/** Порядок строк: сначала смысловые поля из PRIMARY_FIELDS, затем остальные по алфавиту подписи. */
function sortRows(rows) {
  return rows.sort((a, b) => {
    const ia = PRIMARY_FIELDS.indexOf(a.key);
    const ib = PRIMARY_FIELDS.indexOf(b.key);
    const ra = ia < 0 ? PRIMARY_FIELDS.length : ia;
    const rb = ib < 0 ? PRIMARY_FIELDS.length : ib;
    if (ra !== rb) return ra - rb;
    return a.label.localeCompare(b.label, 'ru');
  });
}

/** Строка таблицы свойств из значения поля. */
function makeRow(key, value, row, nodes) {
  const resolved = resolveIdentifier(key, value, row, nodes);
  if (resolved) {
    return { key, label: fieldLabel(key), text: resolved.text, kind: 'text', hint: resolved.hint };
  }
  const formatted = formatValue(value);
  return { key, label: fieldLabel(key), text: formatted.text, kind: formatted.kind, hint: formatted.hint };
}

/** Имя типа связи из справочника по коду (клиентская подстановка). */
function relationTypeName(code, relationTypes) {
  const rt = (relationTypes || []).find((t) => String(t && t.code) === String(code));
  if (!rt) return '';
  return String(rt.display_name || rt.name || '').trim();
}

/**
 * Свойства узла графа: все поля ответа detail-эндпоинта.
 * @param {{ entityType: string, entityId: number|string, typeLabel?: string,
 *           data: object, nodes: object, fallbackName?: string }} params
 */
export function buildNodePropertyView({ entityType, entityId, typeLabel, data, nodes, fallbackName }) {
  const d = data || {};
  const title = d.display_name || d.name || d.fullname || d.full_name || d.short_name
    || d.task_name || d.code || fallbackName || `${entityType}:${entityId}`;
  const subtitle = typeLabel ? `${typeLabel} · ${entityType}:${entityId}` : `${entityType}:${entityId}`;
  const rows = [];
  for (const key of Object.keys(d)) {
    if (key.startsWith('_')) continue;
    rows.push(makeRow(key, d[key], d, nodes));
  }
  return { title: String(title), subtitle, rows: sortRows(rows) };
}

/**
 * Свойства связи: полная строка реестра `ar_metamodel_relations` (если есть) либо объект ребра графа.
 * Концы связи разрешаются по уже загруженным объектам графа.
 * @param {{ edgeId: string, edge: object, relation: object|null,
 *           nodes: object, relationTypes: Array }} params
 */
export function buildEdgePropertyView({ edgeId, edge, relation, nodes, relationTypes }) {
  const e = edge || {};
  const fromNodeId = e.source;
  const toNodeId = e.target;
  const fromName = (nodes && nodes[fromNodeId] && nodes[fromNodeId].name) || fromNodeId || '—';
  const toName = (nodes && nodes[toNodeId] && nodes[toNodeId].name) || toNodeId || '—';
  const rtCode = (relation && relation.relation_type) || e.relationType || '';
  const rtName = relationTypeName(rtCode, relationTypes)
    || (relation && relation.relation_type_name) || '';
  const relLabel = (relation && (relation.displayed_name || relation.name))
    || e.name || rtName || rtCode || 'Связь';
  const rows = [];

  if (relation) {
    for (const key of Object.keys(relation)) {
      if (key.startsWith('_')) continue;
      if (key === 'from_entity_id' || key === 'to_entity_id') {
        const nid = key === 'from_entity_id' ? fromNodeId : toNodeId;
        const nm = key === 'from_entity_id' ? fromName : toName;
        rows.push({
          key,
          label: fieldLabel(key),
          text: `${nm} (${nid || relation[key]})`,
          kind: 'text',
          hint: `${key} = ${relation[key]}`,
        });
        continue;
      }
      if (key === 'relation_type' && rtName) {
        rows.push({
          key,
          label: fieldLabel(key),
          text: `${rtName} (${relation[key]})`,
          kind: 'text',
          hint: String(relation[key]),
        });
        continue;
      }
      rows.push(makeRow(key, relation[key], relation, nodes));
    }
  } else {
    // Ребра без строки реестра (например, пучок интеграционных потоков) — показываем поля ребра.
    const synthetic = [
      ['source', 'Источник', fromName, fromNodeId],
      ['target', 'Приёмник', toName, toNodeId],
      ['relationType', 'Тип связи', rtName ? `${rtName} (${rtCode})` : rtCode, rtCode],
      ['name', 'Наименование связи', relLabel, ''],
      ['relationId', 'Идентификатор связи', e.relationId, ''],
      ['bundled', 'Пучок потоков', e.bundled, ''],
      ['memberRelationIds', 'Связи в пучке', e.memberRelationIds, ''],
    ];
    for (const [key, label, value, hint] of synthetic) {
      if (value === undefined) continue;
      const formatted = formatValue(value);
      rows.push({ key, label, text: formatted.text, kind: formatted.kind, hint: hint || formatted.hint });
    }
  }

  return {
    title: String(relLabel),
    subtitle: `${fromName} → ${toName}`,
    edgeId,
    bundledCount: e.bundled ? (e.memberRelationIds || []).length : 0,
    rows: sortRows(rows),
  };
}

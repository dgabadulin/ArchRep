import { getConfig } from '@/config/params'

/**
 * Конфигурация типов сущностей метамодели для графа зависимостей.
 * code совпадает с ar_metamodel_entity_types.code.
 * icon — имя компонента из lucide-vue-next.
 * Переопределяется из параметра GRAPH_ENTITY_ICONS (issue #28).
 */
export const entityTypeConfig = {
  system: {
    label: 'Информационная система',
    icon: 'Monitor',
    listLabel: 'ИС',
  },
  subsystem: {
    label: 'Модуль системы',
    icon: 'Puzzle',
    listLabel: 'Модули систем',
  },
  system_child: {
    label: 'Модуль системы',
    icon: 'Puzzle',
    listLabel: 'Модули систем',
  },
  technology: {
    label: 'Технология',
    icon: 'Cpu',
    listLabel: 'Технологии',
  },
  organization_unit: {
    label: 'Организационная единица',
    icon: 'Building2',
    listLabel: 'Орг. единицы',
  },
  actor: {
    label: 'Заинтересованное лицо',
    icon: 'User',
    listLabel: 'Заинтересованные лица',
  },
  employee: {
    label: 'Сотрудник',
    icon: 'UserCircle',
    listLabel: 'Сотрудники',
  },
  business_service: {
    label: 'Бизнес-сервис (продукт)',
    icon: 'Package',
    listLabel: 'Продукты',
  },
  business_function: {
    label: 'Бизнес-функция',
    icon: 'GitBranch',
    listLabel: 'Бизнес-способности',
  },
  principle: {
    label: 'Принцип',
    icon: 'Scale',
    listLabel: 'Принципы',
  },
  gap: {
    label: 'Архитектурный долг',
    icon: 'AlertTriangle',
    listLabel: 'Долги',
  },
  partner: {
    label: 'Партнёр',
    icon: 'Handshake',
    listLabel: 'Партнёры',
  },
  system_function: {
    label: 'Функция ИС',
    icon: 'Layers',
    listLabel: 'Функции ИС',
  },
  adr_principle: {
    label: 'ADRP (принцип)',
    icon: 'BookOpen',
    listLabel: 'ADRP',
  },
  applied: {
    label: 'ADRA (заключение)',
    icon: 'FileText',
    listLabel: 'ADRA',
  },
}

export function getEntityTypeConfig(code) {
  const def = entityTypeConfig[code] || { label: code, icon: 'Circle', listLabel: code }
  const overrides = getConfig().GRAPH_ENTITY_ICONS
  if (overrides && overrides[code] && typeof overrides[code] === 'object') {
    return { ...def, ...overrides[code] }
  }
  return def
}

export function nodeId(entityType, entityId) {
  return `${entityType}:${entityId}`
}

export function parseNodeId(nodeIdStr) {
  const i = nodeIdStr.indexOf(':')
  if (i < 0) return null
  return {
    entityType: nodeIdStr.slice(0, i),
    entityId: parseInt(nodeIdStr.slice(i + 1), 10),
  }
}

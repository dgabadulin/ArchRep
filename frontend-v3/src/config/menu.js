// Структура меню по docs/togaf-metamodel-implementation_gdi.md
// RBAC: docs/access-control-design.md — «Администрирование» на одном уровне с «Настройки».
export const menuItems = [
  {
    label: 'Управление архитектурой',
    icon: 'compass',
    children: [
      { label: 'Архитектурные принципы', path: '/principles', icon: 'alert', requiredPermission: 'principle:read' },
      { label: 'Архитектурные решения (ADR)', path: '/decisions/principle', icon: 'file', requiredPermission: 'adr_principle:read' },
      { label: 'Архитектурные заключения', path: '/decisions/applied', icon: 'file-text', requiredPermission: 'adr_applied:read' },
      { label: 'Архитектурный долг', path: '/architecture-debt', icon: 'debt', requiredPermission: 'gap:read' },
    ],
  },
  {
    label: 'Бизнес-архитектура',
    icon: 'briefcase',
    children: [
      { label: 'Организационные единицы', path: '/organization-units', icon: 'org', requiredPermission: 'organization_unit:read' },
      { label: 'Заинтересованные лица', path: '/actors', icon: 'user', requiredPermission: 'actor:read' },
      { label: 'Продукты', path: '/business-services', icon: 'service', requiredPermission: 'business_service:read' },
      { label: 'Бизнес-способности', path: '/business-functions', icon: 'function', requiredPermission: 'business_function:read' },
      { label: 'Цели и задачи', path: '/goals', icon: 'target', requiredPermission: 'goals:read' },
    ],
  },
  {
    label: 'Информационные системы',
    icon: 'desktop',
    children: [
      { label: 'Каталог ИС', path: '/systems', icon: 'list', requiredPermission: 'system:read' },
      { label: 'Реестр интеграций', path: '/integrations', icon: 'share', requiredPermission: 'integration_flow:read' },
      { label: 'Реестр веб-ресурсов', path: '/web-resources', icon: 'globe', requiredPermission: 'web_resource:read' },
      { label: 'Реестр доменов', path: '/domains', icon: 'globe', requiredPermission: 'domain:read' },
      { label: 'Реестр сертификатов', path: '/certificates', icon: 'shield', requiredPermission: 'certificate:read' },
    ],
  },
  {
    label: 'Технологии',
    icon: 'gear',
    children: [
      { label: 'Каталог технологий', path: '/technologies', icon: 'gears', requiredPermission: 'technology:read' },
      { label: 'Тех.радар', path: '/tech-radar', icon: 'radar', requiredPermission: 'tech_radar:read' },
    ],
  },
  {
    label: 'Аналитика',
    icon: 'chart',
    children: [
      { label: 'Анализ зависимостей', path: '/analytics', icon: 'chart', requiredPermission: 'analytics:read' },
      { label: 'Дашборды', path: '/dashboards', icon: 'chart', requiredPermission: 'dashboard:read' },
      { label: 'Связи объектов управления', path: '/metamodel-relations', icon: 'link', requiredPermission: 'metamodel_relation:read' },
    ],
  },
  {
    label: 'Настройки',
    icon: 'settings',
    children: [
      { label: 'Справочники', path: '/references', icon: 'book', requiredPermission: 'references:read' },
      { label: 'Справочник дашбордов', path: '/dashboards/catalog', icon: 'book', requiredPermission: 'dashboard:read' },
      { label: 'Параметры', path: '/settings/parameters', icon: 'settings', requiredPermission: 'settings_parameters:read' },
      { label: 'Управление заданиями', path: '/settings/jobs', icon: 'clock', requiredPermission: 'jobs:read' },
      { label: 'Сервисные операции', path: '/settings/service-operations', icon: 'wrench', requiredPermission: 'service_operations:execute' },
    ],
  },
  {
    label: 'Администрирование',
    icon: 'shield',
    children: [
      { label: 'Пользователи', path: '/settings/administration/users', icon: 'user', requiredPermission: 'users:read' },
      { label: 'Роли', path: '/settings/administration/roles', icon: 'book', requiredPermission: 'roles:read' },
    ],
  },
]

/** Рекурсивная фильтрация меню по permissions (open mode — всё видно). */
export function filterMenuItems(items, hasPermission) {
  return (items || [])
    .map((item) => {
      if (item.children?.length) {
        const children = filterMenuItems(item.children, hasPermission)
        if (!children.length) return null
        return { ...item, children }
      }
      if (item.requiredPermission && !hasPermission(item.requiredPermission)) return null
      return item
    })
    .filter(Boolean)
}

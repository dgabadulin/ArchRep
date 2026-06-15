// Структура меню по docs/togaf-metamodel-implementation_gdi.md (дерево меню в UI)
export const menuItems = [
  {
    label: 'Управление архитектурой',
    icon: 'compass',
    children: [
      { label: 'Архитектурные принципы', path: '/principles', icon: 'alert' },
      { label: 'Архитектурные решения (ADR)', path: '/decisions/principle', icon: 'file' },
      { label: 'Архитектурные заключения', path: '/decisions/applied', icon: 'file-text' },
      { label: 'Архитектурный долг', path: '/architecture-debt', icon: 'debt' },
    ],
  },
  {
    label: 'Бизнес-архитектура',
    icon: 'briefcase',
    children: [
      { label: 'Организационные единицы', path: '/organization-units', icon: 'org' },
      { label: 'Заинтересованные лица', path: '/actors', icon: 'user' },
      { label: 'Продукты', path: '/business-services', icon: 'service' },
      { label: 'Бизнес-способности', path: '/business-functions', icon: 'function' },
      { label: 'Цели и задачи', path: '/goals', icon: 'target' },
    ],
  },
  {
    label: 'Информационные системы',
    icon: 'desktop',
    children: [
      { label: 'Каталог ИС', path: '/systems', icon: 'list' },
      { label: 'Реестр интеграций', path: '/integrations', icon: 'share' },
      { label: 'Реестр веб-ресурсов', path: '/web-resources', icon: 'globe' },
    ],
  },
  {
    label: 'Технологии',
    icon: 'gear',
    children: [
      { label: 'Каталог технологий', path: '/technologies', icon: 'gears' },
      { label: 'Тех.радар', path: '/tech-radar', icon: 'radar' },
    ],
  },
  {
    label: 'Аналитика',
    icon: 'chart',
    children: [
      { label: 'Анализ зависимостей', path: '/analytics', icon: 'chart' },
      { label: 'Дашборды', path: '/dashboards', icon: 'chart' },
      { label: 'Связи объектов управления', path: '/metamodel-relations', icon: 'link' },
    ],
  },
  {
    label: 'Настройки',
    icon: 'settings',
    children: [
      { label: 'Справочники', path: '/references', icon: 'book' },
      { label: 'Справочник дашбордов', path: '/dashboards/catalog', icon: 'book' },
      { label: 'Параметры', path: '/settings/parameters', icon: 'settings' },
      { label: 'Сервисные операции', path: '/settings/service-operations', icon: 'wrench' },
    ],
  },
]

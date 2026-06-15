import * as LucideIcons from 'lucide-vue-next'

/**
 * Общий словарь иконок для меню/плиток/KPI.
 * Значения — имена компонентов из lucide-vue-next (монохромные SVG).
 * Для типов сущностей в анализаторе использованы те же базовые иконки:
 * Monitor, Building2, User, Package, GitBranch, Scale, AlertTriangle, Cpu.
 */
export const menuIconNames = {
  home: 'House',
  alert: 'AlertTriangle',
  compass: 'Compass',
  file: 'File',
  'file-text': 'FileText',
  debt: 'AlertTriangle',
  briefcase: 'Briefcase',
  org: 'Building2',
  user: 'User',
  service: 'Package',
  function: 'GitBranch',
  desktop: 'Monitor',
  list: 'List',
  share: 'Share2',
  globe: 'Globe',
  link: 'Link',
  gear: 'Settings',
  gears: 'Settings',
  radar: 'Radar',
  chart: 'BarChart3',
  settings: 'Settings',
  wrench: 'Wrench',
  book: 'BookOpen',
  target: 'Target',
}

export function getMenuIconName(name) {
  return menuIconNames[name] || 'Circle'
}

export function getMenuIconComponent(name) {
  const iconName = getMenuIconName(name)
  return LucideIcons[iconName] || LucideIcons.Circle
}

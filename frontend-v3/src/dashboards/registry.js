/**
 * Реестр дашбордов ECharts: метаданные и сопоставление slug → компонент.
 */
import BusinessFunctionsTreemapChart from '../components/dashboards/BusinessFunctionsTreemapChart.vue'

export const dashboards = [
  {
    slug: 'business-functions-treemap',
    title: 'Бизнес-способности (treemap)',
    description:
      'Иерархия бизнес-функций из каталога. Площадь прямоугольника пропорциональна числу узлов в поддереве. Клик по блоку — drill-down, сверху хлебные крошки для возврата.',
    category: 'Бизнес-архитектура',
    component: BusinessFunctionsTreemapChart,
  },
]

export const dashboardBySlug = Object.fromEntries(dashboards.map((d) => [d.slug, d]))

export const dashboardSlugLabels = Object.fromEntries(dashboards.map((d) => [d.slug, d.title]))

export function getDashboard(slug) {
  return dashboardBySlug[slug] || null
}

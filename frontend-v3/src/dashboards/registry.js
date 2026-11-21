/**
 * Реестр дашбордов: метаданные и сопоставление slug → компонент.
 * Компонент может быть ECharts-графиком или обычной HTML-визуализацией (матрица).
 */
import BusinessFunctionsTreemapChart from '../components/dashboards/BusinessFunctionsTreemapChart.vue'
import TargetArchitectureMatrixChart from '../components/dashboards/TargetArchitectureMatrixChart.vue'

export const dashboards = [
  {
    slug: 'target-architecture-matrix',
    title: 'Целевая архитектура: матрица',
    description:
      'Матрица «бизнес-способности × продукты» по целевой архитектуре. В ячейках — системы: зелёные в промышленной или опытной эксплуатации, оранжевые — новые или планируемые.',
    category: 'Бизнес-архитектура',
    component: TargetArchitectureMatrixChart,
  },
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

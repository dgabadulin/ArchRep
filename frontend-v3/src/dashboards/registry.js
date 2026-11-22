/**
 * Реестр дашбордов: метаданные и сопоставление slug → компонент.
 * Компонент может быть ECharts-графиком или обычной HTML-визуализацией (матрица).
 */
import BusinessFunctionsTreemapChart from '../components/dashboards/BusinessFunctionsTreemapChart.vue'
import TargetArchitectureMatrixChart from '../components/dashboards/TargetArchitectureMatrixChart.vue'

export const dashboards = [
  {
    slug: 'target-architecture-matrix',
    title: 'Карта ИТ ландшафта',
    description:
      'Матрица «бизнес-способности × продукты» по целевой архитектуре. В ячейках — системы: зелёные в промышленной или опытной эксплуатации, оранжевые — новые или планируемые.',
    category: 'Бизнес-архитектура',
    requires: [
      'Реестр «Системы» (ar_systems)',
      'Реестр «Бизнес-способности» (ar_business_functions, связи system_business_function)',
      'Реестр «Продукты» (бизнес-сервисы, связи system_business_service)',
      'Типы связей: system_business_function, system_business_service (payload source = architecture_capability_matrix)',
      'Системные параметры: ARR_TARGET_MATRIX_ORDER (порядок колонок), ARR_TARGET_MATRIX_FUNCTION_ORDER (порядок строк)',
    ],
    component: TargetArchitectureMatrixChart,
  },
  {
    slug: 'business-functions-treemap',
    title: 'Бизнес-способности (treemap)',
    description:
      'Иерархия бизнес-функций из каталога. Площадь прямоугольника пропорциональна числу узлов в поддереве. Клик по блоку — drill-down, сверху хлебные крошки для возврата.',
    category: 'Бизнес-архитектура',
    requires: [
      'Реестр «Бизнес-способности» (ar_business_functions) с иерархией parent_id',
    ],
    component: BusinessFunctionsTreemapChart,
  },
]

export const dashboardBySlug = Object.fromEntries(dashboards.map((d) => [d.slug, d]))

export const dashboardSlugLabels = Object.fromEntries(dashboards.map((d) => [d.slug, d.title]))

export function getDashboard(slug) {
  return dashboardBySlug[slug] || null
}

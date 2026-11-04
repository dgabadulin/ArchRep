/**
 * Реестр поверхностей UI подключаемых модулей (docs/modules-contract.md §7.1, §7.3).
 *
 * Модуль (build-time) вызывает `registerSurface(point, entry)`; ядро решает, где и как
 * отрисовать компонент. Реестр реактивный — `SurfaceHost` перерисовывается при регистрации.
 *
 * entry: { code, component, requiredPermission?, props? }
 */
import { reactive } from 'vue'

const state = reactive({ points: {} })

/**
 * @param {string} point — например 'adrAppliedForm.actions'
 * @param {{code:string, component:any, requiredPermission?:string|null, props?:object}} entry
 * @returns {boolean} false — запись уже есть (повторный install)
 */
export function registerSurface(point, entry) {
  if (!point || !entry || !entry.component) return false
  if (!state.points[point]) state.points[point] = []
  const list = state.points[point]
  const code = String(entry.code || '')
  if (list.some((item) => item.code === code && item.component === entry.component)) return false
  list.push({
    code,
    component: entry.component,
    requiredPermission: entry.requiredPermission || null,
    props: entry.props && typeof entry.props === 'object' ? entry.props : null,
  })
  return true
}

/**
 * Все поверхности точки (в порядке регистрации).
 * @param {string} point
 */
export function listSurfaces(point) {
  return state.points[point] || []
}

/** Для диагностики/тестов. */
export function surfaceRegistry() {
  return state
}

export function resetSurfaces() {
  for (const point of Object.keys(state.points)) delete state.points[point]
}

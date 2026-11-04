/**
 * Установка фронтовых модулей при старте SPA (build-time, docs/modules-contract.md §7.2).
 *
 * Список адаптеров статический: компоненты модулей попадают в общий бандл на этапе Vite.
 * Ошибка одного модуля не мешает остальным и не ломает приложение.
 */
import { registerSurface } from './registry'
import drawioPro from './adapters/drawioPro'

const ADAPTERS = [drawioPro]

export function installModuleSurfaces() {
  const ui = {
    registerSurface: (point, entry) => registerSurface(point, entry),
  }
  for (const adapter of ADAPTERS) {
    if (!adapter || typeof adapter.install !== 'function') continue
    try {
      adapter.install({ ui })
    } catch (err) {
      console.warn(`[modules][${adapter.code || '?'}] install failed: ${err && err.message ? err.message : err}`)
    }
  }
}

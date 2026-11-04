/**
 * Адаптер фронта модуля DrawIO Pro (build-time, docs/modules-contract.md §7).
 *
 * Модуль v0.1.0 не отдаёт `install(ctx)` и не объявляет компоненты в module.json —
 * ядро подключает его публичные Vue-компоненты напрямую (контракт §16.6 #1/#2).
 * Путь `@isar/drawio-pro` резолвится alias'ом в vite.config.js:
 *   - установленный пакет (@isar/drawio-pro в зависимостях / modules/drawio-pro) — реальный модуль;
 *   - иначе — заглушки frontend-v3/src/modules/stubs/drawio-pro (сборка не падает).
 *
 * Никакой код модуля в ядро не копируется: используются только его публичные экспорты.
 */
import { defineAsyncComponent } from 'vue'

export const code = 'drawio-pro'

/** Причина, по которой точка расширения не отрисовалась (для консоли). */
function stubComponent(label) {
  return {
    name: `Stub${label}`,
    props: { title: { type: String, default: '' } },
    render() {
      return null
    },
  }
}

function loadComponent(loader, label) {
  return defineAsyncComponent(async () => {
    try {
      const mod = await loader()
      return (mod && mod.default) || mod || stubComponent(label)
    } catch (err) {
      // Не ломаем SPA: если пакет не собран/не установлен — компонент не рисуется.
      console.warn(`[modules][${code}] компонент ${label} недоступен: ${err && err.message ? err.message : err}`)
      return stubComponent(label)
    }
  })
}

export const DrawioProButton = loadComponent(
  () => import('@isar/drawio-pro/frontend/DrawioProButton.vue'),
  'DrawioProButton',
)

export const DrawioProPanel = loadComponent(
  () => import('@isar/drawio-pro/frontend/DrawioProPanel.vue'),
  'DrawioProPanel',
)

/**
 * Контракт §7.3: `install(ctx)` + `ctx.ui.registerSurface(point, Component)`.
 * @param {{ui:{registerSurface:Function}}} ctx
 */
export function install(ctx) {
  const ui = ctx && ctx.ui
  if (!ui || typeof ui.registerSurface !== 'function') return false
  ui.registerSurface('adrAppliedForm.actions', {
    code,
    component: DrawioProButton,
    requiredPermission: 'adr_applied:write',
  })
  ui.registerSurface('diagramEditor.toolbar', {
    code,
    component: DrawioProPanel,
    requiredPermission: 'adr_applied:write',
  })
  return true
}

export default { code, install }

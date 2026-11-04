/**
 * API-адаптер ядра для контроллера модуля DrawIO Pro (frontend/README.md §3).
 *
 * Модуль не ходит в HTTP сам — все методы передаёт ядро. Здесь:
 * - каталоги (`listSystems`, `listSystemFunctions`, `listIntegrationFlows`);
 * - сохранение заключения через `full`-эндпоинты в режиме `merge` (ядро заменяет только
 *   выбранное решение и **не затирает шапку** — docs/modules-contract.md §16.6 #5);
 * - сохранение `.drawio`: приоритет — XML из редактора (раскладка пользователя), иначе mxfile модуля
 *   (§16.6 #6: `POST .../diagrams` принимает клиентский mxfile).
 */
import { api } from '../../api/client'

function resolve(value) {
  return typeof value === 'function' ? value() : value
}

/**
 * @param {{incrementId?:number|string|null|(()=>any), getEditorXml?:()=>Promise<string|null>}} opts
 */
export function createDrawioProApi({ incrementId = null, getEditorXml = null } = {}) {
  const currentIncrementId = () => {
    const value = resolve(incrementId)
    return value == null || value === '' ? undefined : value
  }

  return {
    listSystems: (params) => api.getSystems(params),
    listSystemFunctions: (systemId) => api.getSystemFunctions(systemId),
    listIntegrationFlows: (params) => api.getIntegrationFlows(params),

    /** Новое заключение: POST /full (increments_mode=merge — не плодим лишние решения). */
    saveAppliedFull: (body) => api.saveDecisionAppliedFull({
      ...(body || {}),
      increments_mode: 'merge',
    }),

    /** Существующее заключение: PUT /full с заменой только текущего решения. */
    updateAppliedFull: (id, body) => api.updateDecisionAppliedFull(id, {
      ...(body || {}),
      increments_mode: 'merge',
      increment_id: currentIncrementId(),
    }),

    /**
     * Сохранение схемы: берём XML из открытого редактора (пользовательская раскладка),
     * а mxfile модуля — только если редактор недоступен.
     */
    createIncrementDiagram: async (targetIncrementId, body) => {
      let editorXml = null
      if (typeof getEditorXml === 'function') {
        try {
          editorXml = await getEditorXml()
        } catch (_) {
          editorXml = null
        }
      }
      const mxfile = editorXml || (body && body.mxfile) || undefined
      return api.createIncrementDiagram(targetIncrementId, mxfile ? { mxfile } : {})
    },
  }
}

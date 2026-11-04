/**
 * Статус подключаемых модулей для UI (docs/modules-contract.md §7.4).
 *
 * Авторитетный источник — секция `modules` в `GET /api/config` (решение §16.6 #9).
 * `/api/<code>/manifest` используется только как fallback, если ядро ещё не отдало секцию
 * (например, старый backend) — модуль v0.1.0 отдаёт `active: true` безусловно, поэтому
 * его ответ НЕ перекрывает `enabled/licensed` из конфига.
 */
import { reactive } from 'vue'
import { api } from '../api/client'

const state = reactive({
  modules: {},
  manifests: {},
  pending: {},
})

export function setModulesConfig(map) {
  state.modules = map && typeof map === 'object' ? { ...map } : {}
}

export function moduleStatus(code) {
  return state.modules[code] || null
}

/**
 * Статус для гейта видимости: config → manifest → «неизвестно».
 * @param {string} code
 * @returns {{ready:boolean, enabled:boolean, licensed:boolean, source:string|null, expires_at:string|null}}
 */
export function moduleGate(code) {
  const fromConfig = state.modules[code]
  if (fromConfig) {
    return {
      ready: true,
      enabled: Boolean(fromConfig.enabled),
      licensed: Boolean(fromConfig.licensed),
      source: 'config',
      expires_at: fromConfig.expires_at || null,
    }
  }
  const hasManifest = Object.prototype.hasOwnProperty.call(state.manifests, code)
  const manifest = state.manifests[code]
  if (hasManifest && manifest) {
    const enabled = manifest.enabled != null ? Boolean(manifest.enabled) : Boolean(manifest.active)
    const licensed = manifest.licensed != null ? Boolean(manifest.licensed) : Boolean(manifest.active)
    return {
      ready: true,
      enabled,
      licensed,
      source: 'manifest',
      expires_at: manifest.expires_at || null,
    }
  }
  return { ready: false, enabled: false, licensed: false, source: null, expires_at: null }
}

/**
 * Догрузить `/api/<code>/manifest`, если статуса модуля нет в конфиге.
 * @param {string} code
 */
export async function ensureModuleStatus(code) {
  if (!code) return moduleGate(code)
  if (state.modules[code]) return moduleGate(code)
  if (Object.prototype.hasOwnProperty.call(state.manifests, code)) return moduleGate(code)
  if (state.pending[code]) return state.pending[code]

  const task = (async () => {
    try {
      const info = await api.getModuleManifest(code)
      state.manifests[code] = info || null
    } catch (_) {
      state.manifests[code] = null
    } finally {
      delete state.pending[code]
    }
    return moduleGate(code)
  })()

  state.pending[code] = task
  return task
}

/** Для тестов/перезагрузки конфига. */
export function resetModuleStatus() {
  state.modules = {}
  state.manifests = {}
  state.pending = {}
}

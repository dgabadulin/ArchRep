import { computed } from 'vue'
import { authStore } from '../auth/authStore'

/**
 * Хелпер для UI-проверок RBAC (docs/access-control-design.md §8).
 * При AUTH_ENABLED=false все can* возвращают true.
 */
export function usePermissions(resource) {
  const can = (code) => authStore.hasPermission(code)

  const canRead = computed(() => (resource ? can(`${resource}:read`) : true))
  const canWrite = computed(() => (resource ? can(`${resource}:write`) : true))
  const canDelete = computed(() => (resource ? can(`${resource}:delete`) : true))
  const canExport = computed(() => (resource ? can(`${resource}:export`) : true))

  return {
    can,
    canRead,
    canWrite,
    canDelete,
    canExport,
    hasPermission: can,
    hasAllPermissions: (...codes) => authStore.hasAllPermissions(codes.flat()),
    hasAnyPermission: (...codes) => authStore.hasAnyPermission(codes.flat()),
  }
}

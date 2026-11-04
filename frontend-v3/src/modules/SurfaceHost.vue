<template>
  <component
    :is="item.component"
    v-for="(item, index) in visibleSurfaces"
    :key="item.key"
    :ref="(el) => setInstance(index, el)"
    v-bind="contextProps"
    v-on="listeners"
  />
</template>

<script setup>
/**
 * Хост поверхностей расширения (docs/modules-contract.md §7.1, §7.4).
 *
 * Рендерит все компоненты, зарегистрированные модулями на точку `point`, и гейтит их:
 *   модуль включён и лицензирован (`/api/config.modules`) + есть `requiredPermission`.
 *
 * События пробрасываются «как есть»: родитель слушает `@open`, `@saved`, `@error` и т.п.
 * Доступ к экземплярам компонентов (например, `panel.controller`) — через `getInstance(i)`.
 */
import { computed, onMounted, ref, useAttrs } from 'vue'
import { listSurfaces } from './registry'
import { authStore } from '../auth/authStore'
import { ensureModuleStatus, moduleGate } from './status'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  /** Точка расширения, например 'adrAppliedForm.actions' */
  point: { type: String, required: true },
  /** Пропсы, передаваемые компоненту модуля. */
  context: { type: Object, default: () => ({}) },
  /** Ограничить точку одним модулем (необязательно). */
  moduleCode: { type: String, default: '' },
})

const attrs = useAttrs()
const instances = ref([])
const surfaces = computed(() => listSurfaces(props.point))

const visibleSurfaces = computed(() =>
  surfaces.value
    .filter((sf) => {
      if (props.moduleCode && sf.code !== props.moduleCode) return false
      const gate = moduleGate(sf.code)
      if (!gate.ready || !gate.enabled || !gate.licensed) return false
      if (sf.requiredPermission && !authStore.hasPermission(sf.requiredPermission)) return false
      return true
    })
    .map((sf, index) => ({ ...sf, key: `${sf.code}:${sf.point || props.point}:${index}` })),
)

const listeners = computed(() => attrs)
const contextProps = computed(() => props.context || {})

function setInstance(index, el) {
  if (el) instances.value[index] = el
  else delete instances.value[index]
}

onMounted(() => {
  for (const sf of surfaces.value) ensureModuleStatus(sf.code)
})

defineExpose({
  getInstance: (index = 0) => instances.value[index] || null,
  instances: () => instances.value,
})
</script>

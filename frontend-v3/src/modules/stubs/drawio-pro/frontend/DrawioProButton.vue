<template>
  <span v-if="false" />
</template>

<script setup>
/**
 * Заглушка компонента кнопки модуля DrawIO Pro.
 *
 * Используется, когда пакет `@isar/drawio-pro` не установлен в сборку:
 * Vite alias подставляет этот каталог вместо реального модуля, чтобы `npm run build:v3`
 * не падал. Точка расширения при этом всё равно скрыта (модуль не загружен ядром →
 * нет статуса в /api/config → gate не пропускает).
 */
defineProps({
  appliedId: { type: [Number, String], default: null },
  incrementId: { type: [Number, String], default: null },
  title: { type: String, default: '' },
})
defineEmits(['open'])
</script>

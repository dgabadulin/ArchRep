<template>
  <div class="drawio-pro-stub">
    <p class="drawio-pro-stub__title">DrawIO Pro не установлен</p>
    <p class="drawio-pro-stub__hint">
      Пакет <code>@isar/drawio-pro</code> не найден в сборке. Установите модуль
      (<code>npm i @isar/drawio-pro@0.1.0</code> или каталог <code>modules/drawio-pro</code>)
      и пересоберите фронт: <code>npm run build:v3</code>.
    </p>
  </div>
</template>

<script setup>
/**
 * Заглушка панели модуля DrawIO Pro (см. DrawioProButton.vue).
 * Реальная панель — `@isar/drawio-pro/frontend/DrawioProPanel.vue`.
 */
defineProps({
  api: { type: Object, default: () => ({}) },
  appliedId: { type: [Number, String], default: null },
  incrementId: { type: [Number, String], default: null },
  increment: { type: Object, default: () => ({}) },
  formMode: { type: String, default: 'builtin' },
})
defineEmits(['diagram', 'saved', 'error', 'open-system-form', 'open-function-form', 'open-flow-form'])
</script>

<style scoped>
.drawio-pro-stub {
  border: 1px dashed var(--color-border, #ccc);
  border-radius: 6px;
  padding: 0.75rem;
  font-size: 0.85rem;
  color: var(--color-muted, #666);
}
.drawio-pro-stub__title {
  margin: 0 0 0.35rem;
  font-weight: 600;
}
.drawio-pro-stub__hint {
  margin: 0;
}
</style>

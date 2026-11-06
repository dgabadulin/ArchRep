<template>
  <div class="save-bar">
    <div class="save-bar__status" aria-live="polite">
      <span v-if="error" class="save-bar__msg save-bar__msg--error">{{ error }}</span>
      <span v-else-if="saving" class="save-bar__msg save-bar__msg--muted">Сохранение…</span>
      <span v-else-if="saved" class="save-bar__msg save-bar__msg--saved">Сохранено ✓</span>
      <span v-else-if="dirty" class="save-bar__msg save-bar__msg--muted">Есть несохранённые изменения</span>
    </div>
    <div class="save-bar__actions">
      <button
        v-if="canSave"
        type="button"
        class="btn btn-primary"
        :disabled="saving"
        @click="$emit('save')"
      >
        {{ saving ? 'Сохранение…' : saveLabel }}
      </button>
      <button
        v-if="canSave && showSaveAndClose"
        type="button"
        class="btn btn-secondary"
        :disabled="saving"
        @click="$emit('save-and-close')"
      >
        Сохранить и закрыть
      </button>
      <slot name="cancel" />
    </div>
  </div>
</template>

<script setup>
/**
 * Единая панель сохранения формы (issue #94).
 *
 * Одинаковая на всех формах и вкладках: одна кнопка сохранения, состояние
 * «сохранение → сохранено → ошибка», без двойных нажатий (кнопка блокируется на время
 * `saving`). У вкладок собственных кнопок сохранения нет — они правят локальный черновик.
 */
defineProps({
  /** Идёт сохранение: кнопки блокируются, чтобы исключить двойную отправку. */
  saving: { type: Boolean, default: false },
  /** Сохранение только что завершилось успешно (кратковременная отметка «Сохранено ✓»). */
  saved: { type: Boolean, default: false },
  /** Есть неприменённые изменения (шапка формы или черновик вкладки). */
  dirty: { type: Boolean, default: false },
  /** Есть право записи: без него кнопок сохранения нет (режим просмотра). */
  canSave: { type: Boolean, default: false },
  /** Текст основной кнопки. */
  saveLabel: { type: String, default: 'Сохранить' },
  /** Показывать вторую кнопку «Сохранить и закрыть» (только на страницах-формах). */
  showSaveAndClose: { type: Boolean, default: false },
  /** Текст ошибки сохранения; показывается слева от кнопок. */
  error: { type: String, default: '' },
})

defineEmits(['save', 'save-and-close'])
</script>

<style scoped>
.save-bar {
  position: sticky;
  bottom: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem 1rem;
  flex-wrap: wrap;
  margin-top: 1.5rem;
  padding: 0.75rem 1rem;
  background: var(--ar-surface);
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-lg);
  box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.07);
}
.save-bar__status {
  min-height: 1.25rem;
  font-size: 0.9rem;
  line-height: 1.35;
}
.save-bar__msg--error {
  color: var(--ar-danger);
  font-weight: 600;
}
.save-bar__msg--saved {
  color: var(--ar-success);
  font-weight: 600;
}
.save-bar__msg--muted {
  color: var(--ar-muted);
}
.save-bar__actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-left: auto;
}
</style>

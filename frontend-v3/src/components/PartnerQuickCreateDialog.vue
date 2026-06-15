<template>
  <Teleport to="body">
    <div v-if="modelValue" class="partner-create-overlay" @click.self="close">
      <div class="partner-create-modal card" role="dialog" aria-labelledby="partner-create-title">
        <h3 id="partner-create-title">Новый партнёр</h3>
        <div class="form-row">
          <label for="partner-create-name">Наименование <span class="req">*</span></label>
          <input
            id="partner-create-name"
            ref="nameInput"
            v-model="name"
            type="text"
            autocomplete="off"
            :disabled="saving"
            @keydown.enter.prevent="submit"
          />
        </div>
        <p v-if="duplicateHint" class="duplicate-hint">{{ duplicateHint }}</p>
        <p v-if="error" class="error">{{ error }}</p>
        <div class="modal-actions">
          <button type="button" class="btn btn-primary" :disabled="saving || !nameTrimmed" @click="submit">
            {{ saving ? 'Сохранение...' : 'Создать' }}
          </button>
          <button type="button" class="btn btn-secondary" :disabled="saving" @click="close">Отмена</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { api } from '../api/client'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** Уже загруженные партнёры — для мягкой проверки дублей по имени */
  existingPartners: { type: Array, default: () => [] },
})

const emit = defineEmits(['update:modelValue', 'created'])

const name = ref('')
const saving = ref(false)
const error = ref('')
const nameInput = ref(null)

const nameTrimmed = computed(() => String(name.value || '').trim())

const duplicateHint = computed(() => {
  const n = nameTrimmed.value.toLowerCase()
  if (!n) return ''
  const dup = props.existingPartners.find((p) =>
    String(p.display_name || p.name || '').trim().toLowerCase() === n,
  )
  if (!dup) return ''
  return `Партнёр с похожим наименованием уже есть: «${dup.display_name || dup.name}». Можно выбрать его в списке или всё равно создать новую запись.`
})

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return
    name.value = ''
    error.value = ''
    saving.value = false
    await nextTick()
    nameInput.value?.focus()
  },
)

function close() {
  if (saving.value) return
  emit('update:modelValue', false)
}

async function submit() {
  if (!nameTrimmed.value || saving.value) return
  saving.value = true
  error.value = ''
  try {
    const created = await api.createPartner({ name: nameTrimmed.value })
    emit('created', created)
    emit('update:modelValue', false)
  } catch (e) {
    error.value = e.message || 'Не удалось создать партнёра'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.partner-create-overlay {
  position: fixed;
  inset: 0;
  background: rgba(26, 29, 46, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}
.partner-create-modal {
  min-width: 320px;
  max-width: 28rem;
  padding: 1.5rem;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
}
.partner-create-modal h3 {
  margin: 0 0 1rem;
  font-size: 1.1rem;
}
.form-row {
  margin-bottom: 0.75rem;
}
.form-row label {
  display: block;
  margin-bottom: 0.35rem;
  font-weight: 600;
  font-size: 0.8rem;
  color: var(--ar-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.form-row input {
  width: 100%;
  padding: 0.5rem 0.65rem;
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  font-size: 0.95rem;
  background: var(--ar-surface);
}
.duplicate-hint {
  margin: 0 0 0.75rem;
  font-size: 0.85rem;
  color: var(--ar-muted);
  line-height: 1.4;
}
.error {
  margin: 0 0 0.75rem;
  color: var(--ar-danger);
  font-size: 0.9rem;
}
.modal-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.req {
  color: var(--ar-danger);
}
</style>

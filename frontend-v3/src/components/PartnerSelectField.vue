<template>
  <div class="field partner-select-field">
    <label>{{ label }}</label>
    <div class="partner-select-row">
      <select v-model="selectModel" class="partner-select">
        <option value="">—</option>
        <option v-for="p in options" :key="p.id" :value="p.id">{{ p.display_name || p.name }}</option>
      </select>
      <button
        v-if="canCreatePartner"
        type="button"
        class="btn btn-secondary btn-add-partner"
        title="Добавить партнёра"
        aria-label="Добавить партнёра"
        @click="dialogOpen = true"
      >
        +
      </button>
    </div>
    <PartnerQuickCreateDialog
      v-if="canCreatePartner"
      v-model="dialogOpen"
      :existing-partners="options"
      @created="onPartnerCreated"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import PartnerQuickCreateDialog from './PartnerQuickCreateDialog.vue'
import { authStore } from '../auth/authStore'

const props = defineProps({
  modelValue: { type: [Number, String, null], default: null },
  label: { type: String, required: true },
  options: { type: Array, default: () => [] },
  /** false — скрыть быстрое создание; по умолчанию — по partner:write */
  allowCreate: { type: Boolean, default: undefined },
})

const canCreatePartner = computed(() => {
  if (props.allowCreate === false) return false
  if (props.allowCreate === true) return true
  return authStore.hasPermission('partner:write')
})


const emit = defineEmits(['update:modelValue', 'partner-created'])

const dialogOpen = ref(false)

const selectModel = computed({
  get: () => (props.modelValue == null ? '' : props.modelValue),
  set: (v) => {
    if (v === '' || v == null) {
      emit('update:modelValue', null)
      return
    }
    const n = Number(v)
    emit('update:modelValue', Number.isNaN(n) ? v : n)
  },
})

function onPartnerCreated(partner) {
  emit('partner-created', partner)
  emit('update:modelValue', partner.id)
}
</script>

<style scoped>
.partner-select-row {
  display: flex;
  align-items: stretch;
  gap: 0.5rem;
}
.partner-select {
  flex: 1;
  min-width: 0;
  padding: 0.5rem 0.65rem;
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  font-size: 0.95rem;
  color: var(--ar-text);
  background: var(--ar-surface);
}
.btn-add-partner {
  flex-shrink: 0;
  width: 2.25rem;
  padding: 0;
  font-size: 1.15rem;
  line-height: 1;
  font-weight: 600;
}
</style>

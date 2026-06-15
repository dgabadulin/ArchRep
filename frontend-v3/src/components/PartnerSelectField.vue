<template>
  <div class="field partner-select-field">
    <label>{{ label }}</label>
    <div class="partner-select-row">
      <select v-model="selectModel" class="partner-select">
        <option value="">—</option>
        <option v-for="p in options" :key="p.id" :value="p.id">{{ p.display_name || p.name }}</option>
      </select>
      <button
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
      v-model="dialogOpen"
      :existing-partners="options"
      @created="onPartnerCreated"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import PartnerQuickCreateDialog from './PartnerQuickCreateDialog.vue'

const props = defineProps({
  modelValue: { type: [Number, String, null], default: null },
  label: { type: String, required: true },
  options: { type: Array, default: () => [] },
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

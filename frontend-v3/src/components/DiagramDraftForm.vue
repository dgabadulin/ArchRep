<template>
  <div v-if="show" class="modal-overlay" role="dialog" aria-modal="true" @click.self="$emit('close')">
    <div class="modal modal-draft">
      <h3>{{ title }}</h3>

      <div v-if="kind === 'system'" class="form-row">
        <label>Наименование <span class="req">*</span></label>
        <input v-model="values.label" type="text" class="modal-input" maxlength="255" placeholder="Напр. CRM" />
      </div>
      <div v-if="kind === 'system'" class="form-row">
        <label>Код</label>
        <input v-model="values.code" type="text" class="modal-input" maxlength="64" placeholder="Напр. SYS-CRM" />
      </div>

      <div v-if="kind === 'flow'" class="form-row">
        <label>Передаваемые данные <span class="req">*</span></label>
        <input v-model="values.label" type="text" class="modal-input" maxlength="500" placeholder="Напр. Заявки" />
      </div>
      <div v-if="kind === 'flow'" class="form-row">
        <label>Поток из реестра</label>
        <select v-model="values.flowId" class="modal-input">
          <option :value="null">— новый поток (создастся при сохранении) —</option>
          <option v-for="f in flowOptions" :key="f.id" :value="String(f.id)">{{ f.label }}</option>
        </select>
      </div>

      <div class="form-row">
        <label>Статус в заключении</label>
        <select v-model="values.statusCode" class="modal-input">
          <option :value="null">—</option>
          <option v-for="st in statusOptions" :key="st.code" :value="st.code">{{ st.name }}</option>
        </select>
      </div>

      <p v-for="e in errors" :key="e.message" class="error">{{ e.message }}</p>

      <div class="modal-actions">
        <button type="button" class="btn btn-primary" @click="submit">Применить</button>
        <button type="button" class="btn btn-secondary" @click="$emit('close')">Отмена</button>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * Модалка черновика для палитры диаграммы: новая система или новый поток.
 *
 * Ничего не пишет в реестр — отдаёт значения через `submit`, палитра кладёт их
 * в черновик (`useDiagramDraft`). Сохранение в БД — только по кнопке «Сохранить».
 */
import { reactive, watch } from 'vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  kind: { type: String, default: 'system' }, // 'system' | 'flow'
  title: { type: String, default: 'Новый объект' },
  initial: { type: Object, default: null },
  statusOptions: { type: Array, default: () => [] },
  flowOptions: { type: Array, default: () => [] },
  errors: { type: Array, default: () => [] },
})

const emit = defineEmits(['submit', 'close'])

const values = reactive({ label: '', code: '', flowId: null, statusCode: null })

function reset() {
  const src = props.initial || {}
  values.label = src.label || ''
  values.code = src.code || ''
  values.flowId = src.flowId != null && src.flowId !== '' ? String(src.flowId) : null
  values.statusCode = src.statusCode || null
}

watch(() => [props.show, props.initial, props.kind], () => { if (props.show) reset() }, { immediate: true })

function submit() {
  emit('submit', { ...values })
}
</script>

<style scoped>
.modal-draft { width: min(30rem, 94vw); }
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(26, 29, 46, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 250;
}
.modal {
  background: var(--ar-surface);
  padding: 1.25rem;
  border-radius: var(--ar-radius-lg);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
  border: 1px solid var(--ar-border);
}
.modal h3 { margin: 0 0 0.75rem; font-size: 1.05rem; }
.form-row { margin-bottom: 0.75rem; }
.form-row label { display: block; margin-bottom: 0.25rem; font-size: 0.9rem; }
.modal-input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  box-sizing: border-box;
  background: var(--ar-surface);
  font: inherit;
}
.modal-actions { margin-top: 1rem; display: flex; gap: 0.5rem; }
.req { color: var(--ar-danger); }
.error { color: var(--ar-danger); margin: 0.35rem 0; font-size: 0.85rem; }
</style>

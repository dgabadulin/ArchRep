<template>
  <div class="col-picker-wrap" v-click-outside="() => $emit('close')">
    <button type="button" class="btn btn-secondary btn-same" @click.stop="$emit('toggle')">Вид</button>
    <div v-if="open" class="col-picker-dropdown">
      <label v-for="col in columns" :key="col.key" class="col-picker-item">
        <input
          type="checkbox"
          :checked="visibleCols.includes(col.key)"
          @change="$emit('toggle-col', col.key)"
        />
        {{ col.label || col.key }}
      </label>
    </div>
  </div>
</template>

<script setup>
import { vClickOutside } from '../directives/clickOutside'

defineProps({
  columns: { type: Array, required: true },
  visibleCols: { type: Array, required: true },
  open: { type: Boolean, default: false },
})

defineEmits(['toggle', 'close', 'toggle-col'])
</script>

<style scoped>
.col-picker-wrap {
  position: relative;
}
.col-picker-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 2px;
  background: var(--ar-surface);
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  box-shadow: var(--ar-shadow-card);
  padding: 0.5rem;
  min-width: 160px;
  z-index: 50;
}
.col-picker-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0;
  cursor: pointer;
  font-size: 0.9rem;
}
.btn-same {
  min-width: 140px;
}
</style>

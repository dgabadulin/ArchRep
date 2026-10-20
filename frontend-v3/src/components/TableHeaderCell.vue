<template>
  <div class="th-cell">
    <span
      class="th-label"
      :class="{ sortable: sortable }"
      @click="sortable && $emit('sort')"
    >
      {{ label }}
      <span v-if="sortable && isSorted" class="sort-indicator">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
    </span>
    <button
      v-if="filterType"
      type="button"
      class="th-filter-btn"
      :class="{ active: filterActive }"
      title="Фильтр"
      aria-label="Фильтр"
      @click.stop="$emit('toggle-filter')"
    >
      <Filter :size="14" :stroke-width="2" />
    </button>
  </div>
</template>

<script setup>
import { Filter } from 'lucide-vue-next'

defineProps({
  label: { type: String, required: true },
  sortable: { type: Boolean, default: false },
  isSorted: { type: Boolean, default: false },
  sortOrder: { type: String, default: 'asc' },
  filterType: { type: String, default: '' },
  filterActive: { type: Boolean, default: false },
})

defineEmits(['sort', 'toggle-filter'])
</script>

<style scoped>
.th-cell {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  justify-content: space-between;
}
.th-label.sortable {
  cursor: pointer;
  flex: 1;
  min-width: 0;
}
.th-filter-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  padding: 0;
  border: none;
  border-radius: var(--ar-radius-sm);
  background: transparent;
  color: var(--ar-muted);
  cursor: pointer;
}
.th-filter-btn:hover {
  background: #eef0f4;
  color: var(--ar-text);
}
.th-filter-btn.active {
  background: var(--ar-accent-muted);
  color: var(--ar-accent);
}
</style>

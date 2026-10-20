<template>
  <div class="toolbar">
    <input
      v-model="searchLocal"
      type="search"
      class="search-input"
      :placeholder="searchPlaceholder"
      @input="onSearchInput"
    />
    <slot name="extra" />
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { getConfig } from '@/config/params'

const props = defineProps({
  search: { type: String, default: '' },
  searchPlaceholder: { type: String, default: () => getConfig().ARR_SEARCH_PLACEHOLDER || 'Поиск по всем полям таблицы' },
})
const emit = defineEmits(['update:search'])

const searchLocal = ref(props.search)
watch(() => props.search, v => { searchLocal.value = v })
function onSearchInput() {
  emit('update:search', searchLocal.value)
}
</script>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}
.search-input {
  flex: 1;
  min-width: 320px;
  max-width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  font-size: 0.9rem;
  background: var(--ar-surface);
  color: var(--ar-text);
}
.search-input:focus {
  outline: none;
  border-color: var(--ar-accent);
  box-shadow: 0 0 0 2px var(--ar-accent-muted);
}
</style>

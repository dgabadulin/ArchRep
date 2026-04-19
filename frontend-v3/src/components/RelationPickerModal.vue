<template>
  <Teleport to="body">
    <div v-if="modelValue" class="relation-picker-overlay">
      <div class="relation-picker-modal card">
        <h3 class="modal-title">{{ title }}</h3>
        <p v-if="fromLabel" class="picker-hint">{{ fromLabel }}</p>

        <div class="picker-row">
          <label class="picker-label">Тип сущности «К» <span class="req">*</span></label>
          <select v-model="toEntityType" class="picker-select" @change="onEntityTypeChange">
            <option value="">— Выберите тип —</option>
            <option v-for="et in entityTypes" :key="et.code" :value="et.code">{{ et.display_name || (et.name + ' (' + et.code + ')') }}</option>
          </select>
        </div>

        <div v-if="toEntityType" class="picker-row">
          <label class="picker-label">Объект <span class="req">*</span></label>
          <input v-model="pickerSearch" type="text" class="picker-search" placeholder="Поиск по названию или коду..." />
          <div class="picker-list-wrap">
            <div v-if="listLoading" class="loading-inline">Загрузка...</div>
            <div v-else class="picker-list">
              <button
                v-for="item in filteredEntityList"
                :key="item.id"
                type="button"
                :class="['picker-item', { selected: selectedEntity && selectedEntity.id === item.id }]"
                @click="selectEntity(item)"
              >
                {{ item.display_name || item.name || item.code || `#${item.id}` }}
              </button>
            </div>
            <p v-if="!listLoading && entityList.length === 0" class="empty-inline">Нет записей</p>
          </div>
        </div>

        <div class="picker-row">
          <label class="picker-label">Тип связи <span class="req">*</span></label>
          <select v-model="relationTypeCode" class="picker-select">
            <option value="">— Выберите тип связи —</option>
            <option v-for="rt in relationTypesForSelectedTo" :key="rt.code" :value="rt.code">{{ rt.display_name || (rt.name + ' (' + rt.code + ')') }}</option>
          </select>
        </div>

        <div class="picker-row">
          <label class="picker-label">Название связи</label>
          <input v-model="relationName" type="text" class="picker-input" placeholder="Необязательно" />
        </div>

        <div class="modal-actions">
          <button type="button" class="btn btn-primary" :disabled="!canConfirm" @click="confirm">
            Добавить связь
          </button>
          <button type="button" class="btn btn-secondary" @click="$emit('update:modelValue', false)">
            Отмена
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { loadEntityList } from '../api/graphApi'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** Заголовок модалки */
  title: { type: String, default: 'Добавить связь' },
  /** Подсказка (например: «Связь от архитектурного долга к системе/технологии») */
  fromLabel: { type: String, default: '' },
  /** Список типов сущностей для выбора «К» */
  entityTypes: { type: Array, default: () => [] },
  /** Список типов связей (уже отфильтрованный по типу «от») */
  relationTypes: { type: Array, default: () => [] },
})

const emit = defineEmits(['update:modelValue', 'confirm'])

const toEntityType = ref('')
const pickerSearch = ref('')
const entityList = ref([])
const listLoading = ref(false)
const selectedEntity = ref(null)
const relationTypeCode = ref('')
const relationName = ref('')

const filteredEntityList = computed(() => {
  const q = (pickerSearch.value || '').trim().toLowerCase()
  if (!q) return entityList.value
  return entityList.value.filter(
    (e) =>
      (e.display_name && e.display_name.toLowerCase().includes(q)) ||
      (e.name && e.name.toLowerCase().includes(q)) ||
      (e.code && e.code.toLowerCase().includes(q)) ||
      (e.fullname && e.fullname.toLowerCase().includes(q)) ||
      String(e.id).includes(q)
  )
})

/** Типы связей только для выбранного типа «К» */
const relationTypesForSelectedTo = computed(() => {
  if (!toEntityType.value) return []
  return props.relationTypes.filter((rt) => rt.to_entity_type_code === toEntityType.value)
})

const canConfirm = computed(() => {
  return toEntityType.value && selectedEntity.value && relationTypeCode.value
})

async function loadList() {
  if (!toEntityType.value) {
    entityList.value = []
    return
  }
  listLoading.value = true
  try {
    entityList.value = await loadEntityList(toEntityType.value, {}) || []
  } catch {
    entityList.value = []
  } finally {
    listLoading.value = false
  }
}

function onEntityTypeChange() {
  selectedEntity.value = null
  relationTypeCode.value = ''
  pickerSearch.value = ''
  loadList()
}

function selectEntity(item) {
  selectedEntity.value = selectedEntity.value?.id === item.id
    ? null
    : { id: item.id, name: item.display_name || item.name || item.code || `#${item.id}` }
}

function confirm() {
  if (!canConfirm.value) return
  emit('confirm', {
    to_entity_type: toEntityType.value,
    to_entity_id: selectedEntity.value.id,
    relation_type: relationTypeCode.value,
    name: relationName.value?.trim() || undefined,
  })
  emit('update:modelValue', false)
  reset()
}

function reset() {
  toEntityType.value = ''
  pickerSearch.value = ''
  entityList.value = []
  selectedEntity.value = null
  relationTypeCode.value = ''
  relationName.value = ''
}

watch(() => props.modelValue, (visible) => {
  if (visible) {
    reset()
    if (props.entityTypes.length && !toEntityType.value) toEntityType.value = props.entityTypes[0]?.code || ''
    if (toEntityType.value) loadList()
  }
})

watch(toEntityType, () => {
  if (toEntityType.value) loadList()
})
</script>

<style scoped>
.relation-picker-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.relation-picker-modal {
  max-width: 480px;
  width: 100%;
  margin: 1rem;
  max-height: 90vh;
  overflow-y: auto;
}
.modal-title {
  margin: 0 0 0.5rem;
  font-size: 1.1rem;
  color: #0f172a;
}
.picker-hint {
  margin: 0 0 1rem;
  color: #5c5349;
  font-size: 0.9rem;
}
.picker-row {
  margin-bottom: 1rem;
}
.picker-label {
  display: block;
  font-weight: 500;
  margin-bottom: 0.35rem;
  color: #374151;
  font-size: 0.9rem;
}
.req {
  color: #b91c1c;
}
.picker-select,
.picker-input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  border: 1px solid #d4c4b0;
  font-size: 0.9rem;
  box-sizing: border-box;
}
.picker-search {
  width: 100%;
  margin-bottom: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  border: 1px solid #d4c4b0;
  font-size: 0.9rem;
  box-sizing: border-box;
}
.picker-list-wrap {
  max-height: 220px;
  overflow-y: auto;
  border: 1px solid #e5dccf;
  border-radius: 6px;
  padding: 0.5rem;
  background: #faf8f5;
}
.picker-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.picker-item {
  display: block;
  width: 100%;
  padding: 0.5rem 0.75rem;
  text-align: left;
  font-size: 0.9rem;
  background: #fff;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
}
.picker-item:hover {
  background: #f5f0eb;
}
.picker-item.selected {
  background: #e8ddd0;
  border-color: #cb997e;
}
.loading-inline,
.empty-inline {
  margin: 0;
  padding: 0.5rem;
  color: #5c5349;
  font-size: 0.9rem;
}
.modal-actions {
  margin-top: 1.25rem;
  display: flex;
  gap: 0.5rem;
}
.btn {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.9rem;
  border: none;
  cursor: pointer;
}
.btn-primary {
  background: #0284c7;
  color: #fff;
}
.btn-primary:hover:not(:disabled) {
  background: #0369a1;
}
.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.btn-secondary {
  background: #e2e8f0;
  color: #475569;
}
.btn-secondary:hover {
  background: #cbd5e1;
}
.card {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  border: 1px solid #e5e7eb;
  padding: 1.5rem;
}
</style>

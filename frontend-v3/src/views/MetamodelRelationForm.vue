<template>
  <div class="page">
    <div class="page-head">
      <h1>{{ formTitle }}</h1>
      <router-link :to="listRouteLocation" class="btn">Назад</router-link>
    </div>
    <form v-if="form" class="form" @submit.prevent="submit">
      <p v-if="isEdit && !canWrite" class="readonly-banner">Режим просмотра: нет права <code>metamodel_relation:write</code>.</p>
      <p v-if="isManagedIntegrationProjection" class="banner">
        Проекция интеграционного потока (поток id {{ form.reference_to_baserow }}). Редактируйте запись в
        <router-link v-if="hasPermission('integration_flow:read')" to="/integrations">реестре потоков</router-link><template v-else>реестре потоков</template>; пересборка проекций — в
        <router-link v-if="hasPermission('service_operations:execute')" to="/settings/service-operations">Настройки → Сервисные операции</router-link><template v-else>Настройки → Сервисные операции</template>.
      </p>
      <p v-else-if="isManagedRelation" class="banner">
        Связь создаётся и поддерживается автоматически (триггер БД или карточка источника).
        <template v-if="form.relation_type === 'system_technology' || form.relation_type === 'module_technology'">
          Стек технологий редактируется на карточке ИС.
        </template>
        <template v-else>
          Изменяйте её из карточки источника — ИС, партнёра, функции ИС, сертификата, веб-ресурса или потока.
        </template>
      </p>
      <fieldset class="form-fieldset" :disabled="!canWrite || isManagedRelation">
      <div class="form-row">
        <label>Тип сущности «От» *</label>
        <select v-model="form.from_entity_type" required :disabled="isManagedRelation" @change="onEndTypeChange('from')">
          <option v-for="et in entityTypes" :key="et.code" :value="et.code">{{ et.display_name || (et.name + ' (' + et.code + ')') }}</option>
        </select>
      </div>
      <div class="form-row">
        <label>Объект «От» *</label>
        <select
          v-if="!fromOptionsError"
          v-model.number="form.from_entity_id"
          required
          :disabled="isManagedRelation || fromOptionsLoading"
        >
          <option :value="null" disabled>{{ fromOptionsLoading ? 'Загрузка...' : '— Выберите объект —' }}</option>
          <option v-for="opt in fromOptions" :key="opt.id" :value="opt.id">{{ opt.label }}</option>
        </select>
        <input v-else class="readonly" readonly :value="endLabel('from')" />
        <p v-if="fromOptionsError" class="hint">{{ fromOptionsError }}</p>
      </div>
      <div class="form-row">
        <label>Тип связи *</label>
        <select v-model="form.relation_type" required :disabled="isManagedRelation">
          <option v-for="rt in relationTypesForSelect" :key="rt.id || rt.code" :value="rt.code">{{ rt.display_name || (rt.name + ' (' + rt.code + ')') }}</option>
        </select>
        <p v-if="!relationTypesForSelect.length" class="hint">Для выбранной пары типов нет доступных ручных типов связи.</p>
      </div>
      <div class="form-row">
        <label>Тип сущности «К» *</label>
        <select v-model="form.to_entity_type" required :disabled="isManagedRelation" @change="onEndTypeChange('to')">
          <option v-for="et in entityTypes" :key="et.code" :value="et.code">{{ et.display_name || (et.name + ' (' + et.code + ')') }}</option>
        </select>
      </div>
      <div class="form-row">
        <label>Объект «К» *</label>
        <select
          v-if="!toOptionsError"
          v-model.number="form.to_entity_id"
          required
          :disabled="isManagedRelation || toOptionsLoading"
        >
          <option :value="null" disabled>{{ toOptionsLoading ? 'Загрузка...' : '— Выберите объект —' }}</option>
          <option v-for="opt in toOptions" :key="opt.id" :value="opt.id">{{ opt.label }}</option>
        </select>
        <input v-else class="readonly" readonly :value="endLabel('to')" />
        <p v-if="toOptionsError" class="hint">{{ toOptionsError }}</p>
      </div>
      <div v-if="isManagedIntegrationProjection" class="form-row">
        <label>Подпись (displayed_name)</label>
        <input :value="form.displayed_name || '—'" class="readonly" readonly />
      </div>
      <div class="form-row">
        <label>Название связи</label>
        <input v-model="form.name" :disabled="isManagedRelation" />
      </div>
      <div class="form-row">
        <label>Описание</label>
        <textarea v-model="form.description" rows="2" :disabled="isManagedRelation"></textarea>
      </div>
      </fieldset>
      <p v-if="submitError" class="msg error">{{ submitError }}</p>
      <div class="form-actions">
        <button v-if="canWrite && !isManagedRelation" type="submit" class="btn btn-primary">Сохранить</button>
        <router-link :to="listRouteLocation" class="btn">{{ canWrite ? 'Отмена' : 'Назад к списку' }}</router-link>
      </div>
    </form>
    <div v-else-if="loading" class="msg">Загрузка...</div>
    <div v-else class="msg error">{{ error || 'Не найдено' }}</div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { togafApi } from '../api'
import { loadEntityList } from '../api/graphApi'
import { useFormListReturn } from '../composables/useFormListReturn'
import { usePermissions } from '../composables/usePermissions'

const route = useRoute()
const router = useRouter()
const { listRouteLocation } = useFormListReturn('/metamodel-relations')
const { canWrite, hasPermission } = usePermissions('metamodel_relation')
const id = computed(() => route.params.id)
const isEdit = computed(() => !!id.value && id.value !== 'new')
const formTitle = computed(() => {
  if (!isEdit.value) return 'Новая связь метамодели'
  return canWrite.value ? 'Редактирование связи' : 'Просмотр связи'
})
const form = ref(null)
const loading = ref(true)
const error = ref('')
const submitError = ref('')
const entityTypes = ref([])
const relationTypes = ref([])

/**
 * Объекты концов связи: в модель по-прежнему пишется числовой id (структура хранения не меняется),
 * пользователь выбирает объект по наименованию. Списки кэшируются на сессию формы.
 */
const fromOptions = ref([])
const toOptions = ref([])
const fromOptionsLoading = ref(false)
const toOptionsLoading = ref(false)
const fromOptionsError = ref('')
const toOptionsError = ref('')
const endOptionsCache = new Map()

function toIdOrNull(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** Подпись объекта для списка выбора: display_name (DISP_*) → name → short_name → full_name → code → #id. */
function optionLabel(row) {
  const candidates = [row.display_name, row.name, row.short_name, row.full_name, row.code, row.task_name]
  for (const v of candidates) {
    if (v != null && String(v).trim()) return String(v).trim()
  }
  return `#${row.id}`
}

function fetchEndOptions(entityType) {
  if (!endOptionsCache.has(entityType)) {
    endOptionsCache.set(
      entityType,
      loadEntityList(entityType)
        .then((rows) =>
          (rows || [])
            .map((row) => ({ id: toIdOrNull(row.id), label: optionLabel(row) }))
            .filter((opt) => opt.id != null)
        )
        .catch(() => [])
    )
  }
  return endOptionsCache.get(entityType)
}

/** Текущий id может отсутствовать в списке (нет прав/объект удалён) — добавляем синтетическую опцию. */
function ensureCurrentOption(side) {
  const id = toIdOrNull(form.value?.[`${side}_entity_id`])
  if (id == null) return
  const optionsRef = side === 'from' ? fromOptions : toOptions
  if (optionsRef.value.some((opt) => opt.id === id)) return
  const name = form.value?.[`${side}_entity_name`]
  optionsRef.value = [{ id, label: name || `#${id}` }, ...optionsRef.value]
}

/** После смены типа конца тип связи должен остаться допустимым для новой пары. */
function syncRelationTypeForPair() {
  if (!form.value) return
  const allowed = allowedRelationTypesForPair()
  if (!allowed.length) return
  if (allowed.some((rt) => rt.code === form.value.relation_type)) return
  form.value.relation_type = allowed[0].code
}

async function loadEndOptions(side) {
  const optionsRef = side === 'from' ? fromOptions : toOptions
  const loadingRef = side === 'from' ? fromOptionsLoading : toOptionsLoading
  const errorRef = side === 'from' ? fromOptionsError : toOptionsError
  const entityType = form.value?.[`${side}_entity_type`]
  optionsRef.value = []
  errorRef.value = ''
  if (!entityType) return
  loadingRef.value = true
  const options = await fetchEndOptions(entityType)
  if (form.value?.[`${side}_entity_type`] !== entityType) {
    loadingRef.value = false
    return
  }
  optionsRef.value = options
  loadingRef.value = false
  if (options.length === 0) {
    errorRef.value = 'Список объектов недоступен (нет прав на реестр или реестр пуст).'
  }
  ensureCurrentOption(side)
}

function onEndTypeChange(side) {
  if (!form.value) return
  form.value[`${side}_entity_id`] = null
  form.value[`${side}_entity_name`] = ''
  syncRelationTypeForPair()
  loadEndOptions(side)
}

function endLabel(side) {
  const name = form.value?.[`${side}_entity_name`]
  if (name) return name
  const id = toIdOrNull(form.value?.[`${side}_entity_id`])
  return id != null ? `#${id}` : '—'
}

/** Типы связей, допустимые для выбранной пары «От»/«К» и не управляемые автоматически. */
function allowedRelationTypesForPair() {
  const from = form.value?.from_entity_type
  const to = form.value?.to_entity_type
  return relationTypes.value.filter((rt) => {
    if (rt.managed) return false
    if (!from || !to) return true
    return rt.from_entity_type_code === from && rt.to_entity_type_code === to
  })
}

/**
 * Список для селекта «Тип связи»: допустимые для пары ручные типы + текущий (даже если он managed),
 * чтобы существующее ребро корректно отображалось в режиме правки.
 */
const relationTypesForSelect = computed(() => {
  const allowed = allowedRelationTypesForPair()
  const current = relationTypes.value.find(
    (rt) =>
      rt.code === form.value?.relation_type &&
      rt.from_entity_type_code === form.value?.from_entity_type &&
      rt.to_entity_type_code === form.value?.to_entity_type
  )
  return current && !allowed.includes(current) ? [current, ...allowed] : allowed
})

const isManagedIntegrationProjection = computed(
  () =>
    !!form.value &&
    form.value.relation_type === 'integration_flow' &&
    form.value.reference_to_baserow != null
)

/**
 * Связь создаётся и поддерживается автоматически: триггер-проекция или карточка-источник
 * (`managed` в справочнике типов связей). Форма в этом случае доступна только для чтения.
 */
const isManagedRelation = computed(() => {
  if (!form.value) return false
  if (form.value.relation_type_managed) return true
  const rt = relationTypes.value.find(
    (x) =>
      x.code === form.value.relation_type &&
      x.from_entity_type_code === form.value.from_entity_type &&
      x.to_entity_type_code === form.value.to_entity_type
  )
  return !!(rt && rt.managed)
})

async function loadRefs() {
  entityTypes.value = await togafApi.entityTypes()
  relationTypes.value = await togafApi.relationTypes()
}

async function load() {
  loading.value = true
  error.value = ''
  await loadRefs()
  if (isEdit.value) {
    try {
      const row = await togafApi.relation(id.value, { with_labels: '1' })
      form.value = {
        from_entity_type: row.from_entity_type,
        from_entity_id: toIdOrNull(row.from_entity_id),
        from_entity_name: row.from_entity_name || '',
        to_entity_type: row.to_entity_type,
        to_entity_id: toIdOrNull(row.to_entity_id),
        to_entity_name: row.to_entity_name || '',
        relation_type: row.relation_type,
        relation_type_managed: !!row.relation_type_managed,
        name: row.name || '',
        description: row.description || '',
        displayed_name: row.displayed_name || '',
        reference_to_baserow: row.reference_to_baserow ?? null,
      }
    } catch (e) {
      error.value = e.message
      form.value = null
    }
  } else {
    form.value = {
      from_entity_type: entityTypes.value[0]?.code || 'organization_unit',
      from_entity_id: null,
      from_entity_name: '',
      to_entity_type: entityTypes.value[0]?.code || 'organization_unit',
      to_entity_id: null,
      to_entity_name: '',
      relation_type: relationTypesForSelect.value[0]?.code || 'composed_of',
      name: '',
      description: '',
      displayed_name: '',
      reference_to_baserow: null,
    }
  }
  if (form.value) {
    await Promise.all([loadEndOptions('from'), loadEndOptions('to')])
    // Для новой связи тип по умолчанию выбираем уже с учётом выбранной пары типов концов.
    if (!isEdit.value) syncRelationTypeForPair()
  }
  loading.value = false
}

async function submit() {
  if (!canWrite.value) return
  if (isManagedRelation.value) return
  submitError.value = ''
  const fromId = toIdOrNull(form.value.from_entity_id)
  const toId = toIdOrNull(form.value.to_entity_id)
  if (fromId == null || toId == null) {
    submitError.value = 'Выберите объекты «От» и «К».'
    return
  }
  const payload = {
    from_entity_type: form.value.from_entity_type,
    from_entity_id: fromId,
    to_entity_type: form.value.to_entity_type,
    to_entity_id: toId,
    relation_type: form.value.relation_type,
    name: form.value.name || undefined,
    description: form.value.description || undefined,
  }
  try {
    if (isEdit.value) {
      await togafApi.updateRelation(id.value, payload)
    } else {
      await togafApi.createRelation(payload)
    }
    router.push(listRouteLocation.value)
  } catch (e) {
    error.value = e.message || 'Ошибка сохранения'
  }
}

onMounted(load)
watch(id, load)
</script>

<style scoped>
.form-fieldset {
  border: 0;
  margin: 0;
  padding: 0;
  min-width: 0;
}
.readonly-banner {
  margin: 0 0 1rem;
  padding: 0.65rem 0.85rem;
  background: var(--ar-accent-soft);
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  font-size: 0.9rem;
  color: var(--ar-muted);
}
.form {
  max-width: 500px;
  background: var(--ar-surface);
  padding: 1.25rem;
  border-radius: var(--ar-radius-lg);
  border: 1px solid var(--ar-border);
  box-shadow: var(--ar-shadow-card);
}
.form-row {
  margin-bottom: 1rem;
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
.form-row input,
.form-row select,
.form-row textarea {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  background: var(--ar-surface);
}
.form-actions {
  margin-top: 1.25rem;
  display: flex;
  gap: 0.75rem;
}
.msg {
  padding: 1rem;
}
.msg.error {
  color: var(--ar-danger);
}
.hint {
  margin: 0.35rem 0 0;
  font-size: 0.85rem;
  color: var(--ar-danger);
}
.banner {
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  background: var(--ar-accent-muted);
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  font-size: 0.9rem;
  color: var(--ar-text);
}
.banner a {
  color: var(--ar-link);
  font-weight: 600;
}
input.readonly,
textarea.readonly {
  background: var(--ar-table-head-bg);
  color: var(--ar-muted);
}
</style>

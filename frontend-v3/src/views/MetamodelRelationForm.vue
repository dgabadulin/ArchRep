<template>
  <div class="page">
    <div class="page-head">
      <h1>{{ isEdit ? 'Редактирование связи' : 'Новая связь метамодели' }}</h1>
      <router-link to="/metamodel-relations" class="btn">Назад</router-link>
    </div>
    <form v-if="form" class="form" @submit.prevent="submit">
      <p v-if="isManagedIntegrationProjection" class="banner">
        Проекция интеграционного потока (поток id {{ form.reference_to_baserow }}). Редактируйте запись в
        <router-link to="/integrations">реестре потоков</router-link>; пересборка проекций — в
        <router-link to="/settings/service-operations">Настройки → Сервисные операции</router-link>.
      </p>
      <div class="form-row">
        <label>Тип сущности «От» *</label>
        <select v-model="form.from_entity_type" required :disabled="isManagedIntegrationProjection">
          <option v-for="et in entityTypes" :key="et.code" :value="et.code">{{ et.display_name || (et.name + ' (' + et.code + ')') }}</option>
        </select>
      </div>
      <div class="form-row">
        <label>ID сущности «От» *</label>
        <input v-model.number="form.from_entity_id" type="number" required :disabled="isManagedIntegrationProjection" />
      </div>
      <div class="form-row">
        <label>Тип связи *</label>
        <select v-model="form.relation_type" required :disabled="isManagedIntegrationProjection">
          <option v-for="rt in relationTypesForSelect" :key="rt.code" :value="rt.code">{{ rt.display_name || (rt.name + ' (' + rt.code + ')') }}</option>
        </select>
      </div>
      <div class="form-row">
        <label>Тип сущности «К» *</label>
        <select v-model="form.to_entity_type" required :disabled="isManagedIntegrationProjection">
          <option v-for="et in entityTypes" :key="et.code" :value="et.code">{{ et.display_name || (et.name + ' (' + et.code + ')') }}</option>
        </select>
      </div>
      <div class="form-row">
        <label>ID сущности «К» *</label>
        <input v-model.number="form.to_entity_id" type="number" required :disabled="isManagedIntegrationProjection" />
      </div>
      <div v-if="isManagedIntegrationProjection" class="form-row">
        <label>Подпись (displayed_name)</label>
        <input :value="form.displayed_name || '—'" class="readonly" readonly />
      </div>
      <div class="form-row">
        <label>Название связи</label>
        <input v-model="form.name" :disabled="isManagedIntegrationProjection" />
      </div>
      <div class="form-row">
        <label>Описание</label>
        <textarea v-model="form.description" rows="2" :disabled="isManagedIntegrationProjection"></textarea>
      </div>
      <div class="form-actions">
        <button v-if="!isManagedIntegrationProjection" type="submit" class="btn btn-primary">Сохранить</button>
        <router-link to="/metamodel-relations" class="btn">Назад к списку</router-link>
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

const route = useRoute()
const router = useRouter()
const id = computed(() => route.params.id)
const isEdit = computed(() => !!id.value && id.value !== 'new')
const form = ref(null)
const loading = ref(true)
const error = ref('')
const entityTypes = ref([])
const relationTypes = ref([])

const relationTypesForSelect = computed(() => {
  if (isEdit.value) return relationTypes.value
  return relationTypes.value.filter((rt) => rt.code !== 'integration_flow')
})

const isManagedIntegrationProjection = computed(
  () =>
    !!form.value &&
    form.value.relation_type === 'integration_flow' &&
    form.value.reference_to_baserow != null
)

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
      const row = await togafApi.relation(id.value)
      form.value = {
        from_entity_type: row.from_entity_type,
        from_entity_id: row.from_entity_id,
        to_entity_type: row.to_entity_type,
        to_entity_id: row.to_entity_id,
        relation_type: row.relation_type,
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
      to_entity_type: entityTypes.value[0]?.code || 'organization_unit',
      to_entity_id: null,
      relation_type: relationTypes.value[0]?.code || 'composed_of',
      name: '',
      description: '',
      displayed_name: '',
      reference_to_baserow: null,
    }
  }
  loading.value = false
}

async function submit() {
  if (isManagedIntegrationProjection.value) return
  const payload = {
    from_entity_type: form.value.from_entity_type,
    from_entity_id: Number(form.value.from_entity_id),
    to_entity_type: form.value.to_entity_type,
    to_entity_id: Number(form.value.to_entity_id),
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
    router.push('/metamodel-relations')
  } catch (e) {
    error.value = e.message || 'Ошибка сохранения'
  }
}

onMounted(load)
watch(id, load)
</script>

<style scoped>
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

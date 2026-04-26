<template>
  <div class="page">
    <div class="page-head">
      <h1>{{ isEdit ? 'Редактирование бизнес-сервиса' : 'Новый бизнес-сервис' }}</h1>
      <router-link to="/business-services" class="btn">Назад</router-link>
    </div>
    <form v-if="form" class="form" @submit.prevent="submit">
      <div class="form-row">
        <label>Код *</label>
        <input v-model="form.code" required />
      </div>
      <div class="form-row">
        <label>Наименование *</label>
        <input v-model="form.name" required />
      </div>
      <div class="form-row">
        <label>Полное наименование</label>
        <input v-model="form.fullname" />
      </div>
      <div class="form-row">
        <label>Владелец (орг. единица)</label>
        <select v-model="form.ar_organization_units_id">
          <option :value="null">—</option>
          <option v-for="ou in organizationUnits" :key="ou.id" :value="ou.id">{{ ou.display_name || ou.name }}</option>
        </select>
      </div>
      <div class="form-row">
        <label>Статус</label>
        <select v-model="form.ar_business_service_statuses_id">
          <option :value="null">—</option>
          <option v-for="s in statuses" :key="s.id" :value="s.id">{{ s.display_name || s.name }}</option>
        </select>
      </div>
      <div class="form-row">
        <label>Источник / Категория</label>
        <input v-model="form.source" placeholder="Источник" />
        <input v-model="form.category" placeholder="Категория" class="mt-1" />
      </div>
      <div class="form-row">
        <label>Описание</label>
        <textarea v-model="form.description" rows="3"></textarea>
      </div>
      <div class="form-actions">
        <button type="submit" class="btn btn-primary">Сохранить</button>
        <router-link to="/business-services" class="btn">Отмена</router-link>
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
const organizationUnits = ref([])
const statuses = ref([])

async function loadRefs() {
  organizationUnits.value = await togafApi.organizationUnits()
  statuses.value = await togafApi.refs.businessServiceStatuses()
}

async function load() {
  loading.value = true
  error.value = ''
  await loadRefs()
  if (isEdit.value) {
    try {
      const row = await togafApi.businessService(id.value)
      form.value = {
        code: row.code,
        name: row.name,
        fullname: row.fullname || '',
        ar_organization_units_id: row.ar_organization_units_id,
        ar_business_service_statuses_id: row.ar_business_service_statuses_id,
        source: row.source || '',
        category: row.category || '',
        description: row.description || '',
      }
    } catch (e) {
      error.value = e.message
      form.value = null
    }
  } else {
    form.value = { code: '', name: '', fullname: '', ar_organization_units_id: null, ar_business_service_statuses_id: null, source: '', category: '', description: '' }
  }
  loading.value = false
}

async function submit() {
  const payload = {
    code: form.value.code,
    name: form.value.name,
    fullname: form.value.fullname || undefined,
    ar_organization_units_id: form.value.ar_organization_units_id || undefined,
    ar_business_service_statuses_id: form.value.ar_business_service_statuses_id || undefined,
    source: form.value.source || undefined,
    category: form.value.category || undefined,
    description: form.value.description || undefined,
  }
  try {
    if (isEdit.value) {
      await togafApi.updateBusinessService(id.value, payload)
    } else {
      await togafApi.createBusinessService(payload)
    }
    router.push('/business-services')
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
.mt-1 {
  margin-top: 0.35rem;
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
</style>

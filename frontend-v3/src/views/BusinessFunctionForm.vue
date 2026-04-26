<template>
  <div class="page">
    <div class="page-head">
      <h1>{{ isEdit ? 'Редактирование бизнес-функции' : 'Новая бизнес-функция' }}</h1>
      <router-link to="/business-functions" class="btn">Назад</router-link>
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
        <label>Родитель</label>
        <select v-model="form.parent_id">
          <option :value="null">—</option>
          <option v-for="f in businessFunctions" :key="f.id" :value="f.id" :disabled="isEdit && f.id === parseInt(id)">{{ f.display_name || f.name }}</option>
        </select>
      </div>
      <div class="form-row">
        <label>Владелец (орг. единица)</label>
        <select v-model="form.ar_organization_units_id">
          <option :value="null">—</option>
          <option v-for="ou in organizationUnits" :key="ou.id" :value="ou.id">{{ ou.display_name || ou.name }}</option>
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
        <router-link to="/business-functions" class="btn">Отмена</router-link>
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
const businessFunctions = ref([])

async function loadRefs() {
  organizationUnits.value = await togafApi.organizationUnits()
  businessFunctions.value = await togafApi.businessFunctions()
}

async function load() {
  loading.value = true
  error.value = ''
  await loadRefs()
  if (isEdit.value) {
    try {
      const row = await togafApi.businessFunction(id.value)
      form.value = {
        code: row.code,
        name: row.name,
        description: row.description || '',
        parent_id: row.parent_id,
        ar_organization_units_id: row.ar_organization_units_id,
        source: row.source || '',
        category: row.category || '',
      }
    } catch (e) {
      error.value = e.message
      form.value = null
    }
  } else {
    form.value = { code: '', name: '', description: '', parent_id: null, ar_organization_units_id: null, source: '', category: '' }
  }
  loading.value = false
}

async function submit() {
  const payload = {
    code: form.value.code,
    name: form.value.name,
    description: form.value.description || undefined,
    parent_id: form.value.parent_id || undefined,
    ar_organization_units_id: form.value.ar_organization_units_id || undefined,
    source: form.value.source || undefined,
    category: form.value.category || undefined,
  }
  try {
    if (isEdit.value) {
      await togafApi.updateBusinessFunction(id.value, payload)
    } else {
      await togafApi.createBusinessFunction(payload)
    }
    router.push('/business-functions')
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

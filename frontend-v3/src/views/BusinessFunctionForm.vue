<template>
  <div class="page">
    <div class="page-head">
      <h1>{{ formTitle }}</h1>
      <router-link :to="listRouteLocation" class="btn">Назад</router-link>
    </div>
    <form v-if="form" class="form" @submit.prevent="submit">
      <p v-if="isEdit && !canWrite" class="readonly-banner">Режим просмотра: нет права <code>business_function:write</code>.</p>
      <fieldset class="form-fieldset" :disabled="!canWrite">
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
        <label>Описание</label>
        <textarea v-model="form.description" rows="3"></textarea>
      </div>
      </fieldset>
      <div class="form-actions">
        <button v-if="canWrite" type="submit" class="btn btn-primary">Сохранить</button>
        <router-link :to="listRouteLocation" class="btn">{{ canWrite ? 'Отмена' : 'К списку' }}</router-link>
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
import { useFormListReturn } from '../composables/useFormListReturn'
import { usePermissions } from '../composables/usePermissions'

const route = useRoute()
const router = useRouter()
const { listRouteLocation } = useFormListReturn('/business-functions')
const { canWrite } = usePermissions('business_function')
const id = computed(() => route.params.id)
const isEdit = computed(() => !!id.value && id.value !== 'new')
const formTitle = computed(() => {
  if (!isEdit.value) return 'Новая бизнес-функция'
  return canWrite.value ? 'Редактирование бизнес-функции' : 'Просмотр бизнес-функции'
})
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
        name: row.name,
        description: row.description || '',
        parent_id: row.parent_id,
        ar_organization_units_id: row.ar_organization_units_id,
      }
    } catch (e) {
      error.value = e.message
      form.value = null
    }
  } else {
    form.value = { name: '', description: '', parent_id: null, ar_organization_units_id: null }
  }
  loading.value = false
}

async function submit() {
  if (!canWrite.value) return
  const payload = {
    name: form.value.name,
    description: form.value.description || undefined,
    parent_id: form.value.parent_id || undefined,
    ar_organization_units_id: form.value.ar_organization_units_id || undefined,
  }
  try {
    if (isEdit.value) {
      await togafApi.updateBusinessFunction(id.value, payload)
    } else {
      await togafApi.createBusinessFunction(payload)
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
</style>

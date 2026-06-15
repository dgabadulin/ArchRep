<template>
  <div class="page">
    <div class="page-head">
      <h1>{{ isEdit ? 'Редактирование веб-ресурса' : 'Новый веб-ресурс' }}</h1>
      <router-link :to="listRouteLocation" class="btn btn-secondary">← К реестру</router-link>
    </div>

    <div v-if="loading" class="loading">Загрузка...</div>
    <form v-else-if="form" class="card form" @submit.prevent="submit">
      <div class="form-grid">
        <div class="field field-code" v-if="isEdit">
          <label>Код</label>
          <input v-model="form.code" readonly class="readonly" type="text" />
        </div>
        <div class="field">
          <label>Краткое наименование <span class="req">*</span></label>
          <input v-model="form.short_name" required maxlength="500" />
        </div>
        <div class="field field-wide">
          <label>Назначение</label>
          <textarea v-model="form.purpose" rows="3" />
        </div>
        <div class="field field-wide">
          <label>Адрес публикации (URL)</label>
          <input v-model="form.publication_url" type="url" placeholder="https://..." />
        </div>
        <div class="field field-wide">
          <label>Ссылки на приложения в магазинах</label>
          <textarea v-model="form.app_store_links" rows="2" placeholder="Одно или несколько URL в произвольном виде" />
        </div>
        <div class="field">
          <label>Информационная система <span class="req">*</span></label>
          <select v-model="form.ar_systems_id" required>
            <option :value="null" disabled>— выберите ИС —</option>
            <option v-for="s in systems" :key="s.id" :value="s.id">{{ s.display_name || s.name || s.code }}</option>
          </select>
        </div>
        <div class="field">
          <label>Статус <span class="req">*</span></label>
          <select v-model="form.ar_web_resource_statuses_id" required>
            <option :value="null" disabled>—</option>
            <option v-for="st in statuses" :key="st.id" :value="st.id">{{ st.display_name || st.name }}</option>
          </select>
        </div>
        <div class="field">
          <label>Номер заявки на публикацию</label>
          <input v-model="form.publication_request_number" maxlength="200" />
        </div>
        <div class="field">
          <label>Дата публикации</label>
          <input v-model="form.publication_date" type="date" />
        </div>
      </div>
      <div v-if="submitError" class="error">{{ submitError }}</div>
      <div class="actions actions-bottom">
        <button type="submit" class="btn btn-primary" :disabled="saving">{{ saving ? 'Сохранение...' : 'Сохранить' }}</button>
        <router-link :to="listRouteLocation" class="btn btn-secondary">Отмена</router-link>
      </div>
    </form>
    <div v-else class="error">{{ error || 'Не найдено' }}</div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api/client'
import { useFormListReturn } from '../composables/useFormListReturn'

const route = useRoute()
const router = useRouter()
const { listRouteLocation, routeWithListSearch } = useFormListReturn('/web-resources')
const id = computed(() => route.params.id)
const isEdit = computed(() => !!id.value && id.value !== 'new')

const form = ref(null)
const loading = ref(true)
const error = ref('')
const submitError = ref('')
const saving = ref(false)
const systems = ref([])
const statuses = ref([])

function formatDateForInput(value) {
  if (!value) return ''
  const d = new Date(value)
  if (isNaN(d.getTime())) return String(value).slice(0, 10)
  return d.toISOString().slice(0, 10)
}

async function loadRefs() {
  const [sys, sts] = await Promise.all([
    api.getSystems({ exclude_modules: true }),
    api.getWebResourceStatuses(),
  ])
  systems.value = sys || []
  statuses.value = sts || []
}

async function load() {
  loading.value = true
  error.value = ''
  submitError.value = ''
  await loadRefs()
  if (isEdit.value) {
    try {
      const row = await api.getWebResource(id.value)
      form.value = {
        code: row.code,
        short_name: row.short_name || '',
        purpose: row.purpose || '',
        publication_url: row.publication_url || '',
        app_store_links: row.app_store_links || '',
        ar_systems_id: row.ar_systems_id,
        publication_request_number: row.publication_request_number || '',
        publication_date: formatDateForInput(row.publication_date),
        ar_web_resource_statuses_id: row.ar_web_resource_statuses_id,
      }
    } catch (e) {
      error.value = e.message
      form.value = null
    }
  } else {
    const draft = statuses.value.find((s) => s.code === 'draft')
    form.value = {
      short_name: '',
      purpose: '',
      publication_url: '',
      app_store_links: '',
      ar_systems_id: null,
      publication_request_number: '',
      publication_date: '',
      ar_web_resource_statuses_id: draft?.id ?? statuses.value[0]?.id ?? null,
    }
  }
  loading.value = false
}

async function submit() {
  submitError.value = ''
  saving.value = true
  const payload = {
    short_name: form.value.short_name.trim(),
    purpose: form.value.purpose || undefined,
    publication_url: form.value.publication_url || undefined,
    app_store_links: form.value.app_store_links || undefined,
    ar_systems_id: form.value.ar_systems_id,
    publication_request_number: form.value.publication_request_number || undefined,
    publication_date: form.value.publication_date || undefined,
    ar_web_resource_statuses_id: form.value.ar_web_resource_statuses_id,
  }
  try {
    if (isEdit.value) {
      await api.updateWebResource(id.value, payload)
      router.push(listRouteLocation.value)
    } else {
      const res = await api.createWebResource(payload)
      router.push(routeWithListSearch(`/web-resources/${res.id}/edit`))
    }
  } catch (e) {
    submitError.value = e.message || 'Ошибка сохранения'
  } finally {
    saving.value = false
  }
}

watch(() => route.params.id, load)
onMounted(load)
</script>

<style scoped>
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem 1.25rem;
}
.field-wide { grid-column: 1 / -1; }
.field-code { max-width: 12rem; }
.req { color: #c0392b; }
.readonly { background: #f4f4f4; }
.actions-bottom { margin-top: 1.25rem; display: flex; gap: 0.75rem; }
</style>

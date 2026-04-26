<template>
  <div class="page">
    <div class="page-head">
      <h1>{{ isEdit ? 'Редактирование технологии' : 'Новая технология' }}</h1>
      <router-link to="/technologies" class="btn btn-secondary">← К списку</router-link>
    </div>

    <div v-if="loading && isEdit" class="loading">Загрузка...</div>
    <form v-else class="card form" @submit.prevent="submit">
      <div class="form-grid">
        <div class="field field-wide">
          <label>Название <span class="req">*</span></label>
          <input v-model="form.name" required />
        </div>
        <div class="field">
          <label>Вендор</label>
          <select v-model="form.vendor_ar_partners_id">
            <option :value="null">—</option>
            <option v-for="v in vendors" :key="v.id" :value="v.id">{{ v.display_name || v.name }}</option>
          </select>
        </div>
        <div class="field">
          <label>Класс технологии</label>
          <select v-model="form.technology_classes_id">
            <option :value="null">—</option>
            <option v-for="c in technologyClasses" :key="c.id" :value="c.id">{{ c.display_name || c.name }}</option>
          </select>
        </div>
        <div class="field">
          <label>Тип технологии</label>
          <select v-model="form.technology_types_id">
            <option :value="null">—</option>
            <option v-for="t in technologyTypes" :key="t.id" :value="t.id">{{ t.display_name || t.name }}</option>
          </select>
        </div>
        <div class="field">
          <label>Статус (техрадар)</label>
          <select v-model="form.technology_statuses_id">
            <option :value="null">—</option>
            <option v-for="s in technologyStatuses" :key="s.id" :value="s.id">{{ s.display_name || s.name }}</option>
          </select>
        </div>
        <div class="field">
          <label>В техрадаре</label>
          <input v-model="form.radar_include_flag" type="checkbox" />
        </div>
        <div class="field">
          <label>Отечественное ПО</label>
          <input v-model="form.domestic_flag" type="checkbox" />
        </div>
        <div class="field field-wide">
          <label>Описание</label>
          <textarea v-model="form.description" rows="2"></textarea>
        </div>
        <div class="field field-wide">
          <label>Основание для включения в каталог</label>
          <input v-model="form.approve_document" />
        </div>
      </div>
      <div v-if="submitError" class="error">{{ submitError }}</div>
      <div class="actions">
        <button type="submit" class="btn btn-primary" :disabled="saving">{{ saving ? 'Сохранение...' : 'Сохранить' }}</button>
        <router-link to="/technologies" class="btn btn-secondary">Отмена</router-link>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUnsavedGuard } from '../composables/useUnsavedGuard'
import { api } from '../api/client'

const route = useRoute()
const router = useRouter()
const id = computed(() => route.params.id)
const isEdit = computed(() => !!id.value && id.value !== 'new')

const loading = ref(false)
const saving = ref(false)
const submitError = ref('')
const isDirty = ref(false)
const initialLoadDone = ref(false)
const vendors = ref([])
const technologyClasses = ref([])
const technologyTypes = ref([])
const technologyStatuses = ref([])

const form = reactive({
  name: '',
  vendor_ar_partners_id: null,
  technology_classes_id: null,
  technology_types_id: null,
  technology_statuses_id: null,
  radar_include_flag: false,
  domestic_flag: false,
  description: '',
  approve_document: '',
})

function formSnapshot() {
  return {
    name: form.name,
    vendor_ar_partners_id: form.vendor_ar_partners_id,
    technology_classes_id: form.technology_classes_id,
    technology_types_id: form.technology_types_id,
    technology_statuses_id: form.technology_statuses_id,
    radar_include_flag: form.radar_include_flag,
    domestic_flag: form.domestic_flag,
    description: form.description,
    approve_document: form.approve_document,
  }
}

const lastLoadedSnapshot = ref(null)

onMounted(async () => {
  const [v, c, t, s] = await Promise.all([
    api.getVendors(),
    api.getTechnologyClasses(),
    api.getTechnologyTypes(),
    api.getTechnologyStatuses(),
  ])
  vendors.value = v
  technologyClasses.value = c
  technologyTypes.value = t
  technologyStatuses.value = s
  if (isEdit.value) {
    loading.value = true
    try {
      const row = await api.getTechnology(id.value)
      form.name = row.name ?? ''
      form.vendor_ar_partners_id = row.vendor_ar_partners_id ?? null
      form.technology_classes_id = row.technology_classes_id ?? null
      form.technology_types_id = row.technology_types_id ?? null
      form.technology_statuses_id = row.technology_statuses_id ?? null
      form.radar_include_flag = !!row.radar_include_flag
      form.domestic_flag = !!row.domestic_flag
      form.description = row.description ?? ''
      form.approve_document = row.approve_document ?? ''
    } catch (e) {
      submitError.value = e.message || 'Ошибка загрузки'
    } finally {
      loading.value = false
    }
  }
  lastLoadedSnapshot.value = formSnapshot()
  initialLoadDone.value = true
})

function isFormChanged() {
  const cur = formSnapshot()
  const prev = lastLoadedSnapshot.value
  if (!prev) return false
  return Object.keys(cur).some(k => String(cur[k] ?? '') !== String(prev[k] ?? ''))
}

watch(() => ({ ...form }), () => {
  if (!initialLoadDone.value) return
  isDirty.value = isFormChanged()
}, { deep: true })

async function submit(opts = {}) {
  submitError.value = ''
  saving.value = true
  try {
    const body = {
      name: form.name.trim(),
      vendor_ar_partners_id: form.vendor_ar_partners_id || undefined,
      technology_classes_id: form.technology_classes_id || undefined,
      technology_types_id: form.technology_types_id || undefined,
      technology_statuses_id: form.technology_statuses_id || undefined,
      radar_include_flag: form.radar_include_flag,
      domestic_flag: form.domestic_flag,
      description: form.description || undefined,
      approve_document: form.approve_document || undefined,
    }
    if (isEdit.value) {
      await api.updateTechnology(id.value, body)
      lastLoadedSnapshot.value = formSnapshot()
      isDirty.value = false
      if (!opts.skipNavigate) router.push('/technologies')
    } else {
      const res = await api.createTechnology(body)
      lastLoadedSnapshot.value = formSnapshot()
      isDirty.value = false
      if (!opts.skipNavigate) router.push(`/technologies/${res.id}/edit`)
    }
  } catch (e) {
    submitError.value = e.body?.error || e.message || 'Ошибка сохранения'
    throw e
  } finally {
    saving.value = false
  }
}

useUnsavedGuard(isDirty, () => submit({ skipNavigate: true }))
</script>

<style scoped>
.error {
  margin-top: 0.5rem;
}
.actions {
  margin-top: 1rem;
}
</style>

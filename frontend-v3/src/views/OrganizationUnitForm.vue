<template>
  <div class="page">
    <div class="page-head">
      <h1>{{ isEdit ? 'Редактирование орг. единицы' : 'Новая орг. единица' }}</h1>
      <router-link to="/organization-units" class="btn">Назад</router-link>
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
        <label>Родитель</label>
        <select v-model="form.parent_id">
          <option :value="null">—</option>
          <option v-for="ou in organizationUnits" :key="ou.id" :value="ou.id">{{ ou.display_name || ou.name }}</option>
        </select>
      </div>
      <div class="form-row">
        <label>Категория</label>
        <select v-model="form.organization_unit_categories_id">
          <option :value="null">—</option>
          <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.display_name || c.name }}</option>
        </select>
      </div>
      <div class="form-row">
        <label>Руководитель</label>
        <input v-model="form.leader" />
      </div>
      <div class="form-row">
        <label>Описание</label>
        <textarea v-model="form.description" rows="3"></textarea>
      </div>
      <div class="form-actions">
        <button type="submit" class="btn btn-primary">Сохранить</button>
        <router-link to="/organization-units" class="btn">Отмена</router-link>
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
const categories = ref([])

async function loadRefs() {
  organizationUnits.value = await togafApi.organizationUnits()
  categories.value = await togafApi.refs.organizationUnitCategories()
}

async function load() {
  loading.value = true
  error.value = ''
  await loadRefs()
  if (isEdit.value) {
    try {
      const row = await togafApi.organizationUnit(id.value)
      form.value = {
        code: row.code,
        name: row.name,
        fullname: row.fullname || '',
        parent_id: row.parent_id,
        organization_unit_categories_id: row.organization_unit_categories_id,
        leader: row.leader || '',
        description: row.description || '',
      }
    } catch (e) {
      error.value = e.message
      form.value = null
    }
  } else {
    form.value = { code: '', name: '', fullname: '', parent_id: null, organization_unit_categories_id: null, leader: '', description: '' }
  }
  loading.value = false
}

async function submit() {
  const payload = {
    code: form.value.code,
    name: form.value.name,
    fullname: form.value.fullname || undefined,
    parent_id: form.value.parent_id || undefined,
    organization_unit_categories_id: form.value.organization_unit_categories_id || undefined,
    leader: form.value.leader || undefined,
    description: form.value.description || undefined,
  }
  try {
    if (isEdit.value) {
      await togafApi.updateOrganizationUnit(id.value, payload)
    } else {
      await togafApi.createOrganizationUnit(payload)
    }
    router.push('/organization-units')
  } catch (e) {
    error.value = e.message || 'Ошибка сохранения'
  }
}

onMounted(load)
watch(id, load)
</script>

<style scoped>
.page-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
.page-head h1 { margin: 0; font-size: 1.25rem; }
.form { max-width: 500px; background: #fff; padding: 1.25rem; border-radius: 8px; border: 1px solid #e5dccf; }
.form-row { margin-bottom: 1rem; }
.form-row label { display: block; margin-bottom: 0.35rem; font-weight: 500; font-size: 0.9rem; }
.form-row input, .form-row select, .form-row textarea { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #e5dccf; border-radius: 6px; }
.form-actions { margin-top: 1.25rem; display: flex; gap: 0.75rem; }
.btn { display: inline-block; padding: 0.5rem 1rem; border-radius: 6px; font-size: 0.9rem; text-decoration: none; border: 1px solid #cb997e; color: #8b5a2b; background: #fff; cursor: pointer; }
.btn-primary { background: #cb997e; color: #fff; border-color: #cb997e; }
.msg { padding: 1rem; }
.msg.error { color: #c44; }
</style>

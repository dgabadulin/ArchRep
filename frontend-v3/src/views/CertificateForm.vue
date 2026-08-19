<template>
  <div class="page">
    <div class="page-head">
      <h1>{{ formTitle }}</h1>
      <router-link :to="listRouteLocation" class="btn btn-secondary">← К реестру</router-link>
    </div>

    <div v-if="loading" class="loading">Загрузка...</div>
    <form v-else-if="form" class="card form" @submit.prevent="submit">
      <p v-if="isEdit && !canWrite" class="readonly-banner">Режим просмотра: нет права <code>certificate:write</code>.</p>
      <fieldset class="form-fieldset" :disabled="!canWrite">
        <div class="form-grid">
          <div class="field">
            <label>Код</label>
            <input :value="form.code || 'Будет присвоен автоматически'" readonly />
          </div>
          <div class="field">
            <label>Домен <span class="req">*</span></label>
            <select v-model="form.ar_domains_id" required>
              <option :value="null" disabled>—</option>
              <option v-for="d in domains" :key="d.id" :value="d.id">{{ d.display_name || d.name }}</option>
            </select>
          </div>
          <div class="field">
            <label>Сертификационный центр</label>
            <select v-model="form.ca_ar_partners_id">
              <option :value="null">—</option>
              <option v-for="p in partners" :key="p.id" :value="p.id">{{ p.display_name || p.name }}</option>
            </select>
          </div>
          <div class="field">
            <label>Ответственный</label>
            <select v-model="form.responsible_ar_employees_id">
              <option :value="null">—</option>
              <option v-for="e in employees" :key="e.id" :value="e.id">{{ e.display_name || e.full_name }}</option>
            </select>
          </div>
          <div class="field">
            <label>Дата выпуска <span class="req">*</span></label>
            <input v-model="form.issued_at" type="date" required />
          </div>
          <div class="field">
            <label>Дата окончания <span class="req">*</span></label>
            <input v-model="form.expires_at" type="date" required />
          </div>
          <div class="field field-checkbox">
            <label>
              <input v-model="form.wildcard_flag" type="checkbox" />
              Wildcard
            </label>
          </div>
          <div class="field field-wide">
            <label>Ссылка на размещение</label>
            <input v-model="form.placement_url" type="text" maxlength="2000" />
          </div>
        </div>
      </fieldset>
      <div v-if="submitError" class="error">{{ submitError }}</div>
      <div class="actions actions-bottom">
        <button v-if="canWrite" type="submit" class="btn btn-primary" :disabled="saving">{{ saving ? 'Сохранение...' : 'Сохранить' }}</button>
        <router-link :to="listRouteLocation" class="btn btn-secondary">{{ canWrite ? 'Отмена' : 'К реестру' }}</router-link>
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
import { usePermissions } from '../composables/usePermissions'

const route = useRoute()
const router = useRouter()
const { listRouteLocation, routeWithListSearch } = useFormListReturn('/certificates')
const { canWrite } = usePermissions('certificate')
const id = computed(() => route.params.id)
const isEdit = computed(() => !!id.value && id.value !== 'new')
const formTitle = computed(() => {
  if (!isEdit.value) return 'Новый сертификат'
  return canWrite.value ? 'Редактирование сертификата' : 'Просмотр сертификата'
})

const form = ref(null)
const loading = ref(true)
const error = ref('')
const submitError = ref('')
const saving = ref(false)
const domains = ref([])
const partners = ref([])
const employees = ref([])

function formatDateForInput(value) {
  if (!value) return ''
  const d = new Date(value)
  if (isNaN(d.getTime())) return String(value).slice(0, 10)
  return d.toISOString().slice(0, 10)
}

async function loadRefs() {
  const [doms, pts, emps] = await Promise.all([
    api.getDomains(),
    api.getPartners(),
    api.getEmployees(),
  ])
  domains.value = doms || []
  partners.value = pts || []
  employees.value = emps || []
}

async function load() {
  loading.value = true
  error.value = ''
  submitError.value = ''
  try {
    await loadRefs()
    if (isEdit.value) {
      const row = await api.getCertificate(id.value)
      form.value = {
        code: row.code || '',
        ar_domains_id: row.ar_domains_id,
        ca_ar_partners_id: row.ca_ar_partners_id ?? null,
        issued_at: formatDateForInput(row.issued_at),
        expires_at: formatDateForInput(row.expires_at),
        wildcard_flag: !!row.wildcard_flag,
        placement_url: row.placement_url || '',
        responsible_ar_employees_id: row.responsible_ar_employees_id ?? null,
      }
    } else {
      form.value = {
        code: '',
        ar_domains_id: domains.value[0]?.id ?? null,
        ca_ar_partners_id: null,
        issued_at: '',
        expires_at: '',
        wildcard_flag: false,
        placement_url: '',
        responsible_ar_employees_id: null,
      }
    }
  } catch (e) {
    error.value = e.message || 'Ошибка загрузки'
    form.value = null
  } finally {
    loading.value = false
  }
}

async function submit() {
  if (!canWrite.value) return
  submitError.value = ''
  saving.value = true
  const payload = {
    ar_domains_id: form.value.ar_domains_id,
    ca_ar_partners_id: form.value.ca_ar_partners_id || undefined,
    issued_at: form.value.issued_at || undefined,
    expires_at: form.value.expires_at || undefined,
    wildcard_flag: !!form.value.wildcard_flag,
    placement_url: form.value.placement_url || undefined,
    responsible_ar_employees_id: form.value.responsible_ar_employees_id || undefined,
  }
  try {
    if (isEdit.value) {
      await api.updateCertificate(id.value, payload)
      router.push(listRouteLocation.value)
    } else {
      const res = await api.createCertificate(payload)
      router.push(routeWithListSearch(`/certificates/${res.id}/edit`))
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
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem 1.25rem;
}
.field-wide { grid-column: 1 / -1; }
.field-checkbox {
  display: flex;
  align-items: end;
}
.field-checkbox label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.req { color: #c0392b; }
.actions-bottom { margin-top: 1.25rem; display: flex; gap: 0.75rem; }
</style>

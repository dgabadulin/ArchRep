<template>
  <div class="page">
    <div class="page-head">
      <h1>{{ formTitle }}</h1>
      <router-link :to="listRouteLocation" class="btn btn-secondary">← К реестру</router-link>
    </div>

    <div v-if="loading" class="loading">Загрузка...</div>
    <form v-else-if="form" class="card form" @submit.prevent="submit">
      <p v-if="isEdit && !canWrite" class="readonly-banner">Режим просмотра: нет права <code>domain:write</code>.</p>
      <fieldset class="form-fieldset" :disabled="!canWrite">
      <div class="form-grid">
        <div class="field">
          <label>Домен <span class="req">*</span></label>
          <input v-model="form.name" required maxlength="500" placeholder="example.ru" />
        </div>
        <div class="field">
          <label>Статус <span class="req">*</span></label>
          <select v-model="form.ar_domain_statuses_id" required>
            <option :value="null" disabled>—</option>
            <option v-for="st in statuses" :key="st.id" :value="st.id">{{ st.display_name || st.name }}</option>
          </select>
        </div>
        <div class="field">
          <label>Регистратор</label>
          <select v-model="form.registrar_ar_partners_id">
            <option :value="null">—</option>
            <option v-for="p in partners" :key="p.id" :value="p.id">{{ p.display_name || p.name }}</option>
          </select>
        </div>
        <div class="field">
          <label>Компания</label>
          <select v-model="form.company_ar_organization_units_id">
            <option :value="null">—</option>
            <option v-for="o in companies" :key="o.id" :value="o.id">{{ o.display_name || o.name }}</option>
          </select>
        </div>
        <div class="field">
          <label>Дата регистрации</label>
          <input v-model="form.registered_at" type="date" />
        </div>
        <div class="field">
          <label>Дата окончания</label>
          <input v-model="form.expires_at" type="date" />
        </div>
        <div class="field">
          <label>Владелец от бизнеса</label>
          <select v-model="form.business_owner_ar_employees_id">
            <option :value="null">—</option>
            <option v-for="e in employees" :key="e.id" :value="e.id">{{ e.display_name || e.full_name }}</option>
          </select>
        </div>
        <div class="field field-wide">
          <label>Назначение</label>
          <textarea v-model="form.purpose" rows="3" />
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
import { togafApi } from '../api'
import { useFormListReturn } from '../composables/useFormListReturn'
import { usePermissions } from '../composables/usePermissions'

const route = useRoute()
const router = useRouter()
const { listRouteLocation, routeWithListSearch } = useFormListReturn('/domains')
const { canWrite } = usePermissions('domain')
const id = computed(() => route.params.id)
const isEdit = computed(() => !!id.value && id.value !== 'new')
const formTitle = computed(() => {
  if (!isEdit.value) return 'Новый домен'
  return canWrite.value ? 'Редактирование домена' : 'Просмотр домена'
})

const form = ref(null)
const loading = ref(true)
const error = ref('')
const submitError = ref('')
const saving = ref(false)
const statuses = ref([])
const partners = ref([])
const companies = ref([])
const employees = ref([])

function formatDateForInput(value) {
  if (!value) return ''
  const d = new Date(value)
  if (isNaN(d.getTime())) return String(value).slice(0, 10)
  return d.toISOString().slice(0, 10)
}

async function loadRefs() {
  const [sts, pts, ous, emps] = await Promise.all([
    api.getDomainStatuses(),
    api.getPartners(),
    togafApi.organizationUnits({ category: 'org' }),
    api.getEmployees(),
  ])
  statuses.value = sts || []
  partners.value = pts || []
  companies.value = ous || []
  employees.value = emps || []
}

async function load() {
  loading.value = true
  error.value = ''
  submitError.value = ''
  try {
    await loadRefs()
    if (isEdit.value) {
      const row = await api.getDomain(id.value)
      form.value = {
        name: row.name || '',
        ar_domain_statuses_id: row.ar_domain_statuses_id,
        registrar_ar_partners_id: row.registrar_ar_partners_id ?? null,
        registered_at: formatDateForInput(row.registered_at),
        expires_at: formatDateForInput(row.expires_at),
        purpose: row.purpose || '',
        company_ar_organization_units_id: row.company_ar_organization_units_id ?? null,
        business_owner_ar_employees_id: row.business_owner_ar_employees_id ?? null,
      }
    } else {
      const delegated = statuses.value.find((s) => s.code === 'delegated')
      form.value = {
        name: '',
        ar_domain_statuses_id: delegated?.id ?? statuses.value[0]?.id ?? null,
        registrar_ar_partners_id: null,
        registered_at: '',
        expires_at: '',
        purpose: '',
        company_ar_organization_units_id: null,
        business_owner_ar_employees_id: null,
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
    name: form.value.name.trim(),
    ar_domain_statuses_id: form.value.ar_domain_statuses_id,
    registrar_ar_partners_id: form.value.registrar_ar_partners_id || undefined,
    registered_at: form.value.registered_at || undefined,
    expires_at: form.value.expires_at || undefined,
    purpose: form.value.purpose || undefined,
    company_ar_organization_units_id: form.value.company_ar_organization_units_id || undefined,
    business_owner_ar_employees_id: form.value.business_owner_ar_employees_id || undefined,
  }
  try {
    if (isEdit.value) {
      await api.updateDomain(id.value, payload)
      router.push(listRouteLocation.value)
    } else {
      const res = await api.createDomain(payload)
      router.push(routeWithListSearch(`/domains/${res.id}/edit`))
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
.req { color: #c0392b; }
.actions-bottom { margin-top: 1.25rem; display: flex; gap: 0.75rem; }
</style>

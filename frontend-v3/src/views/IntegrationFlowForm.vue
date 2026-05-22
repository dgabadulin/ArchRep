<template>
  <div class="page">
    <div class="page-head">
      <h1>{{ isEdit ? 'Редактирование интеграционного потока' : 'Новый интеграционный поток' }}</h1>
      <router-link :to="listRouteLocation" class="btn btn-secondary">← К списку</router-link>
    </div>

    <div v-if="loading && isEdit" class="loading">Загрузка...</div>
    <form v-else class="card form" @submit.prevent="submit">
      <div class="form-grid">
        <div class="field">
          <label>Система источник <span class="req">*</span></label>
          <select v-model="form.source_ar_systems_id" required>
            <option :value="null">—</option>
            <option v-for="s in systems" :key="s.id" :value="s.id">{{ s.display_name || (s.name + ' (' + s.code + ')') }}</option>
          </select>
        </div>
        <div class="field">
          <label>Система получатель <span class="req">*</span></label>
          <select v-model="form.target_ar_systems_id" required>
            <option :value="null">—</option>
            <option v-for="s in systems" :key="s.id" :value="s.id">{{ s.display_name || (s.name + ' (' + s.code + ')') }}</option>
          </select>
        </div>
        <div class="field">
          <label>Тип инициирующего события</label>
          <select v-model="form.ar_integration_flow_event_types_id">
            <option :value="null">—</option>
            <option v-for="e in eventTypes" :key="e.id" :value="e.id">{{ e.display_name || e.name }}</option>
          </select>
        </div>
        <div class="field">
          <label>Периодичность</label>
          <input v-model="form.periodicity" placeholder="Напр. ежедневно, по требованию" />
        </div>
        <div class="field">
          <label>Статус интеграционного потока</label>
          <select v-model="form.ar_integration_flow_statuses_id">
            <option :value="null">—</option>
            <option v-for="st in flowStatuses" :key="st.id" :value="st.id">{{ st.display_name || st.name }}</option>
          </select>
        </div>
        <div class="field field-wide">
          <label>Передаваемые данные</label>
          <textarea v-model="form.transferred_data" rows="3"></textarea>
        </div>
        <div class="field field-wide">
          <label>Способ передачи</label>
          <input v-model="form.transfer_method" />
        </div>
      </div>
      <div v-if="submitError" class="error">{{ submitError }}</div>
      <div class="actions">
        <button type="submit" class="btn btn-primary" :disabled="saving">{{ saving ? 'Сохранение...' : 'Сохранить' }}</button>
        <router-link :to="listRouteLocation" class="btn btn-secondary">Отмена</router-link>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUnsavedGuard } from '../composables/useUnsavedGuard'
import { useFormListReturn } from '../composables/useFormListReturn'
import { api } from '../api/client'

const route = useRoute()
const router = useRouter()
const { listRouteLocation, routeWithListSearch } = useFormListReturn('/integrations')
const id = computed(() => route.params.id)
const isEdit = computed(() => !!id.value && id.value !== 'new')

const loading = ref(false)
const saving = ref(false)
const submitError = ref('')
const isDirty = ref(false)
const initialLoadDone = ref(false)
const systems = ref([])
const eventTypes = ref([])
const flowStatuses = ref([])

const form = reactive({
  source_ar_systems_id: null,
  target_ar_systems_id: null,
  ar_integration_flow_event_types_id: null,
  transferred_data: '',
  transfer_method: '',
  periodicity: '',
  ar_integration_flow_statuses_id: null,
})

function formSnapshot() {
  return {
    source_ar_systems_id: form.source_ar_systems_id,
    target_ar_systems_id: form.target_ar_systems_id,
    ar_integration_flow_event_types_id: form.ar_integration_flow_event_types_id,
    transferred_data: form.transferred_data,
    transfer_method: form.transfer_method,
    periodicity: form.periodicity,
    ar_integration_flow_statuses_id: form.ar_integration_flow_statuses_id,
  }
}

const lastLoadedSnapshot = ref(null)

onMounted(async () => {
  const [sys, ev, st] = await Promise.all([
    api.getSystems(),
    api.getIntegrationFlowEventTypes(),
    api.getIntegrationFlowStatuses(),
  ])
  systems.value = sys
  eventTypes.value = ev
  flowStatuses.value = st
  if (isEdit.value) {
    loading.value = true
    try {
      const row = await api.getIntegrationFlow(id.value)
      form.source_ar_systems_id = row.source_ar_systems_id ?? null
      form.target_ar_systems_id = row.target_ar_systems_id ?? null
      form.ar_integration_flow_event_types_id = row.ar_integration_flow_event_types_id ?? null
      form.transferred_data = row.transferred_data ?? ''
      form.transfer_method = row.transfer_method ?? ''
      form.periodicity = row.periodicity ?? ''
      form.ar_integration_flow_statuses_id = row.ar_integration_flow_statuses_id ?? null
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
  if (form.source_ar_systems_id == null || form.target_ar_systems_id == null) {
    submitError.value = 'Укажите систему источник и систему получатель'
    return
  }
  saving.value = true
  try {
    const body = {
      source_ar_systems_id: form.source_ar_systems_id,
      target_ar_systems_id: form.target_ar_systems_id,
      ar_integration_flow_event_types_id: form.ar_integration_flow_event_types_id || undefined,
      transferred_data: form.transferred_data || undefined,
      transfer_method: form.transfer_method || undefined,
      periodicity: form.periodicity || undefined,
      ar_integration_flow_statuses_id: form.ar_integration_flow_statuses_id || undefined,
    }
    if (isEdit.value) {
      await api.updateIntegrationFlow(id.value, body)
      lastLoadedSnapshot.value = formSnapshot()
      isDirty.value = false
      if (!opts.skipNavigate) router.push(listRouteLocation.value)
    } else {
      const res = await api.createIntegrationFlow(body)
      lastLoadedSnapshot.value = formSnapshot()
      isDirty.value = false
      if (!opts.skipNavigate) router.push(routeWithListSearch(`/integrations/${res.id}/edit`))
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
</style>

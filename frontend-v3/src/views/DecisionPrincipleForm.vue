<template>
  <div class="page">
    <div class="page-head">
      <h1>{{ formTitle }}</h1>
      <router-link :to="listRouteLocation" class="btn btn-secondary">← К реестру</router-link>
    </div>

    <div v-if="loading" class="loading">Загрузка...</div>
    <form v-else class="card form" @submit.prevent="submit">
      <p v-if="isEdit && !canWrite" class="readonly-banner">Режим просмотра: нет права <code>adr_principle:write</code>.</p>
      <fieldset class="form-fieldset" :disabled="!canWrite">
      <div class="form-grid">
        <div class="field" v-if="isEdit">
          <label>Код</label>
          <input v-model="form.code" readonly class="readonly" />
        </div>
        <div class="field field-wide">
          <label>Наименование <span class="req">*</span></label>
          <input v-model="form.name" required />
        </div>
        <div class="field">
          <label>Статус</label>
          <select v-model="form.ar_adr_statuses_id">
            <option :value="null">—</option>
            <option v-for="s in adrStatuses" :key="s.id" :value="s.id">{{ s.display_name || s.name }}</option>
          </select>
        </div>
        <div class="field">
          <label>Автор</label>
          <input v-model="form.author" />
        </div>
        <div class="field field-wide">
          <label>Контекст</label>
          <textarea v-model="form.context" rows="3"></textarea>
        </div>
        <div class="field field-wide">
          <label>Решение</label>
          <textarea v-model="form.decision" rows="3"></textarea>
        </div>
        <div class="field field-wide">
          <label>Последствия</label>
          <textarea v-model="form.consequences" rows="2"></textarea>
        </div>
      </div>
      </fieldset>
      <div v-if="submitError" class="error">{{ submitError }}</div>
      <div class="actions">
        <button v-if="canWrite" type="submit" class="btn btn-primary" :disabled="saving">{{ saving ? 'Сохранение...' : 'Сохранить' }}</button>
        <router-link :to="listRouteLocation" class="btn btn-secondary">{{ canWrite ? 'Отмена' : 'К реестру' }}</router-link>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUnsavedGuard } from '../composables/useUnsavedGuard'
import { useFormListReturn } from '../composables/useFormListReturn'
import { usePermissions } from '../composables/usePermissions'
import { api } from '../api/client'

const route = useRoute()
const router = useRouter()
const { listRouteLocation } = useFormListReturn('/decisions/principle')
const { canWrite } = usePermissions('adr_principle')
const id = computed(() => route.params.id)
const isEdit = computed(() => !!id.value)
const formTitle = computed(() => {
  if (!isEdit.value) return 'Новое принципиальное решение'
  return canWrite.value ? 'Редактирование принципиального решения' : 'Просмотр принципиального решения'
})

const loading = ref(false)
const saving = ref(false)
const submitError = ref('')
const isDirty = ref(false)
const initialLoadDone = ref(false)
const adrStatuses = ref([])
const form = reactive({
  code: '',
  name: '',
  context: '',
  decision: '',
  consequences: '',
  ar_adr_statuses_id: null,
  author: '',
})

function formSnapshot() {
  return {
    name: form.name,
    context: form.context,
    decision: form.decision,
    consequences: form.consequences,
    ar_adr_statuses_id: form.ar_adr_statuses_id,
    author: form.author,
  }
}

const lastLoadedSnapshot = ref(null)

onMounted(async () => {
  try {
    adrStatuses.value = await api.getAdrStatuses()
  } catch (e) {
    submitError.value = e.message || 'Ошибка загрузки справочников'
  }
  if (isEdit.value) {
    loading.value = true
    try {
      const row = await api.getDecisionPrinciple(id.value)
      form.code = row.code ?? ''
      form.name = row.name ?? ''
      form.context = row.context ?? ''
      form.decision = row.decision ?? ''
      form.consequences = row.consequences ?? ''
      form.ar_adr_statuses_id = row.ar_adr_statuses_id ?? null
      form.author = row.author ?? ''
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
  if (!canWrite.value) return
  submitError.value = ''
  saving.value = true
  try {
    const body = {
      name: form.name.trim(),
      context: form.context?.trim() || undefined,
      decision: form.decision?.trim() || undefined,
      consequences: form.consequences?.trim() || undefined,
      ar_adr_statuses_id: form.ar_adr_statuses_id || undefined,
      author: form.author?.trim() || undefined,
    }
    if (isEdit.value) {
      await api.updateDecisionPrinciple(id.value, body)
      lastLoadedSnapshot.value = formSnapshot()
      isDirty.value = false
      if (!opts.skipNavigate) router.push(listRouteLocation.value)
    } else {
      await api.createDecisionPrinciple(body)
      lastLoadedSnapshot.value = formSnapshot()
      isDirty.value = false
      if (!opts.skipNavigate) router.push(listRouteLocation.value)
    }
  } catch (e) {
    submitError.value = e.body?.error || e.message || 'Ошибка сохранения'
    throw e
  } finally {
    saving.value = false
  }
}

useUnsavedGuard(
  computed(() => canWrite.value && isDirty.value),
  () => submit({ skipNavigate: true })
)
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
.field input.readonly {
  background: var(--ar-table-head-bg);
  color: var(--ar-muted);
}
.error {
  margin-top: 0.5rem;
}
</style>

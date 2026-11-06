<template>
  <div class="page">
    <div class="page-head">
      <h1>{{ formTitle }}</h1>
      <router-link :to="listRouteLocation" class="btn">← К списку</router-link>
    </div>
    <form v-if="form" class="form" @submit.prevent="submit()">
      <p v-if="isEdit && !canWrite" class="readonly-banner">Режим просмотра: нет права <code>actor:write</code>.</p>
      <p v-if="prefillNotice" class="readonly-banner prefill-banner">{{ prefillNotice }}</p>
      <fieldset class="form-fieldset" :disabled="!canWrite">
      <div class="form-row">
        <label>Наименование *</label>
        <input v-model="form.name" required />
      </div>
      <div class="form-row">
        <label>Тип заинтересованного лица</label>
        <select v-model="form.actor_type_id">
          <option :value="null">—</option>
          <option v-for="t in actorTypes" :key="t.id" :value="t.id">{{ t.display_name || t.name }}</option>
        </select>
      </div>
      <div class="form-row">
        <label>Орг. единица</label>
        <select v-model="form.organization_unit_id">
          <option :value="null">—</option>
          <option v-for="ou in organizationUnits" :key="ou.id" :value="ou.id">{{ ou.display_name || ou.name }}</option>
        </select>
      </div>
      <div class="form-row">
        <label>Описание</label>
        <textarea v-model="form.description" rows="3"></textarea>
      </div>
      </fieldset>
    </form>
    <div v-else-if="loading" class="msg">Загрузка...</div>
    <div v-else class="msg error">{{ error || 'Не найдено' }}</div>

    <SaveBar
      v-if="form"
      :saving="saving"
      :saved="savedOk"
      :dirty="isDirty"
      :can-save="canWrite"
      :error="submitError"
      show-save-and-close
      max-width="500px"
      @save="submit()"
      @save-and-close="submit({ close: true })"
    >
      <template #cancel>
        <router-link :to="listRouteLocation" class="btn btn-secondary">{{ canWrite ? 'Отмена' : 'К списку' }}</router-link>
      </template>
    </SaveBar>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { togafApi } from '../api'
import SaveBar from '../components/SaveBar.vue'
import { useFormListReturn } from '../composables/useFormListReturn'
import { usePermissions } from '../composables/usePermissions'
import { useFormDirty } from '../composables/useFormDirty'
import { useSaveStatus } from '../composables/useSaveStatus'
import { useUnsavedGuard } from '../composables/useUnsavedGuard'
import { useAiPrefill } from '../composables/useAiPrefill'

const route = useRoute()
const router = useRouter()
const { listRouteLocation, routeWithListSearch } = useFormListReturn('/actors')
const { canWrite } = usePermissions('actor')
const id = computed(() => route.params.id)
const isEdit = computed(() => !!id.value && id.value !== 'new')
const formTitle = computed(() => {
  if (!isEdit.value) return 'Новое заинтересованное лицо'
  return canWrite.value ? 'Редактирование заинтересованного лица' : 'Просмотр заинтересованного лица'
})
const form = ref(null)
const loading = ref(true)
const error = ref('')
const organizationUnits = ref([])
const actorTypes = ref([])

/** Правки формы: снимок берётся после загрузки записи и после сохранения (issue #94). */
const { isDirty, markSaved } = useFormDirty(() => form.value)
/** Состояние панели сохранения: «сохранение → сохранено → ошибка» + текст ошибки. */
const {
  saving,
  savedOk,
  submitError,
  startSaving,
  markSaved: markSavedOk,
  markError,
} = useSaveStatus({ dirty: isDirty })

/**
 * Черновик ИИ-архитектора (`prefill_form`, docs/ai-architect.md §7): тот же контракт `?payload=`,
 * что и в переходе «заключение → форма». Поля совпадают с `prefillFields` в backend/ai/tools.js.
 */
const { prefillNotice, applyAiPrefill } = useAiPrefill({
  entity: 'Заинтересованное лицо',
  target: () => form.value,
  fields: { name: 'string', description: 'string' },
})

async function loadRefs() {
  const [ous, types] = await Promise.all([
    togafApi.organizationUnits(),
    togafApi.refs.actorTypes(),
  ])
  organizationUnits.value = ous
  actorTypes.value = types
}

async function load() {
  loading.value = true
  error.value = ''
  await loadRefs()
  if (isEdit.value) {
    try {
      const row = await togafApi.actor(id.value)
      form.value = {
        name: row.name,
        description: row.description || '',
        organization_unit_id: row.organization_unit_id,
        actor_type_id: row.actor_type_id,
      }
    } catch (e) {
      error.value = e.message
      form.value = null
    }
  } else {
    form.value = { name: '', description: '', organization_unit_id: null, actor_type_id: null }
  }
  markSaved()
  loading.value = false
  applyAiPrefill()
}

/**
 * Единая точка сохранения формы (issue #94).
 *
 * Навигация после успешного сохранения:
 *   skipNavigate — остаться (сохранение перед уходом со страницы, guard);
 *   close        — «Сохранить и закрыть»: уйти в список;
 *   по умолчанию — остаться; созданная запись превращается в карточку редактирования.
 *
 * @param {{ close?: boolean, skipNavigate?: boolean }} opts
 * @returns {Promise<boolean>} true, если сохранение прошло без ошибок.
 */
async function submit(opts = {}) {
  if (!canWrite.value || saving.value) return false
  if (!form.value.name?.trim()) {
    markError('Укажите наименование — это обязательное поле.')
    return false
  }
  startSaving()
  const payload = {
    name: form.value.name,
    description: form.value.description || undefined,
    organization_unit_id: form.value.organization_unit_id || undefined,
    actor_type_id: form.value.actor_type_id || undefined,
  }
  try {
    let actorId = id.value
    if (isEdit.value) {
      await togafApi.updateActor(id.value, payload)
    } else {
      const res = await togafApi.createActor(payload)
      actorId = res.id
    }
    markSaved()
    markSavedOk()
    if (opts.skipNavigate) return true
    if (opts.close) {
      await router.push(listRouteLocation.value)
      return true
    }
    if (!isEdit.value) await router.replace(routeWithListSearch(`/actors/${actorId}/edit`))
    return true
  } catch (e) {
    markError(e.body?.error || e.message || 'Ошибка сохранения')
    return false
  }
}

/**
 * Выход со страницы с несохранёнными правками: guard предлагает сохранить.
 * При ошибке сохранения `submit` возвращает `false` — переход отменяется, данные не теряются.
 */
useUnsavedGuard(
  computed(() => canWrite.value && isDirty.value),
  async () => {
    const ok = await submit({ skipNavigate: true })
    if (!ok) throw new Error('Не сохранено')
  },
)

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
/* Плашка черновика ИИ-архитектора: заметнее режима просмотра, но без «кричащих» цветов. */
.prefill-banner {
  background: var(--ar-surface);
  border-color: var(--ar-accent);
  color: var(--ar-text);
  line-height: 1.45;
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
.msg {
  padding: 1rem;
}
.msg.error {
  color: var(--ar-danger);
}
</style>

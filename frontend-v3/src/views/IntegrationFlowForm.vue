<template>
  <div class="page">
    <div class="page-head">
      <h1>{{ formTitle }}</h1>
      <router-link :to="listRouteLocation" class="btn btn-secondary">← К списку</router-link>
    </div>

    <div v-if="loading && isEdit" class="loading">Загрузка...</div>
    <form v-else class="card form" @submit.prevent="submit()">
      <p v-if="isEdit && !canWrite" class="readonly-banner">Режим просмотра: нет права <code>integration_flow:write</code>.</p>
      <p v-if="prefillNotice" class="readonly-banner prefill-banner">{{ prefillNotice }}</p>
      <fieldset class="form-fieldset" :disabled="!canWrite">
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
      </fieldset>
    </form>

    <SaveBar
      :saving="saving"
      :saved="savedOk"
      :dirty="isDirty"
      :can-save="canWrite"
      :error="submitError"
      show-save-and-close
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
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUnsavedGuard } from '../composables/useUnsavedGuard'
import { useFormListReturn } from '../composables/useFormListReturn'
import { usePermissions } from '../composables/usePermissions'
import { useFormDirty } from '../composables/useFormDirty'
import { useSaveStatus } from '../composables/useSaveStatus'
import { useAiPrefill } from '../composables/useAiPrefill'
import { api } from '../api/client'
import SaveBar from '../components/SaveBar.vue'

const route = useRoute()
const router = useRouter()
const { listRouteLocation, routeWithListSearch } = useFormListReturn('/integrations')
const { canWrite } = usePermissions('integration_flow')
const id = computed(() => route.params.id)
const isEdit = computed(() => !!id.value && id.value !== 'new')
const formTitle = computed(() => {
  if (!isEdit.value) return 'Новый интеграционный поток'
  return canWrite.value ? 'Редактирование интеграционного потока' : 'Просмотр интеграционного потока'
})

const loading = ref(false)
const systems = ref([])
const eventTypes = ref([])
const flowStatuses = ref([])

/**
 * Черновик ИИ-архитектора (`prefill_form`, docs/ai-architect.md §7) — тот же контракт `?payload=`.
 * Поля совпадают с `prefillFields` в backend/ai/tools.js; источник/получатель выбирает пользователь.
 */
const { prefillNotice, applyAiPrefill } = useAiPrefill({
  entity: 'Интеграционный поток',
  target: () => form,
  fields: { transferred_data: 'string', transfer_method: 'string', periodicity: 'string' },
})

const form = reactive({
  source_ar_systems_id: null,
  target_ar_systems_id: null,
  ar_integration_flow_event_types_id: null,
  transferred_data: '',
  transfer_method: '',
  periodicity: '',
  ar_integration_flow_statuses_id: null,
})

/** Правки формы: снимок берётся после загрузки записи и после сохранения (issue #94). */
const { isDirty, markSaved } = useFormDirty(() => form)
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
 * Загрузка карточки: справочники + запись. Вызывается при открытии и при смене `id`
 * (в т.ч. после создания записи: форма сама становится карточкой редактирования).
 */
async function load() {
  submitError.value = ''
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
      markError(e.body?.error || e.message || 'Ошибка загрузки')
    } finally {
      loading.value = false
    }
  }
  markSaved()
  // Черновик применяем после снятия снимка: форма помечается изменённой (guard несохранённых данных).
  applyAiPrefill()
}

onMounted(load)
watch(id, load)

/**
 * Единая точка сохранения формы (issue #94).
 *
 * Навигация после успешного сохранения:
 *   skipNavigate — остаться (сохранение перед уходом со страницы, guard);
 *   close        — «Сохранить и закрыть»: уйти в реестр;
 *   по умолчанию — остаться; созданная запись превращается в карточку редактирования.
 *
 * @param {{ close?: boolean, skipNavigate?: boolean }} opts
 * @returns {Promise<boolean>} true, если сохранение прошло без ошибок.
 */
async function submit(opts = {}) {
  if (!canWrite.value || saving.value) return false
  if (form.source_ar_systems_id == null || form.target_ar_systems_id == null) {
    markError('Укажите систему источник и систему получатель')
    return false
  }
  startSaving()
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
    let flowId = id.value
    if (isEdit.value) {
      await api.updateIntegrationFlow(id.value, body)
    } else {
      const res = await api.createIntegrationFlow(body)
      flowId = res.id
    }
    markSaved()
    markSavedOk()
    if (opts.skipNavigate) return true
    if (opts.close) {
      await router.push(listRouteLocation.value)
      return true
    }
    if (!isEdit.value) await router.replace(routeWithListSearch(`/integrations/${flowId}/edit`))
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
.error {
  margin-top: 0.5rem;
}
</style>

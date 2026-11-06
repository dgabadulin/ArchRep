<template>
  <div class="page">
    <div class="page-head">
      <h1>{{ formTitle }}</h1>
      <router-link :to="listRouteLocation" class="btn btn-secondary">← К реестру</router-link>
    </div>

    <div v-if="loading" class="loading">Загрузка...</div>
    <form v-else class="card form" @submit.prevent="submit()">
      <p v-if="isEdit && !canWrite" class="readonly-banner">Режим просмотра: нет права <code>adr_principle:write</code>.</p>
      <p v-if="prefillNotice" class="readonly-banner prefill-banner">{{ prefillNotice }}</p>
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
        <router-link :to="listRouteLocation" class="btn btn-secondary">{{ canWrite ? 'Отмена' : 'К реестру' }}</router-link>
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
const { listRouteLocation, routeWithListSearch } = useFormListReturn('/decisions/principle')
const { canWrite } = usePermissions('adr_principle')
const id = computed(() => route.params.id)
const isEdit = computed(() => !!id.value)
const formTitle = computed(() => {
  if (!isEdit.value) return 'Новое принципиальное решение'
  return canWrite.value ? 'Редактирование принципиального решения' : 'Просмотр принципиального решения'
})

const loading = ref(false)
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
 * Черновик ИИ-архитектора (`prefill_form`, docs/ai-architect.md §7) — тот же контракт `?payload=`.
 * Поля совпадают с `prefillFields` в backend/ai/tools.js; статус/автор пользователь выбирает сам.
 */
const { prefillNotice, applyAiPrefill } = useAiPrefill({
  entity: 'Принципиальное архитектурное решение',
  target: () => form,
  fields: { name: 'string', context: 'string', decision: 'string', consequences: 'string' },
})

/**
 * Загрузка карточки: справочники + запись. Вызывается при открытии и при смене `id`
 * (в т.ч. после создания записи: форма сама становится карточкой редактирования).
 */
async function load() {
  submitError.value = ''
  try {
    adrStatuses.value = await api.getAdrStatuses()
  } catch (e) {
    markError(e.message || 'Ошибка загрузки справочников')
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
  if (!form.name?.trim()) {
    markError('Укажите наименование — это обязательное поле.')
    return false
  }
  startSaving()
  try {
    const body = {
      name: form.name.trim(),
      context: form.context?.trim() || undefined,
      decision: form.decision?.trim() || undefined,
      consequences: form.consequences?.trim() || undefined,
      ar_adr_statuses_id: form.ar_adr_statuses_id || undefined,
      author: form.author?.trim() || undefined,
    }
    let principleId = id.value
    if (isEdit.value) {
      await api.updateDecisionPrinciple(id.value, body)
    } else {
      const res = await api.createDecisionPrinciple(body)
      principleId = res.id
      form.code = res.code ?? form.code
    }
    markSaved()
    markSavedOk()
    if (opts.skipNavigate) return true
    if (opts.close) {
      await router.push(listRouteLocation.value)
      return true
    }
    if (!isEdit.value) await router.replace(routeWithListSearch(`/decisions/principle/${principleId}/edit`))
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
.field input.readonly {
  background: var(--ar-table-head-bg);
  color: var(--ar-muted);
}
.error {
  margin-top: 0.5rem;
}
</style>

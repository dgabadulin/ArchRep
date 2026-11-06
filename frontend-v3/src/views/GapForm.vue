<template>
  <div class="page">
    <div class="page-head">
      <h1>{{ formTitle }}</h1>
      <router-link :to="listRouteLocation" class="btn btn-secondary">← К реестру</router-link>
    </div>

    <div class="tabs">
      <button :class="['tab', { active: activeTab === 'data' }]" @click="activeTab = 'data'">
        Архитектурный долг<span v-if="headerDirty" class="tab-dot" title="Есть несохранённые изменения">•</span>
      </button>
      <button :class="['tab', { active: activeTab === 'relations' }]" @click="activeTab = 'relations'; loadRelations()">
        Связи<span
          v-if="relationsDraftDirty"
          class="tab-dot"
          :title="`Изменений без сохранения: ${relationsDraftCount}`"
        >•</span>
      </button>
    </div>

    <div v-if="loading && activeTab === 'data'" class="loading">Загрузка...</div>
    <form v-else-if="activeTab === 'data'" class="card form" @submit.prevent="submit()">
      <p v-if="isEdit && !canWrite" class="readonly-banner">Режим просмотра: нет права <code>gap:write</code>.</p>
      <p v-if="prefillNotice" class="readonly-banner prefill-banner">{{ prefillNotice }}</p>
      <fieldset class="form-fieldset" :disabled="!canWrite">
      <div class="form-grid">
        <div class="field field-code" v-if="isEdit">
          <label>Код</label>
          <input v-model="form.code" readonly class="readonly" type="text" />
        </div>
        <div class="field">
          <label>Название <span class="req">*</span></label>
          <input ref="nameInput" v-model="form.name" required placeholder="Краткое описание долга" />
        </div>
        <div class="field field-wide">
          <label>Описание</label>
          <textarea v-model="form.description" rows="3" placeholder="Текущее vs целевое состояние"></textarea>
        </div>
        <div class="field field-wide">
          <label>Последствия</label>
          <textarea v-model="form.consequences" rows="2"></textarea>
        </div>
        <div class="field">
          <label>Тип долга</label>
          <select v-model="form.ar_gap_types_id">
            <option :value="null">—</option>
            <option v-for="t in gapTypes" :key="t.id" :value="t.id">{{ t.display_name || t.name }}</option>
          </select>
        </div>
        <div class="field">
          <label>Степень влияния</label>
          <select v-model="form.ar_impact_level_types_id">
            <option :value="null">—</option>
            <option v-for="t in impactLevelTypes" :key="t.id" :value="t.id">{{ t.display_name || t.name }}</option>
          </select>
        </div>
        <div class="field">
          <label>Состояние</label>
          <select v-model="form.ar_gap_states_id">
            <option :value="null">—</option>
            <option v-for="s in gapStates" :key="s.id" :value="s.id">{{ s.display_name || s.name }}</option>
          </select>
        </div>
        <div class="field">
          <label>Статус утверждения</label>
          <select v-model="form.ar_adr_statuses_id">
            <option :value="null">—</option>
            <option v-for="s in adrStatuses" :key="s.id" :value="s.id">{{ s.display_name || s.name }}</option>
          </select>
        </div>
        <div class="field">
          <label>Трудоёмкость устранения</label>
          <input v-model="form.remediation_effort" placeholder="Напр. 5 чел./дн." />
        </div>
        <div class="field">
          <label>Целевая дата устранения</label>
          <input v-model="form.target_date" type="date" />
        </div>
        <div class="field">
          <label>Фактическая дата устранения</label>
          <input v-model="form.resolved_date" type="date" />
        </div>
        <div class="field">
          <label>Ответственное лицо</label>
          <input v-model="form.responsible_person" placeholder="ФИО (необязательно)" maxlength="500" autocomplete="name" />
        </div>
        <div class="field field-wide">
          <label>Источник</label>
          <input v-model="form.source" placeholder="Источник информации" />
        </div>
      </div>
      </fieldset>
    </form>

    <!-- Вкладка «Связи» — host slice (gap:read / gap:write). Доступна и до сохранения: правки идут в черновик. -->
    <div v-else-if="activeTab === 'relations'" class="card relations-tab">
      <p v-if="!canWrite" class="readonly-banner">Режим просмотра: нет права <code>gap:write</code>.</p>
      <RelationPickerModal
        v-model="showRelationPicker"
        title="Добавить связь"
        from-label="Выберите тип сущности «К», объект и тип связи (аналогично выбору объектов для графа в Анализе зависимостей)."
        :entity-types="allowedToEntityTypesForPicker"
        :relation-types="gapRelationTypes"
        @confirm="onRelationPicked"
      />
      <EntityLinksTableGraph
        :loading="relationsLoading"
        :relations="graphRelations"
        :center-node-id="gapCenterNodeId"
        :relation-types="relationTypes"
        graph-height="780px"
      >
        <template #hint>
          Связи данного архитектурного долга с системами, технологиями и другими сущностями (метамодель). На графе —
          только строки из таблицы слева.
          <template v-if="relationsDraftDirty">
            Изменений без сохранения: {{ relationsDraftCount }} — они применятся по кнопке «Сохранить» внизу страницы.
          </template>
        </template>
        <template #toolbar>
          <button
            v-if="canWrite"
            type="button"
            class="btn btn-primary btn-sm"
            @click="showRelationPicker = true"
          >
            Добавить связь
          </button>
        </template>
        <template #table>
          <table class="table">
            <thead>
              <tr>
                <th>Объект «от»</th>
                <th>Связь</th>
                <th>Объект «к»</th>
                <th v-if="canWrite" class="col-actions">Действия</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in relationRows" :key="r.id">
                <td>{{ r._fromLabel }}</td>
                <td>{{ r._relLabel }}</td>
                <td>{{ r._toLabel }}</td>
                <td v-if="canWrite" class="col-actions">
                  <button type="button" class="btn-link danger" @click="removeRelation(r)">Удалить</button>
                </td>
              </tr>
            </tbody>
          </table>
          <p v-if="relations.length === 0" class="empty">
            Нет связей.
            <template v-if="canWrite"> Добавьте связь с системой, технологией или другой сущностью.</template>
          </p>
        </template>
      </EntityLinksTableGraph>
    </div>

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
import { ref, computed, nextTick, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api/client'
import { togafApi } from '../api'
import RelationPickerModal from '../components/RelationPickerModal.vue'
import EntityLinksTableGraph from '../components/EntityLinksTableGraph.vue'
import SaveBar from '../components/SaveBar.vue'
import { fetchEntity } from '../api/graphApi'
import { nodeId } from '../utils/entityTypeConfig'
import { useFormListReturn } from '../composables/useFormListReturn'
import { usePermissions } from '../composables/usePermissions'
import { useCollectionDraft } from '../composables/useCollectionDraft'
import { useFormDirty } from '../composables/useFormDirty'
import { useSaveStatus } from '../composables/useSaveStatus'
import { useUnsavedGuard } from '../composables/useUnsavedGuard'
import { useAiPrefill } from '../composables/useAiPrefill'

const route = useRoute()
const router = useRouter()
const { listRouteLocation, routeWithListSearch } = useFormListReturn('/architecture-debt')
const { canWrite } = usePermissions('gap')
const id = computed(() => route.params.id)
const isEdit = computed(() => !!id.value && id.value !== 'new')
const formTitle = computed(() => {
  if (!isEdit.value) return 'Новый архитектурный долг'
  return canWrite.value ? 'Редактирование архитектурного долга' : 'Просмотр архитектурного долга'
})

const loading = ref(true)
/**
 * id созданной записи до перехода на маршрут редактирования: нужен, чтобы применить
 * черновик вкладки «Связи» в том же сохранении (issue #94).
 */
const createdId = ref(null)
const effectiveId = computed(() => id.value || createdId.value || null)
const nameInput = ref(null)
const form = ref({
  code: '',
  name: '',
  description: '',
  consequences: '',
  ar_gap_types_id: null,
  ar_impact_level_types_id: null,
  ar_gap_states_id: null,
  ar_adr_statuses_id: null,
  remediation_effort: '',
  target_date: '',
  resolved_date: '',
  responsible_person: '',
  source: '',
})
const gapTypes = ref([])
const impactLevelTypes = ref([])
const gapStates = ref([])
const adrStatuses = ref([])

/** Правки шапки формы: снимок берётся после загрузки записи и после сохранения (issue #94). */
const { isDirty: headerDirty, markSaved: markHeaderSaved } = useFormDirty(() => form.value)

/**
 * Черновик ИИ-архитектора (`prefill_form`, docs/ai-architect.md §7) — тот же контракт `?payload=`.
 * Поля совпадают с `prefillFields` в backend/ai/tools.js; справочные значения пользователь выбирает сам.
 */
const { prefillNotice, applyAiPrefill } = useAiPrefill({
  entity: 'Архитектурный долг',
  target: () => form.value,
  fields: {
    name: 'string',
    description: 'string',
    consequences: 'string',
    remediation_effort: 'string',
    responsible_person: 'string',
    source: 'string',
  },
})

const activeTab = ref('data')

/** Связи — локальный черновик (issue #94): вкладку можно заполнять до сохранения долга. */
const relationsDraft = useCollectionDraft()
const relations = relationsDraft.items
const relationsDraftDirty = relationsDraft.isDirty
const relationsDraftCount = relationsDraft.dirtyCount
const relationsLoading = ref(false)
const entityTypes = ref([])
const relationTypes = ref([])
const showRelationPicker = ref(false)

/** Есть несохранённые изменения: шапка формы или черновик вкладки. */
const isDirty = computed(() => headerDirty.value || relationsDraftDirty.value)
/** Состояние панели сохранения: «сохранение → сохранено → ошибка» + текст ошибки. */
const {
  saving,
  savedOk,
  submitError,
  startSaving,
  markSaved: markSavedOk,
  markError,
} = useSaveStatus({ dirty: isDirty })

/** Строки таблицы связей с подставленными видимыми именами */
const relationRows = ref([])

const gapCenterNodeId = computed(() => (effectiveId.value ? nodeId('gap', Number(effectiveId.value)) : null))

/** Связи для графа: в режиме создания id ещё нет, поэтому граф не строим (таблица работает на черновике). */
const graphRelations = computed(() => (effectiveId.value ? relations.value : []))

const gapRelationTypes = computed(() => {
  return relationTypes.value.filter(rt => rt.from_entity_type_code === 'gap')
})

/** Типы сущностей «К», для которых в метамодели есть связь от текущей сущности (gap) — только их показываем в выборе */
const allowedToEntityTypesForPicker = computed(() => {
  const toCodes = [...new Set(gapRelationTypes.value.map(rt => rt.to_entity_type_code).filter(Boolean))]
  return entityTypes.value.filter(et => toCodes.includes(et.code))
})

function relationTypeLabel(r) {
  const rt = gapRelationTypes.value.find(
    (x) => x.code === r.relation_type && x.to_entity_type_code === r.to_entity_type
  )
  const base = rt?.display_name || rt?.name || r.relation_type
  if (r.name && String(r.name).trim()) return `${base} — ${r.name}`
  return base
}

async function enrichRelationRows() {
  const fromLabel =
    form.value.name?.trim() || form.value.code?.trim() || (effectiveId.value ? `Долг #${effectiveId.value}` : '—')
  const rows = relations.value
  const enriched = await Promise.all(
    rows.map(async (r) => {
      let toLabel = `${r.to_entity_type}:${r.to_entity_id}`
      try {
        const ent = await fetchEntity(r.to_entity_type, r.to_entity_id)
        toLabel =
          ent?.display_name || ent?.name || ent?.code || ent?.task_name || toLabel
      } catch {
        /* keep fallback */
      }
      return {
        ...r,
        _fromLabel: fromLabel,
        _relLabel: relationTypeLabel(r),
        _toLabel: toLabel,
      }
    })
  )
  relationRows.value = enriched
}

async function loadRefs() {
  const [types, impact, states, adr] = await Promise.all([
    api.getGapTypes(),
    api.getImpactLevelTypes(),
    api.getGapStates(),
    api.getAdrStatuses(),
  ])
  gapTypes.value = types
  impactLevelTypes.value = impact
  gapStates.value = states
  adrStatuses.value = adr
}

async function load() {
  loading.value = true
  submitError.value = ''
  await loadRefs()
  if (isEdit.value) {
    try {
      const row = await api.getGap(id.value)
      form.value = {
        code: row.code,
        name: row.name,
        description: row.description || '',
        consequences: row.consequences || '',
        ar_gap_types_id: row.ar_gap_types_id ?? null,
        ar_impact_level_types_id: row.ar_impact_level_types_id ?? null,
        ar_gap_states_id: row.ar_gap_states_id ?? null,
        ar_adr_statuses_id: row.ar_adr_statuses_id ?? null,
        remediation_effort: row.remediation_effort || '',
        target_date: row.target_date ? row.target_date.slice(0, 10) : '',
        resolved_date: row.resolved_date ? row.resolved_date.slice(0, 10) : '',
        responsible_person: row.responsible_person || '',
        source: row.source || '',
      }
    } catch (e) {
      submitError.value = e.message || 'Не удалось загрузить'
    }
  }
  markHeaderSaved()
  loading.value = false
  // Черновик ИИ-архитектора применяем после загрузки: данные НЕ сохраняются — пользователь сохраняет сам.
  applyAiPrefill()
}

/**
 * Проверка обязательных полей шапки: переключаемся на «Данные» и ставим фокус.
 */
async function validateHeader() {
  if (form.value.name?.trim()) return true
  activeTab.value = 'data'
  submitError.value = 'Укажите название долга — это обязательное поле.'
  await nextTick()
  nameInput.value?.focus()
  return false
}

/**
 * Единая точка сохранения страницы (issue #94): шапка формы + черновик вкладки «Связи».
 *
 * Навигация после успешного сохранения:
 *   skipNavigate — остаться (сохранение перед уходом со страницы, guard);
 *   close        — «Сохранить и закрыть»: уйти в реестр (в т.ч. сразу после создания записи);
 *   по умолчанию — остаться; созданная запись превращается в карточку редактирования.
 *
 * @param {{ close?: boolean, skipNavigate?: boolean }} opts
 * @returns {Promise<boolean>} true, если всё сохранилось без ошибок.
 */
async function submit(opts = {}) {
  if (!canWrite.value || saving.value) return false
  if (!(await validateHeader())) return false
  startSaving()
  const body = {
    name: form.value.name,
    description: form.value.description,
    consequences: form.value.consequences,
    ar_gap_types_id: form.value.ar_gap_types_id,
    ar_impact_level_types_id: form.value.ar_impact_level_types_id,
    ar_gap_states_id: form.value.ar_gap_states_id,
    ar_adr_statuses_id: form.value.ar_adr_statuses_id,
    remediation_effort: form.value.remediation_effort,
    target_date: form.value.target_date || null,
    resolved_date: form.value.resolved_date || null,
    responsible_person: form.value.responsible_person?.trim() || '',
    source: form.value.source,
  }
  const wasCreated = !effectiveId.value
  try {
    if (wasCreated) {
      const res = await api.createGap(body)
      createdId.value = res.id
    } else {
      await api.updateGap(effectiveId.value, body)
    }

    // Вкладка «Связи»: применяем накопленный черновик (в режиме создания — уже с реальным id).
    const { failures, failedAdds } = await applyRelationsDraft(effectiveId.value)
    markHeaderSaved()
    if (failures.length) {
      // Частичный успех: перечитываем применённое, неприменённое возвращаем в черновик.
      await loadRelations({ force: true })
      for (const row of failedAdds) relationsDraft.add(row)
      await enrichRelationRows()
      markError(`Сохранено частично: ${failures.join('; ')}. Повторите сохранение.`)
      return false
    }
    await loadRelations({ force: true })
    markSavedOk()
    if (opts.skipNavigate) return true
    if (opts.close) {
      await router.push(listRouteLocation.value)
      return true
    }
    if (wasCreated) {
      // Остаёмся на форме: дальше это карточка редактирования с уже доступными вкладками.
      await router.replace(routeWithListSearch(`/architecture-debt/${effectiveId.value}/edit`))
    }
    return true
  } catch (e) {
    markError(e.body?.error || e.message || 'Ошибка сохранения')
    return false
  }
}

/** Справочники связей нужны и до сохранения; сами связи читаем только при наличии id. */
async function loadRelations({ force = false } = {}) {
  relationsLoading.value = true
  try {
    entityTypes.value = await togafApi.entityTypes()
    relationTypes.value = await togafApi.relationTypes()
    const gapRelations = effectiveId.value ? await api.getGapRelations(effectiveId.value) : []
    // Черновик не затираем: незаписанные связи должны пережить переключение вкладок.
    if (force || !relationsDraft.isDirty.value) relationsDraft.reset(gapRelations)
    await enrichRelationRows()
  } catch (e) {
    relationsDraft.reset([])
    relationRows.value = []
    submitError.value = e.body?.error || e.message || 'Ошибка загрузки связей'
  } finally {
    relationsLoading.value = false
  }
}

/**
 * Применить черновик связей после сохранения шапки: сначала удаления, затем добавления.
 * Возвращает неприменённые операции — форма покажет их и даст повторить.
 */
async function applyRelationsDraft(gapId) {
  const { added, removedIds } = relationsDraft.diff()
  const failures = []
  const failedAdds = []
  for (const relId of removedIds) {
    try {
      await togafApi.deleteRelation(relId)
    } catch (e) {
      failures.push(`не удалена связь #${relId} (${e.body?.error || e.message || 'ошибка'})`)
    }
  }
  for (const row of added) {
    try {
      await api.addGapRelation(gapId, {
        to_entity_type: row.to_entity_type,
        to_entity_id: row.to_entity_id,
        relation_type: row.relation_type,
        name: row.name || undefined,
      })
    } catch (e) {
      failedAdds.push(row)
      failures.push(
        `не добавлена связь «${relationTypeLabel(row)}» (${e.body?.error || e.message || 'ошибка'})`,
      )
    }
  }
  return { failures, failedAdds }
}

/** Добавление связи — в локальный черновик: в API уйдёт вместе с формой. */
async function onRelationPicked(payload) {
  if (!canWrite.value) return
  if (!payload.to_entity_type || !payload.to_entity_id || !payload.relation_type) return
  relationsDraft.add({
    from_entity_type: 'gap',
    from_entity_id: effectiveId.value ? Number(effectiveId.value) : null,
    to_entity_type: payload.to_entity_type,
    to_entity_id: payload.to_entity_id,
    relation_type: payload.relation_type,
    name: payload.name || undefined,
  })
  await enrichRelationRows()
}

/** Удаление связи: существующая помечается на удаление, добавленная локально — просто убирается. */
async function removeRelation(row) {
  if (!canWrite.value || !row) return
  if (!row._local && !confirm('Удалить связь? Изменение применится после сохранения формы.')) return
  relationsDraft.remove(row)
  await enrichRelationRows()
}

watch(
  () => [form.value.name, form.value.code],
  () => {
    if (activeTab.value === 'relations' && relations.value.length) enrichRelationRows()
  }
)

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
.field input.readonly {
  background: var(--ar-table-head-bg);
}
.error {
  margin-top: 0.5rem;
}
.tab-hint {
  font-size: 0.9rem;
  color: var(--ar-muted);
  margin-bottom: 1rem;
}
.relations-tab {
  margin-top: 0;
  padding: 1.5rem;
}
.col-actions {
  width: 8rem;
  white-space: nowrap;
}
.empty {
  color: var(--ar-muted);
}
/* Отметка на вкладке: есть изменения, которые ещё не ушли в API (issue #94). */
.tab-dot {
  color: var(--ar-danger);
  font-weight: 700;
  margin-left: 0.25rem;
}
.tab.active .tab-dot {
  color: var(--ar-text-on-accent);
}
</style>

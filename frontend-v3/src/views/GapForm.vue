<template>
  <div class="page">
    <div class="page-head">
      <h1>{{ formTitle }}</h1>
      <router-link :to="listRouteLocation" class="btn btn-secondary">← К реестру</router-link>
    </div>

    <template v-if="isEdit">
      <div class="tabs">
        <button :class="['tab', { active: activeTab === 'data' }]" @click="activeTab = 'data'">Архитектурный долг</button>
        <button :class="['tab', { active: activeTab === 'relations' }]" @click="activeTab = 'relations'; loadRelations()">Связи</button>
      </div>
    </template>

    <div v-if="loading && (activeTab === 'data' || !isEdit)" class="loading">Загрузка...</div>
    <form v-else-if="activeTab === 'data' || !isEdit" class="card form" @submit.prevent="submit">
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
          <input v-model="form.name" required placeholder="Краткое описание долга" />
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
      <div v-if="submitError" class="error">{{ submitError }}</div>
      <div class="actions actions-bottom">
        <button v-if="canWrite" type="submit" class="btn btn-primary" :disabled="saving">{{ saving ? 'Сохранение...' : 'Сохранить' }}</button>
        <router-link :to="listRouteLocation" class="btn btn-secondary">{{ canWrite ? 'Отмена' : 'К реестру' }}</router-link>
      </div>
    </form>

    <!-- Вкладка «Связи» — host slice (gap:read / gap:write) -->
    <div v-else-if="isEdit && activeTab === 'relations'" class="card relations-tab">
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
        :relations="relations"
        :center-node-id="gapCenterNodeId"
        :relation-types="relationTypes"
        graph-height="780px"
      >
        <template #hint>
          Связи данного архитектурного долга с системами, технологиями и другими сущностями (метамодель). На графе —
          только строки из таблицы слева.
        </template>
        <template #toolbar>
          <button
            v-if="canWrite"
            type="button"
            class="btn btn-primary btn-sm"
            :disabled="relationsSaving"
            @click="showRelationPicker = true"
          >
            {{ relationsSaving ? 'Добавление...' : 'Добавить связь' }}
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
                  <button type="button" class="btn-link danger" @click="removeRelation(r.id)">Удалить</button>
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api/client'
import { togafApi } from '../api'
import RelationPickerModal from '../components/RelationPickerModal.vue'
import EntityLinksTableGraph from '../components/EntityLinksTableGraph.vue'
import { fetchEntity } from '../api/graphApi'
import { nodeId } from '../utils/entityTypeConfig'
import { useFormListReturn } from '../composables/useFormListReturn'
import { usePermissions } from '../composables/usePermissions'
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
const saving = ref(false)
const submitError = ref('')
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
const relations = ref([])
const relationsLoading = ref(false)
const relationsSaving = ref(false)
const entityTypes = ref([])
const relationTypes = ref([])
const showRelationPicker = ref(false)

/** Строки таблицы связей с подставленными видимыми именами */
const relationRows = ref([])

const gapCenterNodeId = computed(() => (isEdit.value && id.value ? nodeId('gap', Number(id.value)) : null))

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
    form.value.name?.trim() || form.value.code?.trim() || (id.value ? `Долг #${id.value}` : '—')
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
  loading.value = false
  // Черновик ИИ-архитектора применяем после загрузки: данные НЕ сохраняются — пользователь сохраняет сам.
  applyAiPrefill()
}

async function submit() {
  if (!canWrite.value) return
  saving.value = true
  submitError.value = ''
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
  try {
    if (isEdit.value) {
      await api.updateGap(id.value, body)
    } else {
      const res = await api.createGap(body)
      router.push(routeWithListSearch(`/architecture-debt/${res.id}/edit`))
      return
    }
  } catch (e) {
    submitError.value = e.message || e.body?.error || 'Ошибка сохранения'
  } finally {
    saving.value = false
  }
}

async function loadRelations() {
  if (!isEdit.value) return
  relationsLoading.value = true
  try {
    entityTypes.value = await togafApi.entityTypes()
    relationTypes.value = await togafApi.relationTypes()
    relations.value = await api.getGapRelations(id.value)
    await enrichRelationRows()
  } catch (e) {
    relations.value = []
    relationRows.value = []
  } finally {
    relationsLoading.value = false
  }
}

async function onRelationPicked(payload) {
  if (!canWrite.value) return
  if (!payload.to_entity_type || !payload.to_entity_id || !payload.relation_type) return
  relationsSaving.value = true
  try {
    await api.addGapRelation(id.value, {
      to_entity_type: payload.to_entity_type,
      to_entity_id: payload.to_entity_id,
      relation_type: payload.relation_type,
      name: payload.name || undefined,
    })
    relations.value = await api.getGapRelations(id.value)
    await enrichRelationRows()
  } catch (e) {
    alert(e.message || 'Ошибка добавления связи')
  } finally {
    relationsSaving.value = false
  }
}

async function removeRelation(relId) {
  if (!canWrite.value) return
  if (!confirm('Удалить связь?')) return
  try {
    await togafApi.deleteRelation(relId)
    relations.value = await api.getGapRelations(id.value)
    await enrichRelationRows()
  } catch (e) {
    alert(e.message || 'Ошибка удаления')
  }
}

watch(
  () => [form.value.name, form.value.code],
  () => {
    if (activeTab.value === 'relations' && relations.value.length) enrichRelationRows()
  }
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
.actions-bottom {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--ar-border);
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
</style>

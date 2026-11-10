<template>
  <div class="page">
    <div class="page-head">
      <h1>{{ formTitle }}</h1>
      <router-link v-if="returnToConclusion" :to="returnConclusionPath" class="btn btn-secondary">← Возврат</router-link>
      <router-link v-else :to="listRouteLocation" class="btn btn-secondary">← К списку</router-link>
    </div>

    <div class="tabs">
      <button :class="['tab', { active: activeTab === 'data' }]" @click="activeTab = 'data'">
        Данные системы<span v-if="headerDirty" class="tab-dot" title="Есть несохранённые изменения">•</span>
      </button>
      <button :class="['tab', { active: activeTab === 'tech' }]" @click="activeTab = 'tech'; loadTechStack()">
        Технологический стек<span
          v-if="techDraftDirty"
          class="tab-dot"
          :title="`Изменений без сохранения: ${techDraftCount}`"
        >•</span>
      </button>
      <button :class="['tab', { active: activeTab === 'integrations' }]" @click="activeTab = 'integrations'; loadIntegrationFlows()">
        Интеграции
      </button>
    </div>

    <div v-if="loading && activeTab === 'data'" class="loading">Загрузка...</div>
    <form v-else-if="activeTab === 'data'" class="card form" @submit.prevent="submit()">
      <p v-if="isEdit && !canWrite" class="readonly-banner">Режим просмотра: нет права <code>system:write</code>.</p>
      <!-- Черновик ИИ-архитектора (issue #78): применяется только к новой системе, НЕ сохраняется -->
      <p v-if="prefillNotice" class="readonly-banner prefill-banner">{{ prefillNotice }}</p>
      <fieldset class="form-fieldset" :disabled="!canWrite">
      <div class="form-grid">
        <div class="field">
          <label>Код <span class="req">*</span></label>
          <input ref="codeInput" v-model="form.code" required :maxlength="sysCodeMaxLen" placeholder="Напр. SUD3" />
        </div>
        <div class="field">
          <label>Краткое наименование <span class="req">*</span></label>
          <input ref="nameInput" v-model="form.name" required placeholder="Напр. СУД.Keycloak" />
        </div>
        <div class="field field-wide">
          <label>Полное наименование</label>
          <input v-model="form.fullname" placeholder="Модуль Keycloak системы СУД" />
        </div>
        <div class="field">
          <label>Родительская система</label>
          <select v-model="form.parent_ar_systems_id">
            <option :value="null">—</option>
            <option v-for="p in parentSystems" :key="p.id" :value="p.id">{{ p.display_name || p.name }}</option>
          </select>
        </div>
        <div class="field">
          <label>Статус</label>
          <select v-model="form.ar_system_statuses_id">
            <option :value="null">—</option>
            <option v-for="s in statuses" :key="s.id" :value="s.id">{{ s.display_name || s.name }}</option>
          </select>
        </div>
        <div class="field">
          <label>Внешняя система</label>
          <select v-model="form.external_system">
            <option :value="false">Нет</option>
            <option :value="true">Да</option>
          </select>
        </div>
        <PartnerSelectField
          v-model="form.vendor_ar_partners_id"
          label="Вендор"
          :options="vendors"
          @partner-created="mergePartner"
        />
        <PartnerSelectField
          v-model="form.supplier_ar_partners_id"
          label="Поставщик"
          :options="vendors"
          @partner-created="mergePartner"
        />
        <PartnerSelectField
          v-model="form.supporter_ar_partners_id"
          label="Партнёр по поддержке"
          :options="vendors"
          @partner-created="mergePartner"
        />
        <div class="field">
          <label>Владелец (направление)</label>
          <select v-model="form.ar_system_owners_id">
            <option :value="null">—</option>
            <option v-for="o in owners" :key="o.id" :value="o.id">{{ o.display_name || o.name }}</option>
          </select>
        </div>
        <div class="field">
          <label>Тип хостинга</label>
          <select v-model="form.ar_system_hosting_types_id">
            <option :value="null">—</option>
            <option v-for="h in hostingTypes" :key="h.id" :value="h.id">{{ h.display_name || h.name }}</option>
          </select>
        </div>
        <div class="field">
          <label>Ответственный от ИТ</label>
          <select v-model="form.it_lead_employee_id">
            <option :value="null">—</option>
            <option v-for="emp in employees" :key="emp.id" :value="emp.id">{{ emp.display_name || emp.full_name }}</option>
          </select>
        </div>
        <div class="field">
          <label>Владелец системы (бизнес)</label>
          <select v-model="form.business_lead_employee_id">
            <option :value="null">—</option>
            <option v-for="emp in employees" :key="'b-' + emp.id" :value="emp.id">{{ emp.display_name || emp.full_name }}</option>
          </select>
        </div>
        <div class="field field-wide">
          <label>Описание</label>
          <textarea v-model="form.description" rows="3"></textarea>
        </div>
        <div class="field field-wide">
          <label>Примечание</label>
          <input v-model="form.comment" />
        </div>
      </div>
      </fieldset>
    </form>

    <!-- Вкладка "Технологический стек" — срез карточки ИС (system:read / system:write) -->
    <div v-else-if="activeTab === 'tech'" class="card tech-stack">
      <p v-if="!canWrite" class="readonly-banner">Режим просмотра: нет права <code>system:write</code>.</p>
      <EntityLinksTableGraph
        :loading="techStackLoading"
        :relations="techStackGraphRelations"
        :center-node-id="systemTechGraphCenterNodeId"
        graph-height="780px"
      >
        <template #hint>
          Технологический стек из метамодели. На графе отображаются только связи из таблицы слева; тип связи задаётся
          на сервере (корневая ИС / модуль).
          <template v-if="techDraftDirty">
            Изменений без сохранения: {{ techDraftCount }} — они применятся по кнопке «Сохранить» внизу страницы.
          </template>
        </template>
        <template #toolbar>
          <div v-if="canWrite" class="tech-add">
            <select v-model="selectedTechnologyId" class="tech-select">
              <option value="">— Выберите технологию —</option>
              <option v-for="t in availableTechnologies" :key="t.id" :value="t.id">{{ t.display_name || t.name }}</option>
            </select>
            <button type="button" class="btn btn-primary btn-sm" :disabled="!selectedTechnologyId" @click="addTechnologyLink">
              Добавить связь
            </button>
          </div>
        </template>
        <template #table>
          <table class="table">
            <thead>
              <tr>
                <th>Технология</th>
                <th v-if="canWrite"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="link in systemTechnologies" :key="link.id">
                <td>{{ link.technology_name }}</td>
                <td v-if="canWrite">
                  <button type="button" class="btn-link danger" @click="removeTechnologyLink(link)">Удалить</button>
                </td>
              </tr>
            </tbody>
          </table>
          <p v-if="!techStackLoading && systemTechnologies.length === 0" class="empty">
            Нет связанных технологий.
            <template v-if="canWrite"> Выберите технологию из каталога и добавьте связь.</template>
          </p>
        </template>
      </EntityLinksTableGraph>
    </div>

    <!-- Вкладка "Интеграции" — срез карточки ИС (system:read); переход в карточку потока — integration_flow:* -->
    <div v-else-if="activeTab === 'integrations'" class="card integrations-tab">
      <p v-if="!canWrite" class="readonly-banner">Режим просмотра: нет права <code>system:write</code>.</p>
      <p class="tab-hint">Интеграционные потоки, где эта система — источник или получатель.</p>
      <p v-if="!isEdit" class="empty">
        Список появится после сохранения системы: интеграционный поток — отдельная сущность со своей карточкой.
      </p>
      <div v-if="isEdit && integrationFlowsError" class="error integration-flows-err">{{ integrationFlowsError }}</div>
      <div v-else-if="isEdit && integrationsLoading" class="loading">Загрузка...</div>
      <table v-else-if="isEdit" class="table">
        <thead>
          <tr>
            <th>Система источник</th>
            <th>Система получатель</th>
            <th>Тип события</th>
            <th>Передаваемые данные</th>
            <th>Способ передачи</th>
            <th>Статус</th>
            <th v-if="canReadIntegration"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in integrationFlows" :key="row.id">
            <td>
              <router-link v-if="row.source_ar_systems_id" :to="`/systems/${row.source_ar_systems_id}/edit`" class="link">{{ row.source_name ?? '—' }}</router-link>
              <span v-else>—</span>
            </td>
            <td>
              <router-link v-if="row.target_ar_systems_id" :to="`/systems/${row.target_ar_systems_id}/edit`" class="link">{{ row.target_name ?? '—' }}</router-link>
              <span v-else>—</span>
            </td>
            <td>{{ row.event_type_name ?? '—' }}</td>
            <td>{{ row.transferred_data ?? '—' }}</td>
            <td>{{ row.transfer_method ?? '—' }}</td>
            <td>{{ row.status_name ?? '—' }}</td>
            <td v-if="canReadIntegration">
              <router-link
                :to="`/integrations/${row.id}/edit`"
                class="link"
              >
                {{ canWriteIntegration ? 'Изменить' : 'Открыть' }}
              </router-link>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="isEdit && !integrationsLoading && integrationFlows.length === 0" class="empty">Нет интеграционных потоков с участием этой системы.</p>
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
        <router-link v-if="returnToConclusion" :to="returnConclusionPath" class="btn btn-secondary">
          {{ canWrite ? 'Отмена' : 'Назад' }}
        </router-link>
        <router-link v-else :to="listRouteLocation" class="btn btn-secondary">
          {{ canWrite ? 'Отмена' : 'К списку' }}
        </router-link>
      </template>
    </SaveBar>

  </div>
</template>

<script setup>
import { ref, reactive, computed, nextTick, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUnsavedGuard } from '../composables/useUnsavedGuard'
import { useFormListReturn } from '../composables/useFormListReturn'
import { usePermissions } from '../composables/usePermissions'
import { api } from '../api/client'
import { togafApi } from '../api'
import { getConfig } from '@/config/params'
import EntityLinksTableGraph from '../components/EntityLinksTableGraph.vue'
import PartnerSelectField from '../components/PartnerSelectField.vue'
import SaveBar from '../components/SaveBar.vue'
import { useCollectionDraft } from '../composables/useCollectionDraft'
import { useFormDirty } from '../composables/useFormDirty'
import { useSaveStatus } from '../composables/useSaveStatus'
import { nodeId } from '../utils/entityTypeConfig'
import { useAiPrefill } from '../composables/useAiPrefill'

const sysCodeMaxLen = computed(() => (getConfig().SYS_CODE_MAXLEN ?? 32) | 0)

const route = useRoute()
const router = useRouter()
const { listRouteLocation, routeWithListSearch } = useFormListReturn('/systems')
const { canWrite } = usePermissions('system')
const { canRead: canReadIntegration, canWrite: canWriteIntegration } = usePermissions('integration_flow')
const id = computed(() => route.params.id)
const isEdit = computed(() => !!id.value)
const formTitle = computed(() => {
  if (!isEdit.value) return 'Новая система'
  return canWrite.value ? 'Редактирование системы' : 'Просмотр системы'
})

const returnToConclusion = computed(() => route.query.returnTo === 'decision-applied-edit' || route.query.returnTo === 'decision-applied-new')
const returnConclusionPath = computed(() => {
  const q = {}
  if (route.query.payload) q.payload = route.query.payload
  if (route.query.appliedId) q.appliedId = route.query.appliedId
  const path = route.query.appliedId ? `/decisions/applied/${route.query.appliedId}/edit` : '/decisions/applied/new'
  return { path, query: q }
})

const loading = ref(false)
const codeInput = ref(null)
const nameInput = ref(null)
const parentSystems = ref([])
const statuses = ref([])
const vendors = ref([])

function mergePartner(partner) {
  if (!partner?.id) return
  if (!vendors.value.some((v) => v.id === partner.id)) {
    vendors.value = [...vendors.value, partner].sort((a, b) =>
      String(a.display_name || a.name).localeCompare(String(b.display_name || b.name), 'ru'),
    )
  }
}

const owners = ref([])
const hostingTypes = ref([])
const employees = ref([])

const activeTab = ref('data')

/**
 * Технологический стек — локальный черновик (issue #94): вкладку можно заполнять до
 * сохранения системы, накопленные связи применяются вместе с формой.
 */
const techDraft = useCollectionDraft()
const systemTechnologies = techDraft.items
const techDraftDirty = techDraft.isDirty
const techDraftCount = techDraft.dirtyCount
const allTechnologies = ref([])
const techStackLoading = ref(false)
/** Справочник типов связей: нужен для подписи строк стека, которые ещё не сохранены (issue #94). */
const techRelationTypes = ref([])
const selectedTechnologyId = ref('')
const integrationFlows = ref([])

const integrationsLoading = ref(false)
const integrationFlowsError = ref('')

const availableTechnologies = computed(() => {
  const linkedIds = new Set(systemTechnologies.value.map(l => l.technologies_id))
  return allTechnologies.value.filter(t => !linkedIds.has(t.id))
})

/**
 * Тип конца «система» в связях стека: сервер выбирает его по наличию родителя
 * (`system` — корневая ИС, `subsystem` — модуль, issues #44/#45). Для строк черновика
 * берём тип из сохранённых строк, а если их нет — из формы.
 */
const systemTechFromType = computed(() => {
  const known = systemTechnologies.value.find((l) => l.from_entity_type)
  if (known) return known.from_entity_type
  return form.parent_ar_systems_id != null ? 'subsystem' : 'system'
})

/** Тип связи «система → технология» из справочника — только когда он однозначен. */
const systemTechRelationType = computed(() => {
  const candidates = techRelationTypes.value.filter(
    (rt) => rt.from_entity_type_code === systemTechFromType.value && rt.to_entity_type_code === 'technology'
  )
  return candidates.length === 1 ? candidates[0] : null
})

/**
 * Связи для графа (только строки таблицы стека; формат метамодели).
 * У строк черновика (issue #94) нет `systems_id` / `from_entity_type` / `relation_type_name`:
 * конец «система» и подпись связи берём из формы и справочника, иначе граф рисовал
 * фантомный узел `system:NaN` отдельно от центральной ИС и код типа вместо «Использует».
 */
const techStackGraphRelations = computed(() => {
  const systemId = Number(id.value)
  if (!Number.isFinite(systemId) || !systemTechnologies.value.length) return []
  const fromType = systemTechFromType.value
  const refType = systemTechRelationType.value
  return systemTechnologies.value.map((l) => ({
    id: l.id,
    from_entity_type: l.from_entity_type || fromType,
    from_entity_id: Number(l.systems_id ?? systemId),
    to_entity_type: 'technology',
    to_entity_id: Number(l.technologies_id),
    relation_type: l.relation_type || refType?.code || 'system_technology',
    relation_type_name: l.relation_type_name || refType?.name || '',
  }))
})

const systemTechGraphCenterNodeId = computed(() => {
  const systemId = Number(id.value)
  if (!Number.isFinite(systemId)) return null
  return nodeId(systemTechFromType.value, systemId)
})

const form = reactive({
  code: '', name: '', fullname: '', parent_ar_systems_id: null, parent_name: '',
  ar_system_statuses_id: null, vendor_ar_partners_id: null, supplier_ar_partners_id: null,
  supporter_ar_partners_id: null, description: '',
  it_lead_employee_id: null, business_lead_employee_id: null,
  ar_system_owners_id: null, ar_system_hosting_types_id: null, comment: '',
  external_system: false,
})

/** Правки шапки формы: снимок берётся после загрузки записи и после сохранения (issue #94). */
const { isDirty: headerDirty, markSaved: markHeaderSaved } = useFormDirty(() => form)

/** Есть несохранённые изменения: шапка формы или черновик вкладки «Технологический стек». */
const isDirty = computed(() => headerDirty.value || techDraftDirty.value)

/** Состояние панели сохранения: «сохранение → сохранено → ошибка» + текст ошибки. */
const {
  saving,
  savedOk,
  submitError,
  startSaving,
  markSaved: markSavedOk,
  markError,
} = useSaveStatus({ dirty: isDirty })

function emptyForm() {
  form.code = ''; form.name = ''; form.fullname = ''; form.parent_ar_systems_id = null; form.parent_name = ''
  form.ar_system_statuses_id = null; form.vendor_ar_partners_id = null; form.supplier_ar_partners_id = null
  form.supporter_ar_partners_id = null; form.description = ''
  form.it_lead_employee_id = null; form.business_lead_employee_id = null
  form.ar_system_owners_id = null; form.ar_system_hosting_types_id = null; form.comment = ''
  form.external_system = false
}

function mapToForm(row) {
  if (!row) return
  form.code = row.code ?? ''; form.name = row.name ?? ''; form.fullname = row.fullname ?? ''
  form.parent_ar_systems_id = row.parent_ar_systems_id ?? null; form.parent_name = row.parent_name ?? ''
  form.ar_system_statuses_id = row.ar_system_statuses_id ?? null
  form.vendor_ar_partners_id = row.vendor_ar_partners_id ?? null
  form.supplier_ar_partners_id = row.supplier_ar_partners_id ?? null
  form.supporter_ar_partners_id = row.supporter_ar_partners_id ?? null
  form.description = row.description ?? ''
  form.it_lead_employee_id = row.it_lead_employee_id ?? null
  form.business_lead_employee_id = row.business_lead_employee_id ?? null
  form.ar_system_owners_id = row.ar_system_owners_id ?? null
  form.ar_system_hosting_types_id = row.ar_system_hosting_types_id ?? null
  form.comment = row.comment ?? ''
  form.external_system = !!row.external_system
}

/**
 * Черновик ИИ-архитектора (issue #78, docs/ai-architect.md §7): новый контракт не вводится —
 * используется тот же `?payload=<base64>`, что и в переходе «архитектурное заключение → новая система»
 * (см. DecisionAppliedForm.vue). Поля только подставляются: сохранение остаётся за пользователем.
 * Работает и на форме изменения (`prefill_form` с `mode: 'edit'`): на `/systems/:id/edit` payload
 * приходит только от ИИ, а сценарий возврата к заключению всегда ведёт на `/systems/new`.
 * Белый список полей совпадает с `prefillFields.system` в `backend/ai/tools.js`.
 */
const { prefillNotice, applyAiPrefill } = useAiPrefill({
  entity: 'Информационная система',
  target: () => form,
  fields: {
    name: 'string',
    fullname: 'string',
    description: 'string',
    comment: 'string',
    external_system: 'boolean',
  },
  // Поля `technologies` в форме нет: связи добавляются на вкладке «Технологический стек».
  manualHints: {
    technologies: (value) =>
      `Технологии (${value}) добавьте на вкладке «Технологический стек» — они сохранятся вместе с формой.`,
  },
  // Код системы в черновике не приходит: на форме создания его нужно заполнить самому.
  unsavedHint: () =>
    isEdit.value
      ? 'Данные не сохранены: проверьте поля и сохраните форму.'
      : 'Данные не сохранены: проверьте поля (код системы обязателен) и сохраните форму.',
})

/** В сценарии возврата к заключению payload описывает черновик ADR — его не применяем. */
function applyAiPrefillForRoute() {
  if (returnToConclusion.value) return
  applyAiPrefill()
}

async function loadRefs() {
  const [parents, st, v, o, h, em] = await Promise.all([
    api.getParentSystems(), api.getSystemStatuses(), api.getVendors(), api.getOwners(), api.getHostingTypes(),
    api.getEmployees(),
  ])
  parentSystems.value = parents; statuses.value = st; vendors.value = v; owners.value = o; hostingTypes.value = h
  employees.value = em
}

/**
 * Загрузка карточки: справочники + запись. Вызывается при открытии и при смене `id`
 * (в т.ч. после создания записи: форма сама становится карточкой редактирования).
 */
async function load() {
  submitError.value = ''
  await loadRefs()
  if (isEdit.value) {
    loading.value = true
    try {
      const row = await api.getSystem(id.value)
      mapToForm(row)
      markHeaderSaved()
      // Черновик ИИ поверх загруженной записи (prefill_form, mode: 'edit'); сохранение — вручную.
      applyAiPrefillForRoute()
    } catch (e) {
      markError(e.body?.error || e.message || 'Ошибка загрузки')
    } finally { loading.value = false }
  } else {
    emptyForm()
    markHeaderSaved()
    applyAiPrefillForRoute()
  }
}

onMounted(load)
watch(id, load)

/**
 * Каталог технологий нужен и в режиме создания (вкладка доступна без сохранения);
 * связи подгружаются только когда у системы уже есть `id`.
 */
async function loadTechStack({ force = false } = {}) {
  techStackLoading.value = true
  try {
    const [techs, links, relationTypes] = await Promise.all([
      api.getTechnologies(),
      isEdit.value && id.value ? api.getSystemsTechnologies({ system_id: id.value }) : Promise.resolve([]),
      // Подписи связей для строк черновика: недоступность справочника не блокирует вкладку.
      togafApi.relationTypes().catch(() => []),
    ])
    allTechnologies.value = techs
    techRelationTypes.value = Array.isArray(relationTypes) ? relationTypes : []
    // Черновик не затираем: незаписанные связи должны пережить переключение вкладок.
    if (force || !techDraft.isDirty.value) techDraft.reset(links)
  } catch (e) {
    submitError.value = e.body?.error || e.message || 'Ошибка загрузки технологий'
  } finally {
    techStackLoading.value = false
  }
}

async function loadIntegrationFlows() {
  if (!isEdit.value || !id.value) return
  integrationsLoading.value = true
  integrationFlowsError.value = ''
  try {
    integrationFlows.value = await api.getIntegrationFlows({ system_id: id.value })
  } catch (e) {
    const msg = e.body?.error || e.message || 'Ошибка загрузки интеграций'
    integrationFlowsError.value = msg
    integrationFlows.value = []
  } finally {
    integrationsLoading.value = false
  }
}

/** Добавление связи — только в локальный черновик: в API уйдёт вместе с формой. */
function addTechnologyLink() {
  if (!canWrite.value || !selectedTechnologyId.value) return
  const tech = allTechnologies.value.find((t) => String(t.id) === String(selectedTechnologyId.value))
  if (!tech) return
  techDraft.add({ technologies_id: tech.id, technology_name: tech.display_name || tech.name })
  selectedTechnologyId.value = ''
}

/** Удаление связи: существующая помечается на удаление, добавленная локально — просто убирается. */
function removeTechnologyLink(link) {
  if (!canWrite.value || !link) return
  if (!link._local && !confirm('Удалить связь с технологией? Изменение применится после сохранения формы.')) return
  techDraft.remove(link)
}

/**
 * Применить черновик вкладки после сохранения шапки: сначала удаления, затем добавления.
 * Возвращает неприменённые операции — форма показывает их как частичный успех и даёт повторить.
 */
async function applyTechDraft(systemId) {
  const { added, removedIds } = techDraft.diff()
  const failures = []
  const failedAdds = []
  for (const linkId of removedIds) {
    try {
      await api.deleteSystemTechnology(linkId)
    } catch (e) {
      failures.push(`не удалена связь #${linkId} (${e.body?.error || e.message || 'ошибка'})`)
    }
  }
  for (const row of added) {
    try {
      await api.createSystemTechnology({ systems_id: systemId, technologies_id: row.technologies_id })
    } catch (e) {
      failedAdds.push(row)
      failures.push(
        `не добавлена технология «${row.technology_name || '#' + row.technologies_id}» (${e.body?.error || e.message || 'ошибка'})`,
      )
    }
  }
  return { failures, failedAdds }
}

/** Для FK в API: пустой выбор → null (иначе node-pg падает на undefined после JSON.stringify) */
function fkOrNull(v) {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Проверка обязательных полей шапки. Если чего-то не хватает — показываем вкладку
 * «Данные системы» и ставим фокус на пустое поле (вкладки при этом не блокируются).
 */
async function validateHeader() {
  if (form.code.trim() && form.name.trim()) return true
  activeTab.value = 'data'
  submitError.value = 'Заполните обязательные поля: код и краткое наименование системы.'
  await nextTick()
  ;(form.code.trim() ? nameInput.value : codeInput.value)?.focus()
  return false
}

/**
 * Единая точка сохранения страницы (issue #94): шапка формы + черновик вкладки.
 * @param {{ close?: boolean, skipNavigate?: boolean }} opts
 *   close — «Сохранить и закрыть» (вернуться к списку/заключению);
 *   skipNavigate — сохранение перед уходом со страницы (guard), без перехода.
 * @returns {Promise<boolean>} true, если всё сохранилось без ошибок.
 */
async function submit(opts = {}) {
  if (!canWrite.value || saving.value) return false
  if (!(await validateHeader())) return false
  startSaving()
  try {
    const body = {
      code: form.code.trim(),
      name: form.name.trim(),
      fullname: form.fullname?.trim() || undefined,
      parent_ar_systems_id: fkOrNull(form.parent_ar_systems_id),
      ar_system_statuses_id: fkOrNull(form.ar_system_statuses_id),
      vendor_ar_partners_id: fkOrNull(form.vendor_ar_partners_id),
      supplier_ar_partners_id: fkOrNull(form.supplier_ar_partners_id),
      supporter_ar_partners_id: fkOrNull(form.supporter_ar_partners_id),
      description: form.description?.trim() || undefined,
      it_lead_employee_id: fkOrNull(form.it_lead_employee_id),
      business_lead_employee_id: fkOrNull(form.business_lead_employee_id),
      ar_system_owners_id: fkOrNull(form.ar_system_owners_id),
      ar_system_hosting_types_id: fkOrNull(form.ar_system_hosting_types_id),
      comment: form.comment?.trim() || undefined,
      external_system: form.external_system,
      technologies: '', // поле убрано с формы, передаём пустую строку для API
    }
    let systemId = isEdit.value ? id.value : null
    if (isEdit.value) {
      await api.updateSystem(id.value, body)
    } else {
      const res = await api.createSystem(body)
      systemId = res.id
    }

    // Вкладки: применяем накопленный черновик (в режиме создания — уже с реальным id).
    const { failures, failedAdds } = await applyTechDraft(systemId)
    markHeaderSaved()
    if (failures.length) {
      // Частичный успех: перечитываем применённое, неприменённое возвращаем в черновик.
      await loadTechStack({ force: true })
      for (const row of failedAdds) {
        techDraft.add({ technologies_id: row.technologies_id, technology_name: row.technology_name })
      }
      markError(`Сохранено частично: ${failures.join('; ')}. Повторите сохранение.`)
      return false
    }
    await loadTechStack({ force: true })
    markSavedOk()
    if (opts.skipNavigate) return true
    // Сценарий «система создаётся из архитектурного заключения»: черновик ADR возвращается назад.
    if (!isEdit.value && returnToConclusion.value && route.query.payload != null) {
      const q = { payload: route.query.payload }
      if (route.query.appliedId) q.appliedId = route.query.appliedId
      q.newSystemId = systemId
      const path = route.query.appliedId ? `/decisions/applied/${route.query.appliedId}/edit` : '/decisions/applied/new'
      await router.push({ path, query: q })
      return true
    }
    if (opts.close) {
      await router.push(returnToConclusion.value ? returnConclusionPath.value : listRouteLocation.value)
      return true
    }
    if (!isEdit.value) {
      // Остаёмся на форме: дальше это карточка редактирования с уже доступными вкладками.
      await router.replace(routeWithListSearch(`/systems/${systemId}/edit`))
    }
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

.tech-stack {
  margin-top: 0;
}
.tech-stack :deep(.entity-links-toolbar) {
  border-bottom-color: var(--ar-border);
}
.tech-add {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.tech-select {
  min-width: 220px;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  font-size: 0.9rem;
  background: var(--ar-surface);
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
.tab-hint {
  font-size: 0.9rem;
  color: var(--ar-muted);
  margin-bottom: 1rem;
}
.integration-flows-err {
  margin-bottom: 1rem;
}
.integrations-tab {
  margin-top: 0;
}
</style>

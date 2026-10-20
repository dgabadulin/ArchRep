<template>
  <div class="page">
    <div class="page-head">
      <h1>{{ formTitle }}</h1>
      <router-link v-if="returnToConclusion" :to="returnConclusionPath" class="btn btn-secondary">← Возврат</router-link>
      <router-link v-else :to="listRouteLocation" class="btn btn-secondary">← К списку</router-link>
    </div>

    <template v-if="isEdit">
      <div class="tabs">
        <button :class="['tab', { active: activeTab === 'data' }]" @click="activeTab = 'data'">Данные системы</button>
        <button :class="['tab', { active: activeTab === 'tech' }]" @click="activeTab = 'tech'; loadTechStack()">Технологический стек</button>
        <button :class="['tab', { active: activeTab === 'integrations' }]" @click="activeTab = 'integrations'; loadIntegrationFlows()">Интеграции</button>
      </div>
    </template>

    <div v-if="loading && isEdit && activeTab === 'data'" class="loading">Загрузка...</div>
    <form v-else-if="activeTab === 'data' || !isEdit" class="card form" @submit.prevent="submit">
      <p v-if="isEdit && !canWrite" class="readonly-banner">Режим просмотра: нет права <code>system:write</code>.</p>
      <!-- Черновик ИИ-архитектора (issue #78): применяется только к новой системе, НЕ сохраняется -->
      <p v-if="prefillNotice" class="readonly-banner prefill-banner">{{ prefillNotice }}</p>
      <fieldset class="form-fieldset" :disabled="!canWrite">
      <div class="form-grid">
        <div class="field">
          <label>Код <span class="req">*</span></label>
          <input v-model="form.code" required :maxlength="sysCodeMaxLen" placeholder="Напр. SUD3" />
        </div>
        <div class="field">
          <label>Краткое наименование <span class="req">*</span></label>
          <input v-model="form.name" required placeholder="Напр. СУД.Keycloak" />
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
      <div v-if="submitError" class="error">{{ submitError }}</div>
      <div class="actions">
        <button
          v-if="canWrite"
          type="submit"
          class="btn btn-primary"
          :disabled="saving"
        >
          {{ saving ? 'Сохранение...' : 'Сохранить' }}
        </button>
        <router-link v-if="returnToConclusion" :to="returnConclusionPath" class="btn btn-secondary">
          {{ canWrite ? 'Отмена' : 'Назад' }}
        </router-link>
        <router-link v-else :to="listRouteLocation" class="btn btn-secondary">
          {{ canWrite ? 'Отмена' : 'К списку' }}
        </router-link>
      </div>
    </form>

    <!-- Вкладка "Технологический стек" — срез карточки ИС (system:read / system:write) -->
    <div v-else-if="isEdit && activeTab === 'tech'" class="card tech-stack">
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
        </template>
        <template #toolbar>
          <div v-if="canWrite" class="tech-add">
            <select v-model="selectedTechnologyId" class="tech-select">
              <option value="">— Выберите технологию —</option>
              <option v-for="t in availableTechnologies" :key="t.id" :value="t.id">{{ t.display_name || t.name }}</option>
            </select>
            <button type="button" class="btn btn-primary btn-sm" :disabled="!selectedTechnologyId || techSaving" @click="addTechnologyLink">
              {{ techSaving ? 'Добавление...' : 'Добавить связь' }}
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
                  <button type="button" class="btn-link danger" @click="removeTechnologyLink(link.id)">Удалить</button>
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
    <div v-else-if="isEdit && activeTab === 'integrations'" class="card integrations-tab">
      <p v-if="!canWrite" class="readonly-banner">Режим просмотра: нет права <code>system:write</code>.</p>
      <p class="tab-hint">Интеграционные потоки, где эта система — источник или получатель.</p>
      <div v-if="integrationFlowsError" class="error integration-flows-err">{{ integrationFlowsError }}</div>
      <div v-else-if="integrationsLoading" class="loading">Загрузка...</div>
      <table v-else class="table">
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
      <p v-if="!integrationsLoading && integrationFlows.length === 0" class="empty">Нет интеграционных потоков с участием этой системы.</p>
    </div>

  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUnsavedGuard } from '../composables/useUnsavedGuard'
import { useFormListReturn } from '../composables/useFormListReturn'
import { usePermissions } from '../composables/usePermissions'
import { api } from '../api/client'
import { getConfig } from '@/config/params'
import EntityLinksTableGraph from '../components/EntityLinksTableGraph.vue'
import PartnerSelectField from '../components/PartnerSelectField.vue'
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
const saving = ref(false)
const submitError = ref('')
const isDirty = ref(false)
const initialLoadDone = ref(false)
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
const systemTechnologies = ref([])
const allTechnologies = ref([])
const techStackLoading = ref(false)
const techSaving = ref(false)
const selectedTechnologyId = ref('')
const newTechModal = ref(false)
const newTechForm = ref({ name: '', vendor_ar_partners_id: null })
const newTechSaving = ref(false)
const newTechError = ref('')
const integrationFlows = ref([])
const integrationsLoading = ref(false)
const integrationFlowsError = ref('')

const availableTechnologies = computed(() => {
  const linkedIds = new Set(systemTechnologies.value.map(l => l.technologies_id))
  return allTechnologies.value.filter(t => !linkedIds.has(t.id))
})

/** Связи для графа (только строки таблицы стека; формат метамодели). */
const techStackGraphRelations = computed(() => {
  if (!id.value || !systemTechnologies.value.length) return []
  return systemTechnologies.value.map((l) => ({
    id: l.id,
    from_entity_type: l.from_entity_type || 'system',
    from_entity_id: Number(l.systems_id),
    to_entity_type: 'technology',
    to_entity_id: Number(l.technologies_id),
    relation_type: l.relation_type || 'system_technology',
    relation_type_name: l.relation_type_name,
  }))
})

const systemTechGraphCenterNodeId = computed(() => {
  if (!id.value) return null
  const ft = systemTechnologies.value[0]?.from_entity_type || (form.parent_ar_systems_id != null ? 'subsystem' : 'system')
  return nodeId(ft, Number(id.value))
})

const form = reactive({
  code: '', name: '', fullname: '', parent_ar_systems_id: null, parent_name: '',
  ar_system_statuses_id: null, vendor_ar_partners_id: null, supplier_ar_partners_id: null,
  supporter_ar_partners_id: null, description: '',
  it_lead_employee_id: null, business_lead_employee_id: null,
  ar_system_owners_id: null, ar_system_hosting_types_id: null, comment: '',
  external_system: false,
})

function formSnapshot() {
  return {
    code: form.code,
    name: form.name,
    fullname: form.fullname,
    parent_ar_systems_id: form.parent_ar_systems_id,
    parent_name: form.parent_name,
    ar_system_statuses_id: form.ar_system_statuses_id,
    vendor_ar_partners_id: form.vendor_ar_partners_id,
    supplier_ar_partners_id: form.supplier_ar_partners_id,
    supporter_ar_partners_id: form.supporter_ar_partners_id,
    description: form.description,
    it_lead_employee_id: form.it_lead_employee_id,
    business_lead_employee_id: form.business_lead_employee_id,
    ar_system_owners_id: form.ar_system_owners_id,
    ar_system_hosting_types_id: form.ar_system_hosting_types_id,
    comment: form.comment,
    external_system: form.external_system,
  }
}

const lastLoadedSnapshot = ref(null)

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
  // Поля `technologies` в форме нет: связи добавляются вручную после сохранения системы.
  manualHints: {
    technologies: (value) =>
      `Технологии (${value}) нужно связать вручную на вкладке «Технологический стек» после сохранения системы.`,
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

onMounted(async () => {
  await loadRefs()
  if (isEdit.value) {
    loading.value = true
    try {
      const row = await api.getSystem(id.value)
      mapToForm(row)
      lastLoadedSnapshot.value = formSnapshot()
      // Черновик ИИ поверх загруженной записи (prefill_form, mode: 'edit'); сохранение — вручную.
      applyAiPrefillForRoute()
    } catch (e) {
      submitError.value = e.body?.error || e.message || 'Ошибка загрузки'
    } finally { loading.value = false }
  } else {
    emptyForm()
    lastLoadedSnapshot.value = formSnapshot()
    applyAiPrefillForRoute()
  }
  initialLoadDone.value = true
})

function isFormChanged() {
  const cur = formSnapshot()
  const prev = lastLoadedSnapshot.value
  if (!prev) return false
  return Object.keys(cur).some(k => {
    const a = cur[k]
    const b = prev[k]
    if (a === b) return false
    if (a == null && b == null) return false
    return String(a) !== String(b)
  })
}

watch(() => ({ ...form }), () => {
  if (!initialLoadDone.value) return
  isDirty.value = isFormChanged()
}, { deep: true })

watch(id, () => { if (!isEdit.value) emptyForm() })

async function loadTechStack() {
  if (!isEdit.value || !id.value) return
  techStackLoading.value = true
  try {
    const [links, techs] = await Promise.all([
      api.getSystemsTechnologies({ system_id: id.value }),
      api.getTechnologies(),
    ])
    systemTechnologies.value = links
    allTechnologies.value = techs
  } catch (e) {
    submitError.value = e.message || 'Ошибка загрузки технологий'
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

async function addTechnologyLink() {
  if (!canWrite.value || !selectedTechnologyId.value || !id.value) return
  techSaving.value = true
  try {
    await api.createSystemTechnology({ systems_id: id.value, technologies_id: selectedTechnologyId.value })
    selectedTechnologyId.value = ''
    await loadTechStack()
  } catch (e) {
    submitError.value = e.body?.error || e.message || 'Ошибка добавления связи'
  } finally {
    techSaving.value = false
  }
}

async function removeTechnologyLink(linkId) {
  if (!canWrite.value) return
  if (!confirm('Удалить связь с технологией?')) return
  try {
    await api.deleteSystemTechnology(linkId)
    await loadTechStack()
  } catch (e) {
    submitError.value = e.message || 'Ошибка удаления'
  }
}

/** Для FK в API: пустой выбор → null (иначе node-pg падает на undefined после JSON.stringify) */
function fkOrNull(v) {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

async function submit(opts = {}) {
  if (!canWrite.value) return
  submitError.value = ''
  saving.value = true
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
    if (isEdit.value) {
      await api.updateSystem(id.value, body)
      isDirty.value = false
      lastLoadedSnapshot.value = formSnapshot()
      if (!opts.skipNavigate) router.push(listRouteLocation.value)
    } else {
      const res = await api.createSystem(body)
      isDirty.value = false
      if (!opts.skipNavigate) {
        if (returnToConclusion.value && route.query.payload != null) {
          const q = { payload: route.query.payload }
          if (route.query.appliedId) q.appliedId = route.query.appliedId
          q.newSystemId = res.id
          const path = route.query.appliedId ? `/decisions/applied/${route.query.appliedId}/edit` : '/decisions/applied/new'
          router.push({ path, query: q })
        } else {
          router.push(routeWithListSearch(`/systems/${res.id}/edit`))
        }
      }
    }
  } catch (e) {
    submitError.value = e.message || e.body?.error || 'Ошибка сохранения'
    throw e
  } finally { saving.value = false }
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

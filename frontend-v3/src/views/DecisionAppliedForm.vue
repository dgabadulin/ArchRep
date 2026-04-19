<template>
  <div class="page">
    <div class="page-head">
      <h1>{{ isEdit ? 'Редактирование архитектурного заключения' : 'Новое архитектурное заключение' }}</h1>
      <router-link to="/decisions/applied" class="btn btn-secondary">← К реестру</router-link>
    </div>

    <div v-if="loading" class="loading">Загрузка...</div>
    <form v-else class="card form unified-form" @submit.prevent="submit">
      <!-- Верх: код + название в одной логической строке; ссылка и заключение — на всю ширину (без «рваной» сетки 1fr×3). -->
      <div class="form-head-row">
        <div class="field field-code">
          <label>Код</label>
          <input
            v-if="form.code"
            v-model="form.code"
            readonly
            class="readonly"
            :maxlength="adrCodeMaxLen"
          />
          <div v-else-if="isEdit" class="code-pending">Загрузка…</div>
          <p v-else class="code-hint">Присвоится после сохранения</p>
        </div>
        <div class="field field-task-name">
          <label>Наименование задачи</label>
          <input v-model="form.task_name" placeholder="Название задачи" :readonly="isFormReadOnly" />
        </div>
      </div>
      <div class="field field-wide">
        <label>Ссылка на задачу</label>
        <input v-model="form.task_link" placeholder="URL или идентификатор" :readonly="isFormReadOnly" />
      </div>
      <div class="field field-wide">
        <label>Архитектурные заключения</label>
        <textarea v-model="form.conclusion" rows="3" :readonly="isFormReadOnly"></textarea>
      </div>
      <div class="form-grid form-grid-narrow">
        <div class="field">
          <label>Статус</label>
          <select v-model="form.ar_adr_statuses_id">
            <option :value="null">—</option>
            <option v-for="s in adrStatuses" :key="s.id" :value="s.id">{{ s.display_name || s.name }}</option>
          </select>
        </div>
        <div class="field">
          <label>Автор</label>
          <input v-model="form.author" :readonly="isFormReadOnly" />
        </div>
      </div>

      <div class="card solutions-card">
        <h3 class="block-title">Решения</h3>
        <div class="block solutions-block">
        <div v-if="!isFormReadOnly" class="toolbar">
          <button
            type="button"
            class="btn btn-primary btn-sm"
            :disabled="!canManageIncrements"
            :title="!canManageIncrements ? 'Сначала сохраните заключение — появится код записи, затем можно добавлять решения.' : ''"
            @click="openIncrementModal()"
          >
            + Добавить решение
          </button>
        </div>
        <p v-if="!isEdit && !isFormReadOnly" class="hint solutions-prereq">
          Чтобы добавить решения, нажмите «Сохранить» внизу страницы — откроется редактирование сохранённого заключения.
        </p>
        <div v-if="incrementsLoading" class="loading">Загрузка...</div>
        <ul v-else class="increment-list">
          <li
            v-for="inc in increments"
            :key="inc.id"
            :class="['increment-item', { selected: selectedIncrementId === inc.id }]"
            @click="selectIncrement(inc.id)"
          >
            <span class="inc-order">{{ inc.order_index }}</span>
            <span class="inc-name">{{ inc.name || inc.type_name || 'Решение' }}</span>
            <span class="inc-type">{{ inc.type_name ?? '—' }}</span>
            <template v-if="!isFormReadOnly">
              <button type="button" class="btn-link btn-sm" @click.stop="openIncrementModal(inc)">Изменить</button>
              <button type="button" class="btn-link danger btn-sm" @click.stop="removeIncrement(inc.id)">Удалить</button>
            </template>
          </li>
        </ul>
        <p v-if="!incrementsLoading && increments.length === 0" class="empty">Нет решений. Добавьте решение.</p>
        </div>
      </div>

      <template v-if="selectedIncrementId">
        <div class="card block block-two-col">
          <div class="block-two-col-layout">
            <div class="block-two-col-head">
              <h3 class="block-title">Системы</h3>
              <button type="button" class="btn-link help-rules-link" @click="openHelpModal('systems')">
                Правила заполнения
              </button>
            </div>
            <div class="block-two-col-body">
              <div v-if="!isFormReadOnly" class="toolbar">
                <div class="add-row">
                  <select v-model="selectedSystemId" class="select">
                    <option value="">— Выберите систему —</option>
                    <option v-for="s in availableSystems" :key="s.id" :value="s.id">{{ s.display_name || s.name }}</option>
                  </select>
                  <select v-model="selectedSystemStatusId" class="select narrow">
                    <option value="">— Статус —</option>
                    <option v-for="st in adrSystemStatuses" :key="st.id" :value="st.id">{{ st.display_name || st.name }}</option>
                  </select>
                  <button type="button" class="btn btn-primary btn-sm" :disabled="!selectedSystemId || systemsSaving" @click="addSystem">Добавить</button>
                </div>
                <a href="#" class="btn btn-secondary btn-sm" @click.prevent="goToNewSystem">+ Новая система</a>
              </div>
              <div v-if="systemsLoading" class="loading">Загрузка...</div>
              <table v-else class="table">
                <thead><tr><th>Система</th><th>Статус</th><th>Функции</th><th v-if="!isFormReadOnly"></th></tr></thead>
                <tbody>
                  <tr v-for="row in incrementSystems" :key="row.id">
                    <td>{{ row.system_name }}</td>
                    <td>{{ row.status_name ?? '—' }}</td>
                    <td class="td-functions">
                      <div class="functions-cell">
                        <span class="functions-text">{{ row.comment?.trim() ? row.comment : '—' }}</span>
                        <button
                          v-if="!isFormReadOnly"
                          type="button"
                          class="btn-link btn-sm"
                          @click="openFunctionsModal(row)"
                        >
                          Функции…
                        </button>
                      </div>
                    </td>
                    <td v-if="!isFormReadOnly"><button type="button" class="btn-link danger" @click="removeSystem(row.id)">Удалить</button></td>
                  </tr>
                </tbody>
              </table>
              <p v-if="!systemsLoading && incrementSystems.length === 0" class="empty">Нет систем.</p>
            </div>
          </div>
        </div>

        <div class="card block block-two-col">
          <div class="block-two-col-layout">
            <div class="block-two-col-head">
              <h3 class="block-title">Интеграции</h3>
              <button type="button" class="btn-link help-rules-link" @click="openHelpModal('integrations')">
                Правила заполнения
              </button>
            </div>
            <div class="block-two-col-body">
              <div v-if="!isFormReadOnly" class="toolbar">
                <button type="button" class="btn btn-primary btn-sm" @click="openRelationModal()">+ Добавить интеграцию</button>
              </div>
              <div v-if="relationsLoading" class="loading">Загрузка...</div>
              <table v-else class="table">
                <thead><tr><th>Источник</th><th>Приёмник</th><th>Наименование</th><th>Статус</th><th v-if="!isFormReadOnly"></th></tr></thead>
                <tbody>
                  <tr v-for="row in incrementRelations" :key="row.id">
                    <td>{{ row.from_name ?? '—' }}</td>
                    <td>{{ row.to_name ?? '—' }}</td>
                    <td>{{ row.name || row.description || '—' }}</td>
                    <td>{{ row.status_name ?? '—' }}</td>
                    <td v-if="!isFormReadOnly">
                      <button type="button" class="btn-link" @click.stop="openRelationModal(row)">Изменить</button>
                      <button type="button" class="btn-link danger" @click.stop="removeRelation(row.id)">Удалить</button>
                    </td>
                  </tr>
                </tbody>
              </table>
              <p v-if="!relationsLoading && incrementRelations.length === 0" class="empty">Нет интеграций.</p>
            </div>
          </div>
        </div>

        <div class="card block block-two-col">
          <div class="block-two-col-layout">
            <div class="block-two-col-head">
              <h3 class="block-title">Схемы</h3>
            </div>
            <div class="block-two-col-body">
              <div v-if="!isFormReadOnly" class="toolbar diagram-toolbar">
                <button
                  type="button"
                  class="btn btn-primary btn-sm"
                  :disabled="!canManageIncrements || diagramsBusy"
                  @click="createIncrementDiagram"
                >
                  Создать схему решения
                </button>
              </div>
              <div v-if="diagramsLoading" class="loading">Загрузка диаграмм…</div>
              <table v-else class="table diagrams-table">
                <thead>
                  <tr>
                    <th>Имя файла</th>
                    <th>Создано</th>
                    <th>Изменено</th>
                    <th>Пользователь</th>
                    <th v-if="!isFormReadOnly">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in incrementDiagrams" :key="row.id">
                    <td>{{ diagramDisplayName(row) }}</td>
                    <td>{{ formatDiagramDate(row.created_at) }}</td>
                    <td>{{ formatDiagramDate(row.updated_at) }}</td>
                    <td>{{ row.last_edited_by || '—' }}</td>
                    <td v-if="!isFormReadOnly" class="diagrams-actions">
                      <button type="button" class="btn-link btn-sm" :disabled="diagramsBusy" @click="mergeIncrementDiagramRow(row)">Обновить</button>
                      <button type="button" class="btn-link btn-sm" :disabled="diagramsBusy" @click="openDiagramEditorTab(row)">Открыть</button>
                      <button type="button" class="btn-link btn-sm" :disabled="diagramsBusy" @click="downloadDiagramRow(row)">Скачать</button>
                      <button type="button" class="btn-link danger btn-sm" :disabled="diagramsBusy" @click="deleteDiagramRow(row)">Удалить</button>
                    </td>
                  </tr>
                </tbody>
              </table>
              <p v-if="!diagramsLoading && incrementDiagrams.length === 0" class="empty">Нет сохранённых схем. Нажмите «Создать схему решения».</p>
            </div>
          </div>
        </div>
      </template>
      <p v-else class="hint">Выберите решение в списке выше, чтобы заполнить системы и интеграции.</p>

      <div v-if="submitError" class="error">{{ submitError }}</div>
      <div class="actions actions-bottom">
        <button type="submit" class="btn btn-primary" :disabled="saving">{{ saving ? 'Сохранение...' : 'Сохранить' }}</button>
        <button type="button" class="btn btn-secondary" @click="cancel">Отмена</button>
      </div>
    </form>

    <!-- Модалка: решение (инкремент) -->
    <div v-if="incrementModal" class="modal-overlay">
      <div class="modal">
        <h3>{{ editingIncrementId ? 'Изменить решение' : 'Новое решение' }}</h3>
        <div class="form-row">
          <label>Порядок</label>
          <input v-model.number="incrementForm.order_index" type="number" min="1" />
        </div>
        <div class="form-row">
          <label>Наименование</label>
          <input v-model="incrementForm.name" placeholder="Напр. Временное решение — Инкремент 1" />
        </div>
        <div class="form-row">
          <label>Тип</label>
          <select v-model="incrementForm.ar_adr_increment_types_id">
            <option :value="null">—</option>
            <option v-for="t in incrementTypes" :key="t.id" :value="t.id">{{ t.display_name || t.name }}</option>
          </select>
        </div>
        <div v-if="incrementError" class="error">{{ incrementError }}</div>
        <div class="modal-actions">
          <button type="button" class="btn btn-primary" :disabled="incrementSaving" @click="saveIncrement">Сохранить</button>
          <button type="button" class="btn btn-secondary" @click="incrementModal = null">Отмена</button>
        </div>
      </div>
    </div>

    <!-- Модалка: интеграция -->
    <div v-if="relationModal" class="modal-overlay">
      <div class="modal">
        <h3>{{ editingRelationId ? 'Изменить интеграцию' : 'Новая интеграция' }}</h3>
        <div class="form-row">
          <label>Система-источник</label>
          <select v-model="relationForm.from_ar_systems_id">
            <option :value="null">—</option>
            <option v-for="s in systemsForIntegrations" :key="s.id" :value="s.id">{{ s.display_name || s.name }}</option>
          </select>
        </div>
        <div class="form-row">
          <label>Система-приёмник</label>
          <select v-model="relationForm.to_ar_systems_id">
            <option :value="null">—</option>
            <option v-for="s in systemsForIntegrations" :key="s.id" :value="s.id">{{ s.display_name || s.name }}</option>
          </select>
        </div>
        <div class="form-row">
          <label>Наименование</label>
          <input v-model="relationForm.name" />
        </div>
        <div class="form-row">
          <label>Описание</label>
          <textarea v-model="relationForm.description" rows="2"></textarea>
        </div>
        <div class="form-row">
          <label>Статус интеграции</label>
          <select v-model="relationForm.ar_adr_increment_relation_statuses_id">
            <option :value="null">—</option>
            <option v-for="st in adrRelationStatuses" :key="st.id" :value="st.id">{{ st.display_name || ((st.code ? st.code + ' — ' : '') + st.name) }}</option>
          </select>
        </div>
        <div v-if="relationError" class="error">{{ relationError }}</div>
        <div class="modal-actions">
          <button type="button" class="btn btn-primary" :disabled="relationSaving" @click="saveRelation">Сохранить</button>
          <button type="button" class="btn btn-secondary" @click="relationModal = null">Отмена</button>
        </div>
      </div>
    </div>

    <!-- Модалка: правила заполнения (системы / интеграции) -->
    <div v-if="helpModalKind" class="modal-overlay">
      <div class="modal modal-help" role="dialog" aria-modal="true" aria-labelledby="help-modal-title">
        <h3 id="help-modal-title">{{ helpModalTitle }}</h3>
        <div class="help-markdown modal-help-body" v-html="helpModalHtml"></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" @click="closeHelpModal">Закрыть</button>
        </div>
      </div>
    </div>

    <IncrementSystemFunctionsModal
      :show="functionsModalOpen"
      :row-id="functionsModalRow?.id"
      :system-id="functionsModalRow?.ar_systems_id"
      :system-name="functionsModalRow?.system_name || ''"
      @close="closeFunctionsModal"
      @saved="onFunctionsModalSaved"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUnsavedGuard } from '../composables/useUnsavedGuard'
import IncrementSystemFunctionsModal from '../components/IncrementSystemFunctionsModal.vue'
import { api } from '../api/client'
import { getConfig } from '@/config/params'
import helpSystemsText from '../content/architecture-conclusion-help-systems.md?raw'
import helpIntegrationsText from '../content/architecture-conclusion-help-integrations.md?raw'
import { marked } from 'marked'

const adrCodeMaxLen = computed(() => (getConfig().ADR_CODE_MAXLEN ?? 15) | 0)

const route = useRoute()
const router = useRouter()
const id = computed(() => route.params.id)
const isEdit = computed(() => !!id.value)

marked.setOptions({ gfm: true })
const helpSystemsHtml = computed(() => marked.parse(helpSystemsText || ''))
const helpIntegrationsHtml = computed(() => marked.parse(helpIntegrationsText || ''))

const helpModalKind = ref(null) // 'systems' | 'integrations'

function openHelpModal(kind) {
  helpModalKind.value = kind
}

function closeHelpModal() {
  helpModalKind.value = null
}

const helpModalTitle = computed(() => {
  if (helpModalKind.value === 'systems') return 'Правила заполнения: системы'
  if (helpModalKind.value === 'integrations') return 'Правила заполнения: интеграции'
  return 'Правила заполнения'
})

const helpModalHtml = computed(() => {
  if (helpModalKind.value === 'systems') return helpSystemsHtml.value
  if (helpModalKind.value === 'integrations') return helpIntegrationsHtml.value
  return ''
})

const loading = ref(false)
const saving = ref(false)
const submitError = ref('')
const isDirty = ref(false)
const initialLoadDone = ref(false)
const adrStatuses = ref([])
const form = reactive({ code: '', task_name: '', task_link: '', conclusion: '', ar_adr_statuses_id: null, author: '' })

const lastLoadedSnapshot = ref(null)
const incrementDataMap = ref({})

const increments = ref([])
const incrementsLoading = ref(false)
const selectedIncrementId = ref(null)
const incrementSystems = computed(() => selectedIncrementId.value ? (incrementDataMap.value[selectedIncrementId.value]?.systems || []) : [])
const incrementRelations = computed(() => selectedIncrementId.value ? (incrementDataMap.value[selectedIncrementId.value]?.relations || []) : [])
const systemsLoading = ref(false)
const systemsSaving = ref(false)
const relationsLoading = ref(false)
const allSystems = ref([])
const adrSystemStatuses = ref([])
const adrRelationStatuses = ref([])
const incrementTypes = ref([])
const selectedSystemId = ref('')
const selectedSystemStatusId = ref('')

const functionsModalOpen = ref(false)
const functionsModalRow = ref(null)

const defaultApplyStatusId = computed(() => {
  const st = (adrSystemStatuses.value || []).find(s => (s.name || '').toLowerCase().includes('применяется'))
  return st ? st.id : null
})

const isFormReadOnly = computed(() => {
  const s = (adrStatuses.value || []).find(x => x.id === form.ar_adr_statuses_id)
  return s ? s.name !== 'Черновик' : false
})

/** Решения привязаны к записи ADRA; на /new нет id — иначе уходит /applied/undefined/increments. */
const canManageIncrements = computed(() => isEdit.value && id.value != null && String(id.value).trim() !== '' && String(id.value) !== 'new')

/** Системы, ещё не привязанные к **выбранному инкременту** (не ко всему заключению). */
const availableSystems = computed(() => {
  const incId = selectedIncrementId.value
  if (!incId) return allSystems.value
  const linked = new Set(
    (incrementDataMap.value[incId]?.systems || []).map((r) => Number(r.ar_systems_id))
  )
  return allSystems.value.filter((s) => !linked.has(Number(s.id)))
})

/** Только системы текущего инкремента — для связей интеграций. */
const systemsForIntegrations = computed(() => {
  const incId = selectedIncrementId.value
  if (!incId) return []
  const sysIds = new Set(
    (incrementDataMap.value[incId]?.systems || []).map((s) => Number(s.ar_systems_id))
  )
  return allSystems.value.filter((s) => sysIds.has(Number(s.id)))
})

const incrementModal = ref(false)
const editingIncrementId = ref(null)
const incrementForm = ref({ order_index: 1, name: '', ar_adr_increment_types_id: null })
const incrementSaving = ref(false)
const incrementError = ref('')

const relationModal = ref(false)
const editingRelationId = ref(null)
const relationForm = ref({ from_ar_systems_id: null, to_ar_systems_id: null, name: '', description: '', ar_adr_increment_relation_statuses_id: null })
const relationSaving = ref(false)
const relationError = ref('')

const incrementDiagrams = ref([])
const diagramsLoading = ref(false)
const diagramsBusy = ref(false)

function formatDiagramDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function safeFilePart(name) {
  return String(name || '')
    .replace(/[/\\:*?"<>|]/g, '_')
    .trim() || 'Решение'
}

/** Имя решения + v{version_no} — как в таблице, так и в имени файла при скачивании. */
function diagramDisplayName(row) {
  const inc = increments.value.find((i) => i.id === selectedIncrementId.value)
  const base = safeFilePart(inc?.name || inc?.type_name || 'Решение')
  const n = row?.version_no != null ? Number(row.version_no) : null
  const v = n != null && !Number.isNaN(n) ? ` v${n}` : ''
  return `${base}${v}`
}

async function loadIncrementDiagrams() {
  if (!selectedIncrementId.value) {
    incrementDiagrams.value = []
    return
  }
  diagramsLoading.value = true
  try {
    const rows = (await api.getIncrementDiagrams(selectedIncrementId.value)) || []
    rows.sort((a, b) => (Number(b.version_no) || 0) - (Number(a.version_no) || 0))
    incrementDiagrams.value = rows
  } catch {
    incrementDiagrams.value = []
  } finally {
    diagramsLoading.value = false
  }
}

async function createIncrementDiagram() {
  if (!canManageIncrements.value || !selectedIncrementId.value) return
  diagramsBusy.value = true
  try {
    const created = await api.createIncrementDiagram(selectedIncrementId.value)
    await loadIncrementDiagrams()
    if (created && created.id != null) {
      openDiagramEditorTab({ id: created.id, version_no: created.version_no })
    }
  } catch (e) {
    submitError.value = e.body?.error || e.message || 'Не удалось создать схему'
  } finally {
    diagramsBusy.value = false
  }
}

async function mergeIncrementDiagramRow(row) {
  if (!selectedIncrementId.value || !row?.id) return
  diagramsBusy.value = true
  try {
    await api.mergeIncrementDiagram(selectedIncrementId.value, row.id)
    await loadIncrementDiagrams()
    openDiagramEditorTab(row)
  } catch (e) {
    submitError.value = e.body?.error || e.message || 'Не удалось обновить схему'
  } finally {
    diagramsBusy.value = false
  }
}

function openDiagramEditorTab(row) {
  if (!selectedIncrementId.value || !row?.id || !id.value) return
  // _t: уникальный query, иначе браузер может сфокусировать уже открытую вкладку с тем же URL —
  // Vue не перемонтирует экран и iframe не перезагружает mxfile (после «Обновить» / повторного «Открыть»).
  // schemeLabel: как в колонке «Имя файла» на форме (совпадает с именем при скачивании без .drawio).
  const url = router.resolve({
    name: 'decision-applied-diagram-editor',
    query: {
      incrementId: String(selectedIncrementId.value),
      diagramId: String(row.id),
      appliedId: String(id.value),
      _t: String(Date.now()),
      schemeLabel: diagramDisplayName(row),
    },
  }).href
  window.open(url, '_blank', 'noopener')
}

async function downloadDiagramRow(row) {
  if (!selectedIncrementId.value || !row?.id) return
  diagramsBusy.value = true
  try {
    const full = await api.getIncrementDiagram(selectedIncrementId.value, row.id)
    const blob = new Blob([full.mxfile || ''], { type: 'application/xml;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${diagramDisplayName(row)}.drawio`
    a.click()
    URL.revokeObjectURL(a.href)
  } catch (e) {
    submitError.value = e.body?.error || e.message || 'Ошибка выгрузки'
  } finally {
    diagramsBusy.value = false
  }
}

async function deleteDiagramRow(row) {
  if (!selectedIncrementId.value || !row?.id) return
  if (!confirm('Вы действительно хотите удалить диаграмму?')) return
  diagramsBusy.value = true
  try {
    await api.deleteIncrementDiagram(selectedIncrementId.value, row.id)
    await loadIncrementDiagrams()
  } catch (e) {
    submitError.value = e.body?.error || e.message || 'Не удалось удалить'
  } finally {
    diagramsBusy.value = false
  }
}

function formSnapshot() {
  return {
    code: form.code,
    task_name: form.task_name,
    task_link: form.task_link,
    conclusion: form.conclusion,
    ar_adr_statuses_id: form.ar_adr_statuses_id,
    author: form.author,
  }
}

onMounted(async () => {
  const [statuses, systems, sysSt, relSt, types] = await Promise.all([
    api.getAdrStatuses(),
    api.getSystems(),
    api.getAdrSystemStatuses(),
    api.getAdrRelationStatuses(),
    api.getAdrIncrementTypes(),
  ]).catch(() => [[], [], [], [], []])
  adrStatuses.value = statuses || []
  allSystems.value = systems || []
  adrSystemStatuses.value = sysSt || []
  adrRelationStatuses.value = relSt || []
  incrementTypes.value = types || []

  const payload = route.query.payload
  const newSystemId = route.query.newSystemId
  if (payload) {
    try {
      const data = JSON.parse(decodeURIComponent(atob(payload)))
      if (data.form) {
        form.task_name = data.form.task_name ?? ''
        form.task_link = data.form.task_link ?? ''
        form.conclusion = data.form.conclusion ?? ''
        form.ar_adr_statuses_id = data.form.ar_adr_statuses_id ?? null
        form.author = data.form.author ?? ''
      }
      if (data.appliedId && data.appliedId !== id.value) {
        router.replace({ path: `/decisions/applied/${data.appliedId}/edit`, query: {} })
        return
      }
    } catch (_) {}
  }

  if (isEdit.value) {
    loading.value = true
    try {
      if (!payload) {
        const row = await api.getDecisionApplied(id.value)
        form.code = (row.code ?? '').slice(0, adrCodeMaxLen.value)
        form.task_name = row.task_name ?? ''
        form.task_link = row.task_link ?? ''
        form.conclusion = row.conclusion ?? ''
        form.ar_adr_statuses_id = row.ar_adr_statuses_id ?? null
        form.author = row.author ?? ''
      } else {
        const row = await api.getDecisionApplied(id.value)
        form.code = (row.code ?? '').slice(0, adrCodeMaxLen.value)
      }
      increments.value = await api.getDecisionAppliedIncrements(id.value)
      for (const inc of increments.value) {
        const [systemsRes, relationsRes] = await Promise.all([
          api.getIncrementSystems(inc.id),
          api.getIncrementRelations(inc.id),
        ])
        incrementDataMap.value[inc.id] = { systems: systemsRes || [], relations: relationsRes || [] }
      }
      incrementDataMap.value = { ...incrementDataMap.value }
      if (increments.value.length && !selectedIncrementId.value) selectedIncrementId.value = increments.value[0].id
      if (newSystemId) selectedSystemId.value = newSystemId
      router.replace({ path: route.path, query: {} })
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
  return Object.keys(cur).some((k) => String(cur[k] ?? '') !== String(prev[k] ?? ''))
}

watch(() => ({ ...form }), () => {
  if (!initialLoadDone.value) return
  isDirty.value = isFormChanged()
}, { deep: true })

/**
 * При переключении инкремента обновляем системы и интеграции с сервера и сбрасываем выбор в селекте «добавить систему»,
 * чтобы availableSystems / таблицы соответствовали именно этому инкременту.
 * Первичная установка selectedIncrementId (без «предыдущего») не дублирует запросы — данные уже в incrementDataMap из onMounted/loadIncrements.
 */
watch(selectedIncrementId, async (incId, prevIncId) => {
  if (!incId) {
    incrementDiagrams.value = []
    return
  }
  if (prevIncId != null && prevIncId !== incId) {
    selectedSystemId.value = ''
    await Promise.all([loadIncrementSystems(), loadIncrementRelations()])
  }
  await loadIncrementDiagrams()
})

async function loadIncrements() {
  if (!id.value) return
  incrementsLoading.value = true
  try {
    increments.value = await api.getDecisionAppliedIncrements(id.value)
    for (const inc of increments.value) {
      if (!incrementDataMap.value[inc.id]) {
        const [systemsRes, relationsRes] = await Promise.all([
          api.getIncrementSystems(inc.id),
          api.getIncrementRelations(inc.id),
        ])
        incrementDataMap.value[inc.id] = { systems: systemsRes || [], relations: relationsRes || [] }
      }
    }
    incrementDataMap.value = { ...incrementDataMap.value }
    if (increments.value.length && !selectedIncrementId.value) selectedIncrementId.value = increments.value[0].id
  } catch (e) {
    submitError.value = e.message || 'Ошибка загрузки'
  } finally {
    incrementsLoading.value = false
  }
}

function selectIncrement(incId) {
  selectedIncrementId.value = incId
  selectedSystemStatusId.value = defaultApplyStatusId.value || selectedSystemStatusId.value
}

async function loadIncrementSystems() {
  if (!selectedIncrementId.value) return
  systemsLoading.value = true
  try {
    const res = await api.getIncrementSystems(selectedIncrementId.value)
    if (!incrementDataMap.value[selectedIncrementId.value]) incrementDataMap.value[selectedIncrementId.value] = { systems: [], relations: incrementDataMap.value[selectedIncrementId.value]?.relations || [] }
    incrementDataMap.value[selectedIncrementId.value].systems = res || []
    incrementDataMap.value = { ...incrementDataMap.value }
  } finally {
    systemsLoading.value = false
  }
}

async function loadIncrementRelations() {
  if (!selectedIncrementId.value) return
  relationsLoading.value = true
  try {
    const res = await api.getIncrementRelations(selectedIncrementId.value)
    if (!incrementDataMap.value[selectedIncrementId.value]) incrementDataMap.value[selectedIncrementId.value] = { systems: incrementDataMap.value[selectedIncrementId.value]?.systems || [], relations: [] }
    incrementDataMap.value[selectedIncrementId.value].relations = res || []
    incrementDataMap.value = { ...incrementDataMap.value }
  } finally {
    relationsLoading.value = false
  }
}

function openIncrementModal(inc) {
  editingIncrementId.value = inc?.id ?? null
  incrementForm.value = {
    order_index: inc?.order_index ?? (increments.value.length + 1),
    name: inc?.name ?? '',
    ar_adr_increment_types_id: inc?.ar_adr_increment_types_id ?? null,
  }
  incrementError.value = ''
  incrementModal.value = true
}

async function saveIncrement() {
  incrementSaving.value = true
  incrementError.value = ''
  try {
    if (!canManageIncrements.value) {
      incrementError.value = 'Сначала сохраните заключение (кнопка внизу страницы), затем добавляйте решения.'
      return
    }
    const typeId = incrementForm.value.ar_adr_increment_types_id
    const payload = {
      order_index: incrementForm.value.order_index,
      name: (incrementForm.value.name || '').trim(),
      ar_adr_increment_types_id:
        typeId != null && typeId !== '' && String(typeId) !== 'undefined' ? Number(typeId) : null,
    }
    if (payload.ar_adr_increment_types_id != null && !Number.isFinite(payload.ar_adr_increment_types_id)) {
      incrementError.value = 'Выберите тип решения из списка.'
      return
    }
    if (editingIncrementId.value) {
      await api.updateIncrement(id.value, editingIncrementId.value, payload)
    } else {
      await api.addDecisionAppliedIncrement(id.value, payload)
    }
    incrementModal.value = null
    await loadIncrements()
  } catch (e) {
    incrementError.value = e.body?.error || e.message || 'Ошибка'
  } finally {
    incrementSaving.value = false
  }
}

async function removeIncrement(incId) {
  if (!confirm('Удалить решение? Будут удалены все системы и интеграции этого решения.')) return
  try {
    await api.removeIncrement(id.value, incId)
    if (selectedIncrementId.value === incId) selectedIncrementId.value = null
    delete incrementDataMap.value[incId]
    incrementDataMap.value = { ...incrementDataMap.value }
    await loadIncrements()
  } catch (e) {
    submitError.value = e.message || 'Ошибка удаления'
  }
}

async function addSystem() {
  if (!selectedSystemId.value || !selectedIncrementId.value) return
  systemsSaving.value = true
  try {
    await api.addIncrementSystem(selectedIncrementId.value, {
      ar_systems_id: selectedSystemId.value,
      ar_adr_increment_system_statuses_id: selectedSystemStatusId.value || defaultApplyStatusId.value || undefined,
    })
    selectedSystemId.value = ''
    selectedSystemStatusId.value = defaultApplyStatusId.value || ''
    await loadIncrementSystems()
  } finally {
    systemsSaving.value = false
  }
}

async function removeSystem(rowId) {
  if (!confirm('Удалить систему из решения?')) return
  try {
    await api.removeIncrementSystem(selectedIncrementId.value, rowId)
    await loadIncrementSystems()
  } catch (e) {
    submitError.value = e.message || 'Ошибка'
  }
}

function openFunctionsModal(row) {
  if (!row?.id || !row?.ar_systems_id) return
  functionsModalRow.value = row
  functionsModalOpen.value = true
}

function closeFunctionsModal() {
  functionsModalOpen.value = false
  functionsModalRow.value = null
}

async function onFunctionsModalSaved() {
  await loadIncrementSystems()
}

function goToNewSystem() {
  const payload = {
    form: formSnapshot(),
    appliedId: id.value || null,
  }
  const q = { returnTo: isEdit.value ? 'decision-applied-edit' : 'decision-applied-new', payload: btoa(encodeURIComponent(JSON.stringify(payload))) }
  if (id.value) q.appliedId = id.value
  router.push({ path: '/systems/new', query: q })
}

function openRelationModal(row) {
  editingRelationId.value = row?.id ?? null
  relationForm.value = {
    from_ar_systems_id: row?.from_ar_systems_id ?? null,
    to_ar_systems_id: row?.to_ar_systems_id ?? null,
    name: row?.name ?? '',
    description: row?.description ?? '',
    ar_adr_increment_relation_statuses_id: row?.ar_adr_increment_relation_statuses_id ?? null,
  }
  relationError.value = ''
  relationModal.value = true
}

async function saveRelation() {
  if (!selectedIncrementId.value) return
  relationSaving.value = true
  relationError.value = ''
  try {
    const body = {
      from_ar_systems_id: relationForm.value.from_ar_systems_id || undefined,
      to_ar_systems_id: relationForm.value.to_ar_systems_id || undefined,
      name: relationForm.value.name?.trim() || undefined,
      description: relationForm.value.description?.trim() || undefined,
      ar_adr_increment_relation_statuses_id: relationForm.value.ar_adr_increment_relation_statuses_id || undefined,
    }
    if (editingRelationId.value) {
      await api.updateIncrementRelation(selectedIncrementId.value, editingRelationId.value, body)
    } else {
      await api.addIncrementRelation(selectedIncrementId.value, body)
    }
    relationModal.value = null
    await loadIncrementRelations()
  } catch (e) {
    relationError.value = e.body?.error || e.message || 'Ошибка'
  } finally {
    relationSaving.value = false
  }
}

async function removeRelation(relationId) {
  if (!confirm('Удалить интеграцию?')) return
  try {
    await api.removeIncrementRelation(selectedIncrementId.value, relationId)
    await loadIncrementRelations()
  } catch (e) {
    submitError.value = e.message || 'Ошибка'
  }
}

async function submit(opts = {}) {
  submitError.value = ''
  saving.value = true
  try {
    const body = {
      task_name: form.task_name?.trim() || undefined,
      task_link: form.task_link?.trim() || undefined,
      conclusion: form.conclusion?.trim() || undefined,
      ar_adr_statuses_id: form.ar_adr_statuses_id || undefined,
      author: form.author?.trim() || undefined,
    }
    if (isEdit.value) {
      if (isFormReadOnly.value) {
        await api.updateDecisionAppliedFull(id.value, { ar_adr_statuses_id: form.ar_adr_statuses_id ?? undefined })
      } else {
        const incrementsPayload = []
        for (const inc of increments.value) {
          const systems = (incrementDataMap.value[inc.id]?.systems || []).map(s => ({
            ar_systems_id: s.ar_systems_id,
            ar_adr_increment_system_statuses_id: s.ar_adr_increment_system_statuses_id || null,
            comment: s.comment || '',
          }))
          const relations = (incrementDataMap.value[inc.id]?.relations || []).map(r => ({
            from_ar_systems_id: r.from_ar_systems_id,
            to_ar_systems_id: r.to_ar_systems_id,
            name: r.name || '',
            description: r.description || '',
            ar_adr_increment_relation_statuses_id: r.ar_adr_increment_relation_statuses_id || null,
          }))
          incrementsPayload.push({
            order_index: inc.order_index,
            name: inc.name || '',
            ar_adr_increment_types_id: inc.ar_adr_increment_types_id || null,
            systems,
            relations,
          })
        }
        await api.updateDecisionAppliedFull(id.value, { ...body, increments: incrementsPayload })
      }
      lastLoadedSnapshot.value = formSnapshot()
      isDirty.value = false
      if (!opts.skipNavigate) router.push('/decisions/applied')
    } else {
      const res = await api.saveDecisionAppliedFull({ ...body, increments: [] })
      if (res?.code != null) {
        form.code = String(res.code).slice(0, adrCodeMaxLen.value)
      }
      lastLoadedSnapshot.value = formSnapshot()
      isDirty.value = false
      if (!opts.skipNavigate) router.push(`/decisions/applied/${res.id}/edit`)
    }
  } catch (e) {
    submitError.value = e.body?.error || e.message || 'Ошибка сохранения'
    throw e
  } finally {
    saving.value = false
  }
}

function cancel() {
  if (lastLoadedSnapshot.value) {
    form.code = lastLoadedSnapshot.value.code ?? ''
    form.task_name = lastLoadedSnapshot.value.task_name ?? ''
    form.task_link = lastLoadedSnapshot.value.task_link ?? ''
    form.conclusion = lastLoadedSnapshot.value.conclusion ?? ''
    form.ar_adr_statuses_id = lastLoadedSnapshot.value.ar_adr_statuses_id ?? null
    form.author = lastLoadedSnapshot.value.author ?? ''
  }
  if (isEdit.value) {
    loadIncrements()
  }
  isDirty.value = false
  submitError.value = ''
}

useUnsavedGuard(isDirty, () => submit({ skipNavigate: true }))
</script>

<style scoped>
.page-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.form-head-row {
  display: grid;
  grid-template-columns: minmax(7.5rem, 10rem) 1fr;
  gap: 1rem;
  align-items: end;
  margin-bottom: 0;
}
.form-head-row .field-code { margin-bottom: 0; }
.form-head-row .field-task-name { margin-bottom: 0; }
.code-hint {
  margin: 0;
  padding: 0.5rem 0.6rem;
  font-size: 0.85rem;
  color: #6b645c;
  background: #f5f0e8;
  border: 1px dashed #d4c4b0;
  border-radius: 6px;
  line-height: 1.3;
}
.code-pending {
  padding: 0.45rem 0.6rem;
  font-size: 0.9rem;
  color: #8b7355;
}
.form-grid-narrow { grid-template-columns: 1fr 1fr; }
.field-code input.readonly { font-weight: 600; letter-spacing: 0.02em; }
.help-rules-link {
  margin: 0;
  padding: 0;
  font-size: 0.9rem;
  text-align: left;
}
.help-markdown { margin: 0; padding: 0.75rem 1rem; font-size: 0.85rem; max-height: 360px; overflow: auto; }
.help-markdown :deep(h3) { margin: 0.5rem 0 0.35rem; font-size: 0.95rem; }
.help-markdown :deep(h4) { margin: 0.75rem 0 0.35rem; font-size: 0.9rem; }
.help-markdown :deep(p) { margin: 0.35rem 0; }
.help-markdown :deep(table) { border-collapse: collapse; width: 100%; margin: 0.5rem 0; }
.help-markdown :deep(th),
.help-markdown :deep(td) { border: 1px solid #d4c4b0; padding: 0.4rem 0.6rem; text-align: left; }
.help-markdown :deep(th) { background: #f0e6dc; font-weight: 600; }
.help-markdown :deep(hr) { border: none; border-top: 1px solid #e5dccf; margin: 0.75rem 0; }
.actions-bottom { margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #e5dccf; }
.card { background: #fff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); border: 1px solid #e5dccf; padding: 1rem; margin-bottom: 1rem; }
.card.block { padding: 0; }
.card .block-title { margin: 0; padding: 1rem 1rem 0.5rem; font-size: 1rem; }

/* Системы / интеграции / схемы: заголовок (+ при необходимости ссылка «Правила») слева, контент справа */
.block-two-col-layout {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 0 1.25rem;
}
.block-two-col-head {
  flex: 0 1 15rem;
  min-width: 11.5rem;
  max-width: 22rem;
  padding: 1rem 0 1rem 1rem;
  box-sizing: border-box;
}
.block-two-col-head .block-title {
  margin: 0;
  padding: 0 0 0.5rem;
  font-size: 1.05rem;
}
.block-two-col-head .help-rules-link {
  margin-top: 0.15rem;
}
.block-two-col-body {
  flex: 1;
  min-width: 0;
  border-left: 1px solid #e5dccf;
}
@media (max-width: 768px) {
  .block-two-col-layout {
    flex-direction: column;
  }
  .block-two-col-head {
    flex: none;
    max-width: none;
    min-width: 0;
    width: 100%;
    padding: 1rem 1rem 0.75rem;
    border-bottom: 1px solid #e5dccf;
  }
  .block-two-col-body {
    border-left: none;
    width: 100%;
  }
}
.solutions-card { margin-top: 1rem; background: #fafaf9; border: 1px solid #e5dccf; }
.solutions-card .block-title { border-bottom: 1px solid #e5dccf; padding: 0.75rem 1rem; margin: 0; }
.solutions-block { padding: 0 1rem 1rem; margin-top: 0; }
.solutions-prereq { margin-top: 0.5rem; margin-bottom: 0; max-width: 42rem; }
.tabs { display: none; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.field-wide { grid-column: 1 / -1; }
.unified-form > .field-wide { margin-bottom: 1rem; }
.unified-form > .form-grid { margin-bottom: 0; }
.field label { display: block; margin-bottom: 0.35rem; font-weight: 500; font-size: 0.9rem; }
.field input, .field select, .field textarea { width: 100%; padding: 0.5rem 0.6rem; border: 1px solid #d4c4b0; border-radius: 6px; }
.field input.readonly { background: #f5f0e8; }
.req { color: #b91c1c; }
.error { color: #b91c1c; margin-top: 0.5rem; }
.actions { margin-top: 1rem; display: flex; gap: 0.75rem; }
.loading, .empty, .hint { padding: 1rem; }
.hint { color: #5c5349; font-size: 0.9rem; }

.increment-list { list-style: none; margin: 0; padding: 0; }
.increment-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 1rem; border-bottom: 1px solid #e5dccf; cursor: pointer; }
.increment-item:hover { background: #faf8f5; }
.increment-item.selected { background: #f0e6dc; }
.inc-order { font-weight: 600; min-width: 1.5rem; }
.inc-name { flex: 1; }
.inc-type { color: #5c5349; font-size: 0.9rem; }
.toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; padding: 1rem; border-bottom: 1px solid #e5dccf; }
.add-row { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.select { min-width: 220px; padding: 0.5rem; border: 1px solid #d4c4b0; border-radius: 6px; }
.select.narrow { min-width: 140px; }
.td-functions { vertical-align: top; max-width: 28rem; }
.functions-cell { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 0.5rem 0.75rem; }
.functions-text { flex: 1; min-width: 8rem; white-space: pre-line; word-break: break-word; }
.table { width: 100%; border-collapse: collapse; }
.table th, .table td { padding: 0.6rem 1rem; text-align: left; border-bottom: 1px solid #e5dccf; }
.table th { background: #faf8f5; font-weight: 600; }
.btn { padding: 0.5rem 1rem; border-radius: 6px; border: none; cursor: pointer; font-size: 0.9rem; text-decoration: none; display: inline-block; }
.btn-primary { background: #cb997e; color: #fff; }
.btn-secondary { background: #e5dccf; color: #2d2a26; }
.btn-sm { padding: 0.35rem 0.75rem; font-size: 0.85rem; }
.btn-link { background: none; border: none; color: #8b6914; cursor: pointer; text-decoration: underline; margin-right: 0.5rem; }
.btn-link.danger { color: #b91c1c; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal { background: #fff; padding: 1.5rem; border-radius: 8px; min-width: 380px; max-width: 440px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); }
.modal.modal-help {
  min-width: min(100%, 520px);
  max-width: min(92vw, 640px);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}
.modal.modal-help h3 {
  flex-shrink: 0;
}
.modal-help-body {
  flex: 1;
  min-height: 0;
  max-height: min(70vh, 520px);
  overflow: auto;
  padding: 0.5rem 0.25rem 0.75rem;
  border-top: 1px solid #e5dccf;
  margin-top: 0.75rem;
}
.modal.modal-help .modal-actions {
  flex-shrink: 0;
  margin-top: 0.75rem;
}
.modal h3 { margin: 0 0 1rem; font-size: 1.1rem; }
.form-row { margin-bottom: 0.75rem; }
.form-row label { display: block; margin-bottom: 0.25rem; font-size: 0.9rem; }
.form-row input, .form-row select, .form-row textarea { width: 100%; padding: 0.5rem; border: 1px solid #d4c4b0; border-radius: 6px; }
.modal-actions { margin-top: 1rem; display: flex; gap: 0.5rem; }
.modal-actions .btn { min-height: 40px; padding: 0.6rem 1rem; }
</style>

<template>
  <div class="page">
    <div class="page-head">
      <h1>{{ formTitle }}</h1>
      <router-link :to="listRouteLocation" class="btn btn-secondary">← К реестру</router-link>
    </div>

    <div v-if="loading" class="loading">Загрузка...</div>
    <form v-else class="card form unified-form" @submit.prevent="submit">
      <p v-if="!canWrite" class="readonly-banner">Режим просмотра: нет права <code>adr_applied:write</code>.</p>
      <p v-if="prefillNotice" class="readonly-banner prefill-banner">{{ prefillNotice }}</p>
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
          <select v-model="form.ar_adr_statuses_id" :disabled="!canWrite">
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
            @click="openIncrementModal()"
          >
            + Добавить решение
          </button>
        </div>
        <div v-if="incrementsLoading" class="loading">Загрузка...</div>
        <ul v-else class="increment-list">
          <li
            v-for="inc in increments"
            :key="inc.id"
            :class="['increment-item', { selected: selectedIncrementId === inc.id }]"
            @click="selectIncrement(inc.id)"
          >
            <span class="inc-order">{{ inc.order_index }}</span>
            <span v-if="inc._local" class="draft-badge">не сохранено</span>
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
              <h3 class="block-title">Системы в решении</h3>
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
                <a
                  v-if="canWriteSystem"
                  href="#"
                  class="btn btn-secondary btn-sm"
                  @click.prevent="openNewSystemModal"
                >+ Новая система</a>
              </div>
              <div v-if="systemsLoading" class="loading">Загрузка...</div>
              <table v-else class="table">
                <thead><tr><th>Система</th><th>Статус</th><th>Функции</th><th v-if="!isFormReadOnly"></th></tr></thead>
                <tbody>
                  <tr v-for="row in displaySystems" :key="row._draft ? ('draft-' + row.localId) : (row._local ? row._localRowId : row.id)">
                    <td>
                      <template v-if="row._draft"><span class="draft-badge">новая</span> </template>
                      <template v-else-if="row._local"><span class="draft-badge">не сохранено</span> </template>{{ row.system_name }}
                    </td>
                    <td>{{ row.status_name ?? '—' }}</td>
                    <td class="td-functions">
                      <div class="functions-cell">
                        <span class="functions-text">{{ systemFunctionsText(row) }}</span>
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
                    <td v-if="!isFormReadOnly"><button type="button" class="btn-link danger" @click="removeSystem(row)">Удалить</button></td>
                  </tr>
                </tbody>
              </table>
              <p v-if="!systemsLoading && displaySystems.length === 0" class="empty">Нет систем.</p>
            </div>
          </div>
        </div>

        <div class="card block block-two-col">
          <div class="block-two-col-layout">
            <div class="block-two-col-head">
              <h3 class="block-title">Интеграции в решении</h3>
              <button type="button" class="btn-link help-rules-link" @click="openHelpModal('integrations')">
                Правила заполнения
              </button>
            </div>
            <div class="block-two-col-body">
              <div v-if="!isFormReadOnly" class="toolbar">
                <button type="button" class="btn btn-primary btn-sm" @click="relationsModalOpen = true">+ Добавить интеграцию</button>
              </div>
              <div v-if="relationsLoading" class="loading">Загрузка...</div>
              <table v-else class="table">
                <thead><tr><th>Источник</th><th>Приёмник</th><th>Наименование</th><th>Статус</th><th v-if="!isFormReadOnly"></th></tr></thead>
                <tbody>
                  <tr v-for="row in incrementRelations" :key="row._key">
                    <td>
                      <template v-if="row._local"><span class="draft-badge">новая</span> </template>{{ endpointLabel(row.from_key) }}
                    </td>
                    <td>{{ endpointLabel(row.to_key) }}</td>
                    <td>{{ row.transferred_data || row.name || '—' }}</td>
                    <td>{{ relationStatusLabel(row) }}</td>
                    <td v-if="!isFormReadOnly">
                      <button type="button" class="btn-link danger" @click.stop="removeRelation(row)">Удалить</button>
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
                  :disabled="diagramsBusy"
                  @click="requestDiagramAction({ kind: 'create' })"
                >
                  Создать схему решения
                </button>
              </div>
              <p v-if="!isFormReadOnly && formHasUnsavedChanges" class="hint">
                Схема строится по сохранённым данным: перед её формированием будет предложено сохранить заключение.
              </p>
              <div v-if="diagramsError" class="error">{{ diagramsError }}</div>
              <div v-if="diagramsLoading" class="loading">Загрузка диаграмм…</div>
              <table v-else class="table diagrams-table">
                <thead>
                  <tr>
                    <th>Имя файла</th>
                    <th>Создано</th>
                    <th>Изменено</th>
                    <th>Пользователь</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in incrementDiagrams" :key="row.id">
                    <td>{{ diagramDisplayName(row) }}</td>
                    <td>{{ formatDiagramDate(row.created_at) }}</td>
                    <td>{{ formatDiagramDate(row.updated_at) }}</td>
                    <td>{{ row.last_edited_by || '—' }}</td>
                    <td class="diagrams-actions">
                      <button
                        v-if="!isFormReadOnly"
                        type="button"
                        class="btn-link btn-sm"
                        :disabled="diagramsBusy"
                        @click="requestDiagramAction({ kind: 'merge', rowId: row.id, versionNo: row.version_no })"
                      >Обновить</button>
                      <button type="button" class="btn-link btn-sm" :disabled="diagramsBusy" @click="openDiagramEditorTab(row)">Открыть</button>
                      <button type="button" class="btn-link btn-sm" :disabled="diagramsBusy" @click="downloadDiagramRow(row)">Скачать</button>
                      <button
                        v-if="!isFormReadOnly"
                        type="button"
                        class="btn-link danger btn-sm"
                        :disabled="diagramsBusy"
                        @click="deleteDiagramRow(row)"
                      >Удалить</button>
                    </td>
                  </tr>
                </tbody>
              </table>
              <p v-if="!diagramsLoading && !diagramsError && incrementDiagrams.length === 0" class="empty">
                Нет сохранённых схем.
                <template v-if="!isFormReadOnly"> Нажмите «Создать схему решения».</template>
              </p>
            </div>
          </div>
        </div>
      </template>
      <p v-else class="hint">Выберите решение в списке выше, чтобы заполнить системы и интеграции.</p>

      <div v-if="submitError" class="error">{{ submitError }}</div>
      <div class="actions actions-bottom">
        <button
          v-if="canWrite"
          type="submit"
          class="btn btn-primary"
          :disabled="saving"
        >{{ saving ? 'Сохранение...' : 'Сохранить' }}</button>
        <button type="button" class="btn btn-secondary" @click="cancel">{{ canWrite ? 'Отмена' : 'К реестру' }}</button>
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

    <!-- Модалка: интеграции в решении (dual listbox, issue #74) -->
    <IncrementRelationsModal
      :show="relationsModalOpen"
      :registry-options="integrationRegistryOptions"
      :draft-options="integrationDraftOptions"
      :relations="incrementRelations"
      :relation-statuses="adrRelationStatuses"
      :event-types="flowEventTypes"
      :default-relation-status-id="prefillRelationStatusId"
      @close="relationsModalOpen = false"
      @save="onRelationsSaved"
    />

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
      :system-name="functionsModalTarget?.systemName || ''"
      :catalog="functionsModalCatalog"
      :selected="functionsModalSelected"
      @close="closeFunctionsModal"
      @save="onFunctionsSaved"
    />

    <!-- Модалка: новая система (черновик в контексте заключения, issue #74) -->
    <div v-if="newSystemModal" class="modal-overlay">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="new-system-modal-title">
        <h3 id="new-system-modal-title">Новая система</h3>
        <p class="modal-sub">Система будет создана в реестре при сохранении заключения (статус «Планируется к внедрению»).</p>
        <div class="form-row">
          <label>Код <span class="req">*</span></label>
          <input v-model="newSystemForm.code" type="text" class="modal-input" maxlength="64" placeholder="Напр. SYS-1" />
        </div>
        <div class="form-row">
          <label>Наименование <span class="req">*</span></label>
          <input v-model="newSystemForm.name" type="text" class="modal-input" maxlength="255" placeholder="Напр. Новая система" />
        </div>
        <div class="form-row">
          <label>Полное наименование</label>
          <input v-model="newSystemForm.fullname" type="text" class="modal-input" maxlength="500" />
        </div>
        <div class="form-row">
          <label>Статус в решении</label>
          <select v-model="newSystemForm.ar_adr_increment_system_statuses_id" class="modal-input">
            <option :value="null">—</option>
            <option v-for="st in adrSystemStatuses" :key="st.id" :value="st.id">{{ st.name }}</option>
          </select>
        </div>
        <div v-if="newSystemError" class="error">{{ newSystemError }}</div>
        <div class="modal-actions">
          <button type="button" class="btn btn-primary" :disabled="newSystemSaving" @click="addDraftSystem">{{ newSystemSaving ? 'Добавление…' : 'Добавить' }}</button>
          <button type="button" class="btn btn-secondary" :disabled="newSystemSaving" @click="closeNewSystemModal">Отмена</button>
        </div>
      </div>
    </div>

    <!-- Модалка: перед формированием схемы решения нужно сохранить изменения (issue #74) -->
    <div v-if="saveBeforeDiagramModal" class="modal-overlay">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="save-before-diagram-title">
        <h3 id="save-before-diagram-title">Перед формированием схемы решения необходимо сохранить внесенные изменения</h3>
        <p class="modal-sub">
          Изменения будут сохранены: новые системы, функции и интеграции попадут в реестр,
          после чего схема будет сформирована по сохранённым данным.
        </p>
        <div v-if="submitError" class="error">{{ submitError }}</div>
        <div class="modal-actions">
          <button type="button" class="btn btn-primary" :disabled="saving" @click="saveAndContinueDiagram">
            {{ saving ? 'Сохранение…' : 'Сохранить и продолжить' }}
          </button>
          <button type="button" class="btn btn-secondary" :disabled="saving" @click="cancelSaveBeforeDiagram">Отмена</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUnsavedGuard } from '../composables/useUnsavedGuard'
import { useFormListReturn } from '../composables/useFormListReturn'
import { usePermissions } from '../composables/usePermissions'
import IncrementSystemFunctionsModal from '../components/IncrementSystemFunctionsModal.vue'
import IncrementRelationsModal from '../components/IncrementRelationsModal.vue'
import { api } from '../api/client'
import { messageFromApiError } from '../utils/apiErrors'
import { getConfig } from '@/config/params'
import helpSystemsText from '../content/architecture-conclusion-help-systems.md?raw'
import helpIntegrationsText from '../content/architecture-conclusion-help-integrations.md?raw'
import { marked } from 'marked'

const adrCodeMaxLen = computed(() => (getConfig().ADR_CODE_MAXLEN ?? 15) | 0)

const route = useRoute()
const router = useRouter()
const { listRouteLocation, routeWithListSearch } = useFormListReturn('/decisions/applied')
const { canWrite } = usePermissions('adr_applied')
const { canWrite: canWriteSystem } = usePermissions('system')
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
// Связи интеграций (в памяти, issue #74): в БД не пишутся до сохранения заключения.
const relationsByIncrement = ref({})
const incrementRelations = computed(() => selectedIncrementId.value ? (relationsByIncrement.value[selectedIncrementId.value] || []) : [])
const displaySystems = computed(() => [
  ...incrementSystems.value.map((s) => ({ ...s, _draft: false })),
  ...visibleDraftSystems.value.map((s) => ({ ...s, _draft: true })),
])
const systemsLoading = ref(false)
const systemsSaving = ref(false)
// Есть несохранённые структурные изменения (системы/функции/интеграции в памяти) — issue #74.
const structureDirty = ref(false)
// Форма содержит несохранённые изменения: поля заключения и/или структура решений.
const formHasUnsavedChanges = computed(() => isDirty.value || structureDirty.value)
const relationsLoading = ref(false)
const allSystems = ref([])
const adrSystemStatuses = ref([])
const adrRelationStatuses = ref([])
const incrementTypes = ref([])
const selectedSystemId = ref('')
const selectedSystemStatusId = ref('')
/**
 * Статусы контура из черновика ИИ (issue #78): приходят **кодами** справочников, а не id.
 * Разрешённые в id значения живут отдельно от `selectedSystemStatusId`, потому что выбор решения
 * (`selectIncrement`) перезаписывает пикер статуса своим дефолтом — предзаполнение должно его пережить.
 */
const prefillSystemStatusId = ref(null)
const prefillRelationStatusId = ref(null)

/**
 * Плашка черновика ИИ-архитектора (issue #78): состав заключения приходит тем же `?payload=`, что и раньше
 * (шапка), плюс `increments` — решения с системами, функциями и связями. В плашке видно, что применилось,
 * а что сервер отбросил; данные не сохраняются до нажатия «Сохранить».
 */
const prefillNotice = ref('')

/**
 * Коды статусов контура — параметры БД (issue #91): статус новой системы/функции больше не «магическая»
 * строка в коде формы, значение правится в «Настройки → Параметры» (группа ADR) и приходит в `/api/config`.
 */
function newSystemStatusCode() {
  return String(getConfig().ADR_INCR_SYS_NEW_STATUS_CODE || 'ADR_INCR_SYS_CREATING')
}

/** Код статуса новой функции системы — параметр `ADR_INCR_SYSFUNC_NEW_STATUS_CODE`. */
function newSysfuncStatusCode() {
  return String(getConfig().ADR_INCR_SYSFUNC_NEW_STATUS_CODE || 'ADR_INCR_SYSFUNC_CREATING')
}

/** id строки справочника по коду: неизвестный код → null (выдуманный моделью код молча игнорируется). */
function catalogIdByCode(rows, code) {
  const c = String(code ?? '').trim()
  if (!c) return null
  const st = (rows || []).find((s) => String(s.code || '').trim() === c)
  return st ? st.id : null
}

// Единая модалка «Функции системы» (dual listbox, issue #74) — и для систем реестра, и для новых (черновых).
const functionsModalOpen = ref(false)
const functionsModalTarget = ref(null) // { kind: 'row' | 'draft', rowId?, localId?, systemName }
const functionsModalCatalog = ref([])
const functionsModalSelected = ref([])
// Выбор функций (в памяти) по строкам систем из реестра: rowId -> { catalog, selected }.
const systemFunctionsMap = ref({})

// Черновые системы (kind:"new") в контексте заключения (issue #74) — не пишутся в реестр до save.
const draftSystems = ref([])
/** Черновые системы текущего решения (без incId — созданные до выбора, показываем в текущем). */
const visibleDraftSystems = computed(() =>
  draftSystems.value.filter((s) => s.incId == null || s.incId === selectedIncrementId.value)
)
const newSystemModal = ref(false)
const newSystemForm = reactive({ code: '', name: '', fullname: '', ar_adr_increment_system_statuses_id: null })
const newSystemSaving = ref(false)
const newSystemError = ref('')
let draftSystemSeq = 0
// Локально добавленные в решение системы (из реестра) — в БД только при сохранении заключения (issue #74).
let localSystemRowSeq = 0
/** Ключ строки системы для карты функций: rowId из БД либо локальный ключ (`lr:<seq>`). */
function systemRowKey(row) {
  return row?._local ? row._localRowId : (row?.id != null ? String(row.id) : null)
}

/**
 * Коды статусов заключения, при которых форма разрешает править состав (issue #91): раньше правило было
 * зашито сравнением имени статуса с «Черновик», теперь это список кодов из параметра
 * `ADR_EDITABLE_STATUS_CODES` — переименование статуса в справочнике форму больше не ломает.
 */
const editableStatusCodes = computed(() => {
  const raw = getConfig().ADR_EDITABLE_STATUS_CODES
  const list = Array.isArray(raw) ? raw : []
  return list.map((v) => String(v || '').trim()).filter(Boolean)
})

/**
 * Статус системы «в решении» по умолчанию для уже существующей системы реестра — код из параметра
 * `ADR_INCR_SYS_DEFAULT_STATUS_CODE` (issue #91). Раньше статус искался по подстроке «применяется»
 * в названии, из-за чего зависел от формулировки в справочнике; кода в справочнике нет — пикер пуст.
 */
const defaultApplyStatusId = computed(() => catalogIdByCode(adrSystemStatuses.value, getConfig().ADR_INCR_SYS_DEFAULT_STATUS_CODE))

const isStatusReadOnly = computed(() => {
  const s = (adrStatuses.value || []).find(x => Number(x.id) === Number(form.ar_adr_statuses_id))
  if (!s) return false
  return !editableStatusCodes.value.includes(String(s.code || '').trim())
})
const isFormReadOnly = computed(() => isStatusReadOnly.value || !canWrite.value)
const formTitle = computed(() => {
  if (!isEdit.value) return 'Новое архитектурное заключение'
  return isFormReadOnly.value ? 'Просмотр архитектурного заключения' : 'Редактирование архитектурного заключения'
})

/** Решения привязаны к записи ADRA; на /new нет id — иначе уходит /applied/undefined/increments. */
const canManageIncrements = computed(() => isEdit.value && id.value != null && String(id.value).trim() !== '' && String(id.value) !== 'new')

/**
 * Локальные решения (issue #74): до первого сохранения заключения решения живут в памяти формы,
 * а запись создаётся сразу с ними (`POST /full` с `increments[]`) — id заключения не требуется.
 */
const LOCAL_INCREMENT_PREFIX = 'linc:'
let localIncrementSeq = 0
function isLocalIncrementId(v) {
  return typeof v === 'string' && v.startsWith(LOCAL_INCREMENT_PREFIX)
}
/** Наименование типа решения для списка (у локальных решений type_name из БД ещё нет). */
function incrementTypeName(typeId) {
  const t = (incrementTypes.value || []).find((x) => Number(x.id) === Number(typeId))
  return t ? t.name : null
}

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

/** Опции «Откуда/Куда» для интеграций: системы инкремента из реестра. Значение — ключ `s:<id>`. */
const integrationRegistryOptions = computed(() =>
  systemsForIntegrations.value.map((s) => ({ value: `s:${s.id}`, label: s.display_name || s.name }))
)

/** Опции «Откуда/Куда»: черновые (новые) системы заключения. Значение — ключ `n:<localId>` (issue #74). */
const integrationDraftOptions = computed(() =>
  visibleDraftSystems.value.map((d) => ({ value: `n:${d.localId}`, label: `${d.name} (новая)` }))
)

/** Подпись конца связи: `s:<id>` → система реестра, `n:<localId>` → новая система заключения. */
function endpointLabel(key) {
  if (!key) return '—'
  const [kind, id] = String(key).split(':')
  if (kind === 's') {
    const s = allSystems.value.find((x) => Number(x.id) === Number(id))
    return s ? (s.display_name || s.name) : `#${id}`
  }
  const d = draftSystems.value.find((x) => String(x.localId) === String(id))
  return d ? d.name : '—'
}

/** Статус связи в решении: из БД либо по выбранному справочнику (для черновых связей). */
function relationStatusLabel(row) {
  if (row?.status_name) return row.status_name
  const st = (adrRelationStatuses.value || []).find(
    (s) => Number(s.id) === Number(row?.ar_adr_increment_relation_statuses_id)
  )
  return st ? (st.display_name || st.name) : '—'
}

/** Нормализовать связь из БД к формату формы: концы — строковые ключи, поля реестровые (issue #74). */
function normalizeRelation(row) {
  return {
    ...row,
    _key: `r:${row.id}`,
    _local: false,
    from_key: row.from_ar_systems_id != null ? `s:${row.from_ar_systems_id}` : null,
    to_key: row.to_ar_systems_id != null ? `s:${row.to_ar_systems_id}` : null,
    transferred_data: row.transferred_data != null ? row.transferred_data : (row.name || ''),
    transfer_method: row.transfer_method != null ? row.transfer_method : (row.description || ''),
    periodicity: row.periodicity || '',
    ar_integration_flows_id: row.ar_integration_flows_id || null,
    ar_integration_flow_event_types_id: row.ar_integration_flow_event_types_id || null,
  }
}

/** Собрать payload связи для `full`: id реестровых систем либо local_key новых. */
function buildRelationPayload(r) {
  const parse = (key) => {
    const [kind, id] = String(key || '').split(':')
    if (kind === 's') return { ar_systems_id: Number(id) }
    if (kind === 'n') return { new_key: `n:${id}` }
    return {}
  }
  const from = parse(r.from_key)
  const to = parse(r.to_key)
  return {
    from_ar_systems_id: from.ar_systems_id ?? undefined,
    from_new_key: from.new_key ?? undefined,
    to_ar_systems_id: to.ar_systems_id ?? undefined,
    to_new_key: to.new_key ?? undefined,
    ar_integration_flows_id: r.ar_integration_flows_id || undefined,
    transferred_data: r.transferred_data || '',
    transfer_method: r.transfer_method || '',
    periodicity: r.periodicity || '',
    ar_integration_flow_event_types_id: r.ar_integration_flow_event_types_id || undefined,
    ar_adr_increment_relation_statuses_id: r.ar_adr_increment_relation_statuses_id || null,
    increment_relation_status_code: r.increment_relation_status_code || undefined,
  }
}

const incrementModal = ref(false)
const editingIncrementId = ref(null)
const incrementForm = ref({ order_index: 1, name: '', ar_adr_increment_types_id: null })
const incrementSaving = ref(false)
const incrementError = ref('')

const relationsModalOpen = ref(false)
const flowEventTypes = ref([])

const incrementDiagrams = ref([])
const diagramsLoading = ref(false)
const diagramsBusy = ref(false)
const diagramsError = ref('')
// A1 (issue #74): перед формированием/обновлением схемы при несохранённых изменениях предлагаем сохранить.
const saveBeforeDiagramModal = ref(false)
const pendingDiagramAction = ref(null) // { kind: 'create' } | { kind: 'merge', row }
// id заключения, созданного по «Сохранить и продолжить» — нужен для перехода в режим редактирования.
const lastCreatedAppliedId = ref(null)

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
  if (!selectedIncrementId.value || isLocalIncrementId(selectedIncrementId.value)) {
    incrementDiagrams.value = []
    diagramsError.value = ''
    return
  }
  diagramsLoading.value = true
  diagramsError.value = ''
  try {
    const rows = (await api.getIncrementDiagrams(selectedIncrementId.value)) || []
    rows.sort((a, b) => (Number(b.version_no) || 0) - (Number(a.version_no) || 0))
    incrementDiagrams.value = rows
  } catch (e) {
    incrementDiagrams.value = []
    diagramsError.value = messageFromApiError(e?.status, e?.body, e?.message) || 'Ошибка загрузки схем'
  } finally {
    diagramsLoading.value = false
  }
}

/**
 * A1 (issue #74): схема строится по сохранённым данным, поэтому при несохранённых изменениях
 * сначала предлагаем сохранить заключение, а затем продолжаем действие.
 */
function requestDiagramAction(action) {
  if (diagramsBusy.value || !action) return
  // Несохранённые изменения или ещё нет id заключения — предлагаем сохранить (issue #74).
  if (formHasUnsavedChanges.value || !canManageIncrements.value) {
    submitError.value = ''
    pendingDiagramAction.value = action
    saveBeforeDiagramModal.value = true
    return
  }
  runDiagramAction(action)
}

async function runDiagramAction(action) {
  if (!action) return
  if (action.kind === 'merge') {
    // После сохранения заключения строки схем пересоздаются — ищем схему по id, затем по номеру версии.
    const row = incrementDiagrams.value.find((d) => d.id === action.rowId)
      || incrementDiagrams.value.find((d) => Number(d.version_no) === Number(action.versionNo))
    await mergeIncrementDiagramRow(row)
  } else {
    await createIncrementDiagram()
  }
}

/** «Сохранить и продолжить»: сохраняем заключение, оставаясь на форме, затем выполняем действие. */
async function saveAndContinueDiagram() {
  const action = pendingDiagramAction.value
  if (!canWrite.value) {
    submitError.value = 'Недостаточно прав для сохранения изменений.'
    return
  }
  const wasNew = !canManageIncrements.value
  try {
    await submit({ skipNavigate: true, diagramContinue: true })
  } catch (_) {
    // Ошибка сохранения показана в модалке — действие не продолжаем, модалка остаётся открытой.
    return
  }
  saveBeforeDiagramModal.value = false
  pendingDiagramAction.value = null
  // Заключения ещё не было: запись уже создана (POST) — переходим в режим редактирования и продолжаем действие.
  if (wasNew) {
    const createdId = lastCreatedAppliedId.value
    lastCreatedAppliedId.value = null
    if (createdId != null) {
      await router.push(routeWithListSearch(`/decisions/applied/${createdId}/edit`))
      // Маршруты /new и /:id/edit используют один компонент — данные читаем из БД явно (issue #74, п.5).
      await reloadAfterSave()
    }
  }
  await runDiagramAction(action)
}

function cancelSaveBeforeDiagram() {
  saveBeforeDiagramModal.value = false
  pendingDiagramAction.value = null
}

/** После сохранения перечитываем решения и структуру — иначе в таблицах остаются бейджи «не сохранено». */
async function reloadAfterSave() {
  const prev = increments.value.find((i) => i.id === selectedIncrementId.value) || null
  const prevOrder = prev?.order_index
  const prevName = prev?.name || ''
  increments.value = []
  incrementDataMap.value = {}
  relationsByIncrement.value = {}
  systemFunctionsMap.value = {}
  selectedIncrementId.value = null
  await loadIncrements()
  const match = increments.value.find((i) => i.order_index === prevOrder && (i.name || '') === prevName)
    || increments.value.find((i) => (i.name || '') === prevName)
    || increments.value[0]
    || null
  selectedIncrementId.value = match ? match.id : null
  // Список схем берём явно: после сохранения их строки получили новые id.
  await loadIncrementDiagrams()
}

async function createIncrementDiagram() {
  if (!canManageIncrements.value) {
    submitError.value = 'Схема формируется по сохранённому заключению: сохраните форму и повторите действие.'
    return
  }
  if (!selectedIncrementId.value) {
    submitError.value = 'Добавьте решение в заключение, чтобы сформировать схему.'
    return
  }
  diagramsBusy.value = true
  try {
    const created = await api.createIncrementDiagram(selectedIncrementId.value)
    await loadIncrementDiagrams()
    if (created && created.id != null) {
      openDiagramEditorTab({ id: created.id, version_no: created.version_no })
    }
  } catch (e) {
    submitError.value = messageFromApiError(e?.status, e?.body, e?.message) || 'Не удалось создать схему'
  } finally {
    diagramsBusy.value = false
  }
}

async function mergeIncrementDiagramRow(row) {
  if (!selectedIncrementId.value) return
  if (!row?.id) {
    submitError.value = 'Схема не найдена: обновите список схем и повторите действие.'
    return
  }
  diagramsBusy.value = true
  try {
    await api.mergeIncrementDiagram(selectedIncrementId.value, row.id)
    await loadIncrementDiagrams()
    openDiagramEditorTab(row)
  } catch (e) {
    submitError.value = messageFromApiError(e?.status, e?.body, e?.message) || 'Не удалось обновить схему'
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
  // Без noopener: иначе новая вкладка не получает копию sessionStorage (JWT) → 401/403 на API схем.
  const w = window.open(url, '_blank')
  if (w) {
    try { w.opener = null } catch (_) { /* ignore */ }
  }
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
    submitError.value = messageFromApiError(e?.status, e?.body, e?.message) || 'Ошибка выгрузки'
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
    submitError.value = messageFromApiError(e?.status, e?.body, e?.message) || 'Не удалось удалить'
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
  const [statuses, systems, sysSt, relSt, types, evtTypes] = await Promise.all([
    api.getAdrStatuses(),
    api.getSystems(),
    api.getAdrSystemStatuses(),
    api.getAdrRelationStatuses(),
    api.getAdrIncrementTypes(),
    api.getIntegrationFlowEventTypes().catch(() => []),
  ]).catch(() => [[], [], [], [], [], []])
  adrStatuses.value = statuses || []
  allSystems.value = systems || []
  adrSystemStatuses.value = sysSt || []
  adrRelationStatuses.value = relSt || []
  incrementTypes.value = types || []
  flowEventTypes.value = evtTypes || []

  const payload = route.query.payload
  const newSystemId = route.query.newSystemId
  // Состав заключения из черновика ИИ (issue #78) применяем ПОСЛЕ загрузки записи: иначе загрузка решений
  // из БД перезаписала бы предложение, а справочники/реестр систем нужны для разрешения кодов и id.
  let aiIncrements = null
  let aiStatusProblem = ''
  if (payload) {
    try {
      const data = JSON.parse(decodeURIComponent(atob(payload)))
      if (data.form) {
        form.task_name = data.form.task_name ?? ''
        form.task_link = data.form.task_link ?? ''
        form.conclusion = data.form.conclusion ?? ''
        form.ar_adr_statuses_id = data.form.ar_adr_statuses_id ?? null
        form.author = data.form.author ?? ''
        // Статус заключения приходит кодом справочника (ADR_STATUS_DRAFT) — разрешаем его в id, как и статусы контура.
        if (data.form.status_code) {
          const draftStatusId = catalogIdByCode(adrStatuses.value, data.form.status_code)
          if (draftStatusId != null) form.ar_adr_statuses_id = draftStatusId
          else aiStatusProblem = `Статус «${data.form.status_code}» не найден в справочнике статусов — выберите его в форме сами.`
        }
        // Статусы контура приходят кодами (ADR_INCR_*), справочники загружены выше — разрешаем их в id.
        const sysStatusId = catalogIdByCode(adrSystemStatuses.value, data.form.increment_system_status_code)
        if (sysStatusId != null) prefillSystemStatusId.value = sysStatusId
        const relStatusId = catalogIdByCode(adrRelationStatuses.value, data.form.increment_relation_status_code)
        if (relStatusId != null) prefillRelationStatusId.value = relStatusId
        aiIncrements = data.form.increments ?? null
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
        relationsByIncrement.value = { ...relationsByIncrement.value, [inc.id]: (relationsRes || []).map(normalizeRelation) }
      }
      incrementDataMap.value = { ...incrementDataMap.value }
      for (const inc of increments.value) {
        await ensureSystemFunctions(incrementDataMap.value[inc.id]?.systems || [])
      }
      if (increments.value.length && !selectedIncrementId.value) selectedIncrementId.value = increments.value[0].id
      if (newSystemId) selectedSystemId.value = newSystemId
      router.replace({ path: route.path, query: {} })
    } catch (e) {
      submitError.value = e.message || 'Ошибка загрузки'
    } finally {
      loading.value = false
    }
  }
  // Состав заключения ИИ (issue #78): раскладываем предложение в память формы тем же способом, что ручное
  // редактирование, — пользователь правит его обычными средствами, а «Сохранить» собирает payload формы.
  if (aiIncrements != null) {
    const structure = await hydrateAiStructure(aiIncrements)
    prefillNotice.value = [
      'Черновик ИИ-архитектора применён к форме (данные не сохранены — проверьте и сохраните сами).',
      structure.summary,
      ...structure.warnings,
      aiStatusProblem,
    ]
      .filter(Boolean)
      .join(' ')
  } else if (aiStatusProblem) {
    prefillNotice.value = aiStatusProblem
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
        relationsByIncrement.value = { ...relationsByIncrement.value, [inc.id]: (relationsRes || []).map(normalizeRelation) }
      }
    }
    incrementDataMap.value = { ...incrementDataMap.value }
    for (const inc of increments.value) {
      await ensureSystemFunctions(incrementDataMap.value[inc.id]?.systems || [])
    }
    if (increments.value.length && !selectedIncrementId.value) selectedIncrementId.value = increments.value[0].id
  } catch (e) {
    submitError.value = e.message || 'Ошибка загрузки'
  } finally {
    incrementsLoading.value = false
  }
}

function selectIncrement(incId) {
  selectedIncrementId.value = incId
  selectedSystemStatusId.value = prefillSystemStatusId.value || defaultApplyStatusId.value || selectedSystemStatusId.value
}

async function loadIncrementSystems(force = false) {
  const incId = selectedIncrementId.value
  if (!incId) return
  // Локальное решение — системы лежат в памяти, запрос к БД не нужен (issue #74).
  if (isLocalIncrementId(incId)) return
  // Данные уже загружены (mount/loadIncrements) — не перезатираем локальные изменения до сохранения.
  if (!force && Array.isArray(incrementDataMap.value[incId]?.systems)) return
  systemsLoading.value = true
  try {
    const res = await api.getIncrementSystems(incId)
    if (!incrementDataMap.value[incId]) incrementDataMap.value[incId] = { systems: [], relations: incrementDataMap.value[incId]?.relations || [] }
    incrementDataMap.value[incId].systems = res || []
    incrementDataMap.value = { ...incrementDataMap.value }
    await ensureSystemFunctions(res || [])
  } finally {
    systemsLoading.value = false
  }
}

async function loadIncrementRelations(force = false) {
  const incId = selectedIncrementId.value
  if (!incId) return
  // Локальное решение — интеграции лежат в памяти, запрос к БД не нужен (issue #74).
  if (isLocalIncrementId(incId)) return
  if (!force && relationsByIncrement.value[incId]) return
  relationsLoading.value = true
  try {
    const res = await api.getIncrementRelations(incId)
    relationsByIncrement.value = { ...relationsByIncrement.value, [incId]: (res || []).map(normalizeRelation) }
  } finally {
    relationsLoading.value = false
  }
}

/** Добавить решение в память формы: запись появится в БД вместе с заключением (`POST /full`, issue #74). */
function addLocalIncrement(payload) {
  localIncrementSeq += 1
  const localId = `${LOCAL_INCREMENT_PREFIX}${localIncrementSeq}`
  increments.value = [
    ...increments.value,
    {
      id: localId,
      _local: true,
      order_index: payload.order_index,
      name: payload.name,
      ar_adr_increment_types_id: payload.ar_adr_increment_types_id,
      type_name: incrementTypeName(payload.ar_adr_increment_types_id),
    },
  ]
  incrementDataMap.value = { ...incrementDataMap.value, [localId]: { systems: [], relations: [] } }
  relationsByIncrement.value = { ...relationsByIncrement.value, [localId]: [] }
  selectedIncrementId.value = localId
  structureDirty.value = true
}

/**
 * Применить структурную часть черновика ИИ (`increments`) к памяти формы (issue #78).
 *
 * Сервер отдаёт состав в формате `buildIncrementsPayload`, но концы связей — ключами: `s:<ar_systems_id>`
 * (система реестра) и `n:<key>` (новая система решения). Раскладываем состав в те же структуры, что и ручное
 * редактирование (`increments`, `incrementDataMap`, `draftSystems`, `relationsByIncrement`, `systemFunctionsMap`),
 * поэтому пользователь правит предложение обычными средствами, а `submit` собирает его своим payload-ом.
 *
 * Ключ модели становится частью `localId` (`<номер решения>-<key>`): `localId` уникален по форме, а в связях
 * остаётся читаемым для `split(':')` (`n:<localId>`). Сервер уже отбросил то, что не проходит справочники и
 * лимиты; здесь отсекается только то, чего нет в загруженном реестре систем.
 *
 * @param {*} raw — `increments` из payload
 * @returns {{ summary: string, warnings: string[] }}
 */
async function hydrateAiStructure(raw) {
  const warnings = []
  if (raw == null) return { summary: '', warnings }
  if (!Array.isArray(raw) || !raw.length) {
    warnings.push('Состав заключения из черновика ИИ не применён: ожидался непустой массив решений.')
    return { summary: '', warnings }
  }
  const newStatusId = catalogIdByCode(adrSystemStatuses.value, newSystemStatusCode())
  const newStatusRow = (adrSystemStatuses.value || []).find((s) => Number(s.id) === Number(newStatusId))
  let incSeq = 0
  let relationSeq = 0
  let systemCount = 0
  for (const rawInc of raw) {
    const inc = rawInc && typeof rawInc === 'object' ? rawInc : {}
    incSeq += 1
    const incId = `${LOCAL_INCREMENT_PREFIX}ai${incSeq}`
    const typeId = inc.ar_adr_increment_types_id ?? null
    increments.value = [
      ...increments.value,
      {
        id: incId,
        _local: true,
        order_index: Number(inc.order_index) || increments.value.length + 1,
        name: String(inc.name || ''),
        ar_adr_increment_types_id: typeId,
        type_name: incrementTypeName(typeId),
      },
    ]
    // Ключ ИИ → ключ формы: системы реестра без изменений, новые — с префиксом решения.
    const endpointMap = new Map()
    const systems = []
    const draftRows = []
    const functionsByRow = []
    for (const rawSys of Array.isArray(inc.systems) ? inc.systems : []) {
      const sys = rawSys && typeof rawSys === 'object' ? rawSys : {}
      if (sys.kind === 'new') {
        const localId = `${incSeq}-${String(sys.key || `sys${draftRows.length + 1}`)}`
        endpointMap.set(`n:${String(sys.key || '')}`, `n:${localId}`)
        draftRows.push({
          localId,
          incId,
          kind: 'new',
          code: String(sys.code || ''),
          name: String(sys.name || ''),
          fullname: sys.fullname ? String(sys.fullname) : undefined,
          ar_adr_increment_system_statuses_id: newStatusId,
          system_name: String(sys.name || ''),
          status_name: newStatusRow ? (newStatusRow.display_name || newStatusRow.name) : '',
          comment: '',
          functions: (Array.isArray(sys.functions) ? sys.functions : []).map((f) => ({
            name: String(f.name || ''),
            description: f.description || '',
            increment_sysfunc_status_code: f.increment_sysfunc_status_code || null,
          })),
        })
        systemCount += 1
        continue
      }
      const arSystemsId = Number(sys.ar_systems_id)
      const known = (allSystems.value || []).find((x) => Number(x.id) === arSystemsId)
      if (!known) {
        warnings.push(`Система #${sys.ar_systems_id} из черновика ИИ не найдена в реестре — не добавлена.`)
        continue
      }
      endpointMap.set(`s:${arSystemsId}`, `s:${arSystemsId}`)
      const statusId = catalogIdByCode(adrSystemStatuses.value, sys.increment_system_status_code)
      const statusRow = (adrSystemStatuses.value || []).find((s) => Number(s.id) === Number(statusId))
      const row = {
        id: null,
        _local: true,
        _localRowId: `lr:ai${++localSystemRowSeq}`,
        ar_adr_increment_id: incId,
        ar_systems_id: arSystemsId,
        ar_adr_increment_system_statuses_id: statusId,
        system_code: known.code || '',
        system_name: known.name || '',
        status_name: statusRow ? (statusRow.display_name || statusRow.name) : '',
        comment: sys.comment ? String(sys.comment) : '',
      }
      systems.push(row)
      systemCount += 1
      const fns = Array.isArray(sys.functions) ? sys.functions : []
      if (fns.length) functionsByRow.push({ row, fns })
    }
    const relations = []
    for (const rawRel of Array.isArray(inc.relations) ? inc.relations : []) {
      const rel = rawRel && typeof rawRel === 'object' ? rawRel : {}
      const fromKey = endpointMap.get(String(rel.from || ''))
      const toKey = endpointMap.get(String(rel.to || ''))
      if (!fromKey || !toKey) {
        warnings.push(
          `Интеграция ${rel.from || '—'} → ${rel.to || '—'} из черновика ИИ пропущена: её концов нет в этом решении.`
        )
        continue
      }
      relationSeq += 1
      const relStatusCode = String(rel.increment_relation_status_code || '')
      relations.push({
        _key: `r:ai:${relationSeq}`,
        _local: true,
        from_key: fromKey,
        to_key: toKey,
        transferred_data: String(rel.transferred_data || ''),
        transfer_method: String(rel.transfer_method || ''),
        periodicity: String(rel.periodicity || ''),
        ar_integration_flows_id: null,
        ar_integration_flow_event_types_id: null,
        ar_adr_increment_relation_statuses_id: catalogIdByCode(adrRelationStatuses.value, relStatusCode),
        increment_relation_status_code: relStatusCode || null,
      })
    }
    incrementDataMap.value = { ...incrementDataMap.value, [incId]: { systems, relations: [] } }
    relationsByIncrement.value = { ...relationsByIncrement.value, [incId]: relations }
    if (draftRows.length) draftSystems.value = [...draftSystems.value, ...draftRows]
    // Функции систем реестра живут в `systemFunctionsMap` (как при ручном выборе): каталог системы подгружаем,
    // чтобы выбор можно было продолжить в модалке; функции ИИ сохраняются как новые функции системы.
    for (const { row, fns } of functionsByRow) {
      await loadSystemFunctions(row)
      const rowKey = systemRowKey(row)
      const entry = systemFunctionsMap.value[rowKey] || { catalog: [] }
      systemFunctionsMap.value = {
        ...systemFunctionsMap.value,
        [rowKey]: {
          catalog: entry.catalog || [],
          selected: fns.map((f) => ({
            ar_system_functions_id: null,
            name: String(f.name || ''),
            description: f.description || '',
            increment_sysfunc_status_code: f.increment_sysfunc_status_code || null,
          })),
        },
      }
    }
  }
  if (!selectedIncrementId.value) selectedIncrementId.value = increments.value[0]?.id ?? null
  structureDirty.value = true
  return {
    summary: `Состав заключения: решений — ${incSeq}, систем — ${systemCount}, интеграций — ${relationSeq}.`,
    warnings,
  }
}

/** Изменить локальное решение (только в памяти). */
function updateLocalIncrement(localId, payload) {
  increments.value = increments.value.map((i) => (i.id === localId
    ? {
        ...i,
        order_index: payload.order_index,
        name: payload.name,
        ar_adr_increment_types_id: payload.ar_adr_increment_types_id,
        type_name: incrementTypeName(payload.ar_adr_increment_types_id),
      }
    : i))
  structureDirty.value = true
}

/** Удалить локальное решение вместе с его системами, черновыми системами и интеграциями (всё — в памяти). */
function removeLocalIncrement(localId) {
  increments.value = increments.value.filter((i) => i.id !== localId)
  const nextData = { ...incrementDataMap.value }
  delete nextData[localId]
  incrementDataMap.value = nextData
  const nextRelations = { ...relationsByIncrement.value }
  delete nextRelations[localId]
  relationsByIncrement.value = nextRelations
  draftSystems.value = draftSystems.value.filter((s) => s.incId !== localId)
  if (selectedIncrementId.value === localId) selectedIncrementId.value = increments.value[0]?.id ?? null
  structureDirty.value = true
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
    // Новое заключение (нет id): решения копятся в памяти и уйдут в `POST /full` (issue #74).
    if (editingIncrementId.value && isLocalIncrementId(editingIncrementId.value)) {
      updateLocalIncrement(editingIncrementId.value, payload)
    } else if (editingIncrementId.value) {
      await api.updateIncrement(id.value, editingIncrementId.value, payload)
      await loadIncrements()
    } else if (canManageIncrements.value) {
      await api.addDecisionAppliedIncrement(id.value, payload)
      await loadIncrements()
    } else {
      addLocalIncrement(payload)
    }
    incrementModal.value = false
  } catch (e) {
    incrementError.value = e.body?.error || e.message || 'Ошибка'
  } finally {
    incrementSaving.value = false
  }
}

async function removeIncrement(incId) {
  if (!confirm('Удалить решение? Будут удалены все системы и интеграции этого решения.')) return
  // Локальное решение удаляем из памяти (в БД его ещё нет, issue #74).
  if (isLocalIncrementId(incId)) {
    removeLocalIncrement(incId)
    return
  }
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

/** Добавить существующую систему реестра в решение — локально (в БД при сохранении заключения, issue #74). */
function addSystem() {
  const incId = selectedIncrementId.value
  if (!selectedSystemId.value || !incId) return
  const sysId = Number(selectedSystemId.value)
  const s = (allSystems.value || []).find((x) => Number(x.id) === sysId)
  const statusId = selectedSystemStatusId.value || prefillSystemStatusId.value || defaultApplyStatusId.value || null
  const st = (adrSystemStatuses.value || []).find((x) => Number(x.id) === Number(statusId))
  const row = {
    id: null,
    _local: true,
    _localRowId: `lr:${++localSystemRowSeq}`,
    ar_adr_increment_id: incId,
    ar_systems_id: sysId,
    ar_adr_increment_system_statuses_id: statusId,
    system_code: s ? s.code : '',
    system_name: s ? s.name : '',
    status_name: st ? st.name : '',
    comment: '',
  }
  const cur = incrementDataMap.value[incId] || { systems: [], relations: [] }
  incrementDataMap.value = {
    ...incrementDataMap.value,
    [incId]: { ...cur, systems: [...(cur.systems || []), row] },
  }
  structureDirty.value = true
  selectedSystemId.value = ''
  selectedSystemStatusId.value = prefillSystemStatusId.value || defaultApplyStatusId.value || ''
}

/** Убрать систему из решения — локально (в БД при сохранении заключения, issue #74). */
function removeSystem(row) {
  const incId = selectedIncrementId.value
  if (!incId) return

  if (row?._draft) {
    const key = `n:${row.localId}`
    const list = relationsByIncrement.value[incId] || []
    const affected = list.filter((r) => r.from_key === key || r.to_key === key)
    if (
      affected.length &&
      !confirm(`У системы «${row.name || row.system_name}» есть интеграции (${affected.length}). Удалить систему вместе с ними?`)
    ) {
      return
    }
    draftSystems.value = draftSystems.value.filter((s) => s.localId !== row.localId)
    if (affected.length) {
      relationsByIncrement.value = {
        ...relationsByIncrement.value,
        [incId]: list.filter((r) => r.from_key !== key && r.to_key !== key),
      }
    }
    structureDirty.value = true
    return
  }

  const sysKey = `s:${row.ar_systems_id}`
  const list = relationsByIncrement.value[incId] || []
  const affected = list.filter((r) => r.from_key === sysKey || r.to_key === sysKey)
  const label = row.system_name || row.name || ''
  const msg = affected.length
    ? `Удалить систему «${label}» из решения? Вместе с ней будут удалены интеграции (${affected.length}).`
    : `Удалить систему «${label}» из решения?`
  if (!confirm(msg)) return

  const cur = incrementDataMap.value[incId] || { systems: [], relations: [] }
  const keep = (cur.systems || []).filter((s) =>
    row._local ? s._localRowId !== row._localRowId : Number(s.id) !== Number(row.id)
  )
  incrementDataMap.value = { ...incrementDataMap.value, [incId]: { ...cur, systems: keep } }

  if (affected.length) {
    relationsByIncrement.value = {
      ...relationsByIncrement.value,
      [incId]: list.filter((r) => r.from_key !== sysKey && r.to_key !== sysKey),
    }
  }
  const fkey = systemRowKey(row)
  if (fkey && systemFunctionsMap.value[fkey]) {
    const next = { ...systemFunctionsMap.value }
    delete next[fkey]
    systemFunctionsMap.value = next
  }
  structureDirty.value = true
}

function mapFunctionSelection(rows) {
  return (rows || []).map((f) => ({
    ar_system_functions_id: f.id ?? null,
    name: f.name || '',
    description: f.description || '',
    increment_sysfunc_status_code: f.increment_sysfunc_status_code || null,
  }))
}

/**
 * Подгрузить каталог и текущий выбор функций строки системы (в память формы).
 * Из БД — выбор в заключении; для локально добавленной системы — каталог системы из реестра.
 */
async function loadSystemFunctions(row) {
  if (!row) return
  const key = systemRowKey(row)
  if (!key) return
  try {
    if (row.id != null) {
      const data = await api.getIncrementSystemFunctionSelection(row.id)
      systemFunctionsMap.value = {
        ...systemFunctionsMap.value,
        [key]: { catalog: data.catalog || [], selected: mapFunctionSelection(data.selected_ordered) },
      }
    } else if (row.ar_systems_id != null) {
      const catalog = await api.getSystemFunctions(row.ar_systems_id)
      systemFunctionsMap.value = { ...systemFunctionsMap.value, [key]: { catalog: catalog || [], selected: [] } }
    }
  } catch (_) {
    if (!systemFunctionsMap.value[key]) {
      systemFunctionsMap.value = { ...systemFunctionsMap.value, [key]: { catalog: [], selected: [] } }
    }
  }
}

/** Гарантировать загрузку функций для строк систем (не перезатирая уже изменённые в памяти). */
async function ensureSystemFunctions(rows) {
  for (const row of rows || []) {
    const key = systemRowKey(row)
    if (!key || systemFunctionsMap.value[key]) continue
    await loadSystemFunctions(row)
  }
}

/** Текст ячейки «Функции»: для черновых — из памяти, для строк реестра — из памяти либо comment. */
function systemFunctionsText(row) {
  if (row?._draft) {
    return (row.functions || []).map((f) => f.name).filter(Boolean).join(', ') || '—'
  }
  const key = systemRowKey(row)
  const entry = key ? systemFunctionsMap.value[key] : null
  if (entry) {
    return (entry.selected || []).map((f) => f.name).filter(Boolean).join(', ') || '—'
  }
  return row?.comment?.trim() ? row.comment : '—'
}

async function openFunctionsModal(row) {
  if (row?._draft) {
    functionsModalTarget.value = { kind: 'draft', localId: row.localId, systemName: row.system_name || '' }
    functionsModalCatalog.value = []
    functionsModalSelected.value = (row.functions || []).map((f) => ({ ...f }))
    functionsModalOpen.value = true
    return
  }
  if (!row?.ar_systems_id) return
  const key = systemRowKey(row)
  if (!key) return
  if (!systemFunctionsMap.value[key]) {
    await loadSystemFunctions(row)
  }
  functionsModalTarget.value = { kind: 'row', key, systemName: row.system_name || '' }
  const entry = systemFunctionsMap.value[key]
  functionsModalCatalog.value = entry?.catalog || []
  functionsModalSelected.value = entry?.selected || []
  functionsModalOpen.value = true
}

function closeFunctionsModal() {
  functionsModalOpen.value = false
  functionsModalTarget.value = null
  functionsModalCatalog.value = []
  functionsModalSelected.value = []
}

/** Сохранить выбор «функций в решении» в памяти формы (в реестр — только при сохранении заключения). */
function onFunctionsSaved(list) {
  const t = functionsModalTarget.value
  if (!t) return
  if (t.kind === 'draft') {
    const idx = draftSystems.value.findIndex((s) => s.localId === t.localId)
    if (idx >= 0) draftSystems.value[idx].functions = list || []
  } else if (t.kind === 'row' && t.key) {
    const entry = systemFunctionsMap.value[t.key] || { catalog: [], selected: [] }
    systemFunctionsMap.value = { ...systemFunctionsMap.value, [t.key]: { ...entry, selected: list || [] } }
  }
  structureDirty.value = true
  closeFunctionsModal()
}

function openNewSystemModal() {
  newSystemError.value = ''
  newSystemForm.code = ''
  newSystemForm.name = ''
  newSystemForm.fullname = ''
  newSystemForm.ar_adr_increment_system_statuses_id = prefillSystemStatusId.value || defaultApplyStatusId.value || null
  newSystemModal.value = true
}

function closeNewSystemModal() {
  if (!newSystemSaving.value) newSystemModal.value = false
}

function addDraftSystem() {
  const code = (newSystemForm.code || '').trim()
  const name = (newSystemForm.name || '').trim()
  if (!code || !name) {
    newSystemError.value = 'Укажите код и наименование'
    return
  }
  const statusId = newSystemForm.ar_adr_increment_system_statuses_id
  const st = (adrSystemStatuses.value || []).find((s) => s.id === statusId)
  draftSystemSeq += 1
  draftSystems.value = [
    ...draftSystems.value,
    {
      localId: draftSystemSeq,
      incId: selectedIncrementId.value ?? null,
      _draft: true,
      kind: 'new',
      code,
      name,
      fullname: (newSystemForm.fullname || '').trim() || undefined,
      ar_adr_increment_system_statuses_id: statusId || null,
      system_name: name,
      status_name: st ? st.name : '—',
      comment: '',
      functions: [],
    },
  ]
  structureDirty.value = true
  newSystemModal.value = false
}

function goToNewSystem() {
  if (!canWriteSystem.value) return
  const payload = {
    form: formSnapshot(),
    appliedId: id.value || null,
  }
  const q = { returnTo: isEdit.value ? 'decision-applied-edit' : 'decision-applied-new', payload: btoa(encodeURIComponent(JSON.stringify(payload))) }
  if (id.value) q.appliedId = id.value
  router.push({ path: '/systems/new', query: q })
}

/** Сохранить состав интеграций решения в памяти формы (в БД — при сохранении заключения, issue #74). */
function onRelationsSaved(list) {
  const incId = selectedIncrementId.value
  if (!incId) return
  relationsByIncrement.value = { ...relationsByIncrement.value, [incId]: (list || []).map((r) => ({ ...r })) }
  structureDirty.value = true
  relationsModalOpen.value = false
}

/** Убрать интеграцию из памяти формы (в БД — при сохранении заключения, issue #74). */
function removeRelation(row) {
  const incId = selectedIncrementId.value
  if (!incId || !row) return
  if (!confirm('Удалить интеграцию?')) return
  const list = (relationsByIncrement.value[incId] || []).filter((r) => r._key !== row._key)
  relationsByIncrement.value = { ...relationsByIncrement.value, [incId]: list }
  structureDirty.value = true
}

/**
 * Собрать решения с системами, функциями и связями для `full` (issue #74).
 * Общий payload для создания заключения (`POST /full`, решения ещё локальные) и для редактирования.
 */
function buildIncrementsPayload() {
  const incrementsPayload = []
  for (const inc of increments.value) {
    const systems = (incrementDataMap.value[inc.id]?.systems || []).map(s => ({
      ar_systems_id: s.ar_systems_id,
      ar_adr_increment_system_statuses_id: s.ar_adr_increment_system_statuses_id || null,
      comment: s.comment || '',
      functions: (systemFunctionsMap.value[systemRowKey(s)]?.selected || []).map((f) => (
        f.ar_system_functions_id
          ? {
              ar_system_functions_id: f.ar_system_functions_id,
              name: f.name,
              increment_sysfunc_status_code: f.increment_sysfunc_status_code || null,
            }
          : {
              kind: 'new',
              name: f.name,
              description: f.description || undefined,
              increment_sysfunc_status_code: f.increment_sysfunc_status_code || newSysfuncStatusCode(),
            }
      )),
    }))
    // Черновые системы (kind:"new") — каждую в своё решение (issue #74).
    if (draftSystems.value.length) {
      for (const d of draftSystems.value) {
        const targetIncId = d.incId ?? selectedIncrementId.value
        if (targetIncId !== inc.id) continue
        systems.push({
          kind: 'new',
          local_key: `n:${d.localId}`,
          code: d.code,
          name: d.name,
          fullname: d.fullname || undefined,
          increment_status_code: newSystemStatusCode(),
          ar_adr_increment_system_statuses_id: d.ar_adr_increment_system_statuses_id || null,
          comment: '',
          functions: (d.functions || []).map((f) => ({
            kind: 'new',
            name: f.name,
            description: f.description || undefined,
            increment_sysfunc_status_code: f.increment_sysfunc_status_code || newSysfuncStatusCode(),
          })),
        })
      }
    }
    const relations = (relationsByIncrement.value[inc.id] || []).map((r) => buildRelationPayload(r))
    incrementsPayload.push({
      order_index: inc.order_index,
      name: inc.name || '',
      ar_adr_increment_types_id: inc.ar_adr_increment_types_id || null,
      systems,
      relations,
    })
  }
  return incrementsPayload
}

async function submit(opts = {}) {
  if (!canWrite.value) return
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
      if (isStatusReadOnly.value) {
        await api.updateDecisionAppliedFull(id.value, { ar_adr_statuses_id: form.ar_adr_statuses_id ?? undefined })
      } else {
        const incrementsPayload = buildIncrementsPayload()
        await api.updateDecisionAppliedFull(id.value, { ...body, increments: incrementsPayload })
        draftSystems.value = []
        structureDirty.value = false
        // Перечитать решения и структуру: строки инкрементов пересозданы, локальные id больше не валидны.
        await reloadAfterSave()
      }
      lastLoadedSnapshot.value = formSnapshot()
      isDirty.value = false
      if (!opts.skipNavigate) router.push(listRouteLocation.value)
    } else {
      const res = await api.saveDecisionAppliedFull({ ...body, increments: buildIncrementsPayload() })
      if (res?.code != null) {
        form.code = String(res.code).slice(0, adrCodeMaxLen.value)
      }
      // Локальные данные перенесены в созданную запись: сбрасываем флаг «структура изменена»,
      // иначе сторож ухода предложит сохранить повторно и создастся дубль заключения.
      draftSystems.value = []
      structureDirty.value = false
      lastLoadedSnapshot.value = formSnapshot()
      isDirty.value = false
      if (opts.skipNavigate) {
        // «Сохранить и продолжить» из модалки схем: id нужен для перехода в режим редактирования.
        if (opts.diagramContinue) lastCreatedAppliedId.value = res?.id ?? null
      } else {
        await router.push(routeWithListSearch(`/decisions/applied/${res.id}/edit`))
        // /new и /:id/edit — один и тот же компонент, поэтому данные читаем из БД явно (issue #74, п.5).
        await reloadAfterSave()
      }
    }
  } catch (e) {
    submitError.value = e.body?.error || e.message || 'Ошибка сохранения'
    throw e
  } finally {
    saving.value = false
  }
}

function cancel() {
  if (!canWrite.value) {
    router.push(listRouteLocation.value)
    return
  }
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

useUnsavedGuard(
  computed(() => canWrite.value && formHasUnsavedChanges.value),
  () => submit({ skipNavigate: true })
)
</script>

<style scoped>
.readonly-banner {
  margin: 0 0 1rem;
  padding: 0.65rem 0.85rem;
  background: var(--ar-accent-soft);
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  font-size: 0.9rem;
  color: var(--ar-muted);
}
/* Плашка черновика ИИ-архитектора (issue #78): заметнее режима просмотра, но без «кричащих» цветов. */
.prefill-banner {
  background: var(--ar-surface);
  border-color: var(--ar-accent);
  color: var(--ar-text);
  line-height: 1.45;
}
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
  color: var(--ar-muted);
  background: var(--ar-table-head-bg);
  border: 1px dashed var(--ar-border);
  border-radius: var(--ar-radius-sm);
  line-height: 1.3;
}
.code-pending {
  padding: 0.45rem 0.6rem;
  font-size: 0.9rem;
  color: var(--ar-muted);
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
.help-markdown :deep(td) { border: 1px solid var(--ar-border); padding: 0.4rem 0.6rem; text-align: left; }
.help-markdown :deep(th) { background: var(--ar-table-head-bg); font-weight: 600; }
.help-markdown :deep(hr) { border: none; border-top: 1px solid var(--ar-border); margin: 0.75rem 0; }
.actions-bottom { margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--ar-border); }
.card { background: var(--ar-surface); border-radius: var(--ar-radius-lg); box-shadow: var(--ar-shadow-card); border: 1px solid var(--ar-border); padding: 1rem; margin-bottom: 1rem; }
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
  border-left: 1px solid var(--ar-border);
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
    border-bottom: 1px solid var(--ar-border);
  }
  .block-two-col-body {
    border-left: none;
    width: 100%;
  }
}
.solutions-card { margin-top: 1rem; background: var(--ar-row-hover); border: 1px solid var(--ar-border); }
.solutions-card .block-title { border-bottom: 1px solid var(--ar-border); padding: 0.75rem 1rem; margin: 0; }
.solutions-block { padding: 0 1rem 1rem; margin-top: 0; }
.tabs { display: none; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.field-wide { grid-column: 1 / -1; }
.unified-form > .field-wide { margin-bottom: 1rem; }
.unified-form > .form-grid { margin-bottom: 0; }
.field label { display: block; margin-bottom: 0.35rem; font-weight: 500; font-size: 0.9rem; }
.field input, .field select, .field textarea { width: 100%; padding: 0.5rem 0.6rem; border: 1px solid var(--ar-border); border-radius: var(--ar-radius-sm); background: var(--ar-surface); }
.field input.readonly { background: var(--ar-table-head-bg); }
.req { color: var(--ar-danger); }
.error { color: var(--ar-danger); margin-top: 0.5rem; }
.actions { margin-top: 1rem; display: flex; gap: 0.75rem; }
.loading, .empty, .hint { padding: 1rem; }
.hint { color: var(--ar-muted); font-size: 0.9rem; }

.increment-list { list-style: none; margin: 0; padding: 0; }
.increment-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 1rem; border-bottom: 1px solid var(--ar-border); cursor: pointer; }
.increment-item:hover { background: var(--ar-row-hover); }
.increment-item.selected { background: var(--ar-accent-muted); }
.inc-order { font-weight: 600; min-width: 1.5rem; }
.inc-name { flex: 1; }
.inc-type { color: var(--ar-muted); font-size: 0.9rem; }
.toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; padding: 1rem; border-bottom: 1px solid var(--ar-border); }
.add-row { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.select { min-width: 220px; padding: 0.5rem; border: 1px solid var(--ar-border); border-radius: var(--ar-radius-sm); background: var(--ar-surface); }
.select.narrow { min-width: 140px; }
.td-functions { vertical-align: top; max-width: 28rem; }
.functions-cell { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 0.5rem 0.75rem; }
.functions-text { flex: 1; min-width: 8rem; white-space: pre-line; word-break: break-word; }
.table { width: 100%; border-collapse: collapse; }
.table th, .table td { padding: 0.6rem 1rem; text-align: left; border-bottom: 1px solid var(--ar-border); }
.table th { background: var(--ar-table-head-bg); font-weight: 600; }
.btn-sm { padding: 0.35rem 0.75rem; font-size: 0.85rem; }
.btn-link { margin-right: 0.5rem; }
.modal-overlay { position: fixed; inset: 0; background: rgba(26, 29, 46, 0.45); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal { background: var(--ar-surface); padding: 1.5rem; border-radius: var(--ar-radius-lg); min-width: 380px; max-width: 440px; box-shadow: 0 12px 40px rgba(0,0,0,0.18); border: 1px solid var(--ar-border); }
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
  border-top: 1px solid var(--ar-border);
  margin-top: 0.75rem;
}
.modal.modal-help .modal-actions {
  flex-shrink: 0;
  margin-top: 0.75rem;
}
.modal h3 { margin: 0 0 1rem; font-size: 1.1rem; }
.form-row { margin-bottom: 0.75rem; }
.form-row label { display: block; margin-bottom: 0.25rem; font-size: 0.9rem; }
.form-row input, .form-row select, .form-row textarea { width: 100%; padding: 0.5rem; border: 1px solid var(--ar-border); border-radius: var(--ar-radius-sm); background: var(--ar-surface); }
.modal-actions { margin-top: 1rem; display: flex; gap: 0.5rem; }
.modal-actions .btn { min-height: 40px; padding: 0.6rem 1rem; }
.draft-badge {
  display: inline-block;
  padding: 0.05rem 0.45rem;
  margin-right: 0.35rem;
  font-size: 0.72rem;
  font-weight: 600;
  color: #8a6d00;
  background: #fff3cd;
  border: 1px solid #ffe08a;
  border-radius: 999px;
}
.modal-sub {
  margin: -0.5rem 0 1rem;
  font-size: 0.88rem;
  color: var(--ar-muted);
}
.modal-input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  background: var(--ar-surface);
  box-sizing: border-box;
}
</style>

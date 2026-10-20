<template>
  <div class="page">
    <h1>Параметры</h1>
    <p class="lead">Настроечные параметры системы: подключения, лимиты, флаги. Меню → Настройки → Параметры.</p>
    <p v-if="!canWrite" class="readonly-banner">Режим просмотра: нет права <code>settings_parameters:write</code>.</p>

    <TableToolbar
      v-model:search="search"
      search-placeholder="Поиск по коду, описанию"
    />

    <div class="table-actions">
      <button v-if="canWrite" type="button" class="btn btn-sm btn-primary" @click="openForm()">Добавить параметр</button>
    </div>

    <div v-if="loading" class="loading">Загрузка...</div>
    <div v-else class="card table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Код</th>
            <th>Описание</th>
            <th>Тип</th>
            <th>Значение</th>
            <th>Только чтение</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in list" :key="p.id">
            <td><code class="code-cell">{{ p.code }}</code></td>
            <td class="desc-cell">{{ p.description || '—' }}</td>
            <td>{{ valueTypeLabel(p.value_type) }}</td>
            <td class="value-cell">{{ displayValue(p) }}</td>
            <td>{{ p.read_only ? 'Да' : '—' }}</td>
            <td>
              <button
                type="button"
                class="btn-link"
                :disabled="canWrite && p.read_only"
                @click="openForm(p)"
              >{{ canWrite && !p.read_only ? 'Изменить' : 'Открыть' }}</button>
              <button
                v-if="canWrite"
                type="button"
                class="btn-link danger"
                :disabled="p.read_only"
                @click="remove(p)"
              >Удалить</button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="list.length === 0" class="empty">Нет параметров. Добавьте параметр или настройте их в окружении.</p>
    </div>

    <!-- Модалка добавления/редактирования -->
    <div v-if="form" class="modal-overlay">
      <div class="modal modal-wide">
        <h3>{{ formModalTitle }}</h3>
        <fieldset class="form-fieldset" :disabled="!canMutateForm">
        <div class="form-row">
          <label>Код <span class="req">*</span></label>
          <input v-model="form.code" type="text" placeholder="AR_Keycloak_Enabled" :readonly="!!form.id" class="code-input" />
        </div>
        <div class="form-row">
          <label>Описание</label>
          <textarea v-model="form.description" rows="2" placeholder="Где и как используется параметр"></textarea>
        </div>
        <div class="form-row">
          <label>Тип значения <span class="req">*</span></label>
          <select v-model="form.value_type" :disabled="!!form.id">
            <option value="string">Строка</option>
            <option value="number">Число</option>
            <option value="boolean">Булево</option>
            <option value="json">JSON-объект</option>
            <option value="string_list">Список строк</option>
          </select>
        </div>
        <div class="form-row" v-if="form.value_type === 'string'">
          <label>Значение</label>
          <input v-model="form.value" type="text" placeholder="Значение" />
        </div>
        <div class="form-row" v-else-if="form.value_type === 'number'">
          <label>Значение</label>
          <input v-model.number="form.value" type="number" placeholder="0" />
        </div>
        <div class="form-row" v-else-if="form.value_type === 'boolean'">
          <label>
            <input v-model="form.value" type="checkbox" :true-value="true" :false-value="false" />
            Значение (вкл/выкл)
          </label>
          <p class="hint">Для булева типа: включено = true, выключено = false.</p>
        </div>
        <div class="form-row" v-else-if="form.value_type === 'json'">
          <label>Значение (JSON)</label>
          <textarea
            v-model="form.valueJson"
            rows="16"
            placeholder='{"url": "https://..."}'
            class="mono json-textarea"
            spellcheck="false"
          ></textarea>
          <p v-if="jsonLoadWarning" class="hint warn">{{ jsonLoadWarning }}</p>
          <p v-if="jsonError" class="error">{{ jsonError }}</p>
        </div>
        <div class="form-row" v-else-if="form.value_type === 'string_list'">
          <label>Список строк</label>
          <div class="list-editor">
            <div v-for="(item, idx) in form.valueList" :key="idx" class="list-row">
              <input v-model="form.valueList[idx]" type="text" placeholder="Элемент списка" />
              <button type="button" class="btn-icon" title="Удалить" @click="form.valueList.splice(idx, 1)">×</button>
            </div>
            <button type="button" class="btn btn-sm btn-secondary" @click="form.valueList.push('')">+ Добавить</button>
          </div>
        </div>
        </fieldset>
        <div class="modal-actions">
          <button v-if="canMutateForm" type="button" class="btn btn-primary" :disabled="saving || !canSave" @click="save">Сохранить</button>
          <button type="button" class="btn btn-secondary" @click="form = null">{{ canMutateForm ? 'Отмена' : 'Закрыть' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { api } from '../api/client'
import TableToolbar from '../components/TableToolbar.vue'
import { usePermissions } from '../composables/usePermissions'

const { canWrite } = usePermissions('settings_parameters')

const VALUE_TYPES = {
  string: 'Строка',
  number: 'Число',
  boolean: 'Булево',
  json: 'JSON',
  string_list: 'Список строк',
}

const search = ref('')
const loading = ref(true)
const list = ref([])
const form = ref(null)
const saving = ref(false)
const jsonError = ref('')
const jsonLoadWarning = ref('')

const canMutateForm = computed(() => canWrite.value && form.value && !form.value.read_only)

const formModalTitle = computed(() => {
  if (!form.value) return ''
  if (!form.value.id) return 'Новый параметр'
  return canMutateForm.value ? 'Изменить параметр' : 'Просмотр параметра'
})

const canSave = computed(() => {
  if (!form.value || !canMutateForm.value) return false
  if (!form.value.code || !form.value.code.trim()) return false
  if (form.value.value_type === 'json' && jsonError.value) return false
  return true
})

function valueTypeLabel(type) {
  return VALUE_TYPES[type] || type || '—'
}

/** Форматирование значения для редактора: pretty-print + предупреждение при невалидном JSON в БД. */
function formatJsonForEditor(raw) {
  if (raw == null || raw === '') {
    return { text: '{}', warning: '' }
  }
  if (typeof raw === 'object') {
    try {
      return { text: JSON.stringify(raw, null, 2), warning: '' }
    } catch {
      return { text: '{}', warning: '' }
    }
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return { text: JSON.stringify(parsed, null, 2), warning: '' }
    } catch {
      return {
        text: raw,
        warning:
          'Сохранённое значение не является валидным JSON. Исправьте текст и сохраните, иначе сервер отклонит запись.',
      }
    }
  }
  return { text: JSON.stringify(raw, null, 2), warning: '' }
}

function displayValue(p) {
  if (p.is_secret && p.value) return '********'
  if (!p.value && p.value !== 0) return '—'
  if (p.value_type === 'string_list' || p.value_type === 'json') {
    const s = typeof p.value === 'string' ? p.value : JSON.stringify(p.value)
    return s.length > 40 ? s.slice(0, 40) + '…' : s
  }
  return String(p.value)
}

async function load() {
  loading.value = true
  try {
    list.value = await api.getSettingsParameters(search.value ? { search: search.value } : {})
  } catch (e) {
    list.value = []
  } finally {
    loading.value = false
  }
}

function openForm(param = null) {
  if (!param && !canWrite.value) return
  jsonLoadWarning.value = ''
  if (param) {
    let value = param.value
    if (param.value_type === 'string_list') {
      try {
        value = typeof param.value === 'string' ? JSON.parse(param.value || '[]') : param.value
        value = Array.isArray(value) ? value : []
      } catch {
        value = []
      }
    } else if (param.value_type === 'boolean') {
      value = param.value === true || param.value === 'true' || param.value === '1'
    } else if (param.value_type === 'number') {
      value = param.value != null && param.value !== '' ? Number(param.value) : ''
    }
    let valueJson = ''
    let loadWarn = ''
    if (param.value_type === 'json') {
      const fmt = formatJsonForEditor(param.value)
      valueJson = fmt.text
      loadWarn = fmt.warning
    }
    form.value = {
      id: param.id,
      code: param.code,
      description: param.description ?? '',
      group: param.group ?? '',
      value_type: param.value_type || 'string',
      value: param.value_type === 'json' ? '' : value,
      valueJson,
      valueList: param.value_type === 'string_list' ? (Array.isArray(value) ? [...value] : []) : [],
      is_secret: param.is_secret === true,
      read_only: param.read_only === true,
    }
    jsonLoadWarning.value = loadWarn
  } else {
    form.value = {
      id: null,
      code: '',
      description: '',
      group: '',
      value_type: 'string',
      value: '',
      valueJson: '{}',
      valueList: [],
      is_secret: false,
      read_only: false,
    }
  }
  jsonError.value = ''
}

function getPayload() {
  const f = form.value
  let value
  if (f.value_type === 'json') {
    try {
      value = JSON.parse(f.valueJson || '{}')
      return { ...f, value: JSON.stringify(value) }
    } catch (e) {
      jsonError.value = e instanceof Error ? e.message : 'Неверный JSON'
      return null
    }
  }
  if (f.value_type === 'string_list') {
    value = (f.valueList || []).filter(Boolean)
    return { ...f, value: JSON.stringify(value) }
  }
  if (f.value_type === 'boolean') {
    value = f.value === true || f.value === 'true'
    return { ...f, value: value ? 'true' : 'false' }
  }
  if (f.value_type === 'number') {
    value = f.value != null && f.value !== '' ? String(Number(f.value)) : ''
    return { ...f, value }
  }
  return { ...f, value: f.value != null ? String(f.value) : '' }
}

async function save() {
  if (!canMutateForm.value) return
  const payload = getPayload()
  if (!payload) {
    if (form.value?.value_type === 'json' && !jsonError.value) {
      jsonError.value = 'Неверный JSON'
    }
    return
  }
  saving.value = true
  jsonError.value = ''
  try {
    const body = {
      code: payload.code.trim(),
      description: payload.description || null,
      group: payload.group || null,
      value_type: payload.value_type,
      value: payload.value,
      is_secret: payload.is_secret,
      read_only: payload.read_only,
    }
    if (payload.id) {
      await api.updateSettingsParameter(payload.id, body)
    } else {
      await api.createSettingsParameter(body)
    }
    form.value = null
    await load()
  } catch (e) {
    alert(e.message || e.body?.error || 'Ошибка сохранения')
  } finally {
    saving.value = false
  }
}

async function remove(p) {
  if (!canWrite.value || p.read_only) return
  if (!confirm(`Удалить параметр "${p.code}"?`)) return
  try {
    await api.deleteSettingsParameter(p.id)
    await load()
  } catch (e) {
    alert(e.message || e.body?.error || 'Ошибка удаления')
  }
}

watch(form, (f) => {
  if (f && f.value_type === 'json' && f.valueJson !== undefined && f.valueJson !== null) {
    try {
      JSON.parse(f.valueJson === '' ? '{}' : f.valueJson)
      jsonError.value = ''
    } catch (e) {
      jsonError.value = e instanceof Error ? e.message : 'Неверный JSON'
    }
  } else {
    jsonError.value = ''
  }
}, { deep: true })

watch(
  () => form.value?.value_type,
  (t) => {
    if (!form.value || t !== 'json') return
    if (form.value.valueJson === undefined || form.value.valueJson === null || form.value.valueJson === '') {
      form.value.valueJson = '{}'
    }
  },
)

watch(search, () => load())

load()
</script>

<style scoped>
.lead {
  color: var(--ar-muted);
  font-size: 0.9rem;
  margin-bottom: 1rem;
}
.readonly-banner {
  margin: 0 0 0.75rem;
  padding: 0.6rem 0.75rem;
  border-radius: var(--ar-radius-sm);
  background: var(--ar-table-head-bg);
  color: var(--ar-muted);
  font-size: 0.9rem;
}
.form-fieldset {
  border: 0;
  margin: 0;
  padding: 0;
  min-width: 0;
}
.table-actions {
  margin-bottom: 0.75rem;
}
.code-cell {
  font-size: 0.85rem;
  background: var(--ar-table-head-bg);
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
}
.desc-cell {
  max-width: 240px;
}
.value-cell {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.btn-link:not(.danger) {
  color: var(--ar-link);
  margin-right: 0.5rem;
}
.btn-link:disabled {
  color: var(--ar-muted);
  cursor: not-allowed;
}
.loading,
.empty {
  color: var(--ar-muted);
}
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(26, 29, 46, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.modal {
  background: var(--ar-surface);
  padding: 1.5rem;
  border-radius: var(--ar-radius-lg);
  min-width: 360px;
  max-width: 90vw;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
  border: 1px solid var(--ar-border);
}
.modal-wide {
  min-width: 480px;
}
.modal h3 {
  margin: 0 0 1rem;
  font-size: 1.1rem;
  color: var(--ar-text);
}
.form-row {
  margin-bottom: 0.75rem;
}
.form-row label {
  display: block;
  margin-bottom: 0.25rem;
  font-size: 0.9rem;
}
.form-row input:not([type="checkbox"]):not([type="radio"]),
.form-row select,
.form-row textarea {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  font-size: 1rem;
  box-sizing: border-box;
  background: var(--ar-surface);
}
.form-row select {
  cursor: pointer;
}
.form-row textarea.mono {
  font-family: ui-monospace, monospace;
  font-size: 0.9rem;
}
.form-row textarea.json-textarea {
  min-height: 14rem;
  line-height: 1.45;
  resize: vertical;
}
.form-row .hint.warn {
  color: #b45309;
}
.form-row input[type="checkbox"] {
  margin-right: 0.5rem;
}
.form-row .hint,
.form-row .error {
  margin-top: 0.25rem;
  font-size: 0.85rem;
}
.form-row .error {
  color: var(--ar-danger);
}
.list-row {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  align-items: center;
}
.list-row input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  font-size: 1rem;
  box-sizing: border-box;
}
.btn-icon {
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  background: var(--ar-surface);
  cursor: pointer;
  font-size: 1.2rem;
  line-height: 1;
  color: var(--ar-muted);
}
.btn-icon:hover {
  background: var(--ar-row-hover);
  color: var(--ar-danger);
}
.modal-actions {
  margin-top: 1rem;
  display: flex;
  gap: 0.5rem;
}
.modal-actions .btn {
  min-height: 40px;
  padding: 0.6rem 1rem;
}
</style>

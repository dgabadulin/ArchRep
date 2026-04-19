<template>
  <div class="page">
    <h1>Параметры</h1>
    <p class="lead">Настроечные параметры системы: подключения, лимиты, флаги. Меню → Настройки → Параметры.</p>

    <TableToolbar
      v-model:search="search"
      search-placeholder="Поиск по коду, описанию"
    />

    <div class="table-actions">
      <button type="button" class="btn btn-sm btn-primary" @click="openForm()">Добавить параметр</button>
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
              <button type="button" class="btn-link" :disabled="p.read_only" @click="openForm(p)">Изменить</button>
              <button type="button" class="btn-link danger" :disabled="p.read_only" @click="remove(p)">Удалить</button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="list.length === 0" class="empty">Нет параметров. Добавьте параметр или настройте их в окружении.</p>
    </div>

    <!-- Модалка добавления/редактирования -->
    <div v-if="form" class="modal-overlay">
      <div class="modal modal-wide">
        <h3>{{ form.id ? 'Изменить параметр' : 'Новый параметр' }}</h3>
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
        <div class="modal-actions">
          <button type="button" class="btn btn-primary" :disabled="saving || !canSave" @click="save">Сохранить</button>
          <button type="button" class="btn btn-secondary" @click="form = null">Отмена</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { api } from '../api/client'
import TableToolbar from '../components/TableToolbar.vue'

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

const canSave = computed(() => {
  if (!form.value) return false
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
  if (p.read_only) return
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
.page { }
.lead { color: #5c5349; font-size: 0.9rem; margin-bottom: 1rem; }
.table-actions { margin-bottom: 0.75rem; }
.card { background: #fff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); border: 1px solid #e5e7eb; overflow: hidden; }
.table { width: 100%; border-collapse: collapse; }
.table th, .table td { padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid #e5e7eb; }
.table th { background: #faf8f5; font-weight: 600; color: #5c5349; }
.code-cell { font-size: 0.85rem; background: #f1f5f9; padding: 0.2rem 0.4rem; border-radius: 4px; }
.desc-cell { max-width: 240px; }
.value-cell { max-width: 200px; overflow: hidden; text-overflow: ellipsis; }
.btn { padding: 0.5rem 1rem; border-radius: 6px; font-size: 0.9rem; border: none; cursor: pointer; }
.btn-sm { padding: 0.4rem 0.75rem; font-size: 0.85rem; }
.btn-primary { background: #0284c7; color: #fff; }
.btn-primary:hover:not(:disabled) { background: #0369a1; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-secondary { background: #e2e8f0; color: #475569; }
.btn-secondary:hover { background: #cbd5e1; }
.btn-link { background: none; border: none; color: #0284c7; cursor: pointer; text-decoration: underline; font-size: 0.9rem; margin-right: 0.5rem; }
.btn-link:disabled { color: #94a3b8; cursor: not-allowed; }
.btn-link.danger { color: #b91c1c; }
.loading, .empty { padding: 1rem; color: #5c5349; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal { background: #fff; padding: 1.5rem; border-radius: 8px; min-width: 360px; max-width: 90vw; max-height: 90vh; overflow-y: auto; box-shadow: 0 4px 20px rgba(0,0,0,0.15); }
.modal-wide { min-width: 480px; }
.modal h3 { margin: 0 0 1rem; font-size: 1.1rem; }
.form-row { margin-bottom: 0.75rem; }
.form-row label { display: block; margin-bottom: 0.25rem; font-size: 0.9rem; }
/* Все поля ввода в строке формы на всю ширину (в т.ч. input без type — иначе не матчится [type="text"]) */
.form-row input:not([type="checkbox"]):not([type="radio"]),
.form-row select,
.form-row textarea { width: 100%; padding: 0.5rem; border: 1px solid #d4c4b0; border-radius: 6px; font-size: 1rem; box-sizing: border-box; }
.form-row select { cursor: pointer; background: #fff; }
.form-row textarea.mono { font-family: ui-monospace, monospace; font-size: 0.9rem; }
.form-row textarea.json-textarea { min-height: 14rem; line-height: 1.45; resize: vertical; }
.form-row .hint.warn { color: #b45309; }
.form-row input[type="checkbox"] { margin-right: 0.5rem; }
.form-row .hint, .form-row .error { margin-top: 0.25rem; font-size: 0.85rem; }
.form-row .error { color: #b91c1c; }
.req { color: #b91c1c; }
.list-editor { }
.list-row { display: flex; gap: 0.5rem; margin-bottom: 0.5rem; align-items: center; }
.list-row input { flex: 1; padding: 0.5rem; border: 1px solid #d4c4b0; border-radius: 6px; font-size: 1rem; box-sizing: border-box; }
.btn-icon { width: 32px; height: 32px; padding: 0; border: 1px solid #d4c4b0; border-radius: 6px; background: #fff; cursor: pointer; font-size: 1.2rem; line-height: 1; color: #64748b; }
.btn-icon:hover { background: #faf8f5; color: #b91c1c; }
.modal-actions { margin-top: 1rem; display: flex; gap: 0.5rem; }
.modal-actions .btn { min-height: 40px; padding: 0.6rem 1rem; }
</style>

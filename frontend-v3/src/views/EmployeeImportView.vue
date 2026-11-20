<template>
  <div class="page">
    <div class="page-head">
      <h1>Загрузка справочника сотрудников</h1>
      <router-link to="/settings/service-operations" class="btn btn-primary">← К сервисным операциям</router-link>
    </div>
    <p class="lead">
      Полная синхронизация справочника из CSV. Файл должен содержать всех сотрудников: отсутствующие
      в нём сотрудники с табельным номером получают статус «уволен». Пустые должность, подразделение
      и email очищают значения.
    </p>

    <div v-if="error" class="banner banner-err">{{ error }}</div>
    <div v-if="message" class="banner banner-ok">{{ message }}</div>

    <div class="card form">
      <h3>Файл</h3>
      <p class="hint">
        UTF-8 CSV, первая строка — заголовки:
        <code>Табельный номер;Сотрудник;Служебный адрес электронной почты;Должность;Подразделение</code>.
        Разделитель <code>,</code> или <code>;</code> определяется автоматически.
      </p>
      <div class="actions">
        <button type="button" class="btn btn-primary" :disabled="busy" @click="downloadTemplate">Скачать шаблон CSV</button>
        <label class="file-label">
          Выбрать CSV
          <input type="file" accept=".csv,text/csv" :disabled="busy" @change="onFile" />
        </label>
        <span v-if="fileName" class="muted">{{ fileName }}</span>
      </div>
      <div class="actions">
        <button type="button" class="btn btn-primary" :disabled="!canValidate" @click="runValidate">
          {{ busy && !applyMode ? 'Проверка…' : 'Проверить' }}
        </button>
        <button type="button" class="btn btn-primary" :disabled="!canApply" @click="runApply">
          {{ busy && applyMode ? 'Загрузка…' : 'Загрузить' }}
        </button>
      </div>
    </div>

    <div v-if="summary" class="card">
      <h3>Результат проверки</h3>
      <table class="summary-table">
        <tbody>
          <tr><th>Строк в файле</th><td>{{ summary.rows || 0 }}</td></tr>
          <tr><th>Будет создано</th><td>{{ summary.would_create || 0 }}</td></tr>
          <tr><th>Будет обновлено</th><td>{{ summary.would_update || 0 }}</td></tr>
          <tr><th>Будет восстановлено</th><td>{{ summary.would_reactivate || 0 }}</td></tr>
          <tr><th>Будет уволено</th><td class="danger-text">{{ summary.would_deactivate || 0 }}</td></tr>
          <tr><th>Ошибок</th><td class="danger-text">{{ summary.errors || 0 }}</td></tr>
          <tr><th>Без табельного номера в БД</th><td>{{ summary.untouched_without_number || 0 }}</td></tr>
        </tbody>
      </table>

      <div v-if="summary.errors" class="banner banner-err">
        Применение заблокировано: исправьте ошибки в файле и повторите проверку.
      </div>
      <div v-if="summary.would_deactivate" class="deactivate-box">
        <p><strong>Будут помечены как уволенные:</strong> {{ summary.would_deactivate }}</p>
        <ul>
          <li v-for="e in deactivate" :key="e.id">
            {{ e.employee_number }} — {{ e.full_name }}
          </li>
        </ul>
        <label class="check">
          <input v-model="confirmDeactivate" type="checkbox" />
          Подтверждаю увольнение указанных сотрудников
        </label>
        <label v-if="summary.requiresLargeDeactivationConfirm" class="check">
          <input v-model="allowLargeDeactivation" type="checkbox" />
          Подтверждаю массовое увольнение ({{ summary.would_deactivate }} из {{ summary.active_with_number }})
        </label>
      </div>
    </div>

    <div v-if="rows.length" class="card">
      <h3>Строки файла</h3>
      <div class="table-wrap">
        <table class="rows-table">
          <thead>
            <tr>
              <th>Строка</th><th>Табельный №</th><th>Сотрудник</th><th>Email</th>
              <th>Должность</th><th>Подразделение</th><th>Статус</th><th>Ошибка</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in rows" :key="r.row_no" :class="{ 'row-error': r.errors && r.errors.length }">
              <td>{{ r.row_no }}</td>
              <td>{{ r.employee_number || '—' }}</td>
              <td>{{ r.full_name || '—' }}</td>
              <td>{{ r.email || '—' }}</td>
              <td>{{ r.position || '—' }}</td>
              <td>{{ r.department || '—' }}</td>
              <td>{{ statusLabel(r.status) }}</td>
              <td>{{ (r.errors || []).join('; ') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { employeeImportApi } from '../api'
import { downloadBlob } from '../utils/downloadBlob'

const fileBase64 = ref('')
const fileName = ref('')
const busy = ref(false)
const applyMode = ref(false)
const error = ref('')
const message = ref('')
const summary = ref(null)
const rows = ref([])
const deactivate = ref([])
const confirmDeactivate = ref(false)
const allowLargeDeactivation = ref(false)

const canValidate = computed(() => !!fileBase64.value && !busy.value)
const canApply = computed(() => {
  if (!fileBase64.value || !summary.value || busy.value) return false
  if (summary.value.errors > 0) return false
  if (summary.value.would_deactivate > 0 && !confirmDeactivate.value) return false
  if (summary.value.requiresLargeDeactivationConfirm && !allowLargeDeactivation.value) return false
  return true
})

function onFile(event) {
  const file = event.target.files && event.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const value = String(reader.result || '')
    const comma = value.indexOf(',')
    fileBase64.value = comma >= 0 ? value.slice(comma + 1) : value
    fileName.value = file.name
    summary.value = null
    rows.value = []
    deactivate.value = []
    confirmDeactivate.value = false
    allowLargeDeactivation.value = false
    error.value = ''
    message.value = ''
  }
  reader.onerror = () => { error.value = 'Не удалось прочитать файл' }
  reader.readAsDataURL(file)
}

async function downloadTemplate() {
  error.value = ''
  try {
    const blob = await employeeImportApi.template()
    downloadBlob(blob, 'employees-template.csv')
  } catch (e) {
    error.value = e.message || 'Не удалось скачать шаблон'
  }
}

async function runValidate() {
  error.value = ''
  message.value = ''
  busy.value = true
  applyMode.value = false
  try {
    const res = await employeeImportApi.validate({
      fileBase64: fileBase64.value,
      filename: fileName.value,
    })
    summary.value = res.summary || {}
    rows.value = res.rows || []
    deactivate.value = res.deactivate || []
    confirmDeactivate.value = false
    allowLargeDeactivation.value = false
    message.value = 'Проверка завершена. Проверьте сводку и подтвердите загрузку.'
  } catch (e) {
    applyError(e)
  } finally {
    busy.value = false
  }
}

async function runApply() {
  error.value = ''
  message.value = ''
  if (!summary.value || summary.value.errors > 0) {
    error.value = 'Сначала исправьте ошибки в файле и повторите проверку.'
    return
  }
  if (summary.value.would_deactivate > 0 && !confirmDeactivate.value) {
    error.value = 'Подтвердите увольнение сотрудников.'
    return
  }
  if (summary.value.requiresLargeDeactivationConfirm && !allowLargeDeactivation.value) {
    error.value = 'Подтвердите массовое увольнение.'
    return
  }
  busy.value = true
  applyMode.value = true
  try {
    const res = await employeeImportApi.apply({
      fileBase64: fileBase64.value,
      filename: fileName.value,
      confirmDeactivate: confirmDeactivate.value,
      expectedDeactivateCount: summary.value.would_deactivate || 0,
      allowLargeDeactivation: allowLargeDeactivation.value,
    })
    summary.value = res.summary || summary.value
    rows.value = res.rows || rows.value
    deactivate.value = res.deactivate || deactivate.value
    message.value = `Загружено: создано ${res.summary?.created || 0}, обновлено ${res.summary?.updated || 0}, восстановлено ${res.summary?.reactivated || 0}, уволено ${res.summary?.deactivated || 0}.`
  } catch (e) {
    applyError(e)
  } finally {
    busy.value = false
  }
}

function applyError(e) {
  error.value = e.message || 'Ошибка загрузки'
  const body = e.body || {}
  if (body.summary) summary.value = body.summary
  if (body.rows) rows.value = body.rows
  if (body.deactivate) deactivate.value = body.deactivate
}

function statusLabel(status) {
  const map = {
    would_create: 'будет создан',
    would_update: 'будет обновлён',
    would_reactivate: 'будет восстановлен',
    created: 'создан',
    updated: 'обновлён',
    reactivated: 'восстановлен',
    error: 'ошибка',
  }
  return map[status] || status || '—'
}
</script>

<style scoped>
.page-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem; }
.lead { color: var(--text-muted, #666); margin-bottom: 1rem; line-height: 1.5; }
.card { margin-bottom: 1rem; }
.form { padding: 1rem; }
.hint { color: var(--text-muted, #666); font-size: 0.9rem; line-height: 1.5; }
.hint code { white-space: normal; }
.actions { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem; margin-top: 0.9rem; }
.file-label { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.9rem; }
.muted { color: var(--text-muted, #666); font-size: 0.9rem; }
.summary-table { width: 100%; border-collapse: collapse; font-size: 0.92rem; }
.summary-table th, .summary-table td { text-align: left; padding: 0.35rem 0.5rem; border-bottom: 1px solid var(--ar-border, #e4e6ea); }
.summary-table th { width: 260px; color: var(--text-muted, #666); font-weight: 600; }
.danger-text { color: #b00020; font-weight: 600; }
.banner { padding: 0.7rem 1rem; border-radius: 6px; margin-bottom: 1rem; font-size: 0.9rem; }
.banner-ok { background: #e8f5e9; border: 1px solid #c8e6c9; color: #2e4a32; }
.banner-err { background: #ffebee; border: 1px solid #ffcdd2; color: #8b1c1c; }
.deactivate-box { margin-top: 1rem; padding: 0.75rem; border: 1px solid #ffcdd2; border-radius: 6px; background: #fff8f8; }
.deactivate-box ul { max-height: 220px; overflow: auto; margin: 0.5rem 0; padding-left: 1.2rem; }
.check { display: block; margin-top: 0.45rem; font-size: 0.9rem; }
.table-wrap { overflow: auto; max-height: 480px; }
.rows-table { width: 100%; border-collapse: collapse; font-size: 0.86rem; }
.rows-table th, .rows-table td { text-align: left; vertical-align: top; padding: 0.35rem 0.45rem; border-bottom: 1px solid var(--ar-border, #e4e6ea); }
.rows-table th { position: sticky; top: 0; background: var(--ar-surface, #fff); }
.row-error { background: #fff4f4; }
</style>



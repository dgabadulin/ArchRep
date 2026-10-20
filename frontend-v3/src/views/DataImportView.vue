<template>
  <div class="page">
    <div class="page-head">
      <h1>Импорт данных</h1>
      <div class="page-head-actions">
        <button type="button" class="btn-link help-rules-link" @click="helpOpen = true">Справка</button>
        <router-link to="/settings/service-operations" class="btn btn-primary">← К сервисным операциям</router-link>
      </div>
    </div>
    <p class="lead">Загрузка записей в реестры из Excel по шаблону. Заполняйте только столбцы полей карточки; ссылочные значения — из справочников файла.</p>

    <div v-if="helpOpen" class="modal-overlay">
      <div class="modal modal-help" role="dialog" aria-modal="true" aria-labelledby="import-page-help-title">
        <h3 id="import-page-help-title">Импорт данных — справка</h3>
        <div class="help-markdown modal-help-body" v-html="helpHtml"></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-primary" @click="helpOpen = false">Закрыть</button>
        </div>
      </div>
    </div>

    <div v-if="error" class="error">{{ error }}</div>
    <div v-if="summaryText" class="banner banner-ok">{{ summaryText }}</div>

    <form class="card form" @submit.prevent>
      <div class="form-grid">
        <div class="field">
          <label>Выберите реестр для импорта</label>
          <select v-model="entityCode" required>
            <option disabled value="">— выберите —</option>
            <option v-for="e in entities" :key="e.code" :value="e.code">{{ e.name }} ({{ e.code }})</option>
          </select>
        </div>
        <div class="field field-wide actions-row">
          <button type="button" class="btn btn-primary" :disabled="!entityCode || busy" @click="downloadTemplate">
            Скачать шаблон
          </button>
          <button type="button" class="btn btn-primary" :disabled="!entityCode || busy" @click="downloadExport">
            Скачать текущий реестр (экспорт)
          </button>
        </div>
        <div class="field field-wide">
          <label>Файл Excel (.xlsx)</label>
          <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" @change="onFile" />
        </div>
        <div class="field">
          <label>Если запись уже есть</label>
          <select v-model="onExists">
            <option value="update">Обновить (только непустые ячейки)</option>
            <option value="skip">Пропустить</option>
            <option value="fail">Ошибка строки</option>
          </select>
        </div>
        <div class="field">
          <label>Состав протокола</label>
          <select v-model="protocolMode">
            <option value="all">Все строки</option>
            <option value="errors">Только ошибки / пропуски</option>
          </select>
        </div>
      </div>
      <div class="actions actions-bottom">
        <button type="button" class="btn btn-primary" :disabled="!canRun" @click="run(false)">
          {{ busy && !applyMode ? 'Проверка…' : 'Проверить' }}
        </button>
        <button type="button" class="btn btn-primary" :disabled="!canRun" @click="run(true)">
          {{ busy && applyMode ? 'Загрузка…' : 'Загрузить' }}
        </button>
        <button type="button" class="btn btn-primary" :disabled="!protocolBase64" @click="downloadProtocol">
          Скачать протокол
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { marked } from 'marked'
import { importApi } from '../api'
import { downloadBlob } from '../utils/downloadBlob'
import importHelpText from '../content/data-import-help.md?raw'

const entities = ref([])
const entityCode = ref('')
const fileBase64 = ref('')
const fileName = ref('')
const onExists = ref('update')
const protocolMode = ref('all')
const busy = ref(false)
const applyMode = ref(false)
const error = ref('')
const summaryText = ref('')
const protocolBase64 = ref('')
const protocolFilename = ref('import-protocol.xlsx')
const helpOpen = ref(false)
const helpHtml = computed(() => marked.parse(importHelpText || ''))

const canRun = computed(() => !!entityCode.value && !!fileBase64.value && !busy.value)

onMounted(async () => {
  try {
    entities.value = await importApi.entities()
    if (entities.value.length === 1) entityCode.value = entities.value[0].code
  } catch (e) {
    error.value = e.message || 'Не удалось загрузить список сущностей'
  }
})

function onFile(ev) {
  const f = ev.target.files?.[0]
  fileBase64.value = ''
  fileName.value = ''
  protocolBase64.value = ''
  summaryText.value = ''
  if (!f) return
  fileName.value = f.name
  const reader = new FileReader()
  reader.onload = () => {
    const s = String(reader.result || '')
    const i = s.indexOf(',')
    fileBase64.value = i >= 0 ? s.slice(i + 1) : s
  }
  reader.readAsDataURL(f)
}

async function downloadTemplate() {
  error.value = ''
  try {
    const blob = await importApi.template(entityCode.value)
    downloadBlob(blob, `import-template-${entityCode.value}.xlsx`)
  } catch (e) {
    error.value = e.message || 'Ошибка шаблона'
  }
}

async function downloadExport() {
  error.value = ''
  try {
    const blob = await importApi.export(entityCode.value)
    downloadBlob(blob, `import-export-${entityCode.value}.xlsx`)
  } catch (e) {
    error.value = e.message || 'Ошибка экспорта'
  }
}

async function run(apply) {
  error.value = ''
  summaryText.value = ''
  busy.value = true
  applyMode.value = apply
  try {
    const body = {
      entity: entityCode.value,
      fileBase64: fileBase64.value,
      onExists: onExists.value,
      protocolMode: protocolMode.value,
    }
    const res = apply ? await importApi.apply(body) : await importApi.validate(body)
    const s = res.summary || {}
    summaryText.value = apply
      ? `Создано ${s.created || 0}, обновлено ${s.updated || 0}, пропущено ${s.skipped || 0}, ошибок ${s.errors || 0}`
      : `Проверка: будет создано ${s.would_create || 0}, обновлено ${s.would_update || 0}, пропущено ${s.skipped || 0}, ошибок ${s.errors || 0}`
    protocolBase64.value = res.protocolBase64 || ''
    protocolFilename.value = res.filename || 'import-protocol.xlsx'
  } catch (e) {
    error.value = e.message || 'Ошибка импорта'
  } finally {
    busy.value = false
  }
}

function downloadProtocol() {
  if (!protocolBase64.value) return
  const bin = atob(protocolBase64.value)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  downloadBlob(new Blob([arr], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), protocolFilename.value)
}
</script>

<style scoped>
.page-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem; }
.page-head-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; }
.help-rules-link { padding: 0; font-size: 0.95rem; }
.lead { color: var(--text-muted, #666); margin-bottom: 1rem; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.field-wide { grid-column: 1 / -1; }
.actions-row { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.banner-ok { background: #e8f5e9; padding: 0.75rem 1rem; border-radius: 4px; margin-bottom: 1rem; }
.error { color: #b00020; margin-bottom: 1rem; }
.actions-bottom { margin-top: 1rem; display: flex; flex-wrap: wrap; gap: 0.5rem; }
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}
.modal {
  background: var(--ar-surface, #fff);
  border-radius: var(--ar-radius-lg, 8px);
  padding: 1.25rem 1.5rem;
  max-width: 420px;
  width: 100%;
  border: 1px solid var(--ar-border, #ddd);
}
.modal.modal-help {
  max-width: 720px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
}
.modal-help-body { overflow: auto; flex: 1; min-height: 0; }
.help-markdown { margin: 0; padding: 0.25rem 0; font-size: 0.85rem; }
.help-markdown :deep(h2) { margin: 0.75rem 0 0.4rem; font-size: 1rem; }
.help-markdown :deep(h2:first-child) { margin-top: 0; }
.help-markdown :deep(p),
.help-markdown :deep(li) { margin: 0.35rem 0; line-height: 1.45; }
.help-markdown :deep(ol),
.help-markdown :deep(ul) { margin: 0.35rem 0; padding-left: 1.25rem; }
.modal-actions { display: flex; gap: 0.5rem; margin-top: 1rem; flex-shrink: 0; }
@media (max-width: 700px) {
  .form-grid { grid-template-columns: 1fr; }
}
</style>

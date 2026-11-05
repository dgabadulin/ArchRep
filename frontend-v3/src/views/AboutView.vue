<template>
  <div class="page">
    <div class="page-head">
      <h1>О системе</h1>
    </div>

    <div v-if="loading" class="loading">Загрузка…</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <template v-else-if="info">
      <p v-if="deployState !== 'release' && canSeeDeployWarn"
         :class="['banner', deployState === 'dirty' ? 'banner--error' : 'banner--warn']">
        <template v-if="deployState === 'dirty'">
          Грязный деплой: {{ deploy.dirty_files }} файл(ов) вне git — сборка не воспроизводима,
          не используйте её как эталон для воспроизведения ошибок.
        </template>
        <template v-else>
          Деплой не из релиза: база <strong>{{ deploy.base_tag || '—' }}</strong>,
          впереди {{ deploy.ahead_commits }} коммит(ов){{ info.commit ? ` (${info.commit})` : '' }}.
        </template>
        <span class="muted">Версия {{ info.version }}, канал {{ channel }}.</span>
      </p>
      <p v-if="versionMismatch" class="banner banner--warn">
        Версия интерфейса ({{ frontendVersion }}) не совпадает с версией API ({{ info.version }}).
        Вероятно, страница загружена из кеша — обновите её (Ctrl+F5).
      </p>
      <p v-if="pending && pending.length && canSeeSchemaWarn" class="banner banner--error">
        Код новее схемы БД: не применено миграций — {{ pending.length }}.
        Примените скрипты из <code>DB/scripts</code> (вручную, по регламенту) и обновите страницу.
      </p>

      <div class="card">
        <h3 class="block-title">Версия</h3>
        <table class="about-table">
          <tbody>
            <tr><th>Продукт</th><td>{{ info.product }}</td></tr>
            <tr><th>Версия</th><td><strong>{{ info.version }}</strong> <span class="muted">({{ channel }})</span></td></tr>
            <tr><th>Коммит</th><td>{{ info.commit || '—' }}</td></tr>
            <tr><th>Сборка</th><td>{{ formatDate(info.build_time) }}</td></tr>
            <tr><th>Состояние деплоя</th><td>{{ deployStateLabel }}</td></tr>
            <tr><th>Версия контракта API</th><td>{{ info.contract_version || '—' }}</td></tr>
            <tr><th>Интерфейс</th><td>{{ frontendVersion || '—' }}{{ frontendCommit ? ` (${frontendCommit})` : '' }}</td></tr>
          </tbody>
        </table>
      </div>

      <div class="card">
        <h3 class="block-title">Схема базы данных</h3>
        <table class="about-table">
          <tbody>
            <tr><th>Версия схемы</th><td>{{ info.db.schema_version || 'неизвестна' }}</td></tr>
            <tr><th>Источник</th><td>{{ schemaSourceLabel }}</td></tr>
            <tr><th>Применена</th><td>{{ formatDate(info.db.applied_at) }}</td></tr>
            <tr>
              <th>Неприменённые миграции</th>
              <td>
                <span v-if="pending === null" class="muted">неизвестно (схема не отслеживается)</span>
                <span v-else-if="!pending.length">нет</span>
                <ul v-else class="pending-list">
                  <li v-for="name in pending" :key="name"><code>{{ name }}</code></li>
                </ul>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { api } from '../api/client'
import { usePermissions } from '../composables/usePermissions'
import { messageFromApiError } from '../utils/apiErrors'

const { hasPermission } = usePermissions()

const info = ref(null)
const loading = ref(true)
const error = ref('')

const frontendVersion = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : ''
const frontendCommit = typeof __APP_COMMIT__ === 'string' ? __APP_COMMIT__ : ''

const channel = computed(() => (info.value && info.value.channel) || 'stable')
const pending = computed(() => {
  const db = (info.value && info.value.db) || {}
  if (Array.isArray(db.pending)) return db.pending
  return db.pending === null ? null : []
})
const versionMismatch = computed(() => Boolean(
  frontendVersion && info.value && info.value.version && frontendVersion !== info.value.version,
))
const canSeeSchemaWarn = computed(() => {
  const mode = (info.value && info.value.db && info.value.db.warn_mode) || 'admin'
  if (mode === 'off') return false
  if (mode === 'all') return true
  return hasPermission('settings_parameters:write') || hasPermission('system_admin:restart')
})
const schemaSourceLabel = computed(() => {
  const source = info.value && info.value.db && info.value.db.source
  if (source === 'schema_info') return 'маркер ar_schema_info (накат скриптов)'
  if (source === 'pgmigrations') return 'pgmigrations (node-pg-migrate, demo)'
  return 'не отслеживается'
})

/** Состояние деплоя (docs/versioning.md §4): release | ahead | dirty. */
const deploy = computed(() => {
  const d = (info.value && info.value.deploy) || {}
  return {
    state: d.state || 'release',
    base_tag: d.base_tag || null,
    ahead_commits: Number(d.ahead_commits) || 0,
    dirty_files: Number(d.dirty_files) || 0,
    warn_mode: d.warn_mode || 'admin',
  }
})
const deployState = computed(() => deploy.value.state)
const canSeeDeployWarn = computed(() => {
  const mode = deploy.value.warn_mode
  if (mode === 'off') return false
  if (mode === 'all') return true
  return hasPermission('settings_parameters:write') || hasPermission('system_admin:restart')
})
const deployStateLabel = computed(() => {
  const d = deploy.value
  if (d.state === 'dirty') return `грязный (${d.dirty_files} файл(ов) вне git)`
  if (d.state === 'ahead') return `впереди релиза ${d.base_tag || ''} (+${d.ahead_commits})`
  return 'релиз (тег)'
})

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString('ru-RU')
}

onMounted(async () => {
  loading.value = true
  error.value = ''
  try {
    info.value = await api.getVersion()
  } catch (e) {
    error.value = messageFromApiError(e?.status, e?.body, e?.message) || 'Не удалось получить данные о версии'
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.about-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.92rem;
}
.about-table th,
.about-table td {
  text-align: left;
  vertical-align: top;
  padding: 0.35rem 0.5rem;
  border-bottom: 1px solid var(--ar-border, #e4e6ea);
}
.about-table th {
  width: 240px;
  font-weight: 600;
  color: var(--ar-muted, #666);
}
.muted {
  color: var(--ar-muted, #666);
}
.pending-list {
  margin: 0;
  padding-left: 1rem;
}
.banner {
  margin: 0 0 1rem;
  padding: 0.6rem 0.85rem;
  border-radius: var(--ar-radius-sm, 6px);
  border: 1px solid transparent;
  font-size: 0.9rem;
}
.banner--info {
  background: var(--ar-accent-soft, #eef5ff);
  border-color: var(--ar-border, #cdd9ea);
}
.banner--warn {
  background: #fff8e1;
  border-color: #f0d58c;
}
.banner--error {
  background: #fdecea;
  border-color: #f3b4ad;
  color: #8a1c12;
}
</style>


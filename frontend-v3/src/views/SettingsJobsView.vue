<template>
  <div class="page">
    <h1>Управление заданиями</h1>
    <p class="lead">
      Периодические задания Job Runner. Расписание — интервал после последнего успешного запуска.
      Спека: <code>docs/job-runner-design.md</code> (#68).
    </p>

    <div v-if="message" class="banner" :class="messageOk ? 'banner-ok' : 'banner-err'">{{ message }}</div>
    <div v-if="loading" class="loading">Загрузка...</div>

    <template v-else>
      <div class="card table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Задание</th>
              <th>Код</th>
              <th>Интервал</th>
              <th>Вкл.</th>
              <th>Последний запуск</th>
              <th>Статус</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="job in jobs"
              :key="job.id"
              :class="{ 'row-selected': selectedJobId === job.id }"
              @click="selectJob(job)"
            >
              <td>
                <strong>{{ job.name }}</strong>
                <div v-if="job.description" class="job-desc">{{ job.description }}</div>
              </td>
              <td><code>{{ job.code }}</code></td>
              <td>{{ formatInterval(job.interval_seconds) }}</td>
              <td>
                <label class="toggle" @click.stop>
                  <input
                    type="checkbox"
                    :checked="job.enabled"
                    :disabled="!canExecute || togglingId === job.id"
                    @change="toggleEnabled(job, $event)"
                  />
                  {{ job.enabled ? 'Да' : 'Нет' }}
                </label>
              </td>
              <td>{{ formatDateTime(job.last_finished_at || job.last_started_at) }}</td>
              <td>
                <span class="status-pill" :class="statusClass(job.last_status)">
                  {{ job.last_status || '—' }}
                </span>
              </td>
              <td>
                <button
                  type="button"
                  class="btn btn-sm btn-primary"
                  :disabled="!canExecute || runningId === job.id"
                  @click.stop="runJob(job)"
                >
                  {{ runningId === job.id ? '…' : 'Запустить' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <section v-if="selectedJob" class="history-section">
        <h2>История: {{ selectedJob.name }}</h2>
        <div v-if="runsLoading" class="loading">Загрузка истории...</div>
        <div v-else-if="!runs.length" class="empty">Запусков пока нет.</div>
        <div v-else class="card table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Начало</th>
                <th>Окончание</th>
                <th>Trigger</th>
                <th>Статус</th>
                <th>Сообщение</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="run in runs" :key="run.id">
                <td>{{ formatDateTime(run.started_at) }}</td>
                <td>{{ formatDateTime(run.finished_at) }}</td>
                <td>{{ run.trigger }}{{ run.triggered_by_login ? ` (${run.triggered_by_login})` : '' }}</td>
                <td>
                  <span class="status-pill" :class="statusClass(run.status)">{{ run.status }}</span>
                </td>
                <td class="msg-cell">{{ run.message || run.error_message || '—' }}</td>
                <td>
                  <button
                    v-if="run.result_json"
                    type="button"
                    class="btn-link"
                    @click="toggleResult(run.id)"
                  >
                    {{ expandedRunId === run.id ? 'Скрыть JSON' : 'JSON' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          <pre v-if="expandedRunId && expandedRun" class="result-json">{{ expandedRun }}</pre>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '../api/client'
import { authStore } from '../auth/authStore'

const loading = ref(true)
const runsLoading = ref(false)
const jobs = ref([])
const runs = ref([])
const selectedJobId = ref(null)
const runningId = ref(null)
const togglingId = ref(null)
const message = ref('')
const messageOk = ref(true)
const expandedRunId = ref(null)

const canExecute = computed(() => authStore.hasPermission('jobs:execute'))

const selectedJob = computed(() => jobs.value.find((j) => j.id === selectedJobId.value) || null)

const expandedRun = computed(() => {
  const run = runs.value.find((r) => r.id === expandedRunId.value)
  if (!run || !run.result_json) return ''
  try {
    return JSON.stringify(run.result_json, null, 2)
  } catch {
    return String(run.result_json)
  }
})

function formatInterval(seconds) {
  const s = Number(seconds) || 0
  if (s % 86400 === 0 && s >= 86400) {
    const d = s / 86400
    return d === 1 ? '1 день' : `${d} дн.`
  }
  if (s % 3600 === 0 && s >= 3600) return `${s / 3600} ч.`
  return `${s} сек.`
}

function formatDateTime(v) {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleString('ru-RU')
}

function statusClass(status) {
  if (status === 'success') return 'status-ok'
  if (status === 'failed') return 'status-err'
  if (status === 'running') return 'status-run'
  return ''
}

function showMsg(text, ok = true) {
  message.value = text
  messageOk.value = ok
  setTimeout(() => { message.value = '' }, 8000)
}

async function loadJobs() {
  loading.value = true
  try {
    jobs.value = await api.getJobs()
    if (!selectedJobId.value && jobs.value.length) {
      selectedJobId.value = jobs.value[0].id
      await loadRuns()
    }
  } catch (e) {
    showMsg(e.message || 'Ошибка загрузки', false)
  } finally {
    loading.value = false
  }
}

async function loadRuns() {
  if (!selectedJobId.value) {
    runs.value = []
    return
  }
  runsLoading.value = true
  expandedRunId.value = null
  try {
    runs.value = await api.getJobRuns(selectedJobId.value)
  } catch (e) {
    showMsg(e.message || 'Ошибка загрузки истории', false)
  } finally {
    runsLoading.value = false
  }
}

function selectJob(job) {
  selectedJobId.value = job.id
  loadRuns()
}

function toggleResult(runId) {
  expandedRunId.value = expandedRunId.value === runId ? null : runId
}

async function runJob(job) {
  if (!canExecute.value) return
  runningId.value = job.id
  try {
    const res = await api.runJob(job.id)
    showMsg(res.message || 'Задание выполнено')
    await loadJobs()
    if (selectedJobId.value === job.id) await loadRuns()
  } catch (e) {
    showMsg(e.message || 'Ошибка запуска', false)
  } finally {
    runningId.value = null
  }
}

async function toggleEnabled(job, event) {
  if (!canExecute.value) return
  const enabled = event.target.checked
  togglingId.value = job.id
  try {
    await api.patchJob(job.id, { enabled })
    job.enabled = enabled
    showMsg(enabled ? 'Задание включено' : 'Задание выключено')
  } catch (e) {
    event.target.checked = !enabled
    showMsg(e.message || 'Ошибка сохранения', false)
  } finally {
    togglingId.value = null
  }
}

onMounted(loadJobs)
</script>

<style scoped>
.lead {
  color: var(--ar-muted);
  margin-bottom: 1rem;
}
.job-desc {
  font-size: 0.82rem;
  color: var(--ar-muted);
  margin-top: 0.25rem;
  max-width: 28rem;
}
.row-selected {
  background: var(--ar-accent-soft);
}
.history-section {
  margin-top: 1.5rem;
}
.history-section h2 {
  font-size: 1.1rem;
  margin-bottom: 0.75rem;
}
.msg-cell {
  max-width: 20rem;
  word-break: break-word;
}
.status-pill {
  display: inline-block;
  padding: 0.15rem 0.45rem;
  border-radius: var(--ar-radius-sm);
  font-size: 0.78rem;
  text-transform: lowercase;
}
.status-ok { background: #e8f5e9; color: #2e7d32; }
.status-err { background: #ffebee; color: #c62828; }
.status-run { background: #e3f2fd; color: #1565c0; }
.result-json {
  margin: 0;
  padding: 0.75rem 1rem;
  background: #f4f5f7;
  border-top: 1px solid var(--ar-border);
  font-size: 0.78rem;
  overflow: auto;
  max-height: 16rem;
}
.banner {
  padding: 0.65rem 0.85rem;
  border-radius: var(--ar-radius-sm);
  margin-bottom: 1rem;
}
.banner-ok { background: #e8f5e9; color: #1b5e20; }
.banner-err { background: #ffebee; color: #b71c1c; }
.empty { padding: 1rem; color: var(--ar-muted); }
.toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  cursor: pointer;
  font-size: 0.85rem;
}
</style>

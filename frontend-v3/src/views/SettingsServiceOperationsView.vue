<template>
  <div class="page">
    <h1>Сервисные операции</h1>
    <p class="lead">
      Массовые операции для администраторов. Меню → Настройки → Сервисные операции. Новые действия добавляются сюда по мере необходимости.
    </p>

    <div v-if="message" class="banner" :class="messageOk ? 'banner-ok' : 'banner-err'">{{ message }}</div>
    <div v-if="waitingHealth" class="banner banner-wait">
      Ожидание запуска API… страница обновится автоматически. Если сообщение не исчезнет, обновите вручную через минуту.
    </div>

    <section class="ops-section" aria-label="API">
      <h2 class="section-title">API (Node)</h2>
      <ul class="op-list">
        <li class="op-card" :class="{ disabled: restartStatus && !restartStatus.enabled }">
          <div class="op-card-body">
            <h3 class="op-title">Перезапустить API (Node)</h3>
            <p class="op-desc">
              Завершает процесс Node внутри контейнера. При политике Docker <code>--restart=always</code> (как в <code>deploy.bat</code> на сервере и в <code>infra/docker-compose.yml</code>) тот же контейнер поднимается снова — обновятся кэш параметров из БД и переменные окружения. На время простоя API недоступен.
            </p>
            <p v-if="restartStatus && !restartStatus.enabled" class="op-hint-warn">
              Операция отключена на сервере. Задайте в окружении <code>ADMIN_API_RESTART_SECRET</code> (и введите его на шаге 2) или для доверенной среды —
              <code>ALLOW_INSECURE_RESTART_WITHOUT_SECRET=true</code>.
            </p>
          </div>
          <div class="op-card-actions">
            <button
              type="button"
              class="btn btn-primary"
              :disabled="restartStatusLoading || (restartStatus && !restartStatus.enabled) || restartBusy || waitingHealth"
              @click="openRestartModal"
            >
              Перезапустить…
            </button>
          </div>
        </li>
      </ul>
    </section>

    <section class="ops-section" aria-label="Операции">
      <h2 class="section-title">Метамодель</h2>
      <ul class="op-list">
        <li class="op-card">
          <div class="op-card-body">
            <h3 class="op-title">Пересборка проекций потоков</h3>
            <p class="op-desc">
              Удаляет и заново создаёт в метамодели только связи типа <code>integration_flow</code> из реестра интеграционных потоков.
              Остальные связи <strong>не</strong> затрагиваются. Имеет смысл после смены шаблона
              <code>DISP_INTEGRATION_FLOW_NAME</code>, импорта или при «висячих» проекциях.
            </p>
          </div>
          <div class="op-card-actions">
            <button
              type="button"
              class="btn btn-primary"
              :disabled="rebuildBusy || waitingHealth"
              @click="runRebuildIntegrationFlows"
            >
              {{ rebuildBusy ? 'Выполняется…' : 'Запустить' }}
            </button>
          </div>
        </li>
      </ul>
    </section>

    <section class="ops-section" aria-label="Данные">
      <h2 class="section-title">Данные</h2>
      <ul class="op-list">
        <li class="op-card">
          <div class="op-card-body">
            <h3 class="op-title">Импорт данных</h3>
            <p class="op-desc">
              Загрузка записей в реестры из Excel по шаблону: проверка (dry-run), частичная запись и протокол ошибок.
            </p>
            <p class="op-desc">
              <button type="button" class="btn-link help-rules-link" @click="openImportHelp">Справка по импорту</button>
            </p>
          </div>
          <div class="op-card-actions">
            <router-link class="btn btn-primary" to="/settings/service-operations/import">Открыть…</router-link>
          </div>
        </li>
      </ul>
    </section>

    <div v-if="importHelpOpen" class="modal-overlay">
      <div class="modal modal-help" role="dialog" aria-modal="true" aria-labelledby="import-help-title">
        <h3 id="import-help-title">Импорт данных — справка</h3>
        <div class="help-markdown modal-help-body" v-html="importHelpHtml"></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-primary" @click="importHelpOpen = false">Закрыть</button>
        </div>
      </div>
    </div>

    <!-- Двухшаговое подтверждение перезапуска API -->
    <div v-if="restartModalStep > 0" class="modal-overlay">
      <div class="modal">
        <template v-if="restartModalStep === 1">
          <h3>Перезапуск API</h3>
          <p class="modal-text">
            Сейчас все пользователи потеряют ответ сервера на несколько секунд (или дольше, если надсмотрщик не поднимает процесс автоматически).
            Продолжить?
          </p>
          <div class="modal-actions">
            <button type="button" class="btn btn-primary" @click="restartModalStep = 2">Продолжить</button>
            <button type="button" class="btn btn-secondary" @click="closeRestartModal">Отмена</button>
          </div>
        </template>
        <template v-else>
          <h3>Подтвердите перезапуск</h3>
          <p v-if="restartStatus?.requiresSecret" class="modal-text">
            Введите секрет из переменной окружения сервера <code>ADMIN_API_RESTART_SECRET</code>.
          </p>
          <p v-else class="modal-text">
            Подтвердите завершение процесса API. Перезапуск без секрета разрешён только при включённом флаге на сервере.
          </p>
          <div v-if="restartStatus?.requiresSecret" class="form-row">
            <label>Секрет</label>
            <input v-model="restartSecretInput" type="password" autocomplete="off" class="modal-input" />
          </div>
          <div v-if="restartModalError" class="error">{{ restartModalError }}</div>
          <div class="modal-actions">
            <button
              type="button"
              class="btn btn-primary"
              :disabled="restartBusy || (restartStatus?.requiresSecret && !restartSecretInput.trim())"
              @click="executeRestart"
            >
              {{ restartBusy ? 'Запрос…' : 'Перезапустить API' }}
            </button>
            <button type="button" class="btn btn-secondary" :disabled="restartBusy" @click="restartModalStep = 1">Назад</button>
            <button type="button" class="btn btn-secondary" :disabled="restartBusy" @click="closeRestartModal">Отмена</button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { marked } from 'marked'
import { togafApi, adminApi } from '../api'
import importHelpText from '../content/data-import-help.md?raw'

const importHelpOpen = ref(false)
const importHelpHtml = computed(() => marked.parse(importHelpText || ''))

function openImportHelp() {
  importHelpOpen.value = true
}

const rebuildBusy = ref(false)
const message = ref('')
const messageOk = ref(true)

const restartStatus = ref(null)
const restartStatusLoading = ref(true)
const restartModalStep = ref(0)
const restartSecretInput = ref('')
const restartModalError = ref('')
const restartBusy = ref(false)
const waitingHealth = ref(false)

async function loadRestartStatus() {
  restartStatusLoading.value = true
  try {
    restartStatus.value = await adminApi.restartNodeStatus()
  } catch {
    restartStatus.value = { enabled: false, requiresSecret: true }
  } finally {
    restartStatusLoading.value = false
  }
}

onMounted(loadRestartStatus)

function openRestartModal() {
  restartModalStep.value = 1
  restartSecretInput.value = ''
  restartModalError.value = ''
}

function closeRestartModal() {
  if (restartBusy.value) return
  restartModalStep.value = 0
  restartSecretInput.value = ''
  restartModalError.value = ''
}

async function runRebuildIntegrationFlows() {
  if (
    !confirm(
      'Пересобрать все проекции integration_flow из реестра потоков? Остальные связи метамодели не затрагиваются.'
    )
  ) {
    return
  }
  rebuildBusy.value = true
  message.value = ''
  try {
    await togafApi.rebuildIntegrationFlowProjections()
    messageOk.value = true
    message.value = 'Пересборка выполнена успешно.'
  } catch (e) {
    messageOk.value = false
    message.value = e.message || 'Ошибка пересборки'
  } finally {
    rebuildBusy.value = false
  }
}

/** Опрос /api/health с нарастающим интервалом до успеха или таймаута. */
async function waitForApiHealth(maxMs = 90000) {
  const t0 = Date.now()
  let delay = 1000
  while (Date.now() - t0 < maxMs) {
    try {
      const res = await fetch('/api/health', { method: 'GET', cache: 'no-store' })
      if (res.ok) {
        const j = await res.json()
        if (j && j.ok) return true
      }
    } catch {
      /* сервер ещё не поднялся */
    }
    await new Promise((r) => setTimeout(r, delay))
    delay = Math.min(delay + 1000, 5000)
  }
  return false
}

async function executeRestart() {
  restartModalError.value = ''
  const secret = restartStatus.value?.requiresSecret ? restartSecretInput.value.trim() : ''
  if (restartStatus.value?.requiresSecret && !secret) {
    restartModalError.value = 'Введите секрет'
    return
  }
  restartBusy.value = true
  try {
    await adminApi.restartNode(secret || undefined)
    closeRestartModal()
    message.value = ''
    waitingHealth.value = true
    const ok = await waitForApiHealth()
    waitingHealth.value = false
    if (ok) {
      window.location.reload()
    } else {
      messageOk.value = false
      message.value =
        'API не ответил за отведённое время. Проверьте надсмотрщик процесса и обновите страницу вручную.'
    }
  } catch (e) {
    restartModalError.value = e.message || 'Ошибка запроса'
  } finally {
    restartBusy.value = false
  }
}
</script>

<style scoped>
.page { max-width: 720px; }
h1 { margin: 0 0 0.5rem; font-size: 1.35rem; }
.lead {
  color: var(--ar-muted);
  margin: 0 0 1.25rem;
  line-height: 1.45;
  font-size: 0.95rem;
}
.section-title {
  font-size: 1rem;
  margin: 0 0 0.75rem;
  color: var(--ar-text);
}
.ops-section { margin-top: 1.25rem; }
.op-list { list-style: none; margin: 0; padding: 0; }
.op-card {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: flex-start;
  justify-content: space-between;
  padding: 1.1rem 1.25rem;
  background: var(--ar-surface);
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-lg);
  box-shadow: var(--ar-shadow-card);
}
.op-card.disabled { opacity: 0.85; }
.op-card-body { flex: 1; min-width: 200px; }
.op-title { margin: 0 0 0.5rem; font-size: 1.05rem; }
.op-desc {
  margin: 0;
  font-size: 0.9rem;
  color: var(--ar-muted);
  line-height: 1.45;
}
.op-desc code {
  font-size: 0.85em;
  background: var(--ar-table-head-bg);
  padding: 0.1em 0.35em;
  border-radius: 4px;
}
.op-hint-warn {
  margin: 0.75rem 0 0;
  font-size: 0.85rem;
  color: #b45309;
  line-height: 1.4;
}
.op-card-actions { flex-shrink: 0; }
.banner {
  padding: 0.65rem 1rem;
  margin-bottom: 1rem;
  border-radius: 6px;
  font-size: 0.9rem;
}
.banner-ok { background: #e8f5e9; border: 1px solid #c8e6c9; color: #2e4a32; }
.banner-err { background: #ffebee; border: 1px solid #ffcdd2; color: #8b1c1c; }
.banner-wait { background: #e3f2fd; border: 1px solid #90caf9; color: #1565c0; }
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
  background: var(--ar-surface);
  border-radius: var(--ar-radius-lg);
  padding: 1.25rem 1.5rem;
  max-width: 420px;
  width: 100%;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
  border: 1px solid var(--ar-border);
}
.modal h3 {
  margin: 0 0 0.75rem;
  font-size: 1.1rem;
  color: var(--ar-text);
}
.modal-text {
  margin: 0 0 1rem;
  font-size: 0.9rem;
  color: var(--ar-muted);
  line-height: 1.45;
}
.modal-text code {
  font-size: 0.88em;
  background: var(--ar-table-head-bg);
  padding: 0.1em 0.3em;
  border-radius: 4px;
}
.form-row { margin-bottom: 1rem; }
.form-row label { display: block; margin-bottom: 0.35rem; font-size: 0.88rem; font-weight: 500; }
.modal-input {
  width: 100%;
  padding: 0.5rem 0.65rem;
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  font-size: 0.95rem;
  background: var(--ar-surface);
}
.modal-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1rem;
}
.error {
  color: var(--ar-danger);
  font-size: 0.88rem;
  margin-bottom: 0.5rem;
}
.help-rules-link {
  padding: 0;
  font-size: 0.9rem;
}
.modal.modal-help {
  max-width: 720px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
}
.modal.modal-help h3 {
  flex-shrink: 0;
}
.modal-help-body {
  overflow: auto;
  flex: 1;
  min-height: 0;
}
.help-markdown {
  margin: 0;
  padding: 0.25rem 0;
  font-size: 0.85rem;
}
.help-markdown :deep(h2) {
  margin: 0.75rem 0 0.4rem;
  font-size: 1rem;
}
.help-markdown :deep(h2:first-child) {
  margin-top: 0;
}
.help-markdown :deep(p),
.help-markdown :deep(li) {
  margin: 0.35rem 0;
  line-height: 1.45;
}
.help-markdown :deep(ol),
.help-markdown :deep(ul) {
  margin: 0.35rem 0;
  padding-left: 1.25rem;
}
.help-markdown :deep(strong) {
  font-weight: 600;
}
.modal.modal-help .modal-actions {
  flex-shrink: 0;
}
</style>

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
import { ref, onMounted } from 'vue'
import { togafApi, adminApi } from '../api'

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
.lead { color: #5c5349; margin: 0 0 1.25rem; line-height: 1.45; font-size: 0.95rem; }
.section-title { font-size: 1rem; margin: 0 0 0.75rem; color: #4a433c; }
.ops-section { margin-top: 1.25rem; }
.op-list { list-style: none; margin: 0; padding: 0; }
.op-card {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: flex-start;
  justify-content: space-between;
  padding: 1.1rem 1.25rem;
  background: #fff;
  border: 1px solid #e5dccf;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.op-card.disabled { opacity: 0.85; }
.op-card-body { flex: 1; min-width: 200px; }
.op-title { margin: 0 0 0.5rem; font-size: 1.05rem; }
.op-desc { margin: 0; font-size: 0.9rem; color: #5c5349; line-height: 1.45; }
.op-desc code { font-size: 0.85em; background: #f5f0e8; padding: 0.1em 0.35em; border-radius: 4px; }
.op-hint-warn { margin: 0.75rem 0 0; font-size: 0.85rem; color: #8b5a2b; line-height: 1.4; }
.op-card-actions { flex-shrink: 0; }
.btn {
  display: inline-block;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.9rem;
  border: 1px solid #cb997e;
  cursor: pointer;
  background: #fff;
  color: #8b5a2b;
}
.btn-primary { background: #cb997e; color: #fff; border-color: #cb997e; }
.btn-secondary { background: #f5f0e8; color: #4a433c; border-color: #e5dccf; }
.btn:disabled { opacity: 0.65; cursor: not-allowed; }
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
  background: #fff;
  border-radius: 8px;
  padding: 1.25rem 1.5rem;
  max-width: 420px;
  width: 100%;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
  border: 1px solid #e5dccf;
}
.modal h3 { margin: 0 0 0.75rem; font-size: 1.1rem; }
.modal-text { margin: 0 0 1rem; font-size: 0.9rem; color: #5c5349; line-height: 1.45; }
.modal-text code { font-size: 0.88em; background: #f5f0e8; padding: 0.1em 0.3em; border-radius: 4px; }
.form-row { margin-bottom: 1rem; }
.form-row label { display: block; margin-bottom: 0.35rem; font-size: 0.88rem; font-weight: 500; }
.modal-input {
  width: 100%;
  padding: 0.5rem 0.65rem;
  border: 1px solid #e5dccf;
  border-radius: 6px;
  font-size: 0.95rem;
}
.modal-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1rem; }
.error { color: #c44; font-size: 0.88rem; margin-bottom: 0.5rem; }
</style>

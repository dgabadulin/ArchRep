<template>
  <div class="login-page">
    <form class="card login-card" @submit.prevent="submit">
      <div class="login-brand">
        <img src="/logo.png" alt="" class="logo" />
        <div>
          <div class="brand-name">Архитектурный репозиторий</div>
          <h1>Вход</h1>
        </div>
      </div>
      <p class="lead">
        {{
          keycloakEnabled
            ? 'Локальная учётная запись или корпоративный SSO.'
            : 'Локальная учётная запись (login / пароль).'
        }}
      </p>

      <template v-if="showLocalForm">
        <div class="form-row">
          <label>Логин <span class="req">*</span></label>
          <input v-model="login" type="text" autocomplete="username" required autofocus />
        </div>
        <div class="form-row">
          <label>Пароль <span class="req">*</span></label>
          <input v-model="password" type="password" autocomplete="current-password" required />
        </div>
        <p v-if="error" class="form-error">{{ error }}</p>
        <div class="actions">
          <button type="submit" class="btn btn-primary" :disabled="busy">
            {{ busy ? 'Вход…' : 'Войти' }}
          </button>
        </div>
      </template>

      <div v-if="keycloakEnabled" class="sso-block" :class="{ 'sso-only': !showLocalForm }">
        <p v-if="ssoHint" class="sso-hint">{{ ssoHint }}</p>
        <button
          type="button"
          class="btn btn-secondary sso-btn"
          :disabled="busy || ssoBusy"
          @click="startSso"
        >
          {{ ssoBusy ? 'Переход в SSO…' : 'Войти через SSO' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authStore } from '../auth/authStore'
import { getConfig } from '../config/params'
import { startOidcLogin } from '../auth/oidc'
import { getToken } from '../auth/session'

const route = useRoute()
const router = useRouter()
const login = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)
const ssoBusy = ref(false)
const silentTried = ref(false)

const cfg = computed(() => getConfig())
const keycloakEnabled = computed(
  () => Boolean(cfg.value.keycloak_enabled) && authStore.state.authEnabled
)
const loginMode = computed(() => String(cfg.value.keycloak_login_mode || 'button').toLowerCase())
const forceLocal = computed(
  () => route.query.local === '1' || route.query.local === 'true'
)
const showLocalForm = computed(() => {
  if (!keycloakEnabled.value) return true
  if (forceLocal.value) return true
  if (loginMode.value === 'auto') return false
  return true
})

const ssoHint = computed(() => {
  if (route.query.sso_silent === 'failed') {
    return 'Корпоративная сессия SSO не найдена. Войдите локально или через SSO.'
  }
  return ''
})

function redirectTarget() {
  return typeof route.query.redirect === 'string' ? route.query.redirect : '/'
}

function startSso(prompt) {
  ssoBusy.value = true
  startOidcLogin({
    redirect: redirectTarget(),
    prompt: prompt === 'none' ? 'none' : undefined,
  })
}

onMounted(() => {
  if (typeof route.query.sso_error === 'string' && route.query.sso_error) {
    error.value = route.query.sso_error
  }
  if (!keycloakEnabled.value || getToken() || authStore.state.user) return
  if (forceLocal.value) return

  if (loginMode.value === 'auto') {
    startSso()
    return
  }
  if (loginMode.value === 'silent' && !silentTried.value && route.query.sso_silent !== 'failed') {
    silentTried.value = true
    startSso('none')
  }
})

async function submit() {
  error.value = ''
  busy.value = true
  try {
    const data = await authStore.login(login.value.trim(), password.value)
    if (data?.user?.must_change_password) {
      await router.replace({ name: 'change-password' })
      return
    }
    await router.replace(redirectTarget() || '/')
  } catch (e) {
    error.value = e?.message || 'Ошибка входа'
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 1.5rem;
  background: var(--ar-bg);
}
.login-card {
  width: min(420px, 100%);
  padding: 1.5rem;
}
.login-brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.35rem;
}
.logo {
  width: 40px;
  height: 40px;
  object-fit: contain;
  border-radius: 50%;
  border: 2px solid var(--ar-border);
  background: var(--ar-table-head-bg);
  padding: 2px;
}
.brand-name {
  font-size: 0.8rem;
  color: var(--ar-muted);
  font-weight: 600;
}
h1 {
  margin: 0;
  font-size: 1.35rem;
  color: var(--ar-text);
}
.lead {
  margin: 0 0 1rem;
  color: var(--ar-muted);
  font-size: 0.95rem;
}
.form-row {
  margin-bottom: 0.75rem;
}
.form-row label {
  display: block;
  margin-bottom: 0.25rem;
  font-size: 0.9rem;
}
.form-row input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  font-size: 1rem;
  box-sizing: border-box;
  background: var(--ar-surface);
}
.form-error {
  color: var(--ar-danger);
  font-size: 0.9rem;
  margin: 0 0 0.5rem;
}
.actions {
  margin-top: 1rem;
}
.sso-block {
  margin-top: 1.25rem;
  padding-top: 1rem;
  border-top: 1px solid var(--ar-border);
}
.sso-block.sso-only {
  margin-top: 0.25rem;
  padding-top: 0;
  border-top: none;
}
.sso-btn {
  width: 100%;
}
.sso-hint {
  margin: 0 0 0.75rem;
  font-size: 0.9rem;
  color: var(--ar-muted);
}
</style>

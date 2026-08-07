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
      <p class="lead">Локальная учётная запись (login / пароль).</p>

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
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authStore } from '../auth/authStore'

const route = useRoute()
const router = useRouter()
const login = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)

async function submit() {
  error.value = ''
  busy.value = true
  try {
    const data = await authStore.login(login.value.trim(), password.value)
    if (data?.user?.must_change_password) {
      await router.replace({ name: 'change-password' })
      return
    }
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await router.replace(redirect || '/')
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
</style>

<template>
  <div class="page">
    <h1>Профиль</h1>
    <p class="lead">Данные текущей учётной записи (только просмотр).</p>

    <div v-if="loading" class="loading">Загрузка...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <dl v-else class="card profile-dl">
      <div class="profile-row">
        <dt>Логин</dt>
        <dd>{{ user?.login || '—' }}</dd>
      </div>
      <div class="profile-row">
        <dt>Отображаемое имя</dt>
        <dd>{{ user?.display_name || '—' }}</dd>
      </div>
      <div class="profile-row">
        <dt>Email</dt>
        <dd>{{ user?.email || '—' }}</dd>
      </div>
      <div class="profile-row">
        <dt>Способ входа</dt>
        <dd>{{ authProviderLabel }}</dd>
      </div>
      <div class="profile-row">
        <dt>Роли</dt>
        <dd>{{ rolesLabel }}</dd>
      </div>
      <div v-if="user?.last_login_at" class="profile-row">
        <dt>Последний вход</dt>
        <dd>{{ formatDateTime(user.last_login_at) }}</dd>
      </div>
    </dl>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '../api/client'
import { authStore } from '../auth/authStore'

const loading = ref(true)
const error = ref('')
const user = ref(null)
const roles = ref([])

const authProviderLabels = {
  local: 'Локальная учётная запись',
  keycloak: 'SSO (Keycloak)',
  hybrid: 'Локальная + SSO',
  open: 'Режим без авторизации',
}

const authProviderLabel = computed(() => {
  const p = user.value?.auth_provider
  return authProviderLabels[p] || p || '—'
})

const rolesLabel = computed(() => {
  const list = roles.value || []
  return list.length ? list.join(', ') : '—'
})

function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (isNaN(d.getTime())) return String(value)
  return d.toLocaleString('ru-RU')
}

onMounted(async () => {
  loading.value = true
  error.value = ''
  try {
    const me = await api.getAuthMe()
    user.value = me.user || authStore.state.user
    roles.value = me.roles || authStore.state.roles || []
  } catch (e) {
    error.value = e?.message || 'Не удалось загрузить профиль'
    user.value = authStore.state.user
    roles.value = authStore.state.roles || []
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.lead {
  color: var(--ar-muted);
  margin: 0 0 1rem;
  font-size: 0.95rem;
}
.profile-dl {
  max-width: 36rem;
  padding: 1rem 1.25rem;
}
.profile-row {
  display: grid;
  grid-template-columns: 10rem 1fr;
  gap: 0.75rem 1rem;
  padding: 0.55rem 0;
  border-bottom: 1px solid var(--ar-border);
}
.profile-row:last-child {
  border-bottom: none;
}
.profile-row dt {
  margin: 0;
  font-size: 0.82rem;
  color: var(--ar-muted);
}
.profile-row dd {
  margin: 0;
  font-size: 0.92rem;
  word-break: break-word;
}
@media (max-width: 560px) {
  .profile-row {
    grid-template-columns: 1fr;
    gap: 0.2rem;
  }
}
</style>

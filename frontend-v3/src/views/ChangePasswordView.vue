<template>
  <div class="page">
    <h1>Смена пароля</h1>
    <p class="lead">Требуется сменить пароль перед продолжением работы.</p>

    <form class="card form" @submit.prevent="submit">
      <div class="form-grid">
        <div class="field field-wide">
          <label>Текущий пароль <span class="req">*</span></label>
          <input v-model="currentPassword" type="password" autocomplete="current-password" required />
        </div>
        <div class="field field-wide">
          <label>Новый пароль <span class="req">*</span></label>
          <input v-model="newPassword" type="password" autocomplete="new-password" required minlength="8" />
        </div>
        <div class="field field-wide">
          <label>Повтор нового пароля <span class="req">*</span></label>
          <input v-model="newPassword2" type="password" autocomplete="new-password" required minlength="8" />
        </div>
      </div>
      <p v-if="error" class="form-error">{{ error }}</p>
      <div class="actions">
        <button type="submit" class="btn btn-primary" :disabled="busy">Сохранить</button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api/client'
import { authStore } from '../auth/authStore'

const router = useRouter()
const currentPassword = ref('')
const newPassword = ref('')
const newPassword2 = ref('')
const error = ref('')
const busy = ref(false)

async function submit() {
  error.value = ''
  if (newPassword.value.length < 8) {
    error.value = 'Новый пароль — минимум 8 символов'
    return
  }
  if (newPassword.value !== newPassword2.value) {
    error.value = 'Пароли не совпадают'
    return
  }
  busy.value = true
  try {
    await api.changePassword({
      current_password: currentPassword.value,
      new_password: newPassword.value,
    })
    if (authStore.state.user) {
      authStore.state.user.must_change_password = false
    }
    await router.replace('/')
  } catch (e) {
    error.value = e?.message || 'Не удалось сменить пароль'
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.lead {
  color: var(--ar-muted);
  margin: 0 0 1rem;
  font-size: 0.95rem;
}
.form-error {
  color: var(--ar-danger);
  margin: 0.75rem 0 0;
}
</style>

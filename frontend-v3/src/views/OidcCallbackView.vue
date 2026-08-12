<template>
  <div class="oidc-cb">
    <p>{{ message }}</p>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { authStore } from '../auth/authStore'
import { parseOidcCallbackHash } from '../auth/oidc'

const router = useRouter()
const message = ref('Завершение входа через SSO…')

onMounted(async () => {
  try {
    const { access_token, redirect } = parseOidcCallbackHash(window.location.hash)
    // убрать token из адресной строки
    history.replaceState(null, '', window.location.pathname + window.location.search)
    if (!access_token) {
      message.value = 'Нет токена в ответе SSO'
      await router.replace({ name: 'login', query: { sso_error: 'missing_token' } })
      return
    }
    await authStore.acceptAccessToken(access_token)
    if (authStore.state.user?.must_change_password) {
      await router.replace({ name: 'change-password' })
      return
    }
    await router.replace(redirect || '/')
  } catch (e) {
    message.value = e?.message || 'Ошибка SSO'
    await router.replace({
      name: 'login',
      query: { sso_error: e?.message || 'sso_failed' },
    })
  }
})
</script>

<style scoped>
.oidc-cb {
  min-height: 100vh;
  display: grid;
  place-items: center;
  color: var(--ar-muted);
}
</style>

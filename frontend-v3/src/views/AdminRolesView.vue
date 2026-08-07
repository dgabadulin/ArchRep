<template>
  <div class="page">
    <div class="page-head">
      <h1>Роли</h1>
    </div>
    <p class="lead">
      Системные роли и матрица permissions. Назначение ролей пользователям — на экране «Пользователи».
    </p>

    <TableToolbar
      v-model:search="search"
      search-placeholder="Поиск по коду, имени, permission"
    />

    <div v-if="loading" class="loading">Загрузка...</div>
    <div v-else class="card table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Код</th>
            <th>Название</th>
            <th>Описание</th>
            <th>Системная</th>
            <th>Permissions</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in filtered" :key="r.id">
            <td><code class="code-cell">{{ r.code }}</code></td>
            <td>{{ r.name }}</td>
            <td class="desc-cell">{{ r.description || '—' }}</td>
            <td>{{ r.is_system ? 'Да' : '—' }}</td>
            <td>{{ (r.permissions || []).length }}</td>
            <td>
              <router-link
                v-if="canRead"
                :to="`/settings/administration/roles/${r.id}/edit`"
                class="link"
              >
                {{ canWrite ? 'Изменить' : 'Открыть' }}
              </router-link>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="filtered.length === 0" class="empty">Нет ролей.</p>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { api } from '../api/client'
import TableToolbar from '../components/TableToolbar.vue'
import { usePermissions } from '../composables/usePermissions'

const { canRead, canWrite } = usePermissions('roles')

const roles = ref([])
const loading = ref(true)
const search = ref('')

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return roles.value
  return roles.value.filter((r) => {
    const hay = [r.code, r.name, r.description, ...(r.permissions || [])].join(' ').toLowerCase()
    return hay.includes(q)
  })
})

onMounted(async () => {
  try {
    roles.value = await api.getAdminRoles()
  } catch {
    roles.value = []
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
.code-cell {
  font-size: 0.85rem;
  background: var(--ar-table-head-bg);
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
}
.desc-cell {
  max-width: 280px;
}
.loading,
.empty {
  color: var(--ar-muted);
}
.link {
  color: var(--ar-link);
  text-decoration: none;
  font-weight: 600;
}
.link:hover {
  text-decoration: underline;
}
</style>

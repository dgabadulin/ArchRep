<template>
  <div class="page">
    <div class="page-head">
      <h1>Пользователи</h1>
      <div class="head-actions">
        <button
          v-if="canWrite"
          type="button"
          class="btn btn-primary"
          @click="openForm()"
        >
          Добавить пользователя
        </button>
        <div class="head-buttons-row">
          <button
            v-if="canExport"
            type="button"
            class="btn btn-excel btn-same"
            :disabled="excelLoading"
            @click="exportExcel"
          >
            {{ excelLoading ? 'Выгрузка...' : 'Экспорт в Excel' }}
          </button>
          <div class="col-picker-wrap" v-click-outside="() => (colPickerOpen = false)">
            <button type="button" class="btn btn-secondary btn-same" @click.stop="colPickerOpen = !colPickerOpen">Вид</button>
            <div v-if="colPickerOpen" class="col-picker-dropdown">
              <label v-for="col in userColumns" :key="col.key" class="col-picker-item">
                <input type="checkbox" :checked="visibleCols.includes(col.key)" @change="toggleCol(col.key)" />
                {{ col.label || col.key }}
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
    <p class="lead">Учётные записи приложения. Меню → Администрирование → Пользователи.</p>

    <TableToolbar
      v-model:search="search"
      search-placeholder="Поиск по логину, имени, email"
    />

    <div v-if="loading" class="loading">Загрузка...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else class="card table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th
              v-for="key in visibleCols"
              :key="key"
              :class="{ sortable: key !== 'actions' }"
              @click="key !== 'actions' && toggleSort(key)"
            >
              {{ colLabel(key) }}
              <span v-if="key !== 'actions' && sortKey === key" class="sort-indicator">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in sortedFiltered" :key="u.id">
            <td v-for="key in visibleCols" :key="key">
              <template v-if="key === 'actions'">
                <button v-if="canWrite" type="button" class="btn-link" @click="openForm(u)">Изменить</button>
                <button v-if="canDelete" type="button" class="btn-link danger" @click="remove(u)">Удалить</button>
              </template>
              <template v-else-if="key === 'login'"><code class="code-cell">{{ u.login }}</code></template>
              <template v-else>{{ cellValue(u, key) }}</template>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="sortedFiltered.length === 0" class="empty">Нет пользователей.</p>
    </div>

    <div v-if="form" class="modal-overlay">
      <div class="modal modal-wide">
        <h3>{{ form.id ? 'Изменить пользователя' : 'Новый пользователь' }}</h3>
        <div class="form-row">
          <label>Логин <span class="req">*</span></label>
          <input v-model="form.login" type="text" :readonly="!!form.id" autocomplete="off" />
        </div>
        <div class="form-row">
          <label>Отображаемое имя <span class="req">*</span></label>
          <input v-model="form.display_name" type="text" />
        </div>
        <div class="form-row">
          <label>Email</label>
          <input v-model="form.email" type="email" />
        </div>
        <div class="form-row">
          <label>{{ form.id ? 'Новый пароль (оставьте пустым, чтобы не менять)' : 'Пароль' }} <span v-if="!form.id" class="req">*</span></label>
          <input v-model="form.password" type="password" autocomplete="new-password" />
          <p class="hint">Минимум 8 символов.</p>
        </div>
        <div class="form-row">
          <label>
            <input v-model="form.is_active" type="checkbox" />
            Активен
          </label>
        </div>
        <div class="form-row">
          <label>
            <input v-model="form.must_change_password" type="checkbox" />
            Требовать смену пароля при следующем входе
          </label>
        </div>
        <div v-if="canAssign" class="form-row">
          <label>Роли</label>
          <div class="roles-list">
            <label v-for="r in rolesCatalog" :key="r.code" class="role-check">
              <input v-model="form.roles" type="checkbox" :value="r.code" />
              <span><strong>{{ r.code }}</strong> — {{ r.name }}</span>
            </label>
          </div>
        </div>
        <p v-if="formError" class="form-error">{{ formError }}</p>
        <div class="modal-actions">
          <button type="button" class="btn btn-primary" :disabled="saving || !canSave" @click="save">Сохранить</button>
          <button type="button" class="btn btn-secondary" @click="form = null">Отмена</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { api } from '../api/client'
import TableToolbar from '../components/TableToolbar.vue'
import { authStore } from '../auth/authStore'
import { usePermissions } from '../composables/usePermissions'
import { downloadBlob } from '../utils/downloadBlob'
import { getVisibleColumns, setVisibleColumns, getSortPref, setSortPref } from '../utils/tableColumns'
import { sortByColumn } from '../utils/tableSort'

const { canWrite, canDelete, canExport } = usePermissions('users')
const canAssign = computed(() => authStore.hasPermission('roles:assign'))

const userColumns = [
  { key: 'login', label: 'Логин', defaultVisible: true },
  { key: 'display_name', label: 'Отображаемое имя', defaultVisible: true },
  { key: 'email', label: 'Email', defaultVisible: true },
  { key: 'roles', label: 'Роли', defaultVisible: true },
  { key: 'is_active', label: 'Активен', defaultVisible: true },
  { key: 'must_change_password', label: 'Сменить пароль', defaultVisible: false },
  { key: 'last_login_at', label: 'Последний вход', defaultVisible: true },
  { key: 'actions', label: '', defaultVisible: true },
]

const users = ref([])
const rolesCatalog = ref([])
const loading = ref(true)
const error = ref('')
const search = ref('')
const form = ref(null)
const formError = ref('')
const saving = ref(false)
const excelLoading = ref(false)
const colPickerOpen = ref(false)
const visibleCols = ref(getVisibleColumns('admin_users', userColumns))
const sortPref = getSortPref('admin_users', 'login', 'asc', userColumns)
const sortKey = ref(sortPref.sortKey)
const sortOrder = ref(sortPref.sortOrder)

const canSave = computed(() => {
  if (!form.value) return false
  if (!form.value.login?.trim() || !form.value.display_name?.trim()) return false
  if (!form.value.id && (!form.value.password || form.value.password.length < 8)) return false
  if (form.value.id && form.value.password && form.value.password.length < 8) return false
  return true
})

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return users.value
  return users.value.filter((u) => {
    const hay = [u.login, u.display_name, u.email, ...(u.roles || [])].join(' ').toLowerCase()
    return hay.includes(q)
  })
})

const USER_SORT_TYPES = { last_login_at: 'datetime' }

const sortedFiltered = computed(() =>
  sortByColumn(filtered.value, {
    key: sortKey.value,
    order: sortOrder.value,
    sortType: USER_SORT_TYPES[sortKey.value] || 'text',
    getValue: (row, key) => (USER_SORT_TYPES[key] ? row[key] : cellValue(row, key)),
  }),
)

function colLabel(key) {
  return userColumns.find((c) => c.key === key)?.label || key
}

function formatDt(v) {
  if (!v) return '—'
  try {
    return new Date(v).toLocaleString('ru-RU')
  } catch {
    return String(v)
  }
}

function cellValue(row, key) {
  if (key === 'roles') return (row.roles || []).join(', ') || '—'
  if (key === 'is_active') return row.is_active ? 'Да' : 'Нет'
  if (key === 'must_change_password') return row.must_change_password ? 'Да' : '—'
  if (key === 'last_login_at') return formatDt(row.last_login_at)
  const v = row[key]
  return v ?? '—'
}

function toggleSort(key) {
  if (key === 'actions') return
  if (sortKey.value === key) sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  else {
    sortKey.value = key
    sortOrder.value = 'asc'
  }
  setSortPref('admin_users', sortKey.value, sortOrder.value)
}

function toggleCol(key) {
  const idx = visibleCols.value.indexOf(key)
  let next
  if (idx >= 0) {
    if (visibleCols.value.length <= 1) return
    next = visibleCols.value.filter((k) => k !== key)
  } else {
    const order = userColumns.map((c) => c.key)
    const current = [...visibleCols.value]
    const keyIdx = order.indexOf(key)
    const insertAt = current.findIndex((k) => order.indexOf(k) > keyIdx)
    if (insertAt < 0) current.push(key)
    else current.splice(insertAt, 0, key)
    next = current
  }
  visibleCols.value = next
  setVisibleColumns('admin_users', next)
}

const vClickOutside = {
  mounted(el, binding) {
    el._clickOutside = (e) => {
      if (!el.contains(e.target)) binding.value()
    }
    document.addEventListener('click', el._clickOutside)
  },
  unmounted(el) {
    document.removeEventListener('click', el._clickOutside)
  },
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    users.value = await api.getAdminUsers()
    if (authStore.hasPermission('roles:read') || canAssign.value) {
      rolesCatalog.value = await api.getAdminRoles()
    }
  } catch (e) {
    users.value = []
    error.value = e?.message || 'Ошибка загрузки'
  } finally {
    loading.value = false
  }
}

async function exportExcel() {
  excelLoading.value = true
  error.value = ''
  try {
    const blob = await api.getAdminUsers({ excel: true })
    downloadBlob(blob, 'app-users.xlsx')
  } catch (e) {
    error.value = e?.message || 'Ошибка выгрузки'
  } finally {
    excelLoading.value = false
  }
}

function openForm(user = null) {
  formError.value = ''
  if (user) {
    form.value = {
      id: user.id,
      login: user.login,
      display_name: user.display_name || '',
      email: user.email || '',
      password: '',
      is_active: !!user.is_active,
      must_change_password: !!user.must_change_password,
      roles: [...(user.roles || [])],
    }
  } else {
    form.value = {
      login: '',
      display_name: '',
      email: '',
      password: '',
      is_active: true,
      must_change_password: false,
      roles: ['VIEWER'],
    }
  }
}

async function save() {
  formError.value = ''
  saving.value = true
  try {
    const f = form.value
    if (!f.id) {
      await api.createAdminUser({
        login: f.login.trim(),
        display_name: f.display_name.trim(),
        email: f.email || null,
        password: f.password,
        is_active: f.is_active,
        must_change_password: f.must_change_password,
        roles: canAssign.value ? f.roles : undefined,
      })
    } else {
      const body = {
        display_name: f.display_name.trim(),
        email: f.email || null,
        is_active: f.is_active,
        must_change_password: f.must_change_password,
      }
      if (f.password) body.password = f.password
      if (canAssign.value) body.roles = f.roles
      await api.updateAdminUser(f.id, body)
    }
    form.value = null
    await load()
  } catch (e) {
    formError.value = e?.message || 'Ошибка сохранения'
  } finally {
    saving.value = false
  }
}

async function remove(u) {
  if (!confirm(`Удалить пользователя «${u.login}»?`)) return
  try {
    await api.deleteAdminUser(u.id)
    await load()
  } catch (e) {
    alert(e?.message || 'Ошибка удаления')
  }
}

onMounted(load)
</script>

<style scoped>
.lead {
  color: var(--ar-muted);
  margin: 0 0 1rem;
  font-size: 0.95rem;
}
.head-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5rem;
}
.head-buttons-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.btn-same {
  min-width: 140px;
}
.col-picker-wrap {
  position: relative;
}
.col-picker-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 2px;
  background: var(--ar-surface);
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  box-shadow: var(--ar-shadow-card);
  padding: 0.5rem;
  min-width: 160px;
  z-index: 50;
}
.col-picker-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0;
  cursor: pointer;
  font-size: 0.9rem;
}
.sort-indicator {
  margin-left: 0.25rem;
}
th.sortable {
  cursor: pointer;
  user-select: none;
}
.code-cell {
  font-size: 0.85rem;
  background: var(--ar-table-head-bg);
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
}
.btn-link:not(.danger) {
  color: var(--ar-link);
  margin-right: 0.5rem;
}
.loading,
.empty {
  color: var(--ar-muted);
}
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(26, 29, 46, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.modal {
  background: var(--ar-surface);
  padding: 1.5rem;
  border-radius: var(--ar-radius-lg);
  min-width: 360px;
  max-width: 90vw;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
  border: 1px solid var(--ar-border);
}
.modal-wide {
  min-width: 480px;
}
.modal h3 {
  margin: 0 0 1rem;
  font-size: 1.1rem;
}
.form-row {
  margin-bottom: 0.75rem;
}
.form-row label {
  display: block;
  margin-bottom: 0.25rem;
  font-size: 0.9rem;
}
.form-row input:not([type='checkbox']) {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  font-size: 1rem;
  box-sizing: border-box;
  background: var(--ar-surface);
}
.form-row input[type='checkbox'] {
  margin-right: 0.5rem;
}
.form-row .hint {
  margin-top: 0.25rem;
  font-size: 0.85rem;
  color: var(--ar-muted);
}
.roles-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.5rem 0.65rem;
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  background: var(--ar-table-head-bg);
}
.role-check {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  font-weight: normal;
  margin: 0;
}
.form-error {
  color: var(--ar-danger);
  font-size: 0.9rem;
}
.modal-actions {
  margin-top: 1rem;
  display: flex;
  gap: 0.5rem;
}
</style>

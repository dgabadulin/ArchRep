<template>
  <div class="page">
    <div class="page-head">
      <h1>{{ canWrite ? 'Редактирование роли' : 'Просмотр роли' }}</h1>
      <router-link :to="listPath" class="btn btn-secondary">← К списку</router-link>
    </div>

    <div v-if="loading" class="loading">Загрузка...</div>
    <template v-else-if="role">
      <p v-if="!canWrite" class="readonly-banner">Режим просмотра: нет права <code>roles:write</code>.</p>

      <form class="card form" @submit.prevent="save">
        <fieldset class="form-fieldset" :disabled="!canWrite">
          <div class="form-grid">
            <div class="field">
              <label>Код</label>
              <input :value="role.code" type="text" readonly class="readonly-input" />
            </div>
            <div class="field">
              <label>Системная</label>
              <input :value="role.is_system ? 'Да' : 'Нет'" type="text" readonly class="readonly-input" />
            </div>
            <div class="field field-wide">
              <label>Название <span class="req">*</span></label>
              <input v-model="form.name" type="text" required />
            </div>
            <div class="field field-wide">
              <label>Описание</label>
              <textarea v-model="form.description" rows="2"></textarea>
            </div>
          </div>

          <div class="dual-section">
            <h2 class="section-title">Разрешения</h2>
            <div class="dual-grid">
              <div class="dual-col">
                <label class="dual-label">Существующие разрешения</label>
                <select
                  ref="leftSelectRef"
                  multiple
                  class="dual-select"
                  size="16"
                >
                  <option v-for="p in leftPool" :key="p" :value="p">{{ p }}</option>
                </select>
              </div>
              <div class="dual-btns">
                <button type="button" class="btn btn-secondary btn-sm" title="Назначить" :disabled="!canWrite" @click="moveRight">&gt;&gt;</button>
                <button type="button" class="btn btn-secondary btn-sm" title="Снять" :disabled="!canWrite" @click="moveLeft">&lt;&lt;</button>
              </div>
              <div class="dual-col">
                <label class="dual-label">Назначенные разрешения</label>
                <select
                  ref="rightSelectRef"
                  multiple
                  class="dual-select"
                  size="16"
                >
                  <option v-for="p in assigned" :key="p" :value="p">{{ p }}</option>
                </select>
                <p v-if="assigned.length === 0" class="dual-empty">Нет назначенных разрешений</p>
              </div>
            </div>
          </div>
        </fieldset>

        <div v-if="submitError" class="error">{{ submitError }}</div>
        <div class="actions">
          <button v-if="canWrite" type="submit" class="btn btn-primary" :disabled="saving">
            {{ saving ? 'Сохранение...' : 'Сохранить' }}
          </button>
          <router-link :to="listPath" class="btn btn-secondary">
            {{ canWrite ? 'Отмена' : 'К списку' }}
          </router-link>
        </div>
      </form>
    </template>
    <p v-else class="error">Роль не найдена</p>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../api/client'
import { usePermissions } from '../composables/usePermissions'

const route = useRoute()
const { canWrite } = usePermissions('roles')
const listPath = '/settings/administration/roles'

const loading = ref(true)
const saving = ref(false)
const submitError = ref('')
const role = ref(null)
const allPermissionCodes = ref([])
const assigned = ref([])
const form = ref({ name: '', description: '' })
const leftSelectRef = ref(null)
const rightSelectRef = ref(null)

const leftPool = computed(() => {
  const set = new Set(assigned.value)
  return allPermissionCodes.value.filter((c) => !set.has(c))
})

function selectedValues(selectRef) {
  const el = selectRef.value
  if (!el) return []
  return Array.from(el.selectedOptions || []).map((o) => o.value)
}

function moveRight() {
  if (!canWrite.value) return
  const ids = selectedValues(leftSelectRef)
  if (!ids.length) return
  assigned.value = [...assigned.value, ...ids].sort((a, b) => a.localeCompare(b))
}

function moveLeft() {
  if (!canWrite.value) return
  const ids = new Set(selectedValues(rightSelectRef))
  if (!ids.size) return
  assigned.value = assigned.value.filter((c) => !ids.has(c))
}

async function load() {
  loading.value = true
  submitError.value = ''
  try {
    const id = route.params.id
    const [roleRow, perms] = await Promise.all([
      api.getAdminRole(id),
      api.getAdminPermissions(),
    ])
    role.value = roleRow
    form.value = {
      name: roleRow.name || '',
      description: roleRow.description || '',
    }
    assigned.value = [...(roleRow.permissions || [])]
    allPermissionCodes.value = (perms || []).map((p) => p.code).filter(Boolean)
  } catch (e) {
    role.value = null
    submitError.value = e?.message || 'Ошибка загрузки'
  } finally {
    loading.value = false
  }
}

async function save() {
  if (!canWrite.value || !role.value) return
  submitError.value = ''
  saving.value = true
  try {
    await api.updateAdminRole(role.value.id, {
      name: form.value.name.trim(),
      description: form.value.description.trim() || null,
      permissions: assigned.value,
    })
    await load()
  } catch (e) {
    submitError.value = e?.message || 'Ошибка сохранения'
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.form-fieldset {
  border: 0;
  margin: 0;
  padding: 0;
  min-width: 0;
}
.readonly-banner {
  margin: 0 0 1rem;
  padding: 0.65rem 0.85rem;
  background: var(--ar-accent-soft);
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  font-size: 0.9rem;
  color: var(--ar-muted);
}
.readonly-input {
  background: var(--ar-table-head-bg) !important;
  color: var(--ar-muted);
}
.section-title {
  margin: 1.25rem 0 0.75rem;
  font-size: 1.05rem;
}
.dual-grid {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 12px;
  align-items: start;
}
.dual-label {
  display: block;
  font-weight: 600;
  margin-bottom: 6px;
  font-size: 0.9rem;
}
.dual-select {
  width: 100%;
  min-height: 280px;
  padding: 6px;
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  background: var(--ar-surface);
  font-family: ui-monospace, monospace;
  font-size: 0.85rem;
}
.dual-btns {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-top: 1.75rem;
}
.dual-empty {
  margin: 0.35rem 0 0;
  font-size: 0.85rem;
  color: var(--ar-muted);
}
.error,
.loading {
  color: var(--ar-muted);
}
.error {
  color: var(--ar-danger);
  margin-top: 0.75rem;
}
@media (max-width: 800px) {
  .dual-grid {
    grid-template-columns: 1fr;
  }
  .dual-btns {
    flex-direction: row;
    padding-top: 0;
    justify-content: center;
  }
}
</style>

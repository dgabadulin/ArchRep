<template>
  <div class="page">
    <div class="page-head">
      <h1>{{ pageTitle }}</h1>
      <router-link :to="listPath" class="btn btn-secondary">← К списку</router-link>
    </div>

    <div v-if="loading" class="loading">Загрузка...</div>
    <template v-else-if="roleLoaded">
      <p v-if="!canWrite" class="readonly-banner">Режим просмотра: нет права <code>roles:write</code>.</p>

      <form class="card form" @submit.prevent="save()">
        <fieldset class="form-fieldset" :disabled="!canWrite">
          <div class="form-grid">
            <div class="field">
              <label>Код</label>
              <input
                v-if="isNew"
                v-model="form.code"
                type="text"
                required
                placeholder="Например, DOMAIN_OPERATOR"
              />
              <input v-else :value="role.code" type="text" readonly class="readonly-input" />
            </div>
            <div class="field">
              <label>Системная</label>
              <input :value="role?.is_system ? 'Да' : 'Нет'" type="text" readonly class="readonly-input" />
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
      </form>

      <SaveBar
        :saving="saving"
        :saved="savedOk"
        :dirty="isDirty"
        :can-save="canWrite"
        :error="submitError"
        show-save-and-close
        @save="save()"
        @save-and-close="save({ close: true })"
      >
        <template #extra>
          <button
            v-if="canDelete"
            type="button"
            class="btn btn-danger"
            :disabled="deleting"
            @click="removeRole"
          >
            {{ deleting ? 'Удаление...' : 'Удалить' }}
          </button>
        </template>
        <template #cancel>
          <router-link :to="listPath" class="btn btn-secondary">
            {{ canWrite ? 'Отмена' : 'К списку' }}
          </router-link>
        </template>
      </SaveBar>
    </template>
    <p v-else class="error">{{ submitError || 'Роль не найдена' }}</p>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api/client'
import SaveBar from '../components/SaveBar.vue'
import { usePermissions } from '../composables/usePermissions'
import { useFormDirty } from '../composables/useFormDirty'
import { useSaveStatus } from '../composables/useSaveStatus'
import { useUnsavedGuard } from '../composables/useUnsavedGuard'

const route = useRoute()
const router = useRouter()
const { canWrite } = usePermissions('roles')
const listPath = '/settings/administration/roles'
const isNew = computed(() => route.name === 'admin-role-new')

const loading = ref(true)
const deleting = ref(false)
const role = ref(null)
const allPermissionCodes = ref([])
const assigned = ref([])
const form = ref({ code: '', name: '', description: '' })
const leftSelectRef = ref(null)
const rightSelectRef = ref(null)

/** Правки формы: поля роли + назначенные разрешения (issue #94). */
const { isDirty, markSaved } = useFormDirty(() => ({ ...form.value, permissions: [...assigned.value] }))
/** Состояние панели сохранения: «сохранение → сохранено → ошибка» + текст ошибки. */
const {
  saving,
  savedOk,
  submitError,
  startSaving,
  markSaved: markSavedOk,
  markError,
} = useSaveStatus({ dirty: isDirty })
const roleLoaded = computed(() => isNew.value || !!role.value)
const pageTitle = computed(() => {
  if (isNew.value) return 'Новая роль'
  return canWrite.value ? 'Редактирование роли' : 'Просмотр роли'
})
const canDelete = computed(() =>
  canWrite.value && !isNew.value && role.value && !role.value.is_system
)

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
    const permsPromise = api.getAdminPermissions()
    if (isNew.value) {
      role.value = { id: null, code: '', is_system: false, assigned_users_count: 0, permissions: [] }
      form.value = { code: '', name: '', description: '' }
      assigned.value = []
      const perms = await permsPromise
      allPermissionCodes.value = (perms || []).map((p) => p.code).filter(Boolean)
      return
    }
    const id = route.params.id
    const [roleRow, perms] = await Promise.all([api.getAdminRole(id), permsPromise])
    role.value = roleRow
    form.value = {
      code: roleRow.code || '',
      name: roleRow.name || '',
      description: roleRow.description || '',
    }
    assigned.value = [...(roleRow.permissions || [])]
    allPermissionCodes.value = (perms || []).map((p) => p.code).filter(Boolean)
  } catch (e) {
    role.value = null
    markError(e?.message || 'Ошибка загрузки')
  } finally {
    if (role.value) markSaved()
    loading.value = false
  }
}

/**
 * Единая точка сохранения формы (issue #94).
 *
 * Навигация после успешного сохранения:
 *   skipNavigate — остаться (сохранение перед уходом со страницы, guard);
 *   close        — «Сохранить и закрыть»: уйти к списку ролей;
 *   по умолчанию — остаться; новая роль превращается в карточку редактирования.
 *
 * @param {{ close?: boolean, skipNavigate?: boolean }} opts
 * @returns {Promise<boolean>} true, если сохранение прошло без ошибок.
 */
async function save(opts = {}) {
  if (!canWrite.value || saving.value) return false
  if (!form.value.code.trim() || !form.value.name.trim()) {
    markError('Заполните обязательные поля: код и название роли.')
    return false
  }
  startSaving()
  try {
    const body = {
      code: form.value.code.trim(),
      name: form.value.name.trim(),
      description: form.value.description.trim() || null,
      permissions: assigned.value,
    }
    if (isNew.value) {
      const created = await api.createAdminRole(body)
      // Снимок фиксируем ДО перехода: иначе guard предложит сохранить ещё раз и создаст дубль роли.
      markSaved()
      await router.replace(`/settings/administration/roles/${created.id}/edit`)
    } else {
      await api.updateAdminRole(role.value.id, body)
      markSaved()
    }
    markSavedOk()
    if (opts.skipNavigate) return true
    if (opts.close) {
      await router.push(listPath)
      return true
    }
    // Перечитываем запись: сервер нормализует поля (код, набор разрешений).
    await load()
    return true
  } catch (e) {
    markError(e?.message || 'Ошибка сохранения')
    return false
  }
}

/**
 * Выход со страницы с несохранёнными правками: guard предлагает сохранить.
 * При ошибке сохранения `save` возвращает `false` — переход отменяется, данные не теряются.
 */
useUnsavedGuard(
  computed(() => canWrite.value && isDirty.value),
  async () => {
    const ok = await save({ skipNavigate: true })
    if (!ok) throw new Error('Не сохранено')
  },
)

async function removeRole() {
  if (!canDelete.value || !role.value) return
  const ok = window.confirm(`Удалить роль «${role.value.name}»?`)
  if (!ok) return
  submitError.value = ''
  deleting.value = true
  try {
    await api.deleteAdminRole(role.value.id)
    markSaved()
    await router.push(listPath)
  } catch (e) {
    markError(e?.message || 'Ошибка удаления')
  } finally {
    deleting.value = false
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

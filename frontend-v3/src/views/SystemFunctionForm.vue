<template>
  <div class="page">
    <div class="page-head">
      <h1>{{ formTitle }}</h1>
      <router-link :to="listRouteLocation" class="btn btn-secondary">← К реестру</router-link>
    </div>

    <div v-if="loading" class="loading">Загрузка...</div>
    <div v-else-if="error && !form" class="error">{{ error }}</div>

    <template v-else-if="form">
      <form class="card form unified-form" @submit.prevent="submit()">
        <p v-if="isEdit && !canWrite" class="readonly-banner">
          Режим просмотра: нет права <code>system_function:write</code>.
        </p>
        <fieldset class="form-fieldset" :disabled="!canWrite">
          <div class="form-grid">
            <div class="field">
              <label>Система <span class="req">*</span></label>
              <select v-model="form.ar_systems_id" required>
                <option :value="null">— Выберите систему —</option>
                <option v-for="s in systems" :key="s.id" :value="s.id">
                  {{ s.display_name || s.name }}{{ s.parent_ar_systems_id ? ' (модуль)' : '' }}
                </option>
              </select>
            </div>
            <div class="field">
              <label>Статус в реестре</label>
              <select v-model="form.ar_system_function_statuses_id">
                <option :value="null">—</option>
                <option v-for="st in statuses" :key="st.id" :value="st.id">{{ st.display_name || st.name }}</option>
              </select>
            </div>
            <div class="field field-wide">
              <label>Наименование функции <span class="req">*</span></label>
              <input v-model="form.name" required maxlength="500" placeholder="Например: Формирование реестра заявок" />
            </div>
            <div class="field field-wide">
              <label>Примечание</label>
              <textarea v-model="form.description" rows="3"></textarea>
            </div>
          </div>
        </fieldset>
      </form>

      <div v-if="isEdit" class="card relation-card">
        <h3 class="block-title">Связи метамодели</h3>
        <p class="block-hint">
          Связи функции с системой/модулем и заинтересованными лицами поддерживаются метамоделью
          (реестр «Связи объектов управления»).
        </p>
        <table v-if="relations.length" class="table">
          <thead>
            <tr><th>Тип связи</th><th>От</th><th>К</th><th></th></tr>
          </thead>
          <tbody>
            <tr v-for="rel in relations" :key="rel.id">
              <td>{{ rel.relation_type_display_name || rel.relation_type_name || rel.relation_type }}</td>
              <td>{{ endLabel(rel.from_entity_type, rel.from_entity_name) }}</td>
              <td>{{ endLabel(rel.to_entity_type, rel.to_entity_name) }}</td>
              <td>
                <router-link v-if="canReadRelations" :to="`/metamodel-relations/${rel.id}/edit`" class="link">
                  Открыть
                </router-link>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="empty">Связей нет.</p>
      </div>

      <div v-if="isEdit" class="card relation-card">
        <h3 class="block-title">Использование в архитектурных заключениях</h3>
        <p class="block-hint">
          Пока функция выбрана в заключении, удалить её нельзя. Сначала уберите функцию в форме
          соответствующего заключения.
        </p>
        <table v-if="usages.length" class="table">
          <thead>
            <tr><th>ADR</th><th>Задача</th><th>Решение</th><th></th></tr>
          </thead>
          <tbody>
            <tr v-for="u in usages" :key="`${u.ar_adrs_applied_id}-${u.ar_adr_increment_id}`">
              <td>{{ u.adr_code || `#${u.ar_adrs_applied_id}` }}</td>
              <td>{{ u.adr_task_name || '—' }}</td>
              <td>{{ u.increment_name || '—' }}</td>
              <td>
                <router-link v-if="canReadAdr" :to="`/decisions/applied/${u.ar_adrs_applied_id}/edit`" class="link">
                  Открыть
                </router-link>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="empty">Функция не используется в заключениях.</p>
      </div>
    </template>

    <SaveBar
      v-if="form"
      :saving="saving"
      :saved="savedOk"
      :dirty="isDirty"
      :can-save="canWrite"
      :error="submitError"
      show-save-and-close
      max-width="720px"
      @save="submit()"
      @save-and-close="submit({ close: true })"
    >
      <template #extra>
        <button
          v-if="isEdit && canDelete"
          type="button"
          class="btn btn-danger"


          :disabled="saving || deleting"
          @click="removeFunction"
        >
          {{ deleting ? 'Удаление...' : 'Удалить' }}
        </button>
      </template>
      <template #cancel>
        <router-link :to="listRouteLocation" class="btn btn-secondary">
          {{ canWrite ? 'Отмена' : 'К списку' }}
        </router-link>
      </template>
    </SaveBar>
  </div>
</template>
<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api/client'
import SaveBar from '../components/SaveBar.vue'
import { useFormListReturn } from '../composables/useFormListReturn'
import { usePermissions } from '../composables/usePermissions'
import { useFormDirty } from '../composables/useFormDirty'
import { useSaveStatus } from '../composables/useSaveStatus'
import { useUnsavedGuard } from '../composables/useUnsavedGuard'
import { messageFromApiError } from '../utils/apiErrors'

const route = useRoute()
const router = useRouter()
const { listRouteLocation, routeWithListSearch } = useFormListReturn('/system-functions')
const { canWrite, canDelete, canRead, hasPermission } = usePermissions('system_function')
const id = computed(() => route.params.id)
const isEdit = computed(() => !!id.value && id.value !== 'new')
const formTitle = computed(() => {
  if (!isEdit.value) return 'Новая функция ИС'
  return canWrite.value ? 'Редактирование функции ИС' : 'Просмотр функции ИС'
})
const canReadRelations = computed(() => hasPermission('metamodel_relation:read'))
const canReadAdr = computed(() => hasPermission('adr_applied:read'))

const form = ref(null)
const loading = ref(true)
const error = ref('')
const systems = ref([])
const statuses = ref([])
const relations = ref([])
const usages = ref([])
const deleting = ref(false)

/** Правки формы: снимок берётся после загрузки записи и после сохранения (issue #94). */
const { isDirty, markSaved } = useFormDirty(() => form.value)
const {
  saving,
  savedOk,
  submitError,
  startSaving,
  markSaved: markSavedOk,
  markError,
} = useSaveStatus({ dirty: isDirty })

async function loadRefs() {
  const [sys, st] = await Promise.allSettled([api.getSystems(), api.getSystemFunctionStatuses()])
  systems.value = sys.status === 'fulfilled' ? sys.value || [] : []
  statuses.value = st.status === 'fulfilled' ? st.value || [] : []
}

async function load() {
  loading.value = true
  error.value = ''
  await loadRefs()
  if (isEdit.value) {
    try {
      const row = await api.getSystemFunction(id.value)
      form.value = {
        ar_systems_id: row.ar_systems_id,
        name: row.name || '',
        description: row.description || '',
        ar_system_function_statuses_id: row.ar_system_function_statuses_id ?? null,
      }
      relations.value = row.relations || []
      usages.value = row.usages || []
    } catch (e) {
      error.value = messageFromApiError(e?.status, e?.body, e?.message) || 'Ошибка загрузки'
      form.value = null
    }
  } else {
    form.value = { ar_systems_id: null, name: '', description: '', ar_system_function_statuses_id: null }
  }
  markSaved()
  loading.value = false
}

function endLabel(type, name) {
  const labels = {
    system: 'ИС',
    subsystem: 'Модуль',
    system_function: 'Функция ИС',
    actor: 'Актор',
    business_service: 'Бизнес-сервис',
    business_function: 'Бизнес-способность',
    technology: 'Технология',
    organization_unit: 'Орг. единица',
    employee: 'Сотрудник',
    partner: 'Партнёр',
    principle: 'Принцип',
    gap: 'Арх. долг',
    applied: 'Заключение',
    adr_principle: 'ADR',
  }
  const label = labels[type] || type || '—'
  return `${label}: ${name || '—'}`
}

/**
 * Единая точка сохранения формы (issue #94): создание/правка функции реестра.
 * @param {{ close?: boolean, skipNavigate?: boolean }} opts
 * @returns {Promise<boolean>}
 */
async function submit(opts = {}) {
  if (!canWrite.value || saving.value) return false
  if (!form.value.ar_systems_id) {
    markError('Укажите систему — это обязательное поле.')
    return false
  }
  if (!form.value.name?.trim()) {
    markError('Укажите наименование функции — это обязательное поле.')
    return false
  }
  startSaving()
  const payload = {
    ar_systems_id: form.value.ar_systems_id,
    name: form.value.name,
    description: form.value.description || undefined,
    ar_system_function_statuses_id: form.value.ar_system_function_statuses_id || undefined,
  }
  try {
    let functionId = id.value
    if (isEdit.value) {
      await api.updateSystemFunctionRegistry(id.value, payload)
    } else {
      const res = await api.createSystemFunctionRegistry(payload)
      functionId = res.id
    }
    markSaved()
    markSavedOk()
    if (opts.skipNavigate) return true
    if (opts.close) {
      await router.push(listRouteLocation.value)
      return true
    }
    if (!isEdit.value) await router.replace(routeWithListSearch(`/system-functions/${functionId}/edit`))
    return true
  } catch (e) {
    markError(messageFromApiError(e?.status, e?.body, e?.message) || 'Ошибка сохранения')
    return false
  }
}

/** Удаление функции: 409, если она выбрана в заключениях (показываем список ADR). */
async function removeFunction() {
  if (!canDelete.value || saving.value || deleting.value) return
  const label = form.value.name || 'функцию'
  if (!window.confirm(`Удалить ${label}? Действие необратимо.`)) return
  deleting.value = true
  try {
    await api.deleteSystemFunctionRegistry(id.value)
    await router.push(listRouteLocation.value)
  } catch (e) {
    const body = e?.body || {}
    const base = body.error || messageFromApiError(e?.status, body, e?.message) || 'Не удалось удалить'
    const codes = Array.isArray(body.adr_codes) && body.adr_codes.length ? ` ADR: ${body.adr_codes.join(', ')}.` : ''
    markError(`${base}${codes}`)
  } finally {
    deleting.value = false
  }
}

useUnsavedGuard(
  computed(() => canWrite.value && isDirty.value),
  async () => {
    const ok = await submit({ skipNavigate: true })
    if (!ok) throw new Error('Не сохранено')
  },
)

onMounted(load)
watch(id, load)
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
.form {
  max-width: 720px;
  background: var(--ar-surface);
  padding: 1.25rem;
  border-radius: var(--ar-radius-lg);
  border: 1px solid var(--ar-border);
  box-shadow: var(--ar-shadow-card);
}
.relation-card {
  margin-top: 1rem;
  max-width: 720px;
}
.block-title {
  margin: 0 0 0.35rem;
}
.block-hint {
  margin: 0 0 0.75rem;
  font-size: 0.85rem;
  color: var(--ar-muted);
}
.btn-danger {
  padding: 0.5rem 1rem;
  border: 1px solid var(--ar-danger);
  border-radius: var(--ar-radius-sm);
  background: var(--ar-surface);
  color: var(--ar-danger);
  font-weight: 600;
  cursor: pointer;
}
.btn-danger:disabled {
  opacity: 0.55;
  cursor: default;
}
</style>


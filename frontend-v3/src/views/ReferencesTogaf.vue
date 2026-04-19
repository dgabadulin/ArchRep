<template>
  <div class="page">
    <div class="page-head">
      <h1>Справочники</h1>
    </div>
    <div class="tabs">
      <button type="button" :class="['tab', { active: tab === 'categories' }]" @click="tab = 'categories'">Категории орг. единиц</button>
      <button type="button" :class="['tab', { active: tab === 'actor-types' }]" @click="tab = 'actor-types'">Типы акторов</button>
      <button type="button" :class="['tab', { active: tab === 'statuses' }]" @click="tab = 'statuses'">Статусы бизнес-сервисов</button>
      <button type="button" :class="['tab', { active: tab === 'entity-types' }]" @click="tab = 'entity-types'">Типы сущностей метамодели</button>
      <button type="button" :class="['tab', { active: tab === 'relation-types' }]" @click="tab = 'relation-types'">Типы связей метамодели</button>
    </div>
    <div v-if="tab === 'categories'" class="panel">
      <h2>Категории организационных единиц</h2>
      <div class="table-actions">
        <button type="button" class="btn btn-sm btn-primary" @click="openCategoryForm()">Добавить</button>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr><th>Код</th><th>Наименование</th><th>Описание</th><th></th></tr>
          </thead>
          <tbody>
            <tr v-for="row in categories" :key="row.id">
              <td>{{ row.code || '—' }}</td>
              <td>{{ row.name }}</td>
              <td>{{ row.description || '—' }}</td>
              <td>
                <button type="button" class="btn-link" @click="openCategoryForm(row)">Изменить</button>
                <button type="button" class="btn-link danger" @click="deleteCategory(row.id)">Удалить</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="categories.length === 0" class="empty">Нет записей</p>
    </div>
    <div v-else-if="tab === 'actor-types'" class="panel">
      <h2>Типы акторов</h2>
      <div class="table-actions">
        <button type="button" class="btn btn-sm btn-primary" @click="openActorTypeForm()">Добавить</button>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr><th>Код</th><th>Наименование</th><th>Описание</th><th></th></tr>
          </thead>
          <tbody>
            <tr v-for="row in actorTypes" :key="row.id">
              <td>{{ row.code || '—' }}</td>
              <td>{{ row.name }}</td>
              <td>{{ row.description || '—' }}</td>
              <td>
                <button type="button" class="btn-link" @click="openActorTypeForm(row)">Изменить</button>
                <button type="button" class="btn-link danger" @click="deleteActorType(row.id)">Удалить</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="actorTypes.length === 0" class="empty">Нет записей</p>
    </div>
    <div v-else-if="tab === 'statuses'" class="panel">
      <h2>Статусы бизнес-сервисов</h2>
      <div class="table-actions">
        <button type="button" class="btn btn-sm btn-primary" @click="openStatusForm()">Добавить</button>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr><th>Наименование</th><th>Описание</th><th></th></tr>
          </thead>
          <tbody>
            <tr v-for="row in statuses" :key="row.id">
              <td>{{ row.name }}</td>
              <td>{{ row.description || '—' }}</td>
              <td>
                <button type="button" class="btn-link" @click="openStatusForm(row)">Изменить</button>
                <button type="button" class="btn-link danger" @click="deleteStatus(row.id)">Удалить</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="statuses.length === 0" class="empty">Нет записей</p>
    </div>
    <div v-else-if="tab === 'entity-types'" class="panel">
      <h2>Типы сущностей метамодели</h2>
      <p class="hint">Код используется в связях и графе. table_name — имя таблицы в БД (например ar_systems).</p>
      <div class="table-actions">
        <button type="button" class="btn btn-sm btn-primary" @click="openEntityTypeForm()">Добавить</button>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr><th>Код</th><th>Наименование</th><th>Таблица</th><th>Описание</th><th></th></tr>
          </thead>
          <tbody>
            <tr v-for="row in entityTypes" :key="row.id">
              <td>{{ row.code }}</td>
              <td>{{ row.name }}</td>
              <td>{{ row.table_name || '—' }}</td>
              <td>{{ row.description || '—' }}</td>
              <td>
                <button type="button" class="btn-link" @click="openEntityTypeForm(row)">Изменить</button>
                <button type="button" class="btn-link danger" @click="deleteEntityType(row.id)">Удалить</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="entityTypes.length === 0" class="empty">Нет записей</p>
    </div>
    <div v-else-if="tab === 'relation-types'" class="panel">
      <h2>Типы связей метамодели</h2>
      <p class="hint">from_entity_types / to_entity_types — коды типов сущностей (через запятую), допустимые для этой связи.</p>
      <div class="table-actions">
        <button type="button" class="btn btn-sm btn-primary" @click="openRelationTypeForm()">Добавить</button>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr><th>Код</th><th>Наименование</th><th>Описание</th><th>От (типы)</th><th>К (типам)</th><th></th></tr>
          </thead>
          <tbody>
            <tr v-for="row in relationTypes" :key="row.id">
              <td>{{ row.code }}</td>
              <td>{{ row.name }}</td>
              <td>{{ row.description || '—' }}</td>
              <td>{{ formatEntityTypes(row.from_entity_types) }}</td>
              <td>{{ formatEntityTypes(row.to_entity_types) }}</td>
              <td>
                <button type="button" class="btn-link" @click="openRelationTypeForm(row)">Изменить</button>
                <button type="button" class="btn-link danger" @click="deleteRelationType(row.id)">Удалить</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="relationTypes.length === 0" class="empty">Нет записей</p>
    </div>

    <!-- Модалки -->
    <div v-if="categoryForm" class="modal-overlay">
      <div class="modal">
        <h3>{{ categoryForm.id ? 'Изменить категорию' : 'Новая категория орг. единицы' }}</h3>
        <div class="form-row"><label>Код</label><input v-model="categoryForm.code" placeholder="необязательно" /></div>
        <div class="form-row"><label>Наименование</label><input v-model="categoryForm.name" /></div>
        <div class="form-row"><label>Описание</label><input v-model="categoryForm.description" /></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-primary" @click="saveCategory">Сохранить</button>
          <button type="button" class="btn btn-secondary" @click="categoryForm = null">Отмена</button>
        </div>
      </div>
    </div>
    <div v-if="actorTypeForm" class="modal-overlay">
      <div class="modal">
        <h3>{{ actorTypeForm.id ? 'Изменить тип актора' : 'Новый тип актора' }}</h3>
        <div class="form-row"><label>Код</label><input v-model="actorTypeForm.code" placeholder="необязательно" /></div>
        <div class="form-row"><label>Наименование</label><input v-model="actorTypeForm.name" /></div>
        <div class="form-row"><label>Описание</label><input v-model="actorTypeForm.description" /></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-primary" @click="saveActorType">Сохранить</button>
          <button type="button" class="btn btn-secondary" @click="actorTypeForm = null">Отмена</button>
        </div>
      </div>
    </div>
    <div v-if="statusForm" class="modal-overlay">
      <div class="modal">
        <h3>{{ statusForm.id ? 'Изменить статус' : 'Новый статус бизнес-сервиса' }}</h3>
        <div class="form-row"><label>Наименование</label><input v-model="statusForm.name" /></div>
        <div class="form-row"><label>Описание</label><input v-model="statusForm.description" /></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-primary" @click="saveStatus">Сохранить</button>
          <button type="button" class="btn btn-secondary" @click="statusForm = null">Отмена</button>
        </div>
      </div>
    </div>
    <div v-if="entityTypeForm" class="modal-overlay">
      <div class="modal">
        <h3>{{ entityTypeForm.id ? 'Изменить тип сущности' : 'Новый тип сущности метамодели' }}</h3>
        <div class="form-row"><label>Код <span class="req">*</span></label><input v-model="entityTypeForm.code" placeholder="напр. system" /></div>
        <div class="form-row"><label>Наименование <span class="req">*</span></label><input v-model="entityTypeForm.name" /></div>
        <div class="form-row"><label>Таблица в БД</label><input v-model="entityTypeForm.table_name" placeholder="напр. ar_systems" /></div>
        <div class="form-row"><label>Описание</label><input v-model="entityTypeForm.description" /></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-primary" @click="saveEntityType">Сохранить</button>
          <button type="button" class="btn btn-secondary" @click="entityTypeForm = null">Отмена</button>
        </div>
      </div>
    </div>
    <div v-if="relationTypeForm" class="modal-overlay">
      <div class="modal">
        <h3>{{ relationTypeForm.id ? 'Изменить тип связи' : 'Новый тип связи метамодели' }}</h3>
        <div class="form-row"><label>Код <span class="req">*</span></label><input v-model="relationTypeForm.code" placeholder="напр. realizes" /></div>
        <div class="form-row"><label>Наименование <span class="req">*</span></label><input v-model="relationTypeForm.name" /></div>
        <div class="form-row"><label>Описание</label><input v-model="relationTypeForm.description" /></div>
        <div class="form-row"><label>От типов сущностей (коды через запятую)</label><input v-model="relationTypeForm.from_entity_types_str" placeholder="system, business_service" /></div>
        <div class="form-row"><label>К типам сущностей (коды через запятую)</label><input v-model="relationTypeForm.to_entity_types_str" placeholder="system, technology" /></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-primary" @click="saveRelationType">Сохранить</button>
          <button type="button" class="btn btn-secondary" @click="relationTypeForm = null">Отмена</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { togafApi } from '../api'

const tab = ref('categories')
const categories = ref([])
const actorTypes = ref([])
const statuses = ref([])
const entityTypes = ref([])
const relationTypes = ref([])
const categoryForm = ref(null)
const actorTypeForm = ref(null)
const statusForm = ref(null)
const entityTypeForm = ref(null)
const relationTypeForm = ref(null)

async function load() {
  categories.value = await togafApi.refs.organizationUnitCategories()
  actorTypes.value = await togafApi.refs.actorTypes()
  statuses.value = await togafApi.refs.businessServiceStatuses()
  entityTypes.value = await togafApi.entityTypes()
  relationTypes.value = await togafApi.relationTypes()
}
onMounted(load)

function openCategoryForm(row) {
  categoryForm.value = row
    ? { id: row.id, code: row.code ?? '', name: row.name, description: row.description ?? '' }
    : { code: '', name: '', description: '' }
}
function openActorTypeForm(row) {
  actorTypeForm.value = row
    ? { id: row.id, code: row.code ?? '', name: row.name, description: row.description ?? '' }
    : { code: '', name: '', description: '' }
}
function openStatusForm(row) {
  statusForm.value = row
    ? { id: row.id, name: row.name, description: row.description ?? '' }
    : { name: '', description: '' }
}
function openEntityTypeForm(row) {
  entityTypeForm.value = row
    ? { id: row.id, code: row.code, name: row.name, table_name: row.table_name ?? '', description: row.description ?? '' }
    : { code: '', name: '', table_name: '', description: '' }
}
function openRelationTypeForm(row) {
  const fromStr = (row && row.from_entity_types && row.from_entity_types.length) ? row.from_entity_types.join(', ') : ''
  const toStr = (row && row.to_entity_types && row.to_entity_types.length) ? row.to_entity_types.join(', ') : ''
  relationTypeForm.value = row
    ? { id: row.id, code: row.code, name: row.name, description: row.description ?? '', from_entity_types_str: fromStr, to_entity_types_str: toStr }
    : { code: '', name: '', description: '', from_entity_types_str: '', to_entity_types_str: '' }
}
function formatEntityTypes(arr) {
  if (!arr || !arr.length) return '—'
  return arr.join(', ')
}

async function saveCategory() {
  if (!categoryForm.value?.name) return
  try {
    if (categoryForm.value.id) {
      await togafApi.refs.updateOrganizationUnitCategory(categoryForm.value.id, {
        code: categoryForm.value.code,
        name: categoryForm.value.name,
        description: categoryForm.value.description,
      })
    } else {
      await togafApi.refs.createOrganizationUnitCategory({
        code: categoryForm.value.code,
        name: categoryForm.value.name,
        description: categoryForm.value.description,
      })
    }
    categoryForm.value = null
    await load()
  } catch (e) {
    alert(e.message || 'Ошибка')
  }
}
async function saveActorType() {
  if (!actorTypeForm.value?.name) return
  try {
    if (actorTypeForm.value.id) {
      await togafApi.refs.updateActorType(actorTypeForm.value.id, {
        code: actorTypeForm.value.code,
        name: actorTypeForm.value.name,
        description: actorTypeForm.value.description,
      })
    } else {
      await togafApi.refs.createActorType({
        code: actorTypeForm.value.code,
        name: actorTypeForm.value.name,
        description: actorTypeForm.value.description,
      })
    }
    actorTypeForm.value = null
    await load()
  } catch (e) {
    alert(e.message || 'Ошибка')
  }
}
async function saveStatus() {
  if (!statusForm.value?.name) return
  try {
    if (statusForm.value.id) {
      await togafApi.refs.updateBusinessServiceStatus(statusForm.value.id, {
        name: statusForm.value.name,
        description: statusForm.value.description,
      })
    } else {
      await togafApi.refs.createBusinessServiceStatus({
        name: statusForm.value.name,
        description: statusForm.value.description,
      })
    }
    statusForm.value = null
    await load()
  } catch (e) {
    alert(e.message || 'Ошибка')
  }
}
async function saveEntityType() {
  if (!entityTypeForm.value?.code?.trim() || !entityTypeForm.value?.name?.trim()) return
  try {
    if (entityTypeForm.value.id) {
      await togafApi.refs.updateEntityType(entityTypeForm.value.id, {
        code: entityTypeForm.value.code.trim(),
        name: entityTypeForm.value.name.trim(),
        table_name: entityTypeForm.value.table_name?.trim() || null,
        description: entityTypeForm.value.description?.trim() || null,
      })
    } else {
      await togafApi.refs.createEntityType({
        code: entityTypeForm.value.code.trim(),
        name: entityTypeForm.value.name.trim(),
        table_name: entityTypeForm.value.table_name?.trim() || null,
        description: entityTypeForm.value.description?.trim() || null,
      })
    }
    entityTypeForm.value = null
    await load()
  } catch (e) {
    alert(e.message || 'Ошибка')
  }
}
async function saveRelationType() {
  if (!relationTypeForm.value?.code?.trim() || !relationTypeForm.value?.name?.trim()) return
  const fromArr = (relationTypeForm.value.from_entity_types_str || '').split(',').map(s => s.trim()).filter(Boolean)
  const toArr = (relationTypeForm.value.to_entity_types_str || '').split(',').map(s => s.trim()).filter(Boolean)
  try {
    if (relationTypeForm.value.id) {
      await togafApi.refs.updateRelationType(relationTypeForm.value.id, {
        code: relationTypeForm.value.code.trim(),
        name: relationTypeForm.value.name.trim(),
        description: relationTypeForm.value.description?.trim() || null,
        from_entity_types: fromArr,
        to_entity_types: toArr,
      })
    } else {
      await togafApi.refs.createRelationType({
        code: relationTypeForm.value.code.trim(),
        name: relationTypeForm.value.name.trim(),
        description: relationTypeForm.value.description?.trim() || null,
        from_entity_types: fromArr,
        to_entity_types: toArr,
      })
    }
    relationTypeForm.value = null
    await load()
  } catch (e) {
    alert(e.message || 'Ошибка')
  }
}

async function deleteCategory(id) {
  if (!confirm('Удалить категорию?')) return
  try {
    await togafApi.refs.deleteOrganizationUnitCategory(id)
    await load()
  } catch (e) {
    alert(e.message || 'Ошибка')
  }
}
async function deleteActorType(id) {
  if (!confirm('Удалить тип актора?')) return
  try {
    await togafApi.refs.deleteActorType(id)
    await load()
  } catch (e) {
    alert(e.message || 'Ошибка')
  }
}
async function deleteStatus(id) {
  if (!confirm('Удалить статус?')) return
  try {
    await togafApi.refs.deleteBusinessServiceStatus(id)
    await load()
  } catch (e) {
    alert(e.message || 'Ошибка')
  }
}
async function deleteEntityType(id) {
  if (!confirm('Удалить тип сущности? Могут пострадать связи метамодели.')) return
  try {
    await togafApi.refs.deleteEntityType(id)
    await load()
  } catch (e) {
    alert(e.message || 'Ошибка')
  }
}
async function deleteRelationType(id) {
  if (!confirm('Удалить тип связи?')) return
  try {
    await togafApi.refs.deleteRelationType(id)
    await load()
  } catch (e) {
    alert(e.message || 'Ошибка')
  }
}
</script>

<style scoped>
.page-head { margin-bottom: 1rem; }
.page-head h1 { margin: 0; font-size: 1.25rem; }
.tabs { display: flex; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap; }
.tab { padding: 0.5rem 1rem; border: 1px solid #e5dccf; background: #fff; border-radius: 6px; cursor: pointer; font-size: 0.9rem; }
.tab:hover { background: #faf8f5; }
.tab.active { background: #cb997e; color: #fff; border-color: #cb997e; }
.panel h2 { margin: 0 0 0.75rem; font-size: 1rem; }
.hint { margin: 0 0 0.5rem; font-size: 0.85rem; color: #5c5349; }
.table-actions { margin-bottom: 0.5rem; }
.btn { padding: 0.35rem 0.75rem; border-radius: 6px; border: none; cursor: pointer; font-size: 0.9rem; }
.btn-sm { padding: 0.35rem 0.75rem; font-size: 0.85rem; }
.btn-primary { background: #cb997e; color: #fff; }
.btn-secondary { background: #e5dccf; color: #2d2a26; }
.btn-link { background: none; border: none; color: #8b6914; cursor: pointer; text-decoration: underline; margin-right: 0.5rem; font-size: 0.9rem; }
.btn-link.danger { color: #b91c1c; }
.table-wrap { overflow-x: auto; background: #fff; border-radius: 8px; border: 1px solid #e5dccf; }
.table { width: 100%; border-collapse: collapse; }
.table th, .table td { padding: 0.6rem 0.75rem; text-align: left; border-bottom: 1px solid #e5dccf; }
.table th { font-weight: 600; background: #faf8f5; color: #5c5349; }
.empty { padding: 1rem; margin: 0; color: #5c5349; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal { background: #fff; padding: 1.5rem; border-radius: 8px; min-width: 320px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); }
.modal h3 { margin: 0 0 1rem; font-size: 1.1rem; }
.form-row { margin-bottom: 0.75rem; }
.form-row label { display: block; margin-bottom: 0.25rem; font-size: 0.9rem; }
.form-row input { width: 100%; padding: 0.5rem; border: 1px solid #d4c4b0; border-radius: 6px; }
.req { color: #b91c1c; }
.modal-actions { margin-top: 1rem; display: flex; gap: 0.5rem; }
.modal-actions .btn { min-height: 40px; padding: 0.6rem 1rem; }
</style>

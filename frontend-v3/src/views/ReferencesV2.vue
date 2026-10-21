<template>
  <div class="page">
    <h1>Справочники</h1>
    <p class="lead">Поиск, фильтрация и выгрузка в Excel. Редактирование записей — кнопки в таблице.</p>

    <div class="tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="['tab', { active: activeTab === tab.id }]"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <TableToolbar
      v-model:search="search"
      search-placeholder="Поиск по полям справочника"
    />

    <div v-if="loading" class="loading">Загрузка...</div>
    <div v-else class="card table-wrap">
      <!-- Statuses -->
      <template v-if="activeTab === 'statuses'">
        <div class="table-actions">
          <button v-if="canMutateActive" type="button" class="btn btn-sm btn-primary" @click="openStatusForm()">Добавить</button>
          <button type="button" class="btn btn-sm btn-excel" :disabled="excelLoading" @click="exportExcel">Экспорт в Excel</button>
        </div>
        <table class="table">
          <thead><tr><th>ID</th><th>Наименование</th><th>Описание</th><th></th></tr></thead>
          <tbody>
            <tr v-for="r in statuses" :key="r.id">
              <td>{{ r.id }}</td>
              <td>{{ r.name }}</td>
              <td>{{ r.description ?? '—' }}</td>
              <td>
                <button type="button" class="btn-link" @click="openStatusForm(r)">{{ canMutateActive ? 'Изменить' : 'Открыть' }}</button>
                <button v-if="canMutateActive" type="button" class="btn-link danger" @click="deleteStatus(r.id)">Удалить</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="statuses.length === 0" class="empty">Нет записей</p>
      </template>
      <!-- Hosting -->
      <template v-else-if="activeTab === 'hosting'">
        <div class="table-actions">
          <button v-if="canMutateActive" type="button" class="btn btn-sm btn-primary" @click="openHostingForm()">Добавить</button>
          <button type="button" class="btn btn-sm btn-excel" :disabled="excelLoading" @click="exportExcel">Экспорт в Excel</button>
        </div>
        <table class="table">
          <thead><tr><th>ID</th><th>Наименование</th><th></th></tr></thead>
          <tbody>
            <tr v-for="r in hostingTypes" :key="r.id">
              <td>{{ r.id }}</td>
              <td>{{ r.name }}</td>
              <td>
                <button type="button" class="btn-link" @click="openHostingForm(r)">{{ canMutateActive ? 'Изменить' : 'Открыть' }}</button>
                <button v-if="canMutateActive" type="button" class="btn-link danger" @click="deleteHosting(r.id)">Удалить</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="hostingTypes.length === 0" class="empty">Нет записей</p>
      </template>
      <!-- Owners -->
      <template v-else-if="activeTab === 'owners'">
        <div class="table-actions">
          <button v-if="canMutateActive" type="button" class="btn btn-sm btn-primary" @click="openOwnerForm()">Добавить</button>
          <button type="button" class="btn btn-sm btn-excel" :disabled="excelLoading" @click="exportExcel">Экспорт в Excel</button>
        </div>
        <table class="table">
          <thead><tr><th>ID</th><th>Наименование</th><th>Руководитель</th><th></th></tr></thead>
          <tbody>
            <tr v-for="r in owners" :key="r.id">
              <td>{{ r.id }}</td>
              <td>{{ r.name }}</td>
              <td>{{ r.leader ?? '—' }}</td>
              <td>
                <button type="button" class="btn-link" @click="openOwnerForm(r)">{{ canMutateActive ? 'Изменить' : 'Открыть' }}</button>
                <button v-if="canMutateActive" type="button" class="btn-link danger" @click="deleteOwner(r.id)">Удалить</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="owners.length === 0" class="empty">Нет записей</p>
      </template>
      <!-- Vendors (Partners) -->
      <template v-else-if="activeTab === 'vendors'">
        <div class="table-actions">
          <button v-if="canMutateActive" type="button" class="btn btn-sm btn-primary" @click="openVendorForm()">Добавить</button>
          <button type="button" class="btn btn-sm btn-excel" :disabled="excelLoading" @click="exportExcel">Экспорт в Excel</button>
        </div>
        <table class="table">
          <thead><tr><th>ID</th><th>Наименование</th><th></th></tr></thead>
          <tbody>
            <tr v-for="r in vendors" :key="r.id">
              <td>{{ r.id }}</td>
              <td>{{ r.name }}</td>
              <td>
                <button type="button" class="btn-link" @click="openVendorForm(r)">{{ canMutateActive ? 'Изменить' : 'Открыть' }}</button>
                <button v-if="canMutateActive" type="button" class="btn-link danger" @click="deleteVendor(r.id)">Удалить</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="vendors.length === 0" class="empty">Нет записей</p>
      </template>
      <!-- Сотрудники -->
      <template v-else-if="activeTab === 'employees'">
        <div class="table-actions">
          <button v-if="canMutateActive" type="button" class="btn btn-sm btn-primary" @click="openEmployeeForm()">Добавить</button>
          <button type="button" class="btn btn-sm btn-excel" :disabled="excelLoading" @click="exportExcel">Экспорт в Excel</button>
        </div>
        <table class="table">
          <thead><tr><th>ID</th><th>Табельный №</th><th>Полное имя</th><th>Email</th><th>Статус</th><th></th></tr></thead>
          <tbody>
            <tr v-for="r in employees" :key="r.id">
              <td>{{ r.id }}</td>
              <td>{{ r.employee_number || '—' }}</td>
              <td>{{ r.full_name }}</td>
              <td>{{ r.email || '—' }}</td>
              <td>{{ r.status === 'active' ? 'активен' : 'неактивен' }}</td>
              <td>
                <button type="button" class="btn-link" @click="openEmployeeForm(r)">{{ canMutateActive ? 'Изменить' : 'Открыть' }}</button>
                <button v-if="canMutateActive" type="button" class="btn-link danger" @click="deleteEmployee(r.id)">Удалить</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="employees.length === 0" class="empty">Нет записей</p>
      </template>
      <!-- ADR: статусы систем в решении -->
      <template v-else-if="activeTab === 'adrSystemStatuses'">
        <div class="table-actions">
          <button v-if="canMutateActive" type="button" class="btn btn-sm btn-primary" @click="openAdrSystemStatusForm()">Добавить</button>
          <button type="button" class="btn btn-sm btn-excel" :disabled="excelLoading" @click="exportExcel">Экспорт в Excel</button>
        </div>
        <table class="table">
          <thead><tr><th>ID</th><th>Код</th><th>Наименование</th><th>Описание</th><th></th></tr></thead>
          <tbody>
            <tr v-for="r in adrSystemStatuses" :key="r.id">
              <td>{{ r.id }}</td>
              <td><code>{{ r.code ?? '—' }}</code></td>
              <td>{{ r.name }}</td>
              <td>{{ r.description ?? '—' }}</td>
              <td>
                <button type="button" class="btn-link" @click="openAdrSystemStatusForm(r)">{{ canMutateActive ? 'Изменить' : 'Открыть' }}</button>
                <button v-if="canMutateActive" type="button" class="btn-link danger" @click="deleteAdrSystemStatus(r.id)">Удалить</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="adrSystemStatuses.length === 0" class="empty">Нет записей</p>
      </template>
      <!-- ADR: статусы интеграций в решении -->
      <template v-else-if="activeTab === 'adrRelationStatuses'">
        <div class="table-actions">
          <button v-if="canMutateActive" type="button" class="btn btn-sm btn-primary" @click="openAdrRelationStatusForm()">Добавить</button>
          <button type="button" class="btn btn-sm btn-excel" :disabled="excelLoading" @click="exportExcel">Экспорт в Excel</button>
        </div>
        <table class="table">
          <thead><tr><th>ID</th><th>Код</th><th>Наименование</th><th>Описание</th><th></th></tr></thead>
          <tbody>
            <tr v-for="r in adrRelationStatuses" :key="r.id">
              <td>{{ r.id }}</td>
              <td><code>{{ r.code ?? '—' }}</code></td>
              <td>{{ r.name }}</td>
              <td>{{ r.description ?? '—' }}</td>
              <td>
                <button type="button" class="btn-link" @click="openAdrRelationStatusForm(r)">{{ canMutateActive ? 'Изменить' : 'Открыть' }}</button>
                <button v-if="canMutateActive" type="button" class="btn-link danger" @click="deleteAdrRelationStatus(r.id)">Удалить</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="adrRelationStatuses.length === 0" class="empty">Нет записей</p>
      </template>
      <!-- ADR: статусы функций в решении -->
      <template v-else-if="activeTab === 'adrSystemFunctionStatuses'">
        <div class="table-actions">
          <button v-if="canMutateActive" type="button" class="btn btn-sm btn-primary" @click="openAdrSystemFunctionStatusForm()">Добавить</button>
        </div>
        <table class="table">
          <thead><tr><th>ID</th><th>Код</th><th>Наименование</th><th>Описание</th><th></th></tr></thead>
          <tbody>
            <tr v-for="r in adrSystemFunctionStatuses" :key="r.id">
              <td>{{ r.id }}</td>
              <td><code>{{ r.code ?? '—' }}</code></td>
              <td>{{ r.name }}</td>
              <td>{{ r.description ?? '—' }}</td>
              <td>
                <button type="button" class="btn-link" @click="openAdrSystemFunctionStatusForm(r)">{{ canMutateActive ? 'Изменить' : 'Открыть' }}</button>
                <button v-if="canMutateActive" type="button" class="btn-link danger" @click="deleteAdrSystemFunctionStatus(r.id)">Удалить</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="adrSystemFunctionStatuses.length === 0" class="empty">Нет записей</p>
      </template>
      <!-- Статусы функций (реестр) -->
      <template v-else-if="activeTab === 'systemFunctionStatuses'">
        <div class="table-actions">
          <button v-if="canMutateActive" type="button" class="btn btn-sm btn-primary" @click="openSystemFunctionStatusForm()">Добавить</button>
        </div>
        <table class="table">
          <thead><tr><th>ID</th><th>Код</th><th>Наименование</th><th>Описание</th><th></th></tr></thead>
          <tbody>
            <tr v-for="r in systemFunctionStatuses" :key="r.id">
              <td>{{ r.id }}</td>
              <td><code>{{ r.code ?? '—' }}</code></td>
              <td>{{ r.name }}</td>
              <td>{{ r.description ?? '—' }}</td>
              <td>
                <button type="button" class="btn-link" @click="openSystemFunctionStatusForm(r)">{{ canMutateActive ? 'Изменить' : 'Открыть' }}</button>
                <button v-if="canMutateActive" type="button" class="btn-link danger" @click="deleteSystemFunctionStatus(r.id)">Удалить</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="systemFunctionStatuses.length === 0" class="empty">Нет записей</p>
      </template>
      <!-- Тип события интеграций -->
      <template v-else-if="activeTab === 'integrationFlowEventTypes'">
        <div class="table-actions">
          <button v-if="canMutateActive" type="button" class="btn btn-sm btn-primary" @click="openIntegrationFlowEventTypeForm()">Добавить</button>
          <button type="button" class="btn btn-sm btn-excel" :disabled="excelLoading" @click="exportExcel">Экспорт в Excel</button>
        </div>
        <table class="table">
          <thead><tr><th>ID</th><th>Наименование</th><th>Описание</th><th></th></tr></thead>
          <tbody>
            <tr v-for="r in integrationFlowEventTypes" :key="r.id">
              <td>{{ r.id }}</td>
              <td>{{ r.name }}</td>
              <td>{{ r.description ?? '—' }}</td>
              <td>
                <button type="button" class="btn-link" @click="openIntegrationFlowEventTypeForm(r)">{{ canMutateActive ? 'Изменить' : 'Открыть' }}</button>
                <button v-if="canMutateActive" type="button" class="btn-link danger" @click="deleteIntegrationFlowEventType(r.id)">Удалить</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="integrationFlowEventTypes.length === 0" class="empty">Нет записей</p>
      </template>
      <!-- Статусы интеграционных потоков -->
      <template v-else-if="activeTab === 'integrationFlowStatuses'">
        <div class="table-actions">
          <button v-if="canMutateActive" type="button" class="btn btn-sm btn-primary" @click="openIntegrationFlowStatusForm()">Добавить</button>
          <button type="button" class="btn btn-sm btn-excel" :disabled="excelLoading" @click="exportExcel">Экспорт в Excel</button>
        </div>
        <table class="table">
          <thead><tr><th>ID</th><th>Код</th><th>Наименование</th><th>Описание</th><th></th></tr></thead>
          <tbody>
            <tr v-for="r in integrationFlowStatuses" :key="r.id">
              <td>{{ r.id }}</td>
              <td><code>{{ r.code ?? '—' }}</code></td>
              <td>{{ r.name }}</td>
              <td>{{ r.description ?? '—' }}</td>
              <td>
                <button type="button" class="btn-link" @click="openIntegrationFlowStatusForm(r)">{{ canMutateActive ? 'Изменить' : 'Открыть' }}</button>
                <button v-if="canMutateActive" type="button" class="btn-link danger" @click="deleteIntegrationFlowStatus(r.id)">Удалить</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="integrationFlowStatuses.length === 0" class="empty">Нет записей</p>
      </template>
      <!-- Категории орг. единиц (TOGAF) -->
      <template v-else-if="activeTab === 'orgUnitCategories'">
        <div class="table-actions">
          <button v-if="canMutateActive" type="button" class="btn btn-sm btn-primary" @click="openCategoryForm()">Добавить</button>
        </div>
        <table class="table">
          <thead><tr><th>ID</th><th>Код</th><th>Наименование</th><th>Описание</th><th></th></tr></thead>
          <tbody>
            <tr v-for="r in orgUnitCategories" :key="r.id">
              <td>{{ r.id }}</td>
              <td>{{ r.code ?? '—' }}</td>
              <td>{{ r.name }}</td>
              <td>{{ r.description ?? '—' }}</td>
              <td>
                <button type="button" class="btn-link" @click="openCategoryForm(r)">{{ canMutateActive ? 'Изменить' : 'Открыть' }}</button>
                <button v-if="canMutateActive" type="button" class="btn-link danger" @click="deleteCategory(r.id)">Удалить</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="orgUnitCategories.length === 0" class="empty">Нет записей</p>
      </template>
      <!-- Типы заинтересованных лиц (TOGAF) -->
      <template v-else-if="activeTab === 'actorTypes'">
        <div class="table-actions">
          <button v-if="canMutateActive" type="button" class="btn btn-sm btn-primary" @click="openActorTypeForm()">Добавить</button>
        </div>
        <table class="table">
          <thead><tr><th>ID</th><th>Код</th><th>Наименование</th><th>Описание</th><th></th></tr></thead>
          <tbody>
            <tr v-for="r in actorTypes" :key="r.id">
              <td>{{ r.id }}</td>
              <td>{{ r.code ?? '—' }}</td>
              <td>{{ r.name }}</td>
              <td>{{ r.description ?? '—' }}</td>
              <td>
                <button type="button" class="btn-link" @click="openActorTypeForm(r)">{{ canMutateActive ? 'Изменить' : 'Открыть' }}</button>
                <button v-if="canMutateActive" type="button" class="btn-link danger" @click="deleteActorType(r.id)">Удалить</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="actorTypes.length === 0" class="empty">Нет записей</p>
      </template>
      <!-- Статус утверждения (ar_adr_statuses) — только просмотр -->
      <template v-else-if="activeTab === 'adrStatuses'">
        <p class="ref-hint">Используется в архитектурных решениях и архитектурном долге. Редактирование — через БД при необходимости.</p>
        <table class="table">
          <thead><tr><th>ID</th><th>Наименование</th><th>Описание</th></tr></thead>
          <tbody>
            <tr v-for="r in adrStatuses" :key="r.id">
              <td>{{ r.id }}</td>
              <td>{{ r.name }}</td>
              <td>{{ r.description ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="adrStatuses.length === 0" class="empty">Нет записей</p>
      </template>
      <!-- Типы архитектурного долга -->
      <template v-else-if="activeTab === 'gapTypes'">
        <div class="table-actions">
          <button v-if="canMutateActive" type="button" class="btn btn-sm btn-primary" @click="openGapTypeForm()">Добавить</button>
        </div>
        <table class="table">
          <thead><tr><th>ID</th><th>Наименование</th><th>Описание</th><th></th></tr></thead>
          <tbody>
            <tr v-for="r in gapTypes" :key="r.id">
              <td>{{ r.id }}</td>
              <td>{{ r.name }}</td>
              <td>{{ r.description ?? '—' }}</td>
              <td>
                <button type="button" class="btn-link" @click="openGapTypeForm(r)">{{ canMutateActive ? 'Изменить' : 'Открыть' }}</button>
                <button v-if="canMutateActive" type="button" class="btn-link danger" @click="deleteGapType(r.id)">Удалить</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="gapTypes.length === 0" class="empty">Нет записей</p>
      </template>
      <!-- Степени влияния -->
      <template v-else-if="activeTab === 'impactLevelTypes'">
        <div class="table-actions">
          <button v-if="canMutateActive" type="button" class="btn btn-sm btn-primary" @click="openImpactLevelTypeForm()">Добавить</button>
        </div>
        <table class="table">
          <thead><tr><th>ID</th><th>Наименование</th><th>Описание</th><th></th></tr></thead>
          <tbody>
            <tr v-for="r in impactLevelTypes" :key="r.id">
              <td>{{ r.id }}</td>
              <td>{{ r.name }}</td>
              <td>{{ r.description ?? '—' }}</td>
              <td>
                <button type="button" class="btn-link" @click="openImpactLevelTypeForm(r)">{{ canMutateActive ? 'Изменить' : 'Открыть' }}</button>
                <button v-if="canMutateActive" type="button" class="btn-link danger" @click="deleteImpactLevelType(r.id)">Удалить</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="impactLevelTypes.length === 0" class="empty">Нет записей</p>
      </template>
      <!-- Состояния арх.долга -->
      <template v-else-if="activeTab === 'gapStates'">
        <div class="table-actions">
          <button v-if="canMutateActive" type="button" class="btn btn-sm btn-primary" @click="openGapStateForm()">Добавить</button>
        </div>
        <table class="table">
          <thead><tr><th>ID</th><th>Наименование</th><th>Описание</th><th></th></tr></thead>
          <tbody>
            <tr v-for="r in gapStates" :key="r.id">
              <td>{{ r.id }}</td>
              <td>{{ r.name }}</td>
              <td>{{ r.description ?? '—' }}</td>
              <td>
                <button type="button" class="btn-link" @click="openGapStateForm(r)">{{ canMutateActive ? 'Изменить' : 'Открыть' }}</button>
                <button v-if="canMutateActive" type="button" class="btn-link danger" @click="deleteGapState(r.id)">Удалить</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="gapStates.length === 0" class="empty">Нет записей</p>
      </template>
      <!-- Статусы бизнес-сервисов (TOGAF) -->
      <template v-else-if="activeTab === 'webResourceStatuses'">
        <div class="table-actions">
          <button v-if="canMutateActive" type="button" class="btn btn-sm btn-primary" @click="openWebResourceStatusForm()">Добавить</button>
        </div>
        <table class="table">
          <thead><tr><th>ID</th><th>Код</th><th>Наименование</th><th>Описание</th><th></th></tr></thead>
          <tbody>
            <tr v-for="r in webResourceStatuses" :key="r.id">
              <td>{{ r.id }}</td>
              <td>{{ r.code }}</td>
              <td>{{ r.name }}</td>
              <td>{{ r.description ?? '—' }}</td>
              <td>
                <button type="button" class="btn-link" @click="openWebResourceStatusForm(r)">{{ canMutateActive ? 'Изменить' : 'Открыть' }}</button>
                <button v-if="canMutateActive" type="button" class="btn-link danger" @click="deleteWebResourceStatus(r.id)">Удалить</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="webResourceStatuses.length === 0" class="empty">Нет записей</p>
      </template>
      <template v-else-if="activeTab === 'webResourceCategories'">
        <div class="table-actions">
          <button v-if="canMutateActive" type="button" class="btn btn-sm btn-primary" @click="openWebResourceCategoryForm()">Добавить</button>
        </div>
        <table class="table">
          <thead><tr><th>ID</th><th>Код</th><th>Наименование</th><th>Описание</th><th></th></tr></thead>
          <tbody>
            <tr v-for="r in webResourceCategories" :key="r.id">
              <td>{{ r.id }}</td>
              <td>{{ r.code }}</td>
              <td>{{ r.name }}</td>
              <td>{{ r.description ?? '—' }}</td>
              <td>
                <button type="button" class="btn-link" @click="openWebResourceCategoryForm(r)">{{ canMutateActive ? 'Изменить' : 'Открыть' }}</button>
                <button v-if="canMutateActive" type="button" class="btn-link danger" @click="deleteWebResourceCategory(r.id)">Удалить</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="webResourceCategories.length === 0" class="empty">Нет записей</p>
      </template>
      <template v-else-if="activeTab === 'webResourceStageTypes'">
        <div class="table-actions">
          <button v-if="canMutateActive" type="button" class="btn btn-sm btn-primary" @click="openWebResourceStageTypeForm()">Добавить</button>
        </div>
        <table class="table">
          <thead><tr><th>ID</th><th>Код</th><th>Наименование</th><th>Описание</th><th></th></tr></thead>
          <tbody>
            <tr v-for="r in webResourceStageTypes" :key="r.id">
              <td>{{ r.id }}</td>
              <td>{{ r.code }}</td>
              <td>{{ r.name }}</td>
              <td>{{ r.description ?? '—' }}</td>
              <td>
                <button type="button" class="btn-link" @click="openWebResourceStageTypeForm(r)">{{ canMutateActive ? 'Изменить' : 'Открыть' }}</button>
                <button v-if="canMutateActive" type="button" class="btn-link danger" @click="deleteWebResourceStageType(r.id)">Удалить</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="webResourceStageTypes.length === 0" class="empty">Нет записей</p>
      </template>
      <template v-else-if="activeTab === 'domainStatuses'">
        <div class="table-actions">
          <button v-if="canMutateActive" type="button" class="btn btn-sm btn-primary" @click="openDomainStatusForm()">Добавить</button>
        </div>
        <table class="table">
          <thead><tr><th>ID</th><th>Код</th><th>Наименование</th><th>Описание</th><th></th></tr></thead>
          <tbody>
            <tr v-for="r in domainStatuses" :key="r.id">
              <td>{{ r.id }}</td>
              <td>{{ r.code }}</td>
              <td>{{ r.name }}</td>
              <td>{{ r.description ?? '—' }}</td>
              <td>
                <button type="button" class="btn-link" @click="openDomainStatusForm(r)">{{ canMutateActive ? 'Изменить' : 'Открыть' }}</button>
                <button v-if="canMutateActive" type="button" class="btn-link danger" @click="deleteDomainStatus(r.id)">Удалить</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="domainStatuses.length === 0" class="empty">Нет записей</p>
      </template>
      <template v-else-if="activeTab === 'businessServiceStatuses'">
        <div class="table-actions">
          <button v-if="canMutateActive" type="button" class="btn btn-sm btn-primary" @click="openBusinessServiceStatusForm()">Добавить</button>
        </div>
        <table class="table">
          <thead><tr><th>ID</th><th>Наименование</th><th>Описание</th><th></th></tr></thead>
          <tbody>
            <tr v-for="r in businessServiceStatuses" :key="r.id">
              <td>{{ r.id }}</td>
              <td>{{ r.name }}</td>
              <td>{{ r.description ?? '—' }}</td>
              <td>
                <button type="button" class="btn-link" @click="openBusinessServiceStatusForm(r)">{{ canMutateActive ? 'Изменить' : 'Открыть' }}</button>
                <button v-if="canMutateActive" type="button" class="btn-link danger" @click="deleteBusinessServiceStatus(r.id)">Удалить</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="businessServiceStatuses.length === 0" class="empty">Нет записей</p>
      </template>
      <!-- Типы сущностей метамодели (ar_metamodel_entity_types) -->
      <template v-else-if="activeTab === 'metamodelEntityTypes'">
        <div class="table-actions">
          <button v-if="canMutateActive" type="button" class="btn btn-sm btn-primary" @click="openEntityTypeForm()">Добавить</button>
        </div>
        <table class="table">
          <thead><tr><th>ID</th><th>Код</th><th>Наименование</th><th>Таблица</th><th>DISP-параметр</th><th>Описание</th><th>Импорт</th><th></th></tr></thead>
          <tbody>
            <tr v-for="r in metamodelEntityTypes" :key="r.id">
              <td>{{ r.id }}</td>
              <td>{{ r.code }}</td>
              <td>{{ r.name }}</td>
              <td>{{ r.table_name ?? '—' }}</td>
              <td>{{ r.disp_param_name ?? '—' }}</td>
              <td>{{ r.description ?? '—' }}</td>
              <td>{{ r.import_allowed ? 'да' : 'нет' }}</td>
              <td>
                <button type="button" class="btn-link" @click="openEntityTypeForm(r)">{{ canMutateActive ? 'Изменить' : 'Открыть' }}</button>
                <button v-if="canMutateActive" type="button" class="btn-link danger" @click="deleteEntityType(r.id)">Удалить</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="metamodelEntityTypes.length === 0" class="empty">Нет записей</p>
      </template>
      <!-- Типы связей метамодели (ar_metamodel_relation_types) -->
      <template v-else-if="activeTab === 'metamodelRelationTypes'">
        <div class="table-actions">
          <button v-if="canMutateActive" type="button" class="btn btn-sm btn-primary" @click="openRelationTypeForm()">Добавить</button>
        </div>
        <table class="table">
          <thead><tr><th>ID</th><th>Код</th><th>Наименование</th><th>Описание</th><th>От типа</th><th>К типу</th><th>Авто</th><th></th></tr></thead>
          <tbody>
            <tr v-for="r in metamodelRelationTypes" :key="r.id">
              <td>{{ r.id }}</td>
              <td>{{ r.code }}</td>
              <td>{{ r.name }}</td>
              <td>{{ r.description ?? '—' }}</td>
              <td>{{ r.from_entity_type_name || r.from_entity_type_code || '—' }}</td>
              <td>{{ r.to_entity_type_name || r.to_entity_type_code || '—' }}</td>
              <td>{{ r.managed ? 'да' : 'нет' }}</td>
              <td>
                <button type="button" class="btn-link" @click="openRelationTypeForm(r)">{{ canMutateActive ? 'Изменить' : 'Открыть' }}</button>
                <button v-if="canMutateActive" type="button" class="btn-link danger" @click="deleteRelationType(r.id)">Удалить</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="metamodelRelationTypes.length === 0" class="empty">Нет записей</p>
      </template>
      <!-- Типы объектов инфраструктуры -->
      <template v-else-if="activeTab === 'infrastructureObjectTypes'">
        <div class="table-actions">
          <button v-if="canMutateActive" type="button" class="btn btn-sm btn-primary" @click="openInfrastructureObjectTypeForm()">Добавить</button>
        </div>
        <table class="table">
          <thead><tr><th>ID</th><th>Код</th><th>Наименование</th><th>Описание</th><th></th></tr></thead>
          <tbody>
            <tr v-for="r in infrastructureObjectTypes" :key="r.id">
              <td>{{ r.id }}</td>
              <td><code>{{ r.code }}</code></td>
              <td>{{ r.name }}</td>
              <td>{{ r.description ?? '—' }}</td>
              <td>
                <button type="button" class="btn-link" @click="openInfrastructureObjectTypeForm(r)">{{ canMutateActive ? 'Изменить' : 'Открыть' }}</button>
                <button v-if="canMutateActive" type="button" class="btn-link danger" @click="deleteInfrastructureObjectType(r.id)">Удалить</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="infrastructureObjectTypes.length === 0" class="empty">Нет записей</p>
      </template>
    </div>

    <!-- Modals: simple prompt for add/edit -->
    <div v-if="statusForm" class="modal-overlay">
      <div class="modal">
        <h3>{{ statusForm.id ? 'Изменить статус' : 'Новый статус' }}</h3>
        <fieldset class="form-fieldset" :disabled="!canMutateActive">
        <div class="form-row"><label>Наименование</label><input v-model="statusForm.name" /></div>
        <div class="form-row"><label>Описание</label><input v-model="statusForm.description" /></div>
        </fieldset>
        <div class="modal-actions">
          <button v-if="canMutateActive" type="button" class="btn btn-primary" @click="saveStatus">Сохранить</button>
          <button type="button" class="btn btn-secondary" @click="statusForm = null">{{ canMutateActive ? 'Отмена' : 'Закрыть' }}</button>
        </div>
      </div>
    </div>
    <div v-if="hostingForm" class="modal-overlay">
      <div class="modal">
        <h3>{{ hostingForm.id ? 'Изменить тип хостинга' : 'Новый тип хостинга' }}</h3>
        <fieldset class="form-fieldset" :disabled="!canMutateActive">
        <div class="form-row"><label>Наименование</label><input v-model="hostingForm.name" /></div>
        </fieldset>
        <div class="modal-actions">
          <button v-if="canMutateActive" type="button" class="btn btn-primary" @click="saveHosting">Сохранить</button>
          <button type="button" class="btn btn-secondary" @click="hostingForm = null">{{ canMutateActive ? 'Отмена' : 'Закрыть' }}</button>
        </div>
      </div>
    </div>
    <div v-if="ownerForm" class="modal-overlay">
      <div class="modal">
        <h3>{{ ownerForm.id ? 'Изменить владельца' : 'Новый владелец' }}</h3>
        <fieldset class="form-fieldset" :disabled="!canMutateActive">
        <div class="form-row"><label>Наименование</label><input v-model="ownerForm.name" /></div>
        <div class="form-row"><label>Руководитель</label><input v-model="ownerForm.leader" /></div>
        </fieldset>
        <div class="modal-actions">
          <button v-if="canMutateActive" type="button" class="btn btn-primary" @click="saveOwner">Сохранить</button>
          <button type="button" class="btn btn-secondary" @click="ownerForm = null">{{ canMutateActive ? 'Отмена' : 'Закрыть' }}</button>
        </div>
      </div>
    </div>
    <div v-if="vendorForm" class="modal-overlay">
      <div class="modal">
        <h3>{{ vendorForm.id ? 'Изменить партнёра' : 'Новый партнёр' }}</h3>
        <fieldset class="form-fieldset" :disabled="!canMutateActive">
        <div class="form-row"><label>Наименование</label><input v-model="vendorForm.name" /></div>
        </fieldset>
        <div class="modal-actions">
          <button v-if="canMutateActive" type="button" class="btn btn-primary" @click="saveVendor">Сохранить</button>
          <button type="button" class="btn btn-secondary" @click="vendorForm = null">{{ canMutateActive ? 'Отмена' : 'Закрыть' }}</button>
        </div>
      </div>
    </div>
    <div v-if="employeeForm" class="modal-overlay">
      <div class="modal">
        <h3>{{ employeeForm.id ? 'Изменить сотрудника' : 'Новый сотрудник' }}</h3>
        <fieldset class="form-fieldset" :disabled="!canMutateActive">
        <div class="form-row"><label>Табельный номер</label><input v-model="employeeForm.employee_number" placeholder="12345" /></div>
        <div class="form-row"><label>Полное имя <span class="req">*</span></label><input v-model="employeeForm.full_name" placeholder="Иванов Иван Иванович" /></div>
        <div class="form-row"><label>Email</label><input v-model="employeeForm.email" type="email" placeholder="name@example.com" /></div>
        <div class="form-row"><label>Активен</label><select v-model="employeeForm.active"><option :value="true">Да</option><option :value="false">Нет</option></select></div>
        </fieldset>
        <div class="modal-actions">
          <button v-if="canMutateActive" type="button" class="btn btn-primary" @click="saveEmployee">Сохранить</button>
          <button type="button" class="btn btn-secondary" @click="employeeForm = null">{{ canMutateActive ? 'Отмена' : 'Закрыть' }}</button>
        </div>
      </div>
    </div>
    <div v-if="adrSystemStatusForm" class="modal-overlay">
      <div class="modal">
        <h3>{{ adrSystemStatusForm.id ? 'Изменить статус системы в решении' : 'Новый статус (системы в решении)' }}</h3>
        <fieldset class="form-fieldset" :disabled="!canMutateActive">
        <div class="form-row"><label>Код</label><input v-model="adrSystemStatusForm.code" placeholder="ADR_INCR_SYS_…" /></div>
        <div class="form-row"><label>Наименование</label><input v-model="adrSystemStatusForm.name" /></div>
        <div class="form-row"><label>Описание</label><input v-model="adrSystemStatusForm.description" /></div>
        </fieldset>
        <div class="modal-actions">
          <button v-if="canMutateActive" type="button" class="btn btn-primary" @click="saveAdrSystemStatus">Сохранить</button>
          <button type="button" class="btn btn-secondary" @click="adrSystemStatusForm = null">{{ canMutateActive ? 'Отмена' : 'Закрыть' }}</button>
        </div>
      </div>
    </div>
    <div v-if="adrRelationStatusForm" class="modal-overlay">
      <div class="modal">
        <h3>{{ adrRelationStatusForm.id ? 'Изменить статус интеграции в решении' : 'Новый статус (интеграции в решении)' }}</h3>
        <fieldset class="form-fieldset" :disabled="!canMutateActive">
        <div class="form-row"><label>Код <span class="req">*</span></label><input v-model="adrRelationStatusForm.code" type="text" placeholder="ADR_INCR_REL_…" /></div>
        <div class="form-row"><label>Наименование</label><input v-model="adrRelationStatusForm.name" /></div>
        <div class="form-row"><label>Описание</label><input v-model="adrRelationStatusForm.description" /></div>
        </fieldset>
        <div class="modal-actions">
          <button v-if="canMutateActive" type="button" class="btn btn-primary" @click="saveAdrRelationStatus">Сохранить</button>
          <button type="button" class="btn btn-secondary" @click="adrRelationStatusForm = null">{{ canMutateActive ? 'Отмена' : 'Закрыть' }}</button>
        </div>
      </div>
    </div>
    <div v-if="adrSystemFunctionStatusForm" class="modal-overlay">
      <div class="modal">
        <h3>{{ adrSystemFunctionStatusForm.id ? 'Изменить статус функции в решении' : 'Новый статус (функции в решении)' }}</h3>
        <fieldset class="form-fieldset" :disabled="!canMutateActive">
        <div class="form-row"><label>Код <span class="req">*</span></label><input v-model="adrSystemFunctionStatusForm.code" type="text" placeholder="ADR_INCR_SYSFUNC_…" /></div>
        <div class="form-row"><label>Наименование</label><input v-model="adrSystemFunctionStatusForm.name" /></div>
        <div class="form-row"><label>Описание</label><input v-model="adrSystemFunctionStatusForm.description" /></div>
        </fieldset>
        <div class="modal-actions">
          <button v-if="canMutateActive" type="button" class="btn btn-primary" @click="saveAdrSystemFunctionStatus">Сохранить</button>
          <button type="button" class="btn btn-secondary" @click="adrSystemFunctionStatusForm = null">{{ canMutateActive ? 'Отмена' : 'Закрыть' }}</button>
        </div>
      </div>
    </div>
    <div v-if="systemFunctionStatusForm" class="modal-overlay">
      <div class="modal">
        <h3>{{ systemFunctionStatusForm.id ? 'Изменить статус функции' : 'Новый статус функции (реестр)' }}</h3>
        <fieldset class="form-fieldset" :disabled="!canMutateActive">
        <div class="form-row"><label>Код <span class="req">*</span></label><input v-model="systemFunctionStatusForm.code" type="text" placeholder="SYSFUNC_STATUS_…" /></div>
        <div class="form-row"><label>Наименование</label><input v-model="systemFunctionStatusForm.name" /></div>
        <div class="form-row"><label>Описание</label><input v-model="systemFunctionStatusForm.description" /></div>
        </fieldset>
        <div class="modal-actions">
          <button v-if="canMutateActive" type="button" class="btn btn-primary" @click="saveSystemFunctionStatus">Сохранить</button>
          <button type="button" class="btn btn-secondary" @click="systemFunctionStatusForm = null">{{ canMutateActive ? 'Отмена' : 'Закрыть' }}</button>
        </div>
      </div>
    </div>
    <div v-if="integrationFlowEventTypeForm" class="modal-overlay">
      <div class="modal">
        <h3>{{ integrationFlowEventTypeForm.id ? 'Изменить тип события' : 'Новый тип инициирующего события' }}</h3>
        <fieldset class="form-fieldset" :disabled="!canMutateActive">
        <div class="form-row"><label>Наименование</label><input v-model="integrationFlowEventTypeForm.name" /></div>
        <div class="form-row"><label>Описание</label><input v-model="integrationFlowEventTypeForm.description" /></div>
        </fieldset>
        <div class="modal-actions">
          <button v-if="canMutateActive" type="button" class="btn btn-primary" @click="saveIntegrationFlowEventType">Сохранить</button>
          <button type="button" class="btn btn-secondary" @click="integrationFlowEventTypeForm = null">{{ canMutateActive ? 'Отмена' : 'Закрыть' }}</button>
        </div>
      </div>
    </div>
    <div v-if="integrationFlowStatusForm" class="modal-overlay">
      <div class="modal">
        <h3>{{ integrationFlowStatusForm.id ? 'Изменить статус потока' : 'Новый статус интеграционного потока' }}</h3>
        <fieldset class="form-fieldset" :disabled="!canMutateActive">
        <div class="form-row"><label>Код <span class="req">*</span></label><input v-model="integrationFlowStatusForm.code" type="text" placeholder="FLOW_STATUS_…" /></div>
        <div class="form-row"><label>Наименование</label><input v-model="integrationFlowStatusForm.name" /></div>
        <div class="form-row"><label>Описание</label><input v-model="integrationFlowStatusForm.description" /></div>
        </fieldset>
        <div class="modal-actions">
          <button v-if="canMutateActive" type="button" class="btn btn-primary" @click="saveIntegrationFlowStatus">Сохранить</button>
          <button type="button" class="btn btn-secondary" @click="integrationFlowStatusForm = null">{{ canMutateActive ? 'Отмена' : 'Закрыть' }}</button>
        </div>
      </div>
    </div>
    <div v-if="categoryForm" class="modal-overlay">
      <div class="modal">
        <h3>{{ categoryForm.id ? 'Изменить категорию' : 'Новая категория орг. единицы' }}</h3>
        <fieldset class="form-fieldset" :disabled="!canMutateActive">
        <div class="form-row"><label>Код</label><input v-model="categoryForm.code" placeholder="необязательно" /></div>
        <div class="form-row"><label>Наименование</label><input v-model="categoryForm.name" /></div>
        <div class="form-row"><label>Описание</label><input v-model="categoryForm.description" /></div>
        </fieldset>
        <div class="modal-actions">
          <button v-if="canMutateActive" type="button" class="btn btn-primary" @click="saveCategory">Сохранить</button>
          <button type="button" class="btn btn-secondary" @click="categoryForm = null">{{ canMutateActive ? 'Отмена' : 'Закрыть' }}</button>
        </div>
      </div>
    </div>
    <div v-if="actorTypeForm" class="modal-overlay">
      <div class="modal">
        <h3>{{ actorTypeForm.id ? 'Изменить тип заинтересованного лица' : 'Новый тип заинтересованного лица' }}</h3>
        <fieldset class="form-fieldset" :disabled="!canMutateActive">
        <div class="form-row"><label>Код</label><input v-model="actorTypeForm.code" placeholder="необязательно" /></div>
        <div class="form-row"><label>Наименование</label><input v-model="actorTypeForm.name" /></div>
        <div class="form-row"><label>Описание</label><input v-model="actorTypeForm.description" /></div>
        </fieldset>
        <div class="modal-actions">
          <button v-if="canMutateActive" type="button" class="btn btn-primary" @click="saveActorType">Сохранить</button>
          <button type="button" class="btn btn-secondary" @click="actorTypeForm = null">{{ canMutateActive ? 'Отмена' : 'Закрыть' }}</button>
        </div>
      </div>
    </div>
    <div v-if="webResourceStatusForm" class="modal-overlay">
      <div class="modal">
        <h3>{{ webResourceStatusForm.id ? 'Изменить статус веб-ресурса' : 'Новый статус веб-ресурса' }}</h3>
        <fieldset class="form-fieldset" :disabled="!canMutateActive">
        <div class="form-row"><label>Код</label><input v-model="webResourceStatusForm.code" required /></div>
        <div class="form-row"><label>Наименование</label><input v-model="webResourceStatusForm.name" /></div>
        <div class="form-row"><label>Описание</label><input v-model="webResourceStatusForm.description" /></div>
        </fieldset>
        <div class="modal-actions">
          <button v-if="canMutateActive" type="button" class="btn btn-primary" @click="saveWebResourceStatus">Сохранить</button>
          <button type="button" class="btn btn-secondary" @click="webResourceStatusForm = null">{{ canMutateActive ? 'Отмена' : 'Закрыть' }}</button>
        </div>
      </div>
    </div>
    <div v-if="webResourceCategoryForm" class="modal-overlay">
      <div class="modal">
        <h3>{{ webResourceCategoryForm.id ? 'Изменить категорию' : 'Новая категория веб-ресурса' }}</h3>
        <fieldset class="form-fieldset" :disabled="!canMutateActive">
        <div class="form-row"><label>Код</label><input v-model="webResourceCategoryForm.code" required /></div>
        <div class="form-row"><label>Наименование</label><input v-model="webResourceCategoryForm.name" /></div>
        <div class="form-row"><label>Описание</label><input v-model="webResourceCategoryForm.description" /></div>
        </fieldset>
        <div class="modal-actions">
          <button v-if="canMutateActive" type="button" class="btn btn-primary" @click="saveWebResourceCategory">Сохранить</button>
          <button type="button" class="btn btn-secondary" @click="webResourceCategoryForm = null">{{ canMutateActive ? 'Отмена' : 'Закрыть' }}</button>
        </div>
      </div>
    </div>
    <div v-if="webResourceStageTypeForm" class="modal-overlay">
      <div class="modal">
        <h3>{{ webResourceStageTypeForm.id ? 'Изменить тип стенда' : 'Новый тип стенда' }}</h3>
        <fieldset class="form-fieldset" :disabled="!canMutateActive">
        <div class="form-row"><label>Код</label><input v-model="webResourceStageTypeForm.code" required /></div>
        <div class="form-row"><label>Наименование</label><input v-model="webResourceStageTypeForm.name" /></div>
        <div class="form-row"><label>Описание</label><input v-model="webResourceStageTypeForm.description" /></div>
        </fieldset>
        <div class="modal-actions">
          <button v-if="canMutateActive" type="button" class="btn btn-primary" @click="saveWebResourceStageType">Сохранить</button>
          <button type="button" class="btn btn-secondary" @click="webResourceStageTypeForm = null">{{ canMutateActive ? 'Отмена' : 'Закрыть' }}</button>
        </div>
      </div>
    </div>
    <div v-if="domainStatusForm" class="modal-overlay">
      <div class="modal">
        <h3>{{ domainStatusForm.id ? 'Изменить статус домена' : 'Новый статус домена' }}</h3>
        <fieldset class="form-fieldset" :disabled="!canMutateActive">
        <div class="form-row"><label>Код</label><input v-model="domainStatusForm.code" required /></div>
        <div class="form-row"><label>Наименование</label><input v-model="domainStatusForm.name" /></div>
        <div class="form-row"><label>Описание</label><input v-model="domainStatusForm.description" /></div>
        </fieldset>
        <div class="modal-actions">
          <button v-if="canMutateActive" type="button" class="btn btn-primary" @click="saveDomainStatus">Сохранить</button>
          <button type="button" class="btn btn-secondary" @click="domainStatusForm = null">{{ canMutateActive ? 'Отмена' : 'Закрыть' }}</button>
        </div>
      </div>
    </div>
    <div v-if="businessServiceStatusForm" class="modal-overlay">
      <div class="modal">
        <h3>{{ businessServiceStatusForm.id ? 'Изменить статус' : 'Новый статус бизнес-сервиса' }}</h3>
        <fieldset class="form-fieldset" :disabled="!canMutateActive">
        <div class="form-row"><label>Наименование</label><input v-model="businessServiceStatusForm.name" /></div>
        <div class="form-row"><label>Описание</label><input v-model="businessServiceStatusForm.description" /></div>
        </fieldset>
        <div class="modal-actions">
          <button v-if="canMutateActive" type="button" class="btn btn-primary" @click="saveBusinessServiceStatus">Сохранить</button>
          <button type="button" class="btn btn-secondary" @click="businessServiceStatusForm = null">{{ canMutateActive ? 'Отмена' : 'Закрыть' }}</button>
        </div>
      </div>
    </div>
    <div v-if="gapTypeForm" class="modal-overlay">
      <div class="modal">
        <h3>{{ gapTypeForm.id ? 'Изменить тип арх.долга' : 'Новый тип архитектурного долга' }}</h3>
        <fieldset class="form-fieldset" :disabled="!canMutateActive">
        <div class="form-row"><label>Наименование</label><input v-model="gapTypeForm.name" /></div>
        <div class="form-row"><label>Описание</label><input v-model="gapTypeForm.description" /></div>
        </fieldset>
        <div class="modal-actions">
          <button v-if="canMutateActive" type="button" class="btn btn-primary" @click="saveGapType">Сохранить</button>
          <button type="button" class="btn btn-secondary" @click="gapTypeForm = null">{{ canMutateActive ? 'Отмена' : 'Закрыть' }}</button>
        </div>
      </div>
    </div>
    <div v-if="impactLevelTypeForm" class="modal-overlay">
      <div class="modal">
        <h3>{{ impactLevelTypeForm.id ? 'Изменить степень влияния' : 'Новая степень влияния' }}</h3>
        <fieldset class="form-fieldset" :disabled="!canMutateActive">
        <div class="form-row"><label>Наименование</label><input v-model="impactLevelTypeForm.name" /></div>
        <div class="form-row"><label>Описание</label><input v-model="impactLevelTypeForm.description" /></div>
        </fieldset>
        <div class="modal-actions">
          <button v-if="canMutateActive" type="button" class="btn btn-primary" @click="saveImpactLevelType">Сохранить</button>
          <button type="button" class="btn btn-secondary" @click="impactLevelTypeForm = null">{{ canMutateActive ? 'Отмена' : 'Закрыть' }}</button>
        </div>
      </div>
    </div>
    <div v-if="gapStateForm" class="modal-overlay">
      <div class="modal">
        <h3>{{ gapStateForm.id ? 'Изменить состояние арх.долга' : 'Новое состояние арх.долга' }}</h3>
        <fieldset class="form-fieldset" :disabled="!canMutateActive">
        <div class="form-row"><label>Наименование</label><input v-model="gapStateForm.name" /></div>
        <div class="form-row"><label>Описание</label><input v-model="gapStateForm.description" /></div>
        </fieldset>
        <div class="modal-actions">
          <button v-if="canMutateActive" type="button" class="btn btn-primary" @click="saveGapState">Сохранить</button>
          <button type="button" class="btn btn-secondary" @click="gapStateForm = null">{{ canMutateActive ? 'Отмена' : 'Закрыть' }}</button>
        </div>
      </div>
    </div>
    <div v-if="entityTypeForm" class="modal-overlay">
      <div class="modal">
        <h3>{{ entityTypeForm.id ? 'Изменить тип сущности' : 'Новый тип сущности метамодели' }}</h3>
        <fieldset class="form-fieldset" :disabled="!canMutateActive">
        <div class="form-row"><label>Код <span class="req">*</span></label><input v-model="entityTypeForm.code" placeholder="напр. system" /></div>
        <div class="form-row"><label>Наименование <span class="req">*</span></label><input v-model="entityTypeForm.name" /></div>
        <div class="form-row"><label>Таблица в БД</label><input v-model="entityTypeForm.table_name" placeholder="напр. ar_systems" /></div>
        <div class="form-row">
          <label>DISP-параметр</label>
          <input
            v-model="entityTypeForm.disp_param_name"
            placeholder="напр. DISP_SYSTEM_TEMPLATE"
            title="Код параметра из «Настройки → Параметры». Его плейсхолдеры задают поля поиска в реестре связей. Пусто — поиск по name/code."
          />
        </div>
        <div class="form-row"><label>Описание</label><input v-model="entityTypeForm.description" /></div>
        <div class="form-row"><label><input type="checkbox" v-model="entityTypeForm.import_allowed" /> Допустимо для импорта</label></div>
        </fieldset>
        <div class="modal-actions">
          <button v-if="canMutateActive" type="button" class="btn btn-primary" @click="saveEntityType">Сохранить</button>
          <button type="button" class="btn btn-secondary" @click="entityTypeForm = null">{{ canMutateActive ? 'Отмена' : 'Закрыть' }}</button>
        </div>
      </div>
    </div>
    <div v-if="infrastructureObjectTypeForm" class="modal-overlay">
      <div class="modal">
        <h3>{{ infrastructureObjectTypeForm.id ? 'Изменить тип объекта инфраструктуры' : 'Новый тип объекта инфраструктуры' }}</h3>
        <fieldset class="form-fieldset" :disabled="!canMutateActive">
        <div class="form-row"><label>Код <span class="req">*</span></label><input v-model="infrastructureObjectTypeForm.code" placeholder="напр. virtual_server" :disabled="!!infrastructureObjectTypeForm.id && isReservedInfrastructureTypeCode(infrastructureObjectTypeForm.code)" /></div>
        <div class="form-row"><label>Наименование <span class="req">*</span></label><input v-model="infrastructureObjectTypeForm.name" /></div>
        <div class="form-row"><label>Описание</label><input v-model="infrastructureObjectTypeForm.description" /></div>
        </fieldset>
        <div class="modal-actions">
          <button v-if="canMutateActive" type="button" class="btn btn-primary" @click="saveInfrastructureObjectType">Сохранить</button>
          <button type="button" class="btn btn-secondary" @click="infrastructureObjectTypeForm = null">{{ canMutateActive ? 'Отмена' : 'Закрыть' }}</button>
        </div>
      </div>
    </div>
    <div v-if="relationTypeForm" class="modal-overlay">
      <div class="modal">
        <h3>{{ relationTypeForm.id ? 'Изменить тип связи' : 'Новый тип связи метамодели' }}</h3>
        <fieldset class="form-fieldset" :disabled="!canMutateActive">
        <div class="form-row"><label>Код <span class="req">*</span></label><input v-model="relationTypeForm.code" placeholder="напр. realizes" /></div>
        <div class="form-row"><label>Наименование <span class="req">*</span></label><input v-model="relationTypeForm.name" /></div>
        <div class="form-row"><label>Описание</label><input v-model="relationTypeForm.description" /></div>
        <div class="form-row"><label>От типа сущности <span class="req">*</span></label>
          <select v-model="relationTypeForm.from_entity_type_id" required>
            <option :value="null">— Выберите тип —</option>
            <option v-for="et in metamodelEntityTypes" :key="et.id" :value="et.id">{{ et.display_name || (et.name + ' (' + et.code + ')') }}</option>
          </select>
        </div>
        <div class="form-row"><label>К типу сущности <span class="req">*</span></label>
          <select v-model="relationTypeForm.to_entity_type_id" required>
            <option :value="null">— Выберите тип —</option>
            <option v-for="et in metamodelEntityTypes" :key="et.id" :value="et.id">{{ et.display_name || (et.name + ' (' + et.code + ')') }}</option>
          </select>
        </div>
        <div class="form-row">
          <label title="Проекция из реляционной модели (триггер БД) или связь, создаваемая карточкой источника (например, стек технологий ИС). Ручное создание, правка и удаление запрещены.">
            <input type="checkbox" v-model="relationTypeForm.managed" /> Управляется автоматически
          </label>
        </div>
        </fieldset>
        <div class="modal-actions">
          <button v-if="canMutateActive" type="button" class="btn btn-primary" @click="saveRelationType">Сохранить</button>
          <button type="button" class="btn btn-secondary" @click="relationTypeForm = null">{{ canMutateActive ? 'Отмена' : 'Закрыть' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { api } from '../api/client'
import { togafApi } from '../api'
import TableToolbar from '../components/TableToolbar.vue'
import { downloadBlob } from '../utils/downloadBlob'
import { usePermissions } from '../composables/usePermissions'

const { canWrite: canWriteReferences } = usePermissions('references')
const { canWrite: canWritePartner } = usePermissions('partner')
const { canWrite: canWriteEmployee } = usePermissions('employee')
const { canWrite: canWriteMetamodelCatalog } = usePermissions('metamodel_catalog')

const activeTab = ref('statuses')

function canMutateTab(tabKey) {
  if (tabKey === 'vendors') return canWritePartner.value
  if (tabKey === 'employees') return canWriteEmployee.value
  if (tabKey === 'metamodelEntityTypes' || tabKey === 'metamodelRelationTypes') {
    return canWriteMetamodelCatalog.value
  }
  return canWriteReferences.value
}

const canMutateActive = computed(() => canMutateTab(activeTab.value))

const tabs = [
  { id: 'statuses', label: 'Статусы систем' },
  { id: 'hosting', label: 'Типы хостинга' },
  { id: 'owners', label: 'Владельцы (направления)' },
  { id: 'vendors', label: 'Партнёры / вендоры' },
  { id: 'employees', label: 'Сотрудники' },
  { id: 'adrSystemStatuses', label: 'Системы в решении (статусы)' },
  { id: 'adrRelationStatuses', label: 'Интеграции в решении (статусы)' },
  { id: 'adrSystemFunctionStatuses', label: 'Функции в решении (статусы)' },
  { id: 'systemFunctionStatuses', label: 'Статусы функций (реестр)' },
  { id: 'adrStatuses', label: 'Статус утверждения' },
  { id: 'gapTypes', label: 'Типы арх.долга' },
  { id: 'impactLevelTypes', label: 'Степени влияния' },
  { id: 'gapStates', label: 'Состояния арх.долга' },
  { id: 'integrationFlowEventTypes', label: 'Тип события (интеграции)' },
  { id: 'integrationFlowStatuses', label: 'Статусы интеграционных потоков' },
  { id: 'orgUnitCategories', label: 'Категории орг. единиц' },
  { id: 'actorTypes', label: 'Типы заинтересованных лиц' },
  { id: 'webResourceStatuses', label: 'Статусы веб-ресурсов' },
  { id: 'webResourceCategories', label: 'Категории веб-ресурсов' },
  { id: 'webResourceStageTypes', label: 'Типы стенда веб-ресурсов' },
  { id: 'domainStatuses', label: 'Статусы доменов' },
  { id: 'businessServiceStatuses', label: 'Статусы бизнес-сервисов' },
  { id: 'infrastructureObjectTypes', label: 'Типы объектов инфраструктуры' },
  { id: 'metamodelEntityTypes', label: 'Типы сущностей метамодели' },
  { id: 'metamodelRelationTypes', label: 'Типы связей метамодели' },
]
const search = ref('')
const loading = ref(true)
const excelLoading = ref(false)
const statuses = ref([])
const hostingTypes = ref([])
const owners = ref([])
const vendors = ref([])
const employees = ref([])
const adrSystemStatuses = ref([])
const adrRelationStatuses = ref([])
const adrSystemFunctionStatuses = ref([])
const systemFunctionStatuses = ref([])
const adrStatuses = ref([])
const gapTypes = ref([])
const impactLevelTypes = ref([])
const gapStates = ref([])
const integrationFlowEventTypes = ref([])
const integrationFlowStatuses = ref([])
const orgUnitCategories = ref([])
const actorTypes = ref([])
const webResourceStatuses = ref([])
const webResourceCategories = ref([])
const webResourceStageTypes = ref([])
const domainStatuses = ref([])
const businessServiceStatuses = ref([])
const statusForm = ref(null)
const hostingForm = ref(null)
const ownerForm = ref(null)
const vendorForm = ref(null)
const employeeForm = ref(null)
const adrSystemStatusForm = ref(null)
const adrRelationStatusForm = ref(null)
const adrSystemFunctionStatusForm = ref(null)
const systemFunctionStatusForm = ref(null)
const integrationFlowEventTypeForm = ref(null)
const integrationFlowStatusForm = ref(null)
const categoryForm = ref(null)
const actorTypeForm = ref(null)
const webResourceStatusForm = ref(null)
const webResourceCategoryForm = ref(null)
const webResourceStageTypeForm = ref(null)
const domainStatusForm = ref(null)
const businessServiceStatusForm = ref(null)
const entityTypeForm = ref(null)
const relationTypeForm = ref(null)
const gapTypeForm = ref(null)
const impactLevelTypeForm = ref(null)
const gapStateForm = ref(null)
const metamodelEntityTypes = ref([])
const metamodelRelationTypes = ref([])
const infrastructureObjectTypes = ref([])
const infrastructureObjectTypeForm = ref(null)

async function loadTab() {
  loading.value = true
  try {
    const q = search.value ? { search: search.value } : {}
    if (activeTab.value === 'statuses') statuses.value = await api.getSystemStatuses(q)
    else if (activeTab.value === 'hosting') hostingTypes.value = await api.getHostingTypes(q)
    else if (activeTab.value === 'owners') owners.value = await api.getOwners(q)
    else if (activeTab.value === 'vendors') vendors.value = await api.getPartners(q)
    else if (activeTab.value === 'employees') employees.value = await api.getEmployees(q)
    else if (activeTab.value === 'adrSystemStatuses') adrSystemStatuses.value = await api.getAdrSystemStatuses(q)
    else if (activeTab.value === 'adrRelationStatuses') adrRelationStatuses.value = await api.getAdrRelationStatuses(q)
    else if (activeTab.value === 'adrSystemFunctionStatuses') adrSystemFunctionStatuses.value = await api.getAdrSystemFunctionStatuses()
    else if (activeTab.value === 'systemFunctionStatuses') systemFunctionStatuses.value = await api.getSystemFunctionStatuses()
    else if (activeTab.value === 'adrStatuses') adrStatuses.value = await api.getAdrStatuses()
    else if (activeTab.value === 'gapTypes') gapTypes.value = await api.getGapTypes()
    else if (activeTab.value === 'impactLevelTypes') impactLevelTypes.value = await api.getImpactLevelTypes()
    else if (activeTab.value === 'gapStates') gapStates.value = await api.getGapStates()
    else if (activeTab.value === 'integrationFlowEventTypes') integrationFlowEventTypes.value = await api.getIntegrationFlowEventTypes(q)
    else if (activeTab.value === 'integrationFlowStatuses') integrationFlowStatuses.value = await api.getIntegrationFlowStatuses(q)
    else if (activeTab.value === 'orgUnitCategories') orgUnitCategories.value = await togafApi.refs.organizationUnitCategories()
    else if (activeTab.value === 'actorTypes') actorTypes.value = await togafApi.refs.actorTypes()
    else if (activeTab.value === 'webResourceStatuses') webResourceStatuses.value = await api.getWebResourceStatuses()
    else if (activeTab.value === 'webResourceCategories') webResourceCategories.value = await api.getWebResourceCategories()
    else if (activeTab.value === 'webResourceStageTypes') webResourceStageTypes.value = await api.getWebResourceStageTypes()
    else if (activeTab.value === 'domainStatuses') domainStatuses.value = await api.getDomainStatuses()
    else if (activeTab.value === 'businessServiceStatuses') businessServiceStatuses.value = await togafApi.refs.businessServiceStatuses()
    else if (activeTab.value === 'infrastructureObjectTypes') infrastructureObjectTypes.value = await api.getInfrastructureObjectTypes(q)
    else if (activeTab.value === 'metamodelEntityTypes') metamodelEntityTypes.value = await togafApi.entityTypes()
    else if (activeTab.value === 'metamodelRelationTypes') {
      const [types, entityTypes] = await Promise.all([togafApi.relationTypes(), togafApi.entityTypes()])
      metamodelRelationTypes.value = types
      metamodelEntityTypes.value = entityTypes
    }
  } finally {
    loading.value = false
  }
}

watch([activeTab, search], loadTab)
onMounted(loadTab)

async function exportExcel() {
  excelLoading.value = true
  try {
    const q = { search: search.value || undefined, excel: true }
    let blob
    if (activeTab.value === 'statuses') blob = await api.getSystemStatuses(q)
    else if (activeTab.value === 'hosting') blob = await api.getHostingTypes(q)
    else if (activeTab.value === 'owners') blob = await api.getOwners(q)
    else if (activeTab.value === 'vendors') blob = await api.getPartners(q)
    else if (activeTab.value === 'employees') blob = await api.getEmployees(q)
    else if (activeTab.value === 'adrSystemStatuses') blob = await api.getAdrSystemStatuses(q)
    else if (activeTab.value === 'adrRelationStatuses') blob = await api.getAdrRelationStatuses(q)
    else if (activeTab.value === 'integrationFlowEventTypes') blob = await api.getIntegrationFlowEventTypes(q)
    else if (activeTab.value === 'integrationFlowStatuses') blob = await api.getIntegrationFlowStatuses(q)
    else if (['orgUnitCategories', 'actorTypes', 'webResourceStatuses', 'webResourceCategories', 'webResourceStageTypes', 'domainStatuses', 'businessServiceStatuses', 'infrastructureObjectTypes', 'adrStatuses', 'gapTypes', 'impactLevelTypes', 'gapStates', 'metamodelEntityTypes', 'metamodelRelationTypes'].includes(activeTab.value)) { excelLoading.value = false; return }
    if (blob) downloadBlob(blob, activeTab.value + '.xlsx')
  } finally {
    excelLoading.value = false
  }
}

function openStatusForm(r) { statusForm.value = r ? { id: r.id, name: r.name, description: r.description ?? '' } : { name: '', description: '' } }
function openHostingForm(r) { hostingForm.value = r ? { id: r.id, name: r.name } : { name: '' } }
function openOwnerForm(r) { ownerForm.value = r ? { id: r.id, name: r.name, leader: r.leader ?? '' } : { name: '', leader: '' } }
function openVendorForm(r) { vendorForm.value = r ? { id: r.id, name: r.name } : { name: '' } }
function openEmployeeForm(r) {
  employeeForm.value = r
    ? {
      id: r.id,
      employee_number: r.employee_number ?? '',
      full_name: r.full_name ?? '',
      email: r.email ?? '',
      active: !!r.active,
    }
    : { employee_number: '', full_name: '', email: '', active: true }
}
function openAdrSystemStatusForm(r) { adrSystemStatusForm.value = r ? { id: r.id, code: r.code ?? '', name: r.name, description: r.description ?? '' } : { code: '', name: '', description: '' } }
function openAdrRelationStatusForm(r) { adrRelationStatusForm.value = r ? { id: r.id, code: r.code ?? '', name: r.name, description: r.description ?? '' } : { code: '', name: '', description: '' } }
function openAdrSystemFunctionStatusForm(r) { adrSystemFunctionStatusForm.value = r ? { id: r.id, code: r.code ?? '', name: r.name, description: r.description ?? '' } : { code: '', name: '', description: '' } }
function openSystemFunctionStatusForm(r) { systemFunctionStatusForm.value = r ? { id: r.id, code: r.code ?? '', name: r.name, description: r.description ?? '' } : { code: '', name: '', description: '' } }
function openIntegrationFlowEventTypeForm(r) { integrationFlowEventTypeForm.value = r ? { id: r.id, name: r.name, description: r.description ?? '' } : { name: '', description: '' } }
function openIntegrationFlowStatusForm(r) { integrationFlowStatusForm.value = r ? { id: r.id, name: r.name, description: r.description ?? '' } : { name: '', description: '' } }
function openCategoryForm(r) { categoryForm.value = r ? { id: r.id, code: r.code ?? '', name: r.name, description: r.description ?? '' } : { code: '', name: '', description: '' } }
function openActorTypeForm(r) { actorTypeForm.value = r ? { id: r.id, code: r.code ?? '', name: r.name, description: r.description ?? '' } : { code: '', name: '', description: '' } }
function openWebResourceStatusForm(r) {
  webResourceStatusForm.value = r
    ? { id: r.id, code: r.code, name: r.name, description: r.description ?? '' }
    : { code: '', name: '', description: '' }
}
async function saveWebResourceStatus() {
  if (!webResourceStatusForm.value?.code?.trim() || !webResourceStatusForm.value?.name) return
  try {
    const payload = {
      code: webResourceStatusForm.value.code.trim(),
      name: webResourceStatusForm.value.name,
      description: webResourceStatusForm.value.description,
    }
    if (webResourceStatusForm.value.id) await api.updateWebResourceStatus(webResourceStatusForm.value.id, payload)
    else await api.createWebResourceStatus(payload)
    webResourceStatusForm.value = null
    await loadTab()
  } catch (e) { alert(e.message || 'Ошибка') }
}
async function deleteWebResourceStatus(id) {
  if (!confirm('Удалить статус?')) return
  try {
    await api.deleteWebResourceStatus(id)
    await loadTab()
  } catch (e) { alert(e.message || 'Ошибка') }
}
function openWebResourceCategoryForm(r) {
  webResourceCategoryForm.value = r
    ? { id: r.id, code: r.code, name: r.name, description: r.description ?? '' }
    : { code: '', name: '', description: '' }
}
async function saveWebResourceCategory() {
  if (!webResourceCategoryForm.value?.code?.trim() || !webResourceCategoryForm.value?.name) return
  try {
    const payload = {
      code: webResourceCategoryForm.value.code.trim(),
      name: webResourceCategoryForm.value.name,
      description: webResourceCategoryForm.value.description,
    }
    if (webResourceCategoryForm.value.id) await api.updateWebResourceCategory(webResourceCategoryForm.value.id, payload)
    else await api.createWebResourceCategory(payload)
    webResourceCategoryForm.value = null
    await loadTab()
  } catch (e) { alert(e.message || 'Ошибка') }
}
async function deleteWebResourceCategory(id) {
  if (!confirm('Удалить категорию?')) return
  try {
    await api.deleteWebResourceCategory(id)
    await loadTab()
  } catch (e) { alert(e.message || 'Ошибка') }
}
function openWebResourceStageTypeForm(r) {
  webResourceStageTypeForm.value = r
    ? { id: r.id, code: r.code, name: r.name, description: r.description ?? '' }
    : { code: '', name: '', description: '' }
}
async function saveWebResourceStageType() {
  if (!webResourceStageTypeForm.value?.code?.trim() || !webResourceStageTypeForm.value?.name) return
  try {
    const payload = {
      code: webResourceStageTypeForm.value.code.trim(),
      name: webResourceStageTypeForm.value.name,
      description: webResourceStageTypeForm.value.description,
    }
    if (webResourceStageTypeForm.value.id) await api.updateWebResourceStageType(webResourceStageTypeForm.value.id, payload)
    else await api.createWebResourceStageType(payload)
    webResourceStageTypeForm.value = null
    await loadTab()
  } catch (e) { alert(e.message || 'Ошибка') }
}
async function deleteWebResourceStageType(id) {
  if (!confirm('Удалить тип стенда?')) return
  try {
    await api.deleteWebResourceStageType(id)
    await loadTab()
  } catch (e) { alert(e.message || 'Ошибка') }
}
function openDomainStatusForm(r) {
  domainStatusForm.value = r
    ? { id: r.id, code: r.code, name: r.name, description: r.description ?? '' }
    : { code: '', name: '', description: '' }
}
async function saveDomainStatus() {
  if (!domainStatusForm.value?.code?.trim() || !domainStatusForm.value?.name) return
  try {
    const payload = {
      code: domainStatusForm.value.code.trim(),
      name: domainStatusForm.value.name,
      description: domainStatusForm.value.description,
    }
    if (domainStatusForm.value.id) await api.updateDomainStatus(domainStatusForm.value.id, payload)
    else await api.createDomainStatus(payload)
    domainStatusForm.value = null
    await loadTab()
  } catch (e) { alert(e.message || 'Ошибка') }
}
async function deleteDomainStatus(id) {
  if (!confirm('Удалить статус домена?')) return
  try {
    await api.deleteDomainStatus(id)
    await loadTab()
  } catch (e) { alert(e.message || 'Ошибка') }
}
function openBusinessServiceStatusForm(r) { businessServiceStatusForm.value = r ? { id: r.id, name: r.name, description: r.description ?? '' } : { name: '', description: '' } }
function isReservedInfrastructureTypeCode(code) {
  return ['virtual_server', 'physical_server'].includes(String(code || '').trim())
}
function openInfrastructureObjectTypeForm(r) {
  infrastructureObjectTypeForm.value = r
    ? { id: r.id, code: r.code, name: r.name, description: r.description ?? '' }
    : { code: '', name: '', description: '' }
}
async function saveInfrastructureObjectType() {
  if (!infrastructureObjectTypeForm.value?.code?.trim() || !infrastructureObjectTypeForm.value?.name?.trim()) return
  try {
    const payload = {
      code: infrastructureObjectTypeForm.value.code.trim(),
      name: infrastructureObjectTypeForm.value.name.trim(),
      description: infrastructureObjectTypeForm.value.description,
    }
    if (infrastructureObjectTypeForm.value.id) {
      await api.updateInfrastructureObjectType(infrastructureObjectTypeForm.value.id, payload)
    } else {
      await api.createInfrastructureObjectType(payload)
    }
    infrastructureObjectTypeForm.value = null
    await loadTab()
  } catch (e) { alert(e.message || 'Ошибка') }
}
async function deleteInfrastructureObjectType(id) {
  if (!confirm('Удалить тип объекта инфраструктуры?')) return
  try {
    await api.deleteInfrastructureObjectType(id)
    await loadTab()
  } catch (e) { alert(e.message || 'Ошибка') }
}
function openEntityTypeForm(r) {
  entityTypeForm.value = r
    ? { id: r.id, code: r.code, name: r.name, table_name: r.table_name ?? '', disp_param_name: r.disp_param_name ?? '', description: r.description ?? '', import_allowed: !!r.import_allowed }
    : { code: '', name: '', table_name: '', disp_param_name: '', description: '', import_allowed: false }
}
function openRelationTypeForm(r) {
  relationTypeForm.value = r
    ? { id: r.id, code: r.code, name: r.name, description: r.description ?? '', from_entity_type_id: r.from_entity_type_id, to_entity_type_id: r.to_entity_type_id, managed: !!r.managed }
    : { code: '', name: '', description: '', from_entity_type_id: null, to_entity_type_id: null, managed: false }
}
function openGapTypeForm(r) { gapTypeForm.value = r ? { id: r.id, name: r.name, description: r.description ?? '' } : { name: '', description: '' } }
function openImpactLevelTypeForm(r) { impactLevelTypeForm.value = r ? { id: r.id, name: r.name, description: r.description ?? '' } : { name: '', description: '' } }
function openGapStateForm(r) { gapStateForm.value = r ? { id: r.id, name: r.name, description: r.description ?? '' } : { name: '', description: '' } }
function formatEntityTypesArr(arr) { return (arr && arr.length) ? arr.join(', ') : '—' }

async function saveStatus() {
  if (!statusForm.value?.name) return
  try {
    if (statusForm.value.id) await api.updateSystemStatus(statusForm.value.id, { name: statusForm.value.name, description: statusForm.value.description })
    else await api.createSystemStatus({ name: statusForm.value.name, description: statusForm.value.description })
    statusForm.value = null
    await loadTab()
  } catch (e) { alert(e.message || 'Ошибка') }
}
async function saveHosting() {
  if (!hostingForm.value?.name) return
  try {
    if (hostingForm.value.id) await api.updateHostingType(hostingForm.value.id, { name: hostingForm.value.name })
    else await api.createHostingType({ name: hostingForm.value.name })
    hostingForm.value = null
    await loadTab()
  } catch (e) { alert(e.message || 'Ошибка') }
}
async function saveOwner() {
  if (!ownerForm.value?.name) return
  try {
    if (ownerForm.value.id) await api.updateOwner(ownerForm.value.id, { name: ownerForm.value.name, leader: ownerForm.value.leader })
    else await api.createOwner({ name: ownerForm.value.name, leader: ownerForm.value.leader })
    ownerForm.value = null
    await loadTab()
  } catch (e) { alert(e.message || 'Ошибка') }
}
async function saveVendor() {
  if (!vendorForm.value?.name) return
  try {
    if (vendorForm.value.id) await api.updatePartner(vendorForm.value.id, { name: vendorForm.value.name })
    else await api.createPartner({ name: vendorForm.value.name })
    vendorForm.value = null
    await loadTab()
  } catch (e) { alert(e.message || 'Ошибка') }
}
async function saveEmployee() {
  if (!employeeForm.value?.full_name?.trim()) return
  try {
    const body = {
      employee_number: employeeForm.value.employee_number?.trim() || null,
      full_name: employeeForm.value.full_name.trim(),
      email: employeeForm.value.email?.trim() || null,
      active: employeeForm.value.active,
    }
    if (employeeForm.value.id) await api.updateEmployee(employeeForm.value.id, body)
    else await api.createEmployee(body)
    employeeForm.value = null
    await loadTab()
  } catch (e) { alert(e.message || 'Ошибка') }
}
async function saveAdrSystemStatus() {
  if (!adrSystemStatusForm.value?.name || !String(adrSystemStatusForm.value.code || '').trim()) return
  try {
    const body = { code: String(adrSystemStatusForm.value.code).trim(), name: adrSystemStatusForm.value.name, description: adrSystemStatusForm.value.description }
    if (adrSystemStatusForm.value.id) await api.updateAdrSystemStatus(adrSystemStatusForm.value.id, body)
    else await api.createAdrSystemStatus(body)
    adrSystemStatusForm.value = null
    await loadTab()
  } catch (e) { alert(e.message || 'Ошибка') }
}
async function saveAdrRelationStatus() {
  if (!adrRelationStatusForm.value?.name || !adrRelationStatusForm.value?.code?.trim()) return
  try {
    const payload = { code: adrRelationStatusForm.value.code.trim(), name: adrRelationStatusForm.value.name, description: adrRelationStatusForm.value.description }
    if (adrRelationStatusForm.value.id) await api.updateAdrRelationStatus(adrRelationStatusForm.value.id, payload)
    else await api.createAdrRelationStatus(payload)
    adrRelationStatusForm.value = null
    await loadTab()
  } catch (e) { alert(e.message || 'Ошибка') }
}
async function saveAdrSystemFunctionStatus() {
  if (!adrSystemFunctionStatusForm.value?.name || !String(adrSystemFunctionStatusForm.value.code || '').trim()) return
  try {
    const body = { code: String(adrSystemFunctionStatusForm.value.code).trim(), name: adrSystemFunctionStatusForm.value.name, description: adrSystemFunctionStatusForm.value.description }
    if (adrSystemFunctionStatusForm.value.id) await api.updateAdrSystemFunctionStatus(adrSystemFunctionStatusForm.value.id, body)
    else await api.createAdrSystemFunctionStatus(body)
    adrSystemFunctionStatusForm.value = null
    await loadTab()
  } catch (e) { alert(e.message || 'Ошибка') }
}
async function saveSystemFunctionStatus() {
  if (!systemFunctionStatusForm.value?.name || !String(systemFunctionStatusForm.value.code || '').trim()) return
  try {
    const body = { code: String(systemFunctionStatusForm.value.code).trim(), name: systemFunctionStatusForm.value.name, description: systemFunctionStatusForm.value.description }
    if (systemFunctionStatusForm.value.id) await api.updateSystemFunctionStatus(systemFunctionStatusForm.value.id, body)
    else await api.createSystemFunctionStatus(body)
    systemFunctionStatusForm.value = null
    await loadTab()
  } catch (e) { alert(e.message || 'Ошибка') }
}
async function saveIntegrationFlowEventType() {
  if (!integrationFlowEventTypeForm.value?.name) return
  try {
    if (integrationFlowEventTypeForm.value.id) await api.updateIntegrationFlowEventType(integrationFlowEventTypeForm.value.id, { name: integrationFlowEventTypeForm.value.name, description: integrationFlowEventTypeForm.value.description })
    else await api.createIntegrationFlowEventType({ name: integrationFlowEventTypeForm.value.name, description: integrationFlowEventTypeForm.value.description })
    integrationFlowEventTypeForm.value = null
    await loadTab()
  } catch (e) { alert(e.message || 'Ошибка') }
}
async function saveIntegrationFlowStatus() {
  if (!integrationFlowStatusForm.value?.name || !integrationFlowStatusForm.value?.code?.trim()) return
  try {
    const payload = { code: integrationFlowStatusForm.value.code.trim(), name: integrationFlowStatusForm.value.name, description: integrationFlowStatusForm.value.description }
    if (integrationFlowStatusForm.value.id) await api.updateIntegrationFlowStatus(integrationFlowStatusForm.value.id, payload)
    else await api.createIntegrationFlowStatus(payload)
    integrationFlowStatusForm.value = null
    await loadTab()
  } catch (e) { alert(e.message || 'Ошибка') }
}
async function saveCategory() {
  if (!categoryForm.value?.name) return
  try {
    if (categoryForm.value.id) await togafApi.refs.updateOrganizationUnitCategory(categoryForm.value.id, { code: categoryForm.value.code, name: categoryForm.value.name, description: categoryForm.value.description })
    else await togafApi.refs.createOrganizationUnitCategory({ code: categoryForm.value.code, name: categoryForm.value.name, description: categoryForm.value.description })
    categoryForm.value = null
    await loadTab()
  } catch (e) { alert(e.message || 'Ошибка') }
}
async function saveActorType() {
  if (!actorTypeForm.value?.name) return
  try {
    if (actorTypeForm.value.id) await togafApi.refs.updateActorType(actorTypeForm.value.id, { code: actorTypeForm.value.code, name: actorTypeForm.value.name, description: actorTypeForm.value.description })
    else await togafApi.refs.createActorType({ code: actorTypeForm.value.code, name: actorTypeForm.value.name, description: actorTypeForm.value.description })
    actorTypeForm.value = null
    await loadTab()
  } catch (e) { alert(e.message || 'Ошибка') }
}
async function saveBusinessServiceStatus() {
  if (!businessServiceStatusForm.value?.name) return
  try {
    if (businessServiceStatusForm.value.id) await togafApi.refs.updateBusinessServiceStatus(businessServiceStatusForm.value.id, { name: businessServiceStatusForm.value.name, description: businessServiceStatusForm.value.description })
    else await togafApi.refs.createBusinessServiceStatus({ name: businessServiceStatusForm.value.name, description: businessServiceStatusForm.value.description })
    businessServiceStatusForm.value = null
    await loadTab()
  } catch (e) { alert(e.message || 'Ошибка') }
}
async function saveEntityType() {
  if (!entityTypeForm.value?.code?.trim() || !entityTypeForm.value?.name?.trim()) return
  try {
    const payload = {
      code: entityTypeForm.value.code.trim(),
      name: entityTypeForm.value.name.trim(),
      table_name: entityTypeForm.value.table_name?.trim() || null,
      disp_param_name: entityTypeForm.value.disp_param_name?.trim() || null,
      description: entityTypeForm.value.description?.trim() || null,
      import_allowed: !!entityTypeForm.value.import_allowed,
    }
    if (entityTypeForm.value.id) await togafApi.refs.updateEntityType(entityTypeForm.value.id, payload)
    else await togafApi.refs.createEntityType(payload)
    entityTypeForm.value = null
    await loadTab()
  } catch (e) { alert(e.message || 'Ошибка') }
}
async function saveRelationType() {
  if (!relationTypeForm.value?.code?.trim() || !relationTypeForm.value?.name?.trim()) return
  if (relationTypeForm.value.from_entity_type_id == null || relationTypeForm.value.to_entity_type_id == null) {
    alert('Выберите типы сущностей «от» и «к»')
    return
  }
  try {
    const payload = {
      code: relationTypeForm.value.code.trim(),
      name: relationTypeForm.value.name.trim(),
      description: relationTypeForm.value.description?.trim() || null,
      from_entity_type_id: relationTypeForm.value.from_entity_type_id,
      to_entity_type_id: relationTypeForm.value.to_entity_type_id,
      managed: !!relationTypeForm.value.managed,
    }
    if (relationTypeForm.value.id) await togafApi.refs.updateRelationType(relationTypeForm.value.id, payload)
    else await togafApi.refs.createRelationType(payload)
    relationTypeForm.value = null
    await loadTab()
  } catch (e) { alert(e.message || 'Ошибка') }
}

async function deleteStatus(id) { if (confirm('Удалить?')) { await api.deleteSystemStatus(id); await loadTab() } }
async function deleteHosting(id) { if (confirm('Удалить?')) { await api.deleteHostingType(id); await loadTab() } }
async function deleteOwner(id) { if (confirm('Удалить?')) { await api.deleteOwner(id); await loadTab() } }
async function deleteVendor(id) { if (confirm('Удалить?')) { await api.deletePartner(id); await loadTab() } }
async function deleteEmployee(id) {
  if (!confirm('Удалить сотрудника? Ссылки в ИС будут обнулены.')) return
  try {
    await api.deleteEmployee(id)
    await loadTab()
  } catch (e) { alert(e.message || 'Ошибка') }
}
async function deleteAdrSystemStatus(id) { if (confirm('Удалить?')) { await api.deleteAdrSystemStatus(id); await loadTab() } }
async function deleteAdrRelationStatus(id) { if (confirm('Удалить?')) { await api.deleteAdrRelationStatus(id); await loadTab() } }
async function deleteAdrSystemFunctionStatus(id) { if (confirm('Удалить?')) { await api.deleteAdrSystemFunctionStatus(id); await loadTab() } }
async function deleteSystemFunctionStatus(id) { if (confirm('Удалить?')) { await api.deleteSystemFunctionStatus(id); await loadTab() } }
async function deleteIntegrationFlowEventType(id) { if (confirm('Удалить?')) { await api.deleteIntegrationFlowEventType(id); await loadTab() } }
async function deleteIntegrationFlowStatus(id) { if (confirm('Удалить?')) { await api.deleteIntegrationFlowStatus(id); await loadTab() } }
async function deleteCategory(id) { if (confirm('Удалить категорию?')) { await togafApi.refs.deleteOrganizationUnitCategory(id); await loadTab() } }
async function deleteActorType(id) { if (confirm('Удалить тип заинтересованного лица?')) { await togafApi.refs.deleteActorType(id); await loadTab() } }
async function deleteBusinessServiceStatus(id) { if (confirm('Удалить статус?')) { await togafApi.refs.deleteBusinessServiceStatus(id); await loadTab() } }
async function saveGapType() {
  if (!gapTypeForm.value?.name) return
  try {
    if (gapTypeForm.value.id) await api.updateGapType(gapTypeForm.value.id, { name: gapTypeForm.value.name, description: gapTypeForm.value.description })
    else await api.createGapType({ name: gapTypeForm.value.name, description: gapTypeForm.value.description })
    gapTypeForm.value = null
    await loadTab()
  } catch (e) { alert(e.message || 'Ошибка') }
}
async function saveImpactLevelType() {
  if (!impactLevelTypeForm.value?.name) return
  try {
    if (impactLevelTypeForm.value.id) await api.updateImpactLevelType(impactLevelTypeForm.value.id, { name: impactLevelTypeForm.value.name, description: impactLevelTypeForm.value.description })
    else await api.createImpactLevelType({ name: impactLevelTypeForm.value.name, description: impactLevelTypeForm.value.description })
    impactLevelTypeForm.value = null
    await loadTab()
  } catch (e) { alert(e.message || 'Ошибка') }
}
async function saveGapState() {
  if (!gapStateForm.value?.name) return
  try {
    if (gapStateForm.value.id) await api.updateGapState(gapStateForm.value.id, { name: gapStateForm.value.name, description: gapStateForm.value.description })
    else await api.createGapState({ name: gapStateForm.value.name, description: gapStateForm.value.description })
    gapStateForm.value = null
    await loadTab()
  } catch (e) { alert(e.message || 'Ошибка') }
}
async function deleteGapType(id) { if (confirm('Удалить тип арх.долга?')) { await api.deleteGapType(id); await loadTab() } }
async function deleteImpactLevelType(id) { if (confirm('Удалить степень влияния?')) { await api.deleteImpactLevelType(id); await loadTab() } }
async function deleteGapState(id) { if (confirm('Удалить состояние?')) { await api.deleteGapState(id); await loadTab() } }
async function deleteEntityType(id) { if (confirm('Удалить тип сущности? Могут пострадать связи метамодели.')) { await togafApi.refs.deleteEntityType(id); await loadTab() } }
async function deleteRelationType(id) { if (confirm('Удалить тип связи?')) { await togafApi.refs.deleteRelationType(id); await loadTab() } }
</script>

<style scoped>
.lead {
  color: var(--ar-muted);
  margin-bottom: 1rem;
}
.tabs {
  display: flex;
  gap: 0.25rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}
.table-actions {
  padding: 0.5rem 1rem;
  border-bottom: 1px solid var(--ar-border);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
}
.btn-link:not(.danger) {
  color: var(--ar-link);
  margin-right: 0.5rem;
}
.ref-hint {
  color: var(--ar-muted);
  font-size: 0.9rem;
  margin-bottom: 0.75rem;
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
  min-width: 320px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
  border: 1px solid var(--ar-border);
}
.modal h3 {
  margin: 0 0 1rem;
  font-size: 1.1rem;
  color: var(--ar-text);
}
.form-row {
  margin-bottom: 0.75rem;
}
.form-row label {
  display: block;
  margin-bottom: 0.25rem;
  font-size: 0.9rem;
}
.form-row input,
.form-row select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  font-size: 1rem;
  box-sizing: border-box;
  background: var(--ar-surface);
}
.form-row select {
  cursor: pointer;
}
.modal-actions {
  margin-top: 1rem;
  display: flex;
  gap: 0.5rem;
}
.modal-actions .btn {
  min-height: 40px;
  padding: 0.6rem 1rem;
}
.form-fieldset {
  border: 0;
  margin: 0;
  padding: 0;
  min-width: 0;
}
</style>

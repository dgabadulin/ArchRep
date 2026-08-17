import { createRouter, createWebHistory } from 'vue-router'
import LayoutV3 from '../views/LayoutV3.vue'
import { authStore } from '../auth/authStore'
import { getToken } from '../auth/session'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue'),
    meta: { title: 'Вход', public: true },
  },
  {
    path: '/login/oidc-callback',
    name: 'oidc-callback',
    component: () => import('../views/OidcCallbackView.vue'),
    meta: { title: 'SSO', public: true },
  },
  {
    path: '/',
    component: LayoutV3,
    children: [
      { path: '', name: 'home', component: () => import('../views/HomeView.vue'), meta: { title: 'Главная', requiredPermissions: ['dashboard:read'] } },
      {
        path: 'change-password',
        name: 'change-password',
        component: () => import('../views/ChangePasswordView.vue'),
        meta: { title: 'Смена пароля' },
      },
      {
        path: 'profile',
        name: 'profile',
        component: () => import('../views/ProfileView.vue'),
        meta: { title: 'Профиль' },
      },
      { path: 'principles', name: 'principles', component: () => import('../views/Principles.vue'), meta: { title: 'Архитектурные принципы', requiredPermissions: ['principle:read'] } },
      { path: 'decisions/principle', name: 'decisions-principle', component: () => import('../views/DecisionsPrincipleList.vue'), meta: { title: 'Архитектурные решения (ADR)', requiredPermissions: ['adr_principle:read'] } },
      { path: 'decisions/principle/new', name: 'decision-principle-new', component: () => import('../views/DecisionPrincipleForm.vue'), meta: { title: 'Новое архитектурное решение (ADR)', requiredPermissions: ['adr_principle:write'] } },
      { path: 'decisions/principle/:id/edit', name: 'decision-principle-edit', component: () => import('../views/DecisionPrincipleForm.vue'), meta: { title: 'Редактирование архитектурного решения (ADR)', requiredPermissions: ['adr_principle:read'] } },
      { path: 'decisions/applied', name: 'decisions-applied', component: () => import('../views/DecisionsAppliedList.vue'), meta: { title: 'Архитектурные заключения', requiredPermissions: ['adr_applied:read'] } },
      { path: 'decisions/applied/new', name: 'decision-applied-new', component: () => import('../views/DecisionAppliedForm.vue'), meta: { title: 'Новое архитектурное заключение', requiredPermissions: ['adr_applied:write'] } },
      {
        path: 'decisions/applied/diagram-editor',
        name: 'decision-applied-diagram-editor',
        component: () => import('../views/DiagramEditorView.vue'),
        meta: { title: 'Схема решения', minimalLayout: true, requiredPermissions: ['adr_applied:read'] },
      },
      { path: 'decisions/applied/:id/edit', name: 'decision-applied-edit', component: () => import('../views/DecisionAppliedForm.vue'), meta: { title: 'Редактирование архитектурного заключения', requiredPermissions: ['adr_applied:read'] } },
      { path: 'architecture-debt', name: 'architecture-debt', component: () => import('../views/GapsList.vue'), meta: { title: 'Архитектурный долг', requiredPermissions: ['gap:read'] } },
      { path: 'architecture-debt/new', name: 'gap-new', component: () => import('../views/GapForm.vue'), meta: { title: 'Новый архитектурный долг', requiredPermissions: ['gap:write'] } },
      { path: 'architecture-debt/:id/edit', name: 'gap-edit', component: () => import('../views/GapForm.vue'), meta: { title: 'Редактирование архитектурного долга', requiredPermissions: ['gap:read'] } },
      { path: 'systems', name: 'systems', component: () => import('../views/SystemsList.vue'), meta: { title: 'Каталог ИС', requiredPermissions: ['system:read'] } },
      { path: 'systems/new', name: 'system-new', component: () => import('../views/SystemForm.vue'), meta: { title: 'Новая система', requiredPermissions: ['system:write'] } },
      { path: 'systems/:id/edit', name: 'system-edit', component: () => import('../views/SystemForm.vue'), meta: { title: 'Редактирование системы', requiredPermissions: ['system:read'] } },
      { path: 'integrations', name: 'integrations', component: () => import('../views/IntegrationsList.vue'), meta: { title: 'Интеграционные потоки', requiredPermissions: ['integration_flow:read'] } },
      { path: 'integrations/new', name: 'integration-new', component: () => import('../views/IntegrationFlowForm.vue'), meta: { title: 'Новый интеграционный поток', requiredPermissions: ['integration_flow:write'] } },
      { path: 'integrations/:id/edit', name: 'integration-edit', component: () => import('../views/IntegrationFlowForm.vue'), meta: { title: 'Редактирование интеграционного потока', requiredPermissions: ['integration_flow:read'] } },
      { path: 'web-resources', name: 'web-resources', component: () => import('../views/WebResourcesList.vue'), meta: { title: 'Реестр веб-ресурсов', requiredPermissions: ['web_resource:read'] } },
      { path: 'web-resources/new', name: 'web-resource-new', component: () => import('../views/WebResourceForm.vue'), meta: { title: 'Новый веб-ресурс', requiredPermissions: ['web_resource:write'] } },
      { path: 'web-resources/:id/edit', name: 'web-resource-edit', component: () => import('../views/WebResourceForm.vue'), meta: { title: 'Редактирование веб-ресурса', requiredPermissions: ['web_resource:read'] } },
      { path: 'domains', name: 'domains', component: () => import('../views/DomainsList.vue'), meta: { title: 'Реестр доменов', requiredPermissions: ['domain:read'] } },
      { path: 'domains/new', name: 'domain-new', component: () => import('../views/DomainForm.vue'), meta: { title: 'Новый домен', requiredPermissions: ['domain:write'] } },
      { path: 'domains/:id/edit', name: 'domain-edit', component: () => import('../views/DomainForm.vue'), meta: { title: 'Редактирование домена', requiredPermissions: ['domain:read'] } },
      { path: 'technologies', name: 'technologies', component: () => import('../views/Technologies.vue'), meta: { title: 'Каталог технологий', requiredPermissions: ['technology:read'] } },
      { path: 'technologies/new', name: 'technology-new', component: () => import('../views/TechnologyForm.vue'), meta: { title: 'Новая технология', requiredPermissions: ['technology:write'] } },
      { path: 'technologies/:id/edit', name: 'technology-edit', component: () => import('../views/TechnologyForm.vue'), meta: { title: 'Редактирование технологии', requiredPermissions: ['technology:read'] } },
      { path: 'tech-radar', name: 'tech-radar', component: () => import('../views/TechRadarView.vue'), meta: { title: 'Тех.радар', requiredPermissions: ['tech_radar:read'] } },
      { path: 'analytics', name: 'analytics', component: () => import('../views/AnalyticsView.vue'), meta: { title: 'Анализ зависимостей', requiredPermissions: ['analytics:read'] } },
      { path: 'dashboards', name: 'dashboards', component: () => import('../views/DashboardsIndex.vue'), meta: { title: 'Дашборды', requiredPermissions: ['dashboard:read'] } },
      { path: 'dashboards/catalog', name: 'dashboards-catalog', component: () => import('../views/DashboardsCatalog.vue'), meta: { title: 'Справочник дашбордов', requiredPermissions: ['dashboard:read'] } },
      { path: 'dashboards/full/:slug', name: 'dashboard-full', component: () => import('../views/DashboardFull.vue'), meta: { requiredPermissions: ['dashboard:read'] } },
      { path: 'goals', name: 'goals', component: () => import('../views/Placeholder.vue'), meta: { title: 'Цели и задачи', requiredPermissions: ['goals:read'] } },
      { path: 'organization-units', name: 'organization-units', component: () => import('../views/OrganizationUnitsList.vue'), meta: { title: 'Организационные единицы', requiredPermissions: ['organization_unit:read'] } },
      { path: 'organization-units/new', name: 'organization-unit-new', component: () => import('../views/OrganizationUnitForm.vue'), meta: { title: 'Новая орг. единица', requiredPermissions: ['organization_unit:write'] } },
      { path: 'organization-units/:id/edit', name: 'organization-unit-edit', component: () => import('../views/OrganizationUnitForm.vue'), meta: { title: 'Редактирование орг. единицы', requiredPermissions: ['organization_unit:read'] } },
      { path: 'actors', name: 'actors', component: () => import('../views/ActorsList.vue'), meta: { title: 'Заинтересованные лица', requiredPermissions: ['actor:read'] } },
      { path: 'actors/new', name: 'actor-new', component: () => import('../views/ActorForm.vue'), meta: { title: 'Новое заинтересованное лицо', requiredPermissions: ['actor:write'] } },
      { path: 'actors/:id/edit', name: 'actor-edit', component: () => import('../views/ActorForm.vue'), meta: { title: 'Редактирование заинтересованного лица', requiredPermissions: ['actor:read'] } },
      { path: 'business-services', name: 'business-services', component: () => import('../views/BusinessServicesList.vue'), meta: { title: 'Бизнес-сервисы', requiredPermissions: ['business_service:read'] } },
      { path: 'business-services/new', name: 'business-service-new', component: () => import('../views/BusinessServiceForm.vue'), meta: { title: 'Новый бизнес-сервис', requiredPermissions: ['business_service:write'] } },
      { path: 'business-services/:id/edit', name: 'business-service-edit', component: () => import('../views/BusinessServiceForm.vue'), meta: { title: 'Редактирование бизнес-сервиса', requiredPermissions: ['business_service:read'] } },
      { path: 'business-functions', name: 'business-functions', component: () => import('../views/BusinessFunctionsList.vue'), meta: { title: 'Бизнес-функции', requiredPermissions: ['business_function:read'] } },
      { path: 'business-functions/new', name: 'business-function-new', component: () => import('../views/BusinessFunctionForm.vue'), meta: { title: 'Новая бизнес-функция', requiredPermissions: ['business_function:write'] } },
      { path: 'business-functions/:id/edit', name: 'business-function-edit', component: () => import('../views/BusinessFunctionForm.vue'), meta: { title: 'Редактирование бизнес-функции', requiredPermissions: ['business_function:read'] } },
      { path: 'metamodel-relations', name: 'metamodel-relations', component: () => import('../views/MetamodelRelationsList.vue'), meta: { title: 'Связи метамодели', requiredPermissions: ['metamodel_relation:read'] } },
      { path: 'metamodel-relations/new', name: 'metamodel-relation-new', component: () => import('../views/MetamodelRelationForm.vue'), meta: { title: 'Новая связь', requiredPermissions: ['metamodel_relation:write'] } },
      { path: 'metamodel-relations/:id/edit', name: 'metamodel-relation-edit', component: () => import('../views/MetamodelRelationForm.vue'), meta: { title: 'Редактирование связи', requiredPermissions: ['metamodel_relation:read'] } },
      { path: 'references', name: 'references', component: () => import('../views/ReferencesV2.vue'), meta: { title: 'Справочники', requiredPermissions: ['references:read'] } },
      { path: 'references-togaf', redirect: { name: 'references' } },
      { path: 'settings/parameters', name: 'settings-parameters', component: () => import('../views/SettingsParametersView.vue'), meta: { title: 'Параметры', requiredPermissions: ['settings_parameters:read'] } },
      { path: 'settings/jobs', name: 'settings-jobs', component: () => import('../views/SettingsJobsView.vue'), meta: { title: 'Управление заданиями', requiredPermissions: ['jobs:read'] } },
      { path: 'settings/service-operations', name: 'settings-service-operations', component: () => import('../views/SettingsServiceOperationsView.vue'), meta: { title: 'Сервисные операции', requiredPermissions: ['service_operations:execute'] } },
      { path: 'settings/service-operations/import', name: 'settings-data-import', component: () => import('../views/DataImportView.vue'), meta: { title: 'Импорт данных', requiredPermissions: ['import:execute'] } },
      { path: 'settings/administration/users', name: 'admin-users', component: () => import('../views/AdminUsersView.vue'), meta: { title: 'Пользователи', requiredPermissions: ['users:read'] } },
      { path: 'settings/administration/roles', name: 'admin-roles', component: () => import('../views/AdminRolesView.vue'), meta: { title: 'Роли', requiredPermissions: ['roles:read'] } },
      { path: 'settings/administration/roles/:id/edit', name: 'admin-role-edit', component: () => import('../views/AdminRoleForm.vue'), meta: { title: 'Редактирование роли', requiredPermissions: ['roles:read'] } },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach(async (to) => {
  if (!authStore.state.ready) return true
  const authOn = authStore.state.authEnabled
  const isKeycloakOnly = authStore.state.user?.auth_provider === 'keycloak'

  if (to.name === 'login' || to.name === 'oidc-callback') {
    if (!authOn) return { path: '/' }
    if (to.name === 'login' && getToken() && authStore.state.user) {
      if (!isKeycloakOnly && authStore.state.user.must_change_password) {
        return { name: 'change-password' }
      }
      return { path: '/' }
    }
    return true
  }

  if (authOn && !getToken()) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.name === 'change-password' && isKeycloakOnly) {
    return { name: 'home' }
  }

  if (
    authOn &&
    !isKeycloakOnly &&
    authStore.state.user?.must_change_password &&
    to.name !== 'change-password' &&
    to.name !== 'login'
  ) {
    return { name: 'change-password' }
  }

  const required = to.meta?.requiredPermissions
  if (required?.length && !authStore.hasAllPermissions(required)) {
    // избегаем цикла, если нет даже dashboard:read на главной
    if (to.name === 'home') return true
    return { name: 'home' }
  }
  return true
})

export default router

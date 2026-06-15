import { createRouter, createWebHistory } from 'vue-router'
import LayoutV3 from '../views/LayoutV3.vue'

const routes = [
  {
    path: '/',
    component: LayoutV3,
    children: [
      { path: '', name: 'home', component: () => import('../views/HomeView.vue'), meta: { title: 'Архитектурный репозиторий' } },
      // v2: принципы, решения, ИС, интеграции, технологии
      { path: 'principles', name: 'principles', component: () => import('../views/Principles.vue'), meta: { title: 'Архитектурные принципы' } },
      { path: 'decisions/principle', name: 'decisions-principle', component: () => import('../views/DecisionsPrincipleList.vue'), meta: { title: 'Архитектурные решения (ADR)' } },
      { path: 'decisions/principle/new', name: 'decision-principle-new', component: () => import('../views/DecisionPrincipleForm.vue'), meta: { title: 'Новое архитектурное решение (ADR)' } },
      { path: 'decisions/principle/:id/edit', name: 'decision-principle-edit', component: () => import('../views/DecisionPrincipleForm.vue'), meta: { title: 'Редактирование архитектурного решения (ADR)' } },
      { path: 'decisions/applied', name: 'decisions-applied', component: () => import('../views/DecisionsAppliedList.vue'), meta: { title: 'Архитектурные заключения' } },
      { path: 'decisions/applied/new', name: 'decision-applied-new', component: () => import('../views/DecisionAppliedForm.vue'), meta: { title: 'Новое архитектурное заключение' } },
      {
        path: 'decisions/applied/diagram-editor',
        name: 'decision-applied-diagram-editor',
        component: () => import('../views/DiagramEditorView.vue'),
        meta: { title: 'Схема решения', minimalLayout: true },
      },
      { path: 'decisions/applied/:id/edit', name: 'decision-applied-edit', component: () => import('../views/DecisionAppliedForm.vue'), meta: { title: 'Редактирование архитектурного заключения' } },
      { path: 'architecture-debt', name: 'architecture-debt', component: () => import('../views/GapsList.vue'), meta: { title: 'Архитектурный долг' } },
      { path: 'architecture-debt/new', name: 'gap-new', component: () => import('../views/GapForm.vue'), meta: { title: 'Новый архитектурный долг' } },
      { path: 'architecture-debt/:id/edit', name: 'gap-edit', component: () => import('../views/GapForm.vue'), meta: { title: 'Редактирование архитектурного долга' } },
      { path: 'systems', name: 'systems', component: () => import('../views/SystemsList.vue'), meta: { title: 'Каталог ИС' } },
      { path: 'systems/new', name: 'system-new', component: () => import('../views/SystemForm.vue'), meta: { title: 'Новая система' } },
      { path: 'systems/:id/edit', name: 'system-edit', component: () => import('../views/SystemForm.vue'), meta: { title: 'Редактирование системы' } },
      { path: 'integrations', name: 'integrations', component: () => import('../views/IntegrationsList.vue'), meta: { title: 'Интеграционные потоки' } },
      { path: 'integrations/new', name: 'integration-new', component: () => import('../views/IntegrationFlowForm.vue'), meta: { title: 'Новый интеграционный поток' } },
      { path: 'integrations/:id/edit', name: 'integration-edit', component: () => import('../views/IntegrationFlowForm.vue'), meta: { title: 'Редактирование интеграционного потока' } },
      { path: 'web-resources', name: 'web-resources', component: () => import('../views/WebResourcesList.vue'), meta: { title: 'Реестр веб-ресурсов' } },
      { path: 'web-resources/new', name: 'web-resource-new', component: () => import('../views/WebResourceForm.vue'), meta: { title: 'Новый веб-ресурс' } },
      { path: 'web-resources/:id/edit', name: 'web-resource-edit', component: () => import('../views/WebResourceForm.vue'), meta: { title: 'Редактирование веб-ресурса' } },
      { path: 'technologies', name: 'technologies', component: () => import('../views/Technologies.vue'), meta: { title: 'Каталог технологий' } },
      { path: 'technologies/new', name: 'technology-new', component: () => import('../views/TechnologyForm.vue'), meta: { title: 'Новая технология' } },
      { path: 'technologies/:id/edit', name: 'technology-edit', component: () => import('../views/TechnologyForm.vue'), meta: { title: 'Редактирование технологии' } },
      { path: 'tech-radar', name: 'tech-radar', component: () => import('../views/TechRadarView.vue'), meta: { title: 'Тех.радар' } },
      { path: 'analytics', name: 'analytics', component: () => import('../views/AnalyticsView.vue'), meta: { title: 'Анализ зависимостей' } },
      { path: 'dashboards', name: 'dashboards', component: () => import('../views/DashboardsIndex.vue'), meta: { title: 'Дашборды' } },
      { path: 'dashboards/catalog', name: 'dashboards-catalog', component: () => import('../views/DashboardsCatalog.vue'), meta: { title: 'Справочник дашбордов' } },
      { path: 'dashboards/full/:slug', name: 'dashboard-full', component: () => import('../views/DashboardFull.vue'), meta: {} },
      // v3: бизнес-архитектура и метамодель
      { path: 'goals', name: 'goals', component: () => import('../views/Placeholder.vue'), meta: { title: 'Цели и задачи' } },
      { path: 'organization-units', name: 'organization-units', component: () => import('../views/OrganizationUnitsList.vue'), meta: { title: 'Организационные единицы' } },
      { path: 'organization-units/new', name: 'organization-unit-new', component: () => import('../views/OrganizationUnitForm.vue'), meta: { title: 'Новая орг. единица' } },
      { path: 'organization-units/:id/edit', name: 'organization-unit-edit', component: () => import('../views/OrganizationUnitForm.vue'), meta: { title: 'Редактирование орг. единицы' } },
      { path: 'actors', name: 'actors', component: () => import('../views/ActorsList.vue'), meta: { title: 'Заинтересованные лица' } },
      { path: 'actors/new', name: 'actor-new', component: () => import('../views/ActorForm.vue'), meta: { title: 'Новое заинтересованное лицо' } },
      { path: 'actors/:id/edit', name: 'actor-edit', component: () => import('../views/ActorForm.vue'), meta: { title: 'Редактирование заинтересованного лица' } },
      { path: 'business-services', name: 'business-services', component: () => import('../views/BusinessServicesList.vue'), meta: { title: 'Бизнес-сервисы' } },
      { path: 'business-services/new', name: 'business-service-new', component: () => import('../views/BusinessServiceForm.vue'), meta: { title: 'Новый бизнес-сервис' } },
      { path: 'business-services/:id/edit', name: 'business-service-edit', component: () => import('../views/BusinessServiceForm.vue'), meta: { title: 'Редактирование бизнес-сервиса' } },
      { path: 'business-functions', name: 'business-functions', component: () => import('../views/BusinessFunctionsList.vue'), meta: { title: 'Бизнес-функции' } },
      { path: 'business-functions/new', name: 'business-function-new', component: () => import('../views/BusinessFunctionForm.vue'), meta: { title: 'Новая бизнес-функция' } },
      { path: 'business-functions/:id/edit', name: 'business-function-edit', component: () => import('../views/BusinessFunctionForm.vue'), meta: { title: 'Редактирование бизнес-функции' } },
      { path: 'metamodel-relations', name: 'metamodel-relations', component: () => import('../views/MetamodelRelationsList.vue'), meta: { title: 'Связи метамодели' } },
      { path: 'metamodel-relations/new', name: 'metamodel-relation-new', component: () => import('../views/MetamodelRelationForm.vue'), meta: { title: 'Новая связь' } },
      { path: 'metamodel-relations/:id/edit', name: 'metamodel-relation-edit', component: () => import('../views/MetamodelRelationForm.vue'), meta: { title: 'Редактирование связи' } },
      { path: 'references', name: 'references', component: () => import('../views/ReferencesV2.vue'), meta: { title: 'Справочники' } },
      { path: 'references-togaf', redirect: { name: 'references' } },
      { path: 'settings/parameters', name: 'settings-parameters', component: () => import('../views/SettingsParametersView.vue'), meta: { title: 'Параметры' } },
      { path: 'settings/service-operations', name: 'settings-service-operations', component: () => import('../views/SettingsServiceOperationsView.vue'), meta: { title: 'Сервисные операции' } },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

export default router

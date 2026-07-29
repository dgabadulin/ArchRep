// Базовый URL API (при dev — proxy в vite; при prod — тот же хост)
export const apiBase = (typeof window !== 'undefined' && window.location?.origin) ? '' : ''

async function request(path, options = {}) {
  const url = path.startsWith('http') ? path : `${apiBase}/api${path.startsWith('/') ? path : '/' + path}`
  const { headers: optHeaders = {}, ...fetchRest } = options
  const res = await fetch(url, {
    ...fetchRest,
    headers: {
      'Content-Type': 'application/json',
      ...optHeaders,
    },
  })
  if (res.status === 204) return null
  const text = await res.text()
  if (!text) return null
  const data = text ? JSON.parse(text) : null
  if (!res.ok) throw new Error(data?.error || res.statusText || 'Request failed')
  return data
}

export const api = {
  get: (path, params) => {
    const q = params && Object.keys(params).length ? '?' + new URLSearchParams(params).toString() : ''
    return request(path + q)
  },
  post: (path, body, extra = {}) =>
    request(path, {
      method: 'POST',
      body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
      ...extra,
    }),
  put: (path, body) => request(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: (path) => request(path, { method: 'DELETE' }),
}

// TOGAF
export const togafApi = {
  entityTypes: () => api.get('/togaf/entity-types'),
  relationTypes: () => api.get('/togaf/relation-types'),
  relations: (params) => api.get('/togaf/relations', params),
  relation: (id) => api.get(`/togaf/relations/${id}`),
  createRelation: (body) => api.post('/togaf/relations', body),
  updateRelation: (id, body) => api.put(`/togaf/relations/${id}`, body),
  deleteRelation: (id) => api.delete(`/togaf/relations/${id}`),
  /** Пересборка проекций integration_flow из ar_integration_flows (issue #33). */
  rebuildIntegrationFlowProjections: () => api.post('/togaf/metamodel/rebuild-integration-flow-projections', {}),

  organizationUnits: (params) => api.get('/togaf/organization-units', params),
  organizationUnit: (id) => api.get(`/togaf/organization-units/${id}`),
  createOrganizationUnit: (body) => api.post('/togaf/organization-units', body),
  updateOrganizationUnit: (id, body) => api.put(`/togaf/organization-units/${id}`, body),
  deleteOrganizationUnit: (id) => api.delete(`/togaf/organization-units/${id}`),

  actors: (params) => api.get('/togaf/actors', params),
  actor: (id) => api.get(`/togaf/actors/${id}`),
  createActor: (body) => api.post('/togaf/actors', body),
  updateActor: (id, body) => api.put(`/togaf/actors/${id}`, body),
  deleteActor: (id) => api.delete(`/togaf/actors/${id}`),

  businessServices: (params) => api.get('/togaf/business-services', params),
  businessService: (id) => api.get(`/togaf/business-services/${id}`),
  createBusinessService: (body) => api.post('/togaf/business-services', body),
  updateBusinessService: (id, body) => api.put(`/togaf/business-services/${id}`, body),
  deleteBusinessService: (id) => api.delete(`/togaf/business-services/${id}`),

  webResources: (params) => api.get('/togaf/web-resources', params),
  webResource: (id) => api.get(`/togaf/web-resources/${id}`),

  businessFunctions: (params) => api.get('/togaf/business-functions', params),
  businessFunction: (id) => api.get(`/togaf/business-functions/${id}`),
  createBusinessFunction: (body) => api.post('/togaf/business-functions', body),
  updateBusinessFunction: (id, body) => api.put(`/togaf/business-functions/${id}`, body),
  deleteBusinessFunction: (id) => api.delete(`/togaf/business-functions/${id}`),

  refs: {
    organizationUnitCategories: () => api.get('/togaf/refs/organization-unit-categories'),
    organizationUnitCategory: (id) => api.get(`/togaf/refs/organization-unit-categories/${id}`),
    createOrganizationUnitCategory: (body) => api.post('/togaf/refs/organization-unit-categories', body),
    updateOrganizationUnitCategory: (id, body) => api.put(`/togaf/refs/organization-unit-categories/${id}`, body),
    deleteOrganizationUnitCategory: (id) => api.delete(`/togaf/refs/organization-unit-categories/${id}`),
    actorTypes: () => api.get('/togaf/refs/actor-types'),
    actorType: (id) => api.get(`/togaf/refs/actor-types/${id}`),
    createActorType: (body) => api.post('/togaf/refs/actor-types', body),
    updateActorType: (id, body) => api.put(`/togaf/refs/actor-types/${id}`, body),
    deleteActorType: (id) => api.delete(`/togaf/refs/actor-types/${id}`),
    businessServiceStatuses: () => api.get('/togaf/refs/business-service-statuses'),
    businessServiceStatus: (id) => api.get(`/togaf/refs/business-service-statuses/${id}`),
    createBusinessServiceStatus: (body) => api.post('/togaf/refs/business-service-statuses', body),
    updateBusinessServiceStatus: (id, body) => api.put(`/togaf/refs/business-service-statuses/${id}`, body),
    deleteBusinessServiceStatus: (id) => api.delete(`/togaf/refs/business-service-statuses/${id}`),
    createEntityType: (body) => api.post('/togaf/entity-types', body),
    updateEntityType: (id, body) => api.put(`/togaf/entity-types/${id}`, body),
    deleteEntityType: (id) => api.delete(`/togaf/entity-types/${id}`),
    createRelationType: (body) => api.post('/togaf/relation-types', body),
    updateRelationType: (id, body) => api.put(`/togaf/relation-types/${id}`, body),
    deleteRelationType: (id) => api.delete(`/togaf/relation-types/${id}`),
  },
}

/** Сервисные операции: перезапуск процесса API (см. ADMIN_API_RESTART_SECRET на сервере). */
export const adminApi = {
  restartNodeStatus: () => api.get('/admin/restart-node/status'),
  restartNode: (secret) => {
    const headers = secret ? { 'X-Admin-Restart-Secret': secret } : {}
    return api.post('/admin/restart-node', {}, { headers })
  },
}

/** Сервисный импорт данных (issue #64). */
export const importApi = {
  entities: () => api.get('/import/entities'),
  template: async (entity) => {
    const url = `${apiBase}/api/import/template?entity=${encodeURIComponent(entity)}`
    const res = await fetch(url)
    if (!res.ok) {
      let msg = res.statusText
      try {
        const j = await res.json()
        if (j?.error) msg = j.error
      } catch (_) { /* ignore */ }
      throw new Error(msg || 'template failed')
    }
    return res.blob()
  },
  export: async (entity) => {
    const url = `${apiBase}/api/import/export?entity=${encodeURIComponent(entity)}`
    const res = await fetch(url)
    if (!res.ok) {
      let msg = res.statusText
      try {
        const j = await res.json()
        if (j?.error) msg = j.error
      } catch (_) { /* ignore */ }
      throw new Error(msg || 'export failed')
    }
    return res.blob()
  },
  validate: (body) => api.post('/import/validate', body),
  apply: (body) => api.post('/import/apply', body),
}

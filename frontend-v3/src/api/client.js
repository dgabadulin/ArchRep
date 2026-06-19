const API_BASE = import.meta.env.VITE_API_URL || ''

function buildQuery(params) {
  const q = new URLSearchParams()
  if (params?.search) q.set('search', params.search)
  if (params?.excel) q.set('excel', '1')
  if (params?.vendor_id != null) q.set('vendor_id', params.vendor_id)
  if (params?.system_id != null) q.set('system_id', params.system_id)
  if (params?.exclude_modules) q.set('exclude_modules', '1')
  if (params?.only_modules) q.set('only_modules', '1')
  if (params?.search) q.set('search', params.search)
  const s = q.toString()
  return s ? '?' + s : ''
}

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const err = new Error(res.statusText || 'API error')
    err.status = res.status
    const text = await res.text()
    try {
      const body = JSON.parse(text)
      err.body = body
      if (body && typeof body.error === 'string') err.message = body.error
    } catch { err.body = text }
    throw err
  }
  if (res.status === 204) return null
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) return res.json()
  return res.blob()
}

export const api = {
  getSystems: (params) => request('/api/ar-systems' + buildQuery(params)),
  getSystem: (id) => request(`/api/ar-systems/${id}`),
  createSystem: (body) => request('/api/add-ar-systems', { method: 'POST', body: JSON.stringify(body) }),
  updateSystem: (id, body) => request(`/api/update-ar-systems/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  getParentSystems: () => request('/api/parent-systems'),
  getSystemStatuses: (params) => request('/api/system-statuses' + buildQuery(params)),
  getHostingTypes: (params) => request('/api/hosting-types' + buildQuery(params)),
  getOwners: (params) => request('/api/owners' + buildQuery(params)),
  getVendors: (params) => request('/api/ar-vendors' + buildQuery(params)),
  getPartners: (params) => request('/api/partners' + buildQuery(params)),
  getPartner: (id) => request(`/api/partners/${id}`),
  createPartner: (body) => request('/api/partners', { method: 'POST', body: JSON.stringify(body) }),
  updatePartner: (id, body) => request(`/api/partners/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deletePartner: (id) => request(`/api/partners/${id}`, { method: 'DELETE' }),
  getEmployees: (params) => request('/api/ar-employees' + buildQuery(params)),
  getEmployee: (id) => request(`/api/ar-employees/${id}`),
  createEmployee: (body) => request('/api/ar-employees', { method: 'POST', body: JSON.stringify(body) }),
  updateEmployee: (id, body) => request(`/api/ar-employees/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteEmployee: (id) => request(`/api/ar-employees/${id}`, { method: 'DELETE' }),
  getOwner: (id) => request(`/api/owners/${id}`),
  createOwner: (body) => request('/api/owners', { method: 'POST', body: JSON.stringify(body) }),
  updateOwner: (id, body) => request(`/api/owners/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteOwner: (id) => request(`/api/owners/${id}`, { method: 'DELETE' }),
  createSystemStatus: (body) => request('/api/system-statuses', { method: 'POST', body: JSON.stringify(body) }),
  updateSystemStatus: (id, body) => request(`/api/system-statuses/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteSystemStatus: (id) => request(`/api/system-statuses/${id}`, { method: 'DELETE' }),
  createHostingType: (body) => request('/api/hosting-types', { method: 'POST', body: JSON.stringify(body) }),
  updateHostingType: (id, body) => request(`/api/hosting-types/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteHostingType: (id) => request(`/api/hosting-types/${id}`, { method: 'DELETE' }),
  getTechnologies: (params) => request('/api/technologies' + buildQuery(params)),
  getTechnology: (id) => request(`/api/technologies/${id}`),
  createTechnology: (body) => request('/api/technologies', { method: 'POST', body: JSON.stringify(body) }),
  updateTechnology: (id, body) => request(`/api/technologies/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteTechnology: (id) => request(`/api/technologies/${id}`, { method: 'DELETE' }),
  getTechnologyClasses: (params) => request('/api/technology-classes' + buildQuery(params)),
  createTechnologyClass: (body) => request('/api/technology-classes', { method: 'POST', body: JSON.stringify(body) }),
  updateTechnologyClass: (id, body) => request(`/api/technology-classes/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteTechnologyClass: (id) => request(`/api/technology-classes/${id}`, { method: 'DELETE' }),
  getTechnologyStatuses: (params) => request('/api/technology-statuses' + buildQuery(params)),
  createTechnologyStatus: (body) => request('/api/technology-statuses', { method: 'POST', body: JSON.stringify(body) }),
  updateTechnologyStatus: (id, body) => request(`/api/technology-statuses/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteTechnologyStatus: (id) => request(`/api/technology-statuses/${id}`, { method: 'DELETE' }),
  getTechnologyTypes: (params) => request('/api/technology-types' + buildQuery(params)),
  createTechnologyType: (body) => request('/api/technology-types', { method: 'POST', body: JSON.stringify(body) }),
  updateTechnologyType: (id, body) => request(`/api/technology-types/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteTechnologyType: (id) => request(`/api/technology-types/${id}`, { method: 'DELETE' }),
  getPrinciples: (params) => request('/api/principles' + buildQuery(params)),
  getPrinciple: (id) => request(`/api/principles/${id}`),
  createPrinciple: (body) => request('/api/principles', { method: 'POST', body: JSON.stringify(body) }),
  updatePrinciple: (id, body) => request(`/api/principles/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deletePrinciple: (id) => request(`/api/principles/${id}`, { method: 'DELETE' }),
  getAdrStatuses: () => request('/api/adr-statuses'),
  getDecisionsPrinciple: (params) => request('/api/decisions/principle' + buildQuery(params)),
  getDecisionPrinciple: (id) => request(`/api/decisions/principle/${id}`),
  createDecisionPrinciple: (body) => request('/api/decisions/principle', { method: 'POST', body: JSON.stringify(body) }),
  updateDecisionPrinciple: (id, body) => request(`/api/decisions/principle/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteDecisionPrinciple: (id) => request(`/api/decisions/principle/${id}`, { method: 'DELETE' }),
  getDecisionsApplied: (params) => request('/api/decisions/applied' + buildQuery(params)),
  getDecisionApplied: (id) => request(`/api/decisions/applied/${id}`),
  createDecisionApplied: (body) => request('/api/decisions/applied', { method: 'POST', body: JSON.stringify(body) }),
  updateDecisionApplied: (id, body) => request(`/api/decisions/applied/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  saveDecisionAppliedFull: (body) => request('/api/decisions/applied/full', { method: 'POST', body: JSON.stringify(body) }),
  updateDecisionAppliedFull: (id, body) => request(`/api/decisions/applied/${id}/full`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteDecisionApplied: (id) => request(`/api/decisions/applied/${id}`, { method: 'DELETE' }),
  getAdrIncrementTypes: () => request('/api/adr-increment-types'),
  getDecisionAppliedIncrements: (appliedId) => request(`/api/decisions/applied/${appliedId}/increments`),
  addDecisionAppliedIncrement: (appliedId, body) => request(`/api/decisions/applied/${appliedId}/increments`, { method: 'POST', body: JSON.stringify(body) }),
  updateIncrement: (appliedId, id, body) => request(`/api/decisions/applied/${appliedId}/increments/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  removeIncrement: (appliedId, id) => request(`/api/decisions/applied/${appliedId}/increments/${id}`, { method: 'DELETE' }),
  getIncrementSystems: (incrementId) => request(`/api/increments/${incrementId}/systems`),
  addIncrementSystem: (incrementId, body) => request(`/api/increments/${incrementId}/systems`, { method: 'POST', body: JSON.stringify(body) }),
  removeIncrementSystem: (incrementId, rowId) => request(`/api/increments/${incrementId}/systems/${rowId}`, { method: 'DELETE' }),
  getSystemFunctions: (systemId) => request(`/api/ar-systems/${systemId}/system-functions`),
  getSystemFunctionsGlobal: (params) => request('/api/system-functions' + buildQuery(params)),
  getSystemFunction: (id) => request(`/api/system-functions/${id}`),
  createSystemFunction: (systemId, body) =>
    request(`/api/ar-systems/${systemId}/system-functions`, { method: 'POST', body: JSON.stringify(body) }),
  /** ids — массив id функций каталога; 409 если функции выбраны в ADR (тело: usages, adr_codes) */
  deleteSystemFunctions: (systemId, ids) =>
    request(`/api/ar-systems/${systemId}/system-functions`, {
      method: 'DELETE',
      body: JSON.stringify({ ids }),
    }),
  getIncrementSystemFunctionSelection: (rowId) => request(`/api/adr-increment-systems/${rowId}/function-selection`),
  putIncrementSystemFunctionSelection: (rowId, body) =>
    request(`/api/adr-increment-systems/${rowId}/function-selection`, { method: 'PUT', body: JSON.stringify(body) }),
  getIncrementRelations: (incrementId) => request(`/api/increments/${incrementId}/relations`),
  addIncrementRelation: (incrementId, body) => request(`/api/increments/${incrementId}/relations`, { method: 'POST', body: JSON.stringify(body) }),
  updateIncrementRelation: (incrementId, id, body) => request(`/api/increments/${incrementId}/relations/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  removeIncrementRelation: (incrementId, id) => request(`/api/increments/${incrementId}/relations/${id}`, { method: 'DELETE' }),
  getIncrementDiagrams: (incrementId) => request(`/api/increments/${incrementId}/diagrams`),
  getIncrementDiagram: (incrementId, diagramId) => request(`/api/increments/${incrementId}/diagrams/${diagramId}`),
  createIncrementDiagram: (incrementId) => request(`/api/increments/${incrementId}/diagrams`, { method: 'POST', body: '{}' }),
  mergeIncrementDiagram: (incrementId, diagramId) =>
    request(`/api/increments/${incrementId}/diagrams/${diagramId}/merge`, { method: 'POST', body: '{}' }),
  putIncrementDiagram: (incrementId, diagramId, body) =>
    request(`/api/increments/${incrementId}/diagrams/${diagramId}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteIncrementDiagram: (incrementId, diagramId) =>
    request(`/api/increments/${incrementId}/diagrams/${diagramId}`, { method: 'DELETE' }),
  getAdrSystemStatuses: (params) => request('/api/adr-system-statuses' + buildQuery(params)),
  getAdrRelationStatuses: (params) => request('/api/adr-relation-statuses' + buildQuery(params)),
  createAdrSystemStatus: (body) => request('/api/adr-system-statuses', { method: 'POST', body: JSON.stringify(body) }),
  updateAdrSystemStatus: (id, body) => request(`/api/adr-system-statuses/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteAdrSystemStatus: (id) => request(`/api/adr-system-statuses/${id}`, { method: 'DELETE' }),
  createAdrRelationStatus: (body) => request('/api/adr-relation-statuses', { method: 'POST', body: JSON.stringify(body) }),
  updateAdrRelationStatus: (id, body) => request(`/api/adr-relation-statuses/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteAdrRelationStatus: (id) => request(`/api/adr-relation-statuses/${id}`, { method: 'DELETE' }),
  getClassificators: (params) => request('/api/classificators' + buildQuery(params)),
  createClassificator: (body) => request('/api/classificators', { method: 'POST', body: JSON.stringify(body) }),
  updateClassificator: (id, body) => request(`/api/classificators/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteClassificator: (id) => request(`/api/classificators/${id}`, { method: 'DELETE' }),
  getSystemAssignments: (params) => request('/api/system-assignments' + buildQuery(params)),
  createSystemAssignment: (body) => request('/api/system-assignments', { method: 'POST', body: JSON.stringify(body) }),
  updateSystemAssignment: (id, body) => request(`/api/system-assignments/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteSystemAssignment: (id) => request(`/api/system-assignments/${id}`, { method: 'DELETE' }),
  getSystemsTechnologies: (params) => request('/api/systems-technologies' + buildQuery(params)),
  createSystemTechnology: (body) => request('/api/systems-technologies', { method: 'POST', body: JSON.stringify(body) }),
  deleteSystemTechnology: (id) => request(`/api/systems-technologies/${id}`, { method: 'DELETE' }),
  getIntegrationFlows: (params) => request('/api/integration-flows' + buildQuery(params)),
  getIntegrationFlow: (id) => request(`/api/integration-flows/${id}`),
  createIntegrationFlow: (body) => request('/api/integration-flows', { method: 'POST', body: JSON.stringify(body) }),
  updateIntegrationFlow: (id, body) => request(`/api/integration-flows/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteIntegrationFlow: (id) => request(`/api/integration-flows/${id}`, { method: 'DELETE' }),
  getIntegrationFlowEventTypes: (params) => request('/api/integration-flow-event-types' + buildQuery(params)),
  createIntegrationFlowEventType: (body) => request('/api/integration-flow-event-types', { method: 'POST', body: JSON.stringify(body) }),
  updateIntegrationFlowEventType: (id, body) => request(`/api/integration-flow-event-types/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteIntegrationFlowEventType: (id) => request(`/api/integration-flow-event-types/${id}`, { method: 'DELETE' }),
  getIntegrationFlowStatuses: (params) => request('/api/integration-flow-statuses' + buildQuery(params)),
  createIntegrationFlowStatus: (body) => request('/api/integration-flow-statuses', { method: 'POST', body: JSON.stringify(body) }),
  updateIntegrationFlowStatus: (id, body) => request(`/api/integration-flow-statuses/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteIntegrationFlowStatus: (id) => request(`/api/integration-flow-statuses/${id}`, { method: 'DELETE' }),

  getGaps: (params) => request('/api/ar-gaps' + buildQuery(params)),
  getGap: (id) => request(`/api/ar-gaps/${id}`),
  createGap: (body) => request('/api/ar-gaps', { method: 'POST', body: JSON.stringify(body) }),
  updateGap: (id, body) => request(`/api/ar-gaps/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteGap: (id) => request(`/api/ar-gaps/${id}`, { method: 'DELETE' }),
  getGapRelations: (id) => request(`/api/ar-gaps/${id}/relations`),
  addGapRelation: (id, body) => request(`/api/ar-gaps/${id}/relations`, { method: 'POST', body: JSON.stringify(body) }),
  getGapTypes: () => request('/api/ar-gap-types'),
  createGapType: (body) => request('/api/ar-gap-types', { method: 'POST', body: JSON.stringify(body) }),
  updateGapType: (id, body) => request(`/api/ar-gap-types/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteGapType: (id) => request(`/api/ar-gap-types/${id}`, { method: 'DELETE' }),
  getImpactLevelTypes: () => request('/api/ar-impact-level-types'),
  createImpactLevelType: (body) => request('/api/ar-impact-level-types', { method: 'POST', body: JSON.stringify(body) }),
  updateImpactLevelType: (id, body) => request(`/api/ar-impact-level-types/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteImpactLevelType: (id) => request(`/api/ar-impact-level-types/${id}`, { method: 'DELETE' }),
  getBusinessFunctions: (params) => request('/api/togaf/business-functions' + buildQuery(params)),
  getWebResources: (params) => request('/api/togaf/web-resources' + buildQuery(params)),
  getWebResource: (id) => request(`/api/togaf/web-resources/${id}`),
  createWebResource: (body) => request('/api/togaf/web-resources', { method: 'POST', body: JSON.stringify(body) }),
  updateWebResource: (id, body) => request(`/api/togaf/web-resources/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteWebResource: (id) => request(`/api/togaf/web-resources/${id}`, { method: 'DELETE' }),
  getWebResourceStatuses: () => request('/api/togaf/web-resource-statuses'),
  createWebResourceStatus: (body) => request('/api/togaf/web-resource-statuses', { method: 'POST', body: JSON.stringify(body) }),
  updateWebResourceStatus: (id, body) => request(`/api/togaf/web-resource-statuses/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteWebResourceStatus: (id) => request(`/api/togaf/web-resource-statuses/${id}`, { method: 'DELETE' }),

  getGapStates: () => request('/api/ar-gap-states'),
  createGapState: (body) => request('/api/ar-gap-states', { method: 'POST', body: JSON.stringify(body) }),
  updateGapState: (id, body) => request(`/api/ar-gap-states/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteGapState: (id) => request(`/api/ar-gap-states/${id}`, { method: 'DELETE' }),

  getSettingsParameters: (params) => request('/api/settings-parameters' + buildQuery(params)),
  getSettingsParameter: (id) => request(`/api/settings-parameters/${id}`),
  createSettingsParameter: (body) => request('/api/settings-parameters', { method: 'POST', body: JSON.stringify(body) }),
  updateSettingsParameter: (id, body) => request(`/api/settings-parameters/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteSettingsParameter: (id) => request(`/api/settings-parameters/${id}`, { method: 'DELETE' }),

  getConfig: () => request('/api/config'),
  getHomeStats: () => request('/api/dashboard/home-stats'),
}

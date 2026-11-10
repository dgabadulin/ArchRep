/**
 * Черновик состава решения для палитры «Заполнить из диаграммы» (перенос модуля DrawIO Pro в ядро).
 *
 * Держит системы/функции/связи **в памяти** (до «Сохранить» в реестры ничего не пишется),
 * генерирует mxfile для draw.io и по «Сохранить»:
 *   1) сверяет нарисованное (parseMxfile) с моделью,
 *   2) одной транзакцией пишет состав — `PUT /api/decisions/applied/:id/full`
 *      с `increments_mode: 'merge'` (пересоздаётся только своё решение),
 *   3) перекодирует черновые id ячеек (`draft-sys-*` → `sys-{id}`) по картам из ответа,
 *   4) сохраняет `.drawio` в схему решения.
 *
 * Ключи (`ref`) совпадают с id ячеек диаграммы — так merge раскладки на сервере
 * (`mergeMxfileWithData`) находит позиции после пересохранения.
 */
import { reactive, computed } from 'vue'
import { api } from '../api/client'
import * as dm from '../utils/diagramModel'

function clone(v) {
  return v == null ? v : JSON.parse(JSON.stringify(v))
}

/** Базовая часть ключа черновика (`draft-sys-abc` → `abc`) — она уходит в `local_key`. */
function draftKeyOf(ref) {
  const pid = dm.parseCellId(ref)
  return pid.draftKey
}

export function useDiagramDraft({ appliedId = null, incrementId = null, incrementName = '', orderIndex = 1 } = {}) {
  const state = reactive({
    incrementId: incrementId || null,
    systems: [],
    relations: [],
    systemCatalog: [],
    flowCatalog: [],
    systemStatuses: [],
    sysfuncStatuses: [],
    relationStatuses: [],
    eventTypes: [],
    markers: { ...dm.DEFAULT_SYSFUNC_MARKERS },
    loading: false,
    saving: false,
    loadError: '',
  })

  let seq = 0
  const currentIncrementId = computed(() => state.incrementId || incrementId)

  /** Загрузка справочников (только GET — изолированность сохраняется). */
  async function loadCatalogs() {
    const [systems, flows, sysSt, fnSt, relSt, evt] = await Promise.all([
      api.getSystems().catch(() => []),
      api.getIntegrationFlows().catch(() => []),
      api.getAdrSystemStatuses().catch(() => []),
      api.getAdrSystemFunctionStatuses().catch(() => []),
      api.getAdrRelationStatuses().catch(() => []),
      api.getIntegrationFlowEventTypes().catch(() => []),
    ])
    state.systemCatalog = systems || []
    state.flowCatalog = flows || []
    state.systemStatuses = sysSt || []
    state.sysfuncStatuses = fnSt || []
    state.relationStatuses = relSt || []
    state.eventTypes = evt || []
  }

  /** Текущий состав решения из БД (источник истины при открытии палитры). */
  async function loadComposition(incId) {
    const id = incId || currentIncrementId.value
    if (!id) return
    const [sysRows, relRows] = await Promise.all([
      api.getIncrementSystems(id).catch(() => []),
      api.getIncrementRelations(id).catch(() => []),
    ])

    const systems = []
    for (const row of sysRows || []) {
      const ref = dm.systemCellId({ id: row.ar_systems_id })
      let functions = []
      if (row.id != null) {
        const data = await api.getIncrementSystemFunctionSelection(row.id).catch(() => null)
        const selected = (data && data.selected_ordered) || []
        functions = selected.map((f, i) => ({
          ref: `${ref}#f${i}`,
          id: f.ar_system_functions_id != null ? f.ar_system_functions_id : null,
          name: f.name || '',
          statusCode: f.increment_sysfunc_status_code || null,
        }))
      }
      systems.push({
        ref,
        kind: 'existing',
        id: String(row.ar_systems_id),
        draftKey: null,
        label: row.system_name || row.name || '',
        statusCode: row.increment_system_status_code || null,
        functions,
      })
    }

    const relations = (relRows || []).map((row) => ({
      ref: dm.relationCellId({ id: row.id }),
      kind: 'existing',
      id: String(row.id),
      draftKey: null,
      flowId: row.ar_integration_flows_id != null ? String(row.ar_integration_flows_id) : null,
      label: row.transferred_data || row.name || '',
      statusCode: row.increment_relation_status_code || null,
      fromRef: row.from_ar_systems_id != null ? dm.systemCellId({ id: row.from_ar_systems_id }) : null,
      toRef: row.to_ar_systems_id != null ? dm.systemCellId({ id: row.to_ar_systems_id }) : null,
    }))

    state.systems = systems
    state.relations = relations
  }

  /** Загрузка всего, что нужно палитре. */
  async function load(incId) {
    state.loading = true
    state.loadError = ''
    try {
      await loadCatalogs()
      await loadComposition(incId)
    } catch (e) {
      state.loadError = e?.body?.error || e?.message || 'Ошибка загрузки данных палитры'
    } finally {
      state.loading = false
    }
  }

  // --- изменения (только память) ---------------------------------------------

  /** Добавить систему из реестра в диаграмму. */
  function addExistingSystem({ id, label }) {
    if (id == null) return null
    const ref = dm.systemCellId({ id })
    const existing = state.systems.find((s) => s.ref === ref)
    if (existing) return existing
    const row = (state.systemCatalog || []).find((x) => String(x.id) === String(id))
    const sys = {
      ref,
      kind: 'existing',
      id: String(id),
      draftKey: null,
      label: label || (row && (row.display_name || row.name)) || `Система #${id}`,
      statusCode: null,
      functions: [],
    }
    state.systems.push(sys)
    return sys
  }

  /** Добавить новую систему (в реестр попадёт при сохранении заключения). */
  function addNewSystem({ label, statusCode } = {}) {
    const draftKey = dm.makeDraftKey('sys')
    const sys = {
      ref: dm.systemCellId({ draftKey }),
      kind: 'new',
      id: null,
      draftKey,
      label: label || '',
      statusCode: statusCode || null,
      functions: [],
    }
    state.systems.push(sys)
    return sys
  }

  /** Привязать выбранные функции к системе (из модалки Dual Listbox). */
  function setFunctions(systemRef, list) {
    const sys = state.systems.find((s) => s.ref === systemRef)
    if (!sys) return null
    sys.functions = (list || [])
      .filter((f) => String(f.name || '').trim())
      .map((f, i) => ({
        ref: f.ar_system_functions_id != null ? `fn-${f.ar_system_functions_id}` : `${sys.ref}#f${i}`,
        id: f.ar_system_functions_id != null ? f.ar_system_functions_id : null,
        name: String(f.name).trim(),
        statusCode: f.increment_sysfunc_status_code || null,
      }))
    return sys
  }

  /** Добавить связь (поток) между системами диаграммы. */
  function addRelation({ fromRef, toRef, label, statusCode, flowId } = {}) {
    if (!fromRef || !toRef || fromRef === toRef) return null
    const draftKey = dm.makeDraftKey('rel')
    const rel = {
      ref: dm.relationCellId({ draftKey }),
      kind: 'new',
      id: null,
      draftKey,
      flowId: flowId != null && flowId !== '' ? String(flowId) : null,
      label: label || 'Поток',
      statusCode: statusCode || null,
      fromRef,
      toRef,
    }
    state.relations.push(rel)
    return rel
  }

  /** Статус «в решении» для любой сущности (инлайн-селект палитры). */
  function setStatus(ref, statusCode) {
    const entity = find(ref)
    if (!entity) return false
    entity.statusCode = statusCode || null
    return true
  }

  /** Точечная правка подписи/статуса. */
  function update(ref, patch = {}) {
    const entity = find(ref)
    if (!entity) return null
    for (const key of ['label', 'statusCode', 'flowId']) {
      if (Object.prototype.hasOwnProperty.call(patch, key)) entity[key] = patch[key]
    }
    return entity
  }

  function find(ref) {
    return state.systems.find((s) => s.ref === ref) || state.relations.find((r) => r.ref === ref) || null
  }

  /** Удаление с каскадом: система → её связи. */
  function remove(ref) {
    const isSystem = state.systems.some((s) => s.ref === ref)
    if (isSystem) {
      state.systems = state.systems.filter((s) => s.ref !== ref)
      state.relations = state.relations.filter((r) => r.fromRef !== ref && r.toRef !== ref)
      return true
    }
    const before = state.relations.length
    state.relations = state.relations.filter((r) => r.ref !== ref)
    return state.relations.length !== before
  }

  // --- модель и mxfile ---------------------------------------------------------

  function toModel() {
    return { systems: clone(state.systems), relations: clone(state.relations) }
  }

  /** mxfile по текущему черновику; `geometry` — раскладка с холста (сохраняет позиции). */
  function toMxfile({ geometry, name } = {}) {
    return dm.buildDiagramMxfile(toModel(), {
      name: name || incrementName || 'Схема решения',
      geometry,
      markers: state.markers,
    })
  }

  /**
   * Сверка нарисованного с черновиком: если пользователь удалил ячейку на холсте —
   * объект убирается из состава; статус из стиля ячейки (`isarStatus`) имеет приоритет.
   */
  function reconcile(xml) {
    const parsed = dm.parseMxfile(xml, { markers: state.markers })
    const drawnSystems = new Set(parsed.systems.map((s) => s.ref))
    const drawnRelations = new Set(parsed.relations.map((r) => r.ref))
    state.systems = state.systems.filter((s) => drawnSystems.has(s.ref))
    state.relations = state.relations.filter((r) => drawnRelations.has(r.ref) && state.systems.some((s) => s.ref === r.fromRef) && state.systems.some((s) => s.ref === r.toRef))
    for (const s of parsed.systems) {
      const sys = state.systems.find((x) => x.ref === s.ref)
      if (sys && s.statusCode) sys.statusCode = s.statusCode
    }
    for (const r of parsed.relations) {
      const rel = state.relations.find((x) => x.ref === r.ref)
      if (rel && r.statusCode) rel.statusCode = r.statusCode
    }
    return parsed
  }

  // --- валидация и payload ------------------------------------------------------

  /** Проверки перед сохранением (правила статусов — по спецификации ядра). */
  function validate() {
    const errors = []
    for (const s of state.systems) {
      if (s.kind === 'new' && !String(s.label || '').trim()) {
        errors.push({ ref: s.ref, field: 'label', message: 'Не задано наименование новой системы' })
      }
      for (const f of s.functions || []) {
        if (!f.statusCode) {
          errors.push({ ref: s.ref, field: 'statusCode', message: `Укажите статус функции «${f.name}»` })
        }
      }
    }
    for (const r of state.relations) {
      const from = state.systems.find((s) => s.ref === r.fromRef)
      const to = state.systems.find((s) => s.ref === r.toRef)
      if (!from || !to) {
        errors.push({ ref: r.ref, field: 'endpoints', message: 'У связи не найдены концы' })
      } else if (r.fromRef === r.toRef) {
        errors.push({ ref: r.ref, field: 'endpoints', message: 'Источник и приёмник совпадают' })
      }
      const needsFlow = r.statusCode && r.statusCode !== 'ADR_INCR_REL_CREATING'
      if (needsFlow && !r.flowId) {
        errors.push({
          ref: r.ref,
          field: 'flowId',
          message: 'Для этого статуса выберите существующий поток реестра',
        })
      }
    }
    return errors
  }

  /** Состав решения в контракте `increments[]` (issue #74). */
  function buildIncrementPayload() {
    const systems = state.systems.map((s) => {
      const out = {
        increment_status_code: s.statusCode || undefined,
        comment: '',
        functions: (s.functions || []).map((f) => (f.id != null
          ? {
            ar_system_functions_id: f.id,
            name: f.name,
            increment_sysfunc_status_code: f.statusCode || undefined,
          }
          : {
            kind: 'new',
            name: f.name,
            increment_sysfunc_status_code: f.statusCode || undefined,
          })),
      }
      if (s.kind === 'new') {
        out.kind = 'new'
        out.local_key = s.ref
        out.code = s.code || ''
        out.name = s.label || ''
      } else {
        out.ar_systems_id = Number(s.id)
      }
      return out
    })

    const relations = state.relations.map((r) => {
      const from = state.systems.find((s) => s.ref === r.fromRef)
      const to = state.systems.find((s) => s.ref === r.toRef)
      const out = {
        local_key: r.ref,
        increment_relation_status_code: r.statusCode || undefined,
        transferred_data: r.label || '',
        ar_integration_flows_id: r.flowId ? Number(r.flowId) : undefined,
      }
      if (from && from.kind === 'new') out.from_new_key = from.ref
      else if (from) out.from_ar_systems_id = Number(from.id)
      if (to && to.kind === 'new') out.to_new_key = to.ref
      else if (to) out.to_ar_systems_id = Number(to.id)
      return out
    })

    return {
      order_index: orderIndex != null ? orderIndex : 1,
      name: incrementName || '',
      systems,
      relations,
    }
  }

  // --- сохранение ----------------------------------------------------------------

  /** Карта «черновой id ячейки → реальный» по ответу `PUT /full`. */
  function buildRemapMap(response) {
    const map = new Map()
    for (const row of (response && response.systems) || []) {
      if (row.local_key && row.id != null) map.set(row.local_key, dm.systemCellId({ id: row.id }))
    }
    for (const row of (response && response.relations) || []) {
      if (row.local_key && row.id != null) map.set(row.local_key, dm.relationCellId({ id: row.id }))
    }
    return map
  }

  /** Последняя по номеру версии схема решения. */
  function latestDiagram(rows) {
    const list = Array.isArray(rows) ? [...rows] : []
    list.sort((a, b) => (Number(b.version_no) || 0) - (Number(a.version_no) || 0))
    return list[0] || null
  }

  /**
   * «Сохранить»: состав → одна транзакция ядра → перекодирование id → `.drawio`.
   * @param {{xml?:string}} [opts] xml — то, что сейчас на холсте (для сверки и раскладки)
   */
  async function save(opts = {}) {
    const canvasXml = opts.xml || toMxfile()
    if (canvasXml) reconcile(canvasXml)

    const errors = validate()
    if (errors.length) {
      const err = new Error('Модель содержит ошибки')
      err.errors = errors
      throw err
    }

    const incId = currentIncrementId.value
    if (appliedId == null || incId == null) {
      throw new Error('Состав сохраняется по сохранённому заключению: сначала сохраните заключение.')
    }

    state.saving = true
    try {
      const response = await api.updateDecisionAppliedFull(appliedId, {
        increments: [buildIncrementPayload()],
        // Пересоздаётся только своё решение — остальные решения заключения не трогаем.
        increments_mode: 'merge',
        increment_id: incId,
      })

      const newIncId = (response && response.increment_id) || incId
      const mapping = buildRemapMap(response)
      const finalXml = canvasXml ? dm.remapCellIds(canvasXml, mapping) : null

      let diagramId = null
      if (finalXml) {
        // Строки схем при пересоздании решения пересоздаются — берём актуальную версию.
        const rows = await api.getIncrementDiagrams(newIncId).catch(() => [])
        const existing = latestDiagram(rows)
        const saved = existing
          ? await api.putIncrementDiagram(newIncId, existing.id, { mxfile: finalXml })
          : await api.createIncrementDiagram(newIncId, { mxfile: finalXml })
        diagramId = (existing && existing.id) || (saved && saved.id) || null
      }

      state.incrementId = newIncId
      await loadComposition(newIncId)
      return { incrementId: newIncId, diagramId, xml: finalXml, response }
    } finally {
      state.saving = false
    }
  }

  return {
    state,
    currentIncrementId,
    load,
    loadCatalogs,
    loadComposition,
    addExistingSystem,
    addNewSystem,
    setFunctions,
    addRelation,
    setStatus,
    update,
    find,
    remove,
    toModel,
    toMxfile,
    reconcile,
    validate,
    buildIncrementPayload,
    save,
  }
}

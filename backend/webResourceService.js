/**
 * Сервис веб-ресурсов — общий для HTTP API и сервисного импорта (issue #64).
 * @param {import('pg').Pool|import('pg').PoolClient} db
 * @param {{ getParam: Function, queries: object }} deps
 */
function createWebResourceService(db, deps) {
  const { getParam, queries } = deps;

  async function assertSystemId(systemId) {
    const r = await db.query(queries.web_resources_system_check, [systemId]);
    if (r.rowCount === 0) {
      const err = new Error('Указанная информационная система или модуль не найдены.');
      err.status = 400;
      throw err;
    }
  }

  function validateRequired(b) {
    if (!b.short_name) {
      const err = new Error('short_name required');
      err.status = 400;
      throw err;
    }
    if (!b.ar_systems_id) {
      const err = new Error('ar_systems_id required');
      err.status = 400;
      throw err;
    }
    if (!b.ar_web_resource_statuses_id) {
      const err = new Error('ar_web_resource_statuses_id required');
      err.status = 400;
      throw err;
    }
    if (!b.ar_web_resource_categories_id) {
      const err = new Error('ar_web_resource_categories_id required');
      err.status = 400;
      throw err;
    }
    if (!b.ar_web_resource_stage_types_id) {
      const err = new Error('ar_web_resource_stage_types_id required');
      err.status = 400;
      throw err;
    }
  }

  async function create(body) {
    const b = body || {};
    validateRequired(b);
    await assertSystemId(b.ar_systems_id);
    const wrPrefix = getParam('WR_CODE_PREFIX', 'WR-') || 'WR-';
    const r = await db.query(queries.web_resources_insert, [
      wrPrefix,
      b.short_name,
      b.purpose || '',
      b.publication_url || '',
      b.ar_systems_id,
      b.publication_request_number || '',
      b.publication_date || '',
      b.ar_web_resource_statuses_id,
      b.ar_web_resource_categories_id,
      b.ar_web_resource_stage_types_id,
    ]);
    return r.rows[0];
  }

  async function update(id, body) {
    const b = body || {};
    validateRequired(b);
    await assertSystemId(b.ar_systems_id);
    const r = await db.query(queries.web_resources_update, [
      b.short_name,
      b.purpose || '',
      b.publication_url || '',
      b.ar_systems_id,
      b.publication_request_number || '',
      b.publication_date || '',
      b.ar_web_resource_statuses_id,
      b.ar_web_resource_categories_id,
      b.ar_web_resource_stage_types_id,
      id,
    ]);
    if (r.rowCount === 0) {
      const err = new Error('Not found');
      err.status = 404;
      throw err;
    }
    return r.rows[0];
  }

  async function getById(id) {
    const r = await db.query(queries.web_resources_get, [id]);
    return r.rows[0] || null;
  }

  async function getByCode(code) {
    const r = await db.query(queries.web_resources_get_by_code, [code]);
    return r.rows[0] || null;
  }

  return { create, update, getById, getByCode, assertSystemId, validateRequired };
}

module.exports = { createWebResourceService };

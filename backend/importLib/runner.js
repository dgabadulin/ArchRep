const XLSX = require('xlsx');
const { parseWorkbookBuffer } = require('./excel');

/**
 * Generic import runner.
 *
 * Adapter contract:
 * - catalog
 * - matchMode: 'auto_code' | 'manual_code' | 'name'
 * - matchField: 'code' | 'name' | ...
 * - loadRefs(db, queries) -> refs
 * - findExisting(db, queries, key) -> row|null
 * - create(db, { getParam, queries }, fields, refs) -> { outFieldsPatch? }
 * - update(db, { getParam, queries }, existing, fields, refs) -> void
 * - validateCreateRequired?(fields, catalog)
 */
async function runEntityImport(adapter, opts) {
  const {
    buffer,
    apply,
    onExists = 'update',
    protocolMode = 'all',
    pool,
    queries,
    getParam,
  } = opts;

  const catalog = adapter.catalog;
  const parsed = parseWorkbookBuffer(catalog, buffer);
  if (parsed.meta.entity && parsed.meta.entity !== catalog.ENTITY_CODE) {
    const err = new Error(`Неверная сущность шаблона: ${parsed.meta.entity}`);
    err.status = 400;
    throw err;
  }
  if (
    parsed.meta.template_version != null &&
    Number(parsed.meta.template_version) !== catalog.TEMPLATE_VERSION
  ) {
    const err = new Error(
      `Несовместимая template_version=${parsed.meta.template_version}, ожидается ${catalog.TEMPLATE_VERSION}`
    );
    err.status = 400;
    throw err;
  }

  const matchField = adapter.matchField || 'code';
  const matchMode = adapter.matchMode || 'auto_code';

  const keyCounts = new Map();
  for (const row of parsed.rows) {
    const k = (row.fields[matchField] || '').trim();
    if (!k) continue;
    keyCounts.set(k, (keyCounts.get(k) || 0) + 1);
  }

  const client = await pool.connect();
  const summary = { created: 0, updated: 0, skipped: 0, errors: 0, would_create: 0, would_update: 0 };
  const protocolRows = [];
  const ctx = { getParam, queries };

  try {
    await client.query('BEGIN');
    const refs = await adapter.loadRefs(client, queries);

    for (const row of parsed.rows) {
      const f = row.fields;
      const key = (f[matchField] || '').trim();
      let status = '';
      let error = '';
      let outFields = { ...f };

      await client.query('SAVEPOINT sp_import_row');
      try {
        if (key && keyCounts.get(key) > 1) {
          throw Object.assign(new Error(`Дубль ${matchField} «${key}» в файле`), { status: 400 });
        }

        let existing = null;
        if (key) {
          existing = await adapter.findExisting(client, queries, key);
        }

        if (matchMode === 'auto_code') {
          if (key && !existing) {
            throw Object.assign(
              new Error(`Код не найден: «${key}». Для создания оставьте ${matchField} пустым.`),
              { status: 400 }
            );
          }
        } else if (matchMode === 'manual_code') {
          if (!key) {
            throw Object.assign(new Error(`Поле ${matchField} обязательно (создание и обновление)`), {
              status: 400,
            });
          }
        } else if (matchMode === 'name') {
          if (!key) {
            throw Object.assign(new Error(`Поле ${matchField} обязательно`), { status: 400 });
          }
        }

        if (existing) {
          if (onExists === 'skip') {
            status = apply ? 'skipped' : 'would_skip';
            summary.skipped += 1;
          } else if (onExists === 'fail') {
            throw Object.assign(new Error(`Запись с ${matchField} «${key}» уже существует`), {
              status: 400,
            });
          } else {
            await adapter.update(client, ctx, existing, f, refs);
            status = apply ? 'updated' : 'would_update';
            if (apply) summary.updated += 1;
            else summary.would_update += 1;
          }
        } else {
          if (typeof adapter.validateCreateRequired === 'function') {
            adapter.validateCreateRequired(f, catalog);
          } else {
            for (const def of catalog.leftFields()) {
              if (def.required && def.field !== matchField && !(f[def.field] || '').trim()) {
                throw Object.assign(new Error(`Обязательное поле пусто: ${def.label}`), { status: 400 });
              }
            }
          }
          const created = await adapter.create(client, ctx, f, refs);
          if (created && created.outFieldsPatch) {
            outFields = { ...outFields, ...created.outFieldsPatch };
          }
          status = apply ? 'created' : 'would_create';
          if (apply) summary.created += 1;
          else summary.would_create += 1;
        }
        await client.query('RELEASE SAVEPOINT sp_import_row');
      } catch (e) {
        try {
          await client.query('ROLLBACK TO SAVEPOINT sp_import_row');
        } catch (_) { /* ignore */ }
        status = 'error';
        error = e.message || String(e);
        summary.errors += 1;
      }

      const include =
        protocolMode !== 'errors' || status === 'error' || status === 'skipped' || status === 'would_skip';
      if (include) {
        const proto = {};
        for (const def of catalog.orderedFields()) {
          proto[catalog.headerFor(def)] = outFields[def.field] != null ? outFields[def.field] : '';
        }
        proto.row_no = row.row_no;
        proto.import_status = status;
        proto.import_error = error;
        protocolRows.push(proto);
      }
    }

    if (apply) await client.query('COMMIT');
    else await client.query('ROLLBACK');
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch (_) { /* ignore */ }
    throw e;
  } finally {
    client.release();
  }

  const ws = XLSX.utils.json_to_sheet(protocolRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Протокол');
  const protocolBuffer = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

  return { summary, protocolBuffer, protocolRows };
}

async function buildEntityWorkbook(adapter, pool, queries, dataRows) {
  const { buildWorkbookBuffer } = require('./excel');
  const refs = await adapter.loadRefSheetData(pool, queries);
  return buildWorkbookBuffer(adapter.catalog, {
    dataRows: dataRows || [],
    fieldValueFromRow: adapter.fieldValueFromRow,
    refSheets: refs,
  });
}

module.exports = { runEntityImport, buildEntityWorkbook };

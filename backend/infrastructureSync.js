'use strict';

/**
 * Синхронизация каталога инфраструктуры из Netbox.
 *
 * Идемпотентная операция для Job Runner: upsert по естественному ключу
 * (source, type_id, external_id) + mark-and-sweep по synced_at.
 * Полная очистка реестра не выполняется; при ошибке чтения удалений нет.
 * Связи «ИС → сервер» пересобираются по тегам IS:<код> в той же транзакции вида.
 *
 * @see docs/infrastructure-registry-netbox.md
 */

const {
  loadNetboxConfig,
  enabledKinds,
  fetchNetboxObjects,
  buildNetboxItem,
} = require('./netboxClient');

const SOURCE = 'netbox';

function buildMessage(summary) {
  const parts = [
    `Netbox: ВМ ${summary.vms_fetched}, серверов ${summary.devices_fetched}`,
    `создано ${summary.created}`,
    `обновлено ${summary.updated}`,
    `удалено ${summary.deleted}`,
    `связей ${summary.relations_synced}`,
  ];
  if (summary.unmatched_codes.length) {
    const shown = summary.unmatched_codes.slice(0, 5).join(', ');
    const rest = summary.unmatched_codes.length > 5 ? ` и ещё ${summary.unmatched_codes.length - 5}` : '';
    parts.push(`ИС не найдены: ${shown}${rest}`);
  }
  return parts.join('; ');
}

/**
 * @param {import('pg').Pool} pool
 * @param {{ queries?: object, log?: (message: string) => void }} [deps]
 */
async function syncInfrastructureFromNetbox(pool, deps = {}) {
  const queries = deps.queries || require('./queries');
  const log = typeof deps.log === 'function' ? deps.log : () => {};
  const cfg = loadNetboxConfig();
  const runTs = new Date().toISOString();

  const typeRows = (await pool.query(queries.infrastructure_object_types_select)).rows || [];
  const typeByCode = new Map(typeRows.map((row) => [row.code, row]));
  const systemRows = (await pool.query(queries.infrastructure_systems_map_select)).rows || [];

  const systemByCode = new Map();
  for (const system of systemRows) {
    const key = String(system.code || '').trim().toLowerCase();
    if (!key) continue;
    if (systemByCode.has(key)) {
      log(`Дубликат кода ИС без учёта регистра: ${system.code} (id=${system.id})`);
      continue;
    }
    systemByCode.set(key, system);
  }

  const summary = {
    source: SOURCE,
    tag_prefix: cfg.tagPrefix,
    vms_fetched: 0,
    devices_fetched: 0,
    created: 0,
    updated: 0,
    deleted: 0,
    relations_synced: 0,
    unmatched_codes: [],
  };
  const unmatched = new Set();

  for (const kind of enabledKinds(cfg)) {
    const type = typeByCode.get(kind);
    if (!type) {
      log(`Тип «${kind}» не найден в справочнике ar_infrastructure_object_types — вид пропущен`);
      continue;
    }

    // Чтение вне транзакции: при ошибке НИЧЕГО не удаляем и не меняем.
    const rawItems = await fetchNetboxObjects(kind, cfg);
    if (kind === 'virtual_server') summary.vms_fetched = rawItems.length;
    else summary.devices_fetched = rawItems.length;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const raw of rawItems) {
        const item = buildNetboxItem(kind, raw, cfg);
        if (!Number.isFinite(item.external_id)) continue;

        const systems = [];
        for (const code of item.tag_codes) {
          const system = systemByCode.get(code.toLowerCase());
          if (!system) {
            unmatched.add(code);
            continue;
          }
          if (!systems.some((s) => Number(s.id) === Number(system.id))) systems.push(system);
        }

        const upsert = await client.query(queries.infrastructure_objects_upsert, [
          SOURCE,
          item.external_id,
          type.id,
          item.name,
          item.description,
          item.primary_ip,
          item.status,
          item.site,
          item.cluster,
          item.platform,
          item.tenant,
          item.vcpus,
          item.memory_gb,
          item.disk_gb,
          item.netbox_updated_at,
          runTs,
          JSON.stringify(item.payload),
        ]);
        const saved = upsert.rows[0];
        if (!saved) continue;
        if (saved.inserted) summary.created += 1;
        else summary.updated += 1;

        await client.query(queries.metamodel_relations_delete_infrastructure_object, [saved.id]);

        if (!systems.length) continue;

        for (const system of systems) {
          const isModule = system.parent_ar_systems_id != null;
          const fromType = isModule ? 'subsystem' : 'system';
          const relationType = isModule ? 'subsystem_infrastructure' : 'system_infrastructure';
          await client.query(queries.metamodel_relations_insert, [
            fromType,
            system.id,
            'infrastructure_object',
            saved.id,
            relationType,
            '',
            '',
            JSON.stringify({
              source: SOURCE,
              kind,
              external_id: item.external_id,
              tag_code: system.code,
            }),
            null,
            item.external_id,
          ]);
          summary.relations_synced += 1;
        }
      }

      const removed = await client.query(queries.infrastructure_objects_delete_stale, [
        SOURCE,
        type.id,
        runTs,
      ]);
      summary.deleted += removed.rowCount || 0;

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  summary.unmatched_codes = [...unmatched]
    .sort((a, b) => a.localeCompare(b, 'ru'))
    .slice(0, 50);
  summary.message = buildMessage(summary);
  log(summary.message);

  return summary;
}

module.exports = { syncInfrastructureFromNetbox };

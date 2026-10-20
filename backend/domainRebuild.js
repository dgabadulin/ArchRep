/**
 * Разовое наполнение реестра доменов из веб-ресурсов (#67).
 * @param {import('pg').Pool|import('pg').PoolClient} db
 * @param {{ queries: object }} deps
 */
const { extractDomainNameFromUrl, findDomainRowByName, normalizeDomainName } = require('./domainFromUrl');

async function rebuildDomainsFromWebResources(db, deps) {
  const { queries } = deps;
  const statusR = await db.query(queries.domain_statuses_get_by_code, ['delegated']);
  if (statusR.rowCount === 0) {
    const err = new Error('Статус домена «delegated» не найден. Выполните миграцию реестра доменов.');
    err.status = 500;
    throw err;
  }
  const delegatedStatusId = statusR.rows[0].id;

  const wrR = await db.query(queries.web_resources_select_urls_for_domain_rebuild);
  const summary = {
    scanned: wrR.rowCount,
    domains_created: 0,
    domains_existing: 0,
    fk_set: 0,
    fk_skipped_already_set: 0,
    conflicts: [],
    skipped_no_domain: 0,
  };

  for (const row of wrR.rows) {
    const extracted = extractDomainNameFromUrl(row.publication_url);
    if (!extracted) {
      summary.skipped_no_domain += 1;
      continue;
    }

    let domainId = null;
    const existing = await findDomainRowByName(db, queries, extracted);
    if (existing) {
      domainId = existing.id;
      summary.domains_existing += 1;
    } else {
      const ins = await db.query(queries.domains_insert, [
        extracted,
        '',
        '',
        '',
        delegatedStatusId,
        '',
        '',
        '',
      ]);
      domainId = ins.rows[0].id;
      summary.domains_created += 1;
    }

    if (row.ar_domains_id == null) {
      await db.query(queries.web_resources_set_domain_id, [row.id, domainId]);
      summary.fk_set += 1;
    } else if (Number(row.ar_domains_id) === Number(domainId)) {
      summary.fk_skipped_already_set += 1;
    } else {
      const cur = await db.query(queries.domains_get, [row.ar_domains_id]);
      const curName = cur.rows[0] ? cur.rows[0].name : String(row.ar_domains_id);
      summary.conflicts.push({
        web_resource_id: row.id,
        publication_url: row.publication_url,
        expected_domain: extracted,
        current_domain: curName,
      });
      summary.fk_skipped_already_set += 1;
    }
  }

  return summary;
}

module.exports = { rebuildDomainsFromWebResources };

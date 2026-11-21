/**
 * Преобразование данных дашборда «Целевая архитектура: матрица»
 * в строки бизнес-функций, колонки продуктов и ячейки с системами.
 *
 * Источник — только данные ИСАР (`/api/dashboard/target-architecture-matrix`),
 * без temp-файлов и внешних выгрузок.
 */

const asKey = (value) => String(value);

function normalized(value) {
  return String(value || '').trim().toLowerCase();
}

export function statusTone(system) {
  if (system?.tone) return system.tone;
  const value = normalized(system?.status);
  if (!value) return 'neutral';
  if (/вывод|выведен|архив/.test(value)) return 'neutral';
  if (/промышленн|опытн/.test(value)) return 'green';
  if (/планир|внедр|нов(ая|ое|ые|ых|ую|ой|ый|ого|ому)|проектир|разработ/.test(value)) return 'orange';
  return 'neutral';
}

/**
 * @param {object} data — ответ `/api/dashboard/target-architecture-matrix`
 * @returns {{products: object[], groups: object[], rowCount: number}}
 */
export function buildTargetArchitectureGroups(data) {
  // Порядок колонок задаёт backend: параметр ARR_TARGET_MATRIX_ORDER,
  // иначе — порядок реестра бизнес-сервисов.
  const products = [...(data?.products || [])];
  const systemsById = new Map((data?.systems || []).map((system) => [asKey(system.id), system]));

  const functionSystems = new Map();
  for (const relation of data?.functionRelations || []) {
    const functionId = asKey(relation.function_id);
    if (!functionSystems.has(functionId)) functionSystems.set(functionId, new Set());
    functionSystems.get(functionId).add(asKey(relation.system_id));
  }

  const productSystems = new Map();
  for (const relation of data?.productRelations || []) {
    const productId = asKey(relation.business_service_id);
    if (!productSystems.has(productId)) productSystems.set(productId, new Set());
    productSystems.get(productId).add(asKey(relation.system_id));
  }

  const groups = [];
  const groupsByKey = new Map();

  for (const fn of data?.functions || []) {
    const groupKey = fn.parent_id == null ? 'root' : asKey(fn.parent_id);
    let group = groupsByKey.get(groupKey);
    if (!group) {
      group = {
        key: groupKey,
        name: fn.parent_name || 'Без родительской функции',
        rows: [],
      };
      groupsByKey.set(groupKey, group);
      groups.push(group);
    }

    const fnSystems = functionSystems.get(asKey(fn.id)) || new Set();
    const cells = products.map((product) => {
      const systems = [];
      const prSystems = productSystems.get(asKey(product.id)) || new Set();
      for (const systemId of fnSystems) {
        if (!prSystems.has(systemId)) continue;
        const system = systemsById.get(systemId);
        if (system) systems.push({ ...system, tone: statusTone(system) });
      }
      const toneRank = { green: 0, orange: 1, neutral: 2 };
      systems.sort((a, b) => {
        const toneDiff = (toneRank[a.tone] ?? 2) - (toneRank[b.tone] ?? 2);
        if (toneDiff !== 0) return toneDiff;
        return String(a.name || '').localeCompare(String(b.name || ''), 'ru');
      });
      return { productId: product.id, systems };
    });

    group.rows.push({
      id: fn.id,
      name: fn.name || `#${fn.id}`,
      cells,
    });
  }

  for (const group of groups) {
    group.rows.sort((a, b) => String(a.name).localeCompare(String(b.name), 'ru'));
  }

  return {
    products,
    groups,
    rowCount: groups.reduce((sum, group) => sum + group.rows.length, 0),
  };
}

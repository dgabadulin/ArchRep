/**
 * Значения по умолчанию и merge для DRAWIO_NODE_STYLE / DRAWIO_EDGE_STYLE / DRAWIO_LAYOUT_STYLE (issue #53).
 * Источник: docs/drawio-increment-diagram-parameters.md
 * Сид в БД (те же JSON): DB/scripts/migrate_issue53_drawio_settings_parameters.sql
 */

const DEFAULT_DRAWIO_NODE_STYLE = {
  nodeStatusColor: {
    ADR_INCR_SYS_IN_USE: '#C8E6C9',
    ADR_INCR_SYS_CREATING: '#FFF9C4',
    ADR_INCR_SYS_MODIFYING: '#FFCCBC',
    ADR_INCR_SYS_DECOMMISSIONING: '#ECEFF1',
    ADR_INCR_SYS_OTHER_SOLUTION: '#BBDEFB',
  },
  nodeStatusStroke: {},
  titleFontSize: 14,
  titleBold: true,
  bodyFontSize: 11,
  bodyLineHeight: 1.25,
  paddingH: 12,
  paddingV: 10,
  minWidth: 140,
  minHeight: 72,
  maxTextWidth: 280,
  cornerRadius: 8,
  gridStep: 8,
};

const DEFAULT_DRAWIO_EDGE_STYLE = {
  edgeStatusColor: {
    ADR_INCR_REL_CREATING: '#5C6BC0',
    ADR_INCR_REL_MODIFYING: '#F57C00',
    ADR_INCR_REL_IN_USE: '#212121',
    ADR_INCR_REL_REMOVING: '#C62828',
  },
  labelFontSize: 10,
  labelOffsetAbove: 8,
  labelOffsetLeft: 8,
  onlineLineStyle: { dashed: false, strokeWidth: 2 },
  offlineLineStyle: { dashed: true, dashPattern: '8 4', strokeWidth: 2 },
};

const DEFAULT_DRAWIO_LAYOUT_STYLE = {
  algorithm: 'layered_orthogonal',
  direction: 'LR',
  margin: 40,
  rankSep: 80,
  nodeSep: 40,
  edgeLabelReserveH: 24,
  edgeLabelReserveV: 20,
  parallelEdgeGap: 12,
};

function isPlainObject(x) {
  return x != null && typeof x === 'object' && !Array.isArray(x);
}

function mergeDeep(base, override) {
  if (!isPlainObject(override)) return base;
  const out = { ...base };
  for (const k of Object.keys(override)) {
    const v = override[k];
    if (isPlainObject(v) && isPlainObject(out[k])) out[k] = mergeDeep(out[k], v);
    else if (v !== undefined) out[k] = v;
  }
  return out;
}

/**
 * @param {(code: string, def: any) => any} getParam — как в settingsParams
 */
function resolveDrawioStyles(getParam) {
  const nodeRaw = getParam('DRAWIO_NODE_STYLE', null);
  const edgeRaw = getParam('DRAWIO_EDGE_STYLE', null);
  const layoutRaw = getParam('DRAWIO_LAYOUT_STYLE', null);
  return {
    node: mergeDeep(DEFAULT_DRAWIO_NODE_STYLE, isPlainObject(nodeRaw) ? nodeRaw : {}),
    edge: mergeDeep(DEFAULT_DRAWIO_EDGE_STYLE, isPlainObject(edgeRaw) ? edgeRaw : {}),
    layout: mergeDeep(DEFAULT_DRAWIO_LAYOUT_STYLE, isPlainObject(layoutRaw) ? layoutRaw : {}),
  };
}

module.exports = {
  DEFAULT_DRAWIO_NODE_STYLE,
  DEFAULT_DRAWIO_EDGE_STYLE,
  DEFAULT_DRAWIO_LAYOUT_STYLE,
  mergeDeep,
  resolveDrawioStyles,
};

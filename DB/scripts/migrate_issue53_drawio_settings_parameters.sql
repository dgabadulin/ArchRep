-- Issue #53: параметры DRAWIO_NODE_STYLE / DRAWIO_EDGE_STYLE / DRAWIO_LAYOUT_STYLE в archrep.ar_settings_parameters.
-- Значения совпадают с backend/drawioStyles.js и docs/drawio-increment-diagram-parameters.md; при смене дефолтов в коде — обновить и скрипт.
-- Идемпотентно (INSERT только если кода ещё нет). После выполнения — перезапуск backend (кэш параметров).
-- psql -h ... -U ... -d ... -f DB/scripts/migrate_issue53_drawio_settings_parameters.sql

BEGIN;

INSERT INTO archrep.ar_settings_parameters (code, description, value, value_type, "group", is_secret, read_only)
SELECT
  'DRAWIO_NODE_STYLE',
  'JSON: стили узлов (систем) на схеме инкремента в draw.io — цвета по статусу, типографика, отступы, сетка (issue #53).',
  '{"nodeStatusColor":{"ADR_INCR_SYS_IN_USE":"#C8E6C9","ADR_INCR_SYS_CREATING":"#FFF9C4","ADR_INCR_SYS_MODIFYING":"#FFCCBC","ADR_INCR_SYS_DECOMMISSIONING":"#ECEFF1","ADR_INCR_SYS_OTHER_SOLUTION":"#BBDEFB"},"nodeStatusStroke":{},"titleFontSize":14,"titleBold":true,"bodyFontSize":11,"bodyLineHeight":1.25,"paddingH":12,"paddingV":10,"minWidth":140,"minHeight":72,"maxTextWidth":280,"cornerRadius":8,"gridStep":8}',
  'json',
  'Draw.io',
  false,
  false
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_settings_parameters WHERE code = 'DRAWIO_NODE_STYLE');

INSERT INTO archrep.ar_settings_parameters (code, description, value, value_type, "group", is_secret, read_only)
SELECT
  'DRAWIO_EDGE_STYLE',
  'JSON: стили рёбер (интеграций) на схеме инкремента — цвет по статусу связи, подпись, online/offline (issue #53).',
  '{"edgeStatusColor":{"ADR_INCR_REL_CREATING":"#5C6BC0","ADR_INCR_REL_MODIFYING":"#F57C00","ADR_INCR_REL_IN_USE":"#212121","ADR_INCR_REL_REMOVING":"#C62828"},"labelFontSize":10,"labelOffsetAbove":8,"labelOffsetLeft":8,"onlineLineStyle":{"dashed":false,"strokeWidth":2},"offlineLineStyle":{"dashed":true,"dashPattern":"8 4","strokeWidth":2}}',
  'json',
  'Draw.io',
  false,
  false
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_settings_parameters WHERE code = 'DRAWIO_EDGE_STYLE');

INSERT INTO archrep.ar_settings_parameters (code, description, value, value_type, "group", is_secret, read_only)
SELECT
  'DRAWIO_LAYOUT_STYLE',
  'JSON: раскладка схемы инкремента — поля, зазоры, резерв под подписи, разводка параллельных рёбер (issue #53).',
  '{"algorithm":"layered_orthogonal","direction":"LR","margin":40,"rankSep":80,"nodeSep":40,"edgeLabelReserveH":24,"edgeLabelReserveV":20,"parallelEdgeGap":12}',
  'json',
  'Draw.io',
  false,
  false
WHERE NOT EXISTS (SELECT 1 FROM archrep.ar_settings_parameters WHERE code = 'DRAWIO_LAYOUT_STYLE');

COMMIT;

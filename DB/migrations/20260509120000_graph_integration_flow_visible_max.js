/* eslint-disable camelcase */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    INSERT INTO archrep.ar_settings_parameters (code, description, value, value_type, "group", is_secret, read_only)
    VALUES (
      'GRAPH_INTEGRATION_FLOW_VISIBLE_MAX',
      'Максимум отдельных стрелок интеграционных потоков на графе анализатора для одной пары узлов и направления (from → to). При большем числе потоков показывается одна свёрнутая стрелка; детали — в контекстном меню «Список потоков».',
      '10',
      'number',
      'Граф/Аналитика',
      false,
      false
    )
    ON CONFLICT (code) DO UPDATE SET
      description = EXCLUDED.description,
      value_type = EXCLUDED.value_type,
      "group" = EXCLUDED."group";
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DELETE FROM archrep.ar_settings_parameters
    WHERE code = 'GRAPH_INTEGRATION_FLOW_VISIBLE_MAX';
  `);
};

/* eslint-disable camelcase */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    INSERT INTO archrep.ar_settings_parameters (code, description, value, value_type, "group", is_secret, read_only)
    VALUES (
      'TECH_RADAR_EMBED_URL',
      'Полный URL iframe страницы «Тех.радар» (внешний сервис; documentId и др. в query). Значение задаётся только здесь или через env TECH_RADAR_EMBED_URL.',
      null,
      'string',
      'Технологии',
      false,
      false
    )
    ON CONFLICT (code) DO NOTHING;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DELETE FROM archrep.ar_settings_parameters
    WHERE code = 'TECH_RADAR_EMBED_URL';
  `);
};

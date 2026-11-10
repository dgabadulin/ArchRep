# Changelog

Все заметные изменения ядра ИСАР фиксируются здесь. Формат — [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/),
версии — [SemVer](https://semver.org/lang/ru/). Разделы и версии формирует **Release Please**
из conventional commits (`feat`, `fix`, `feat!`, `BREAKING CHANGE`).

**Формулировки пунктов = `subject`-ы коммитов**, и они согласуются с владельцем продукта **до** коммита
(`.clinerules` §1 п.4): что согласовали — то и попадает в CHANGELOG и в release notes. Правка пункта
в теле GitHub Release вместо `subject` не практикуется; в теле релиза допускается только **дополнение**
(«Что сделать администратору», пояснения). Ручная правка `CHANGELOG.md` — только в релизном PR по просьбе
владельца (после последнего прогона Release Please и сразу мерж).

## [4.4.0](https://github.com/dgabadulin/ArchRep/compare/v4.3.0...v4.4.0) (2026-11-10)


### Новое

* **core:** палитра диаграмм, вложения в чат ИИ и адрес draw.io ([#1](https://github.com/dgabadulin/ArchRep/issues/1), [#95](https://github.com/dgabadulin/ArchRep/issues/95)) ([62e58a5](https://github.com/dgabadulin/ArchRep/commit/62e58a5e65ed02bc8f2001dd73c2f7ef94cc7035))


### Исправлено

* **deploy:** секреты demo-стенда вне git и проверка пароля БД до сборки ([611b865](https://github.com/dgabadulin/ArchRep/commit/611b8651042c7a4473e9f70fd0ea4005b94cc898))
* **frontend:** добавленная технология на графе стека связана с ИС, а не с фантомным узлом ([e39f0e3](https://github.com/dgabadulin/ArchRep/commit/e39f0e340d04c63d8864350012f3967bc22c33e8))

## [4.3.0](https://github.com/dgabadulin/ArchRep/compare/v4.2.0...v4.3.0) (2026-11-06)


### Новое

* **frontend:** «Сохранить и закрыть» закрывает форму во всех реестрах ([#111](https://github.com/dgabadulin/ArchRep/issues/111)) ([8c210ec](https://github.com/dgabadulin/ArchRep/commit/8c210eccd2f986793b046de951d587772cca10c2))

## [4.2.0](https://github.com/dgabadulin/ArchRep/compare/v4.1.0...v4.2.0) (2026-11-06)


### Новое

* **deploy:** адрес стенда и подсказка про ssh-туннель в итоге деплоя ([54a08d2](https://github.com/dgabadulin/ArchRep/commit/54a08d2fa17794157a932b34d64dc474c5cea16e))
* **frontend:** одна кнопка сохраняет форму вместе с вкладками ([#94](https://github.com/dgabadulin/ArchRep/issues/94)) ([8544060](https://github.com/dgabadulin/ArchRep/commit/85440609e082a81951e902ca7c787593e140aaaa))


### Исправлено

* **deploy:** dirty-деплой на теге не отклоняется из-за суффикса версии ([0961d72](https://github.com/dgabadulin/ArchRep/commit/0961d72fb77fb5c8f4875fd46f0f06827c4a084b))

## [4.1.0](https://github.com/dgabadulin/ArchRep/compare/v4.0.1...v4.1.0) (2026-11-06)


### Новое

* **deploy:** гейт с режимами ahead/dirty и состояние деплоя в /api/version и «О системе» ([a5957fe](https://github.com/dgabadulin/ArchRep/commit/a5957fe52ae342994255053d19f1ca06e4c51fc4))

## [4.0.1](https://github.com/dgabadulin/ArchRep/compare/v4.0.0...v4.0.1) (2026-11-05)


### Служебное

* release 4.0.1 ([2a235e5](https://github.com/dgabadulin/ArchRep/commit/2a235e57535bcc33b0d65194f8c8068261ca4fa1))

## [4.0.0](https://github.com/dgabadulin/ArchRep/compare/v3.1.0...v4.0.0) (2026-11-05)


### ⚠ BREAKING CHANGES

* **modules:** удалены маршруты /api/drawio-pro/* (manifest, parse, validate, payload), секции modules в /api/config и /api/version, переменные ENABLED_MODULES, SYS_MODULE_*, SYS_INSTANCE_ID, SYS_INSTALL_REF, MODULES_DIR и таблица archrep.isar_modules. Администратору: применить DB/scripts/migrate_20261106120000_drop_isar_modules.sql (prod — вручную), убрать модульные переменные из env и каталог modules/ (пакет @isar/drawio-pro).

### Новое

* **modules:** единое ядро — удалён модульный слой (код, БД, фронт, документация) ([ee8baf2](https://github.com/dgabadulin/ArchRep/commit/ee8baf2d152638fe3164f8672287ec65ca2776dc))

## [3.1.0](https://github.com/dgabadulin/ArchRep/compare/v3.0.1...v3.1.0) (2026-11-04)


### Новое

* **modules:** ключи лицензий v1 и метаданные лицензии в реестре ([05a66fb](https://github.com/dgabadulin/ArchRep/commit/05a66fb30208edda3cdbc1b8598c66be0a2380d6))


### Исправлено

* **modules:** метаданные лицензии не попадали в реестр (дубль функции) ([e497dab](https://github.com/dgabadulin/ArchRep/commit/e497dab0f9e1f7ded4d13178f7d904b302f5fc92))

## 3.0.1

Первый публичный релиз линейки 3.x:

- метамодель TOGAF: реестры объектов учёта и связи между ними (`ar_metamodel_*`);
- архитектурные заключения (ADR Applied) с решениями, системами, функциями и интеграциями;
- RBAC: роли, права, deny-by-default на маршрутах;
- ИИ-архитектор (issue #78) и панель чата;
- инфраструктура подключаемых модулей (MVP): `registerModules`, реестр `isar_modules`,
  лицензионный гейт, точки расширения UI — подключён модуль DrawIO Pro;
- версия продукта и состояние схемы БД: `GET /api/version`, страница «О системе».

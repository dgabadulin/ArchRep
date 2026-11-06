# Changelog

Все заметные изменения ядра ИСАР фиксируются здесь. Формат — [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/),
версии — [SemVer](https://semver.org/lang/ru/). Разделы и версии формирует **Release Please**
из conventional commits (`feat`, `fix`, `feat!`, `BREAKING CHANGE`); вручную правим только формулировки
в релизном PR (утверждение release notes — на владельце продукта).

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

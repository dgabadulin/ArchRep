# Changelog

Все заметные изменения ядра ИСАР фиксируются здесь. Формат — [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/),
версии — [SemVer](https://semver.org/lang/ru/). Разделы и версии формирует **Release Please**
из conventional commits (`feat`, `fix`, `feat!`, `BREAKING CHANGE`); вручную правим только формулировки
в релизном PR (утверждение release notes — на владельце продукта).

## [3.2.0](https://github.com/dgabadulin/ArchRep/compare/v3.1.0...v3.2.0) (2026-11-04)


### Новое

* **ai:** инструмент rank_relations — рейтинги «где больше всего» ([9149eaf](https://github.com/dgabadulin/ArchRep/commit/9149eaf6ac2b59ae1465641f0f8cfbb77264bd75))
* **infrastructure:** add Netbox infrastructure catalog and sync job ([#92](https://github.com/dgabadulin/ArchRep/issues/92)) ([e2a399e](https://github.com/dgabadulin/ArchRep/commit/e2a399e71335eac634887fa1dcc313eec56ba5a7))
* **modules:** ключи лицензий v1 и метаданные лицензии в реестре ([05a66fb](https://github.com/dgabadulin/ArchRep/commit/05a66fb30208edda3cdbc1b8598c66be0a2380d6))
* **ui:** логотип и иконки ИСАР от дизайнера ([826a27b](https://github.com/dgabadulin/ArchRep/commit/826a27b093b6ae7e4b686535d4d156c07e7eead4))
* **version:** версия продукта, /api/version и строгий гейт деплоя ([#96](https://github.com/dgabadulin/ArchRep/issues/96)) ([1b0e7f2](https://github.com/dgabadulin/ArchRep/commit/1b0e7f253c2f9e1a1406ef7c913639036cd1c01d))


### Исправлено

* **modules:** метаданные лицензии не попадали в реестр (дубль функции) ([e497dab](https://github.com/dgabadulin/ArchRep/commit/e497dab0f9e1f7ded4d13178f7d904b302f5fc92))
* **registry:** корректная сортировка по датам в реестрах ([587e165](https://github.com/dgabadulin/ArchRep/commit/587e165145d6d9f55ffbfefda22b95278a635580))
* **registry:** пустые даты — в конце при asc и в начале при desc ([23c7640](https://github.com/dgabadulin/ArchRep/commit/23c76404a2dd556fa1f4b95822b341c683c70a70))

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

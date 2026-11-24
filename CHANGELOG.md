# Changelog

Все заметные изменения ядра ИСАР фиксируются здесь. Формат — [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/),
версии — [SemVer](https://semver.org/lang/ru/). Разделы и версии формирует **Release Please**
из conventional commits (`feat`, `fix`, `feat!`, `BREAKING CHANGE`).

**Формулировки пунктов = `subject`-ы коммитов**, и они согласуются с владельцем продукта **до** коммита
(`.clinerules` §1 п.4): что согласовали — то и попадает в CHANGELOG и в release notes. Пункты
формулируются как **свершившийся факт в прошедшем времени**: «добавлена…», «исправлена…», «устранено…»,
«пересчитаны…»; не «добавить/исправить» и не «добавление…». Правка пункта
в теле GitHub Release вместо `subject` не практикуется; в теле релиза допускается только **дополнение**
(«Что сделать администратору», пояснения). Ручная правка `CHANGELOG.md` — только в релизном PR по запросу
владельца (после последнего прогона Release Please и сразу мерж).

## [4.7.0](https://github.com/dgabadulin/ArchRep/compare/v4.6.0...v4.7.0) (2026-11-24)


### Новое

* **dashboards:** добавлен дашборд матрицы целевой архитектуры с цветовой легендой ([c94dcc0](https://github.com/dgabadulin/ArchRep/commit/c94dcc0732bbdf58a14876627066c0c4eb4ce446))
* **dashboards:** карта ИТ ландшафта, порядок строк и справочник в «Справочниках» ([#127](https://github.com/dgabadulin/ArchRep/issues/127)) ([e87abf5](https://github.com/dgabadulin/ArchRep/commit/e87abf5e2d12bd67654931c5cc58f2a2d76189b4))
* **employee:** добавлена полная синхронизация справочника сотрудников из CSV ([fd85d9a](https://github.com/dgabadulin/ArchRep/commit/fd85d9ac5fc56c409c758b3b61d9e56782639d73))
* **infrastructure:** исключены служебные ВМ с префиксом vm- из синхронизации каталога ([58e3c36](https://github.com/dgabadulin/ArchRep/commit/58e3c36e4d8147fcf87af9b30470c7f8203877d5))
* **owners:** добавлена дополнительная классификация функциональных вертикалей ([c22b795](https://github.com/dgabadulin/ArchRep/commit/c22b7950a4c822883f8dba47c21e835793083504))
* **references:** добавлена доп. классификация статусов систем ([#130](https://github.com/dgabadulin/ArchRep/issues/130)) ([0fd6388](https://github.com/dgabadulin/ArchRep/commit/0fd6388b0060fb751b73d2d723c7424d678ed0b6))
* **references:** добавлены отсутствовавшие справочники в «Справочниках» ([#133](https://github.com/dgabadulin/ArchRep/issues/133)) ([fcce729](https://github.com/dgabadulin/ArchRep/commit/fcce7292b103744322c204fc1d0417e5e6619f52))
* **systems:** добавлена вкладка «Инфраструктура» на карточке ИС ([#125](https://github.com/dgabadulin/ArchRep/issues/125)) ([696c86c](https://github.com/dgabadulin/ArchRep/commit/696c86cd402677f48ff68ebe764137913cafa34b))
* **systems:** добавлено поле «Организация-владелец», импорт и схема метамодели 2.1 ([#126](https://github.com/dgabadulin/ArchRep/issues/126)) ([b336fae](https://github.com/dgabadulin/ArchRep/commit/b336fae8c7a7f510323a606cda2a6609d077cbdc))
* **system:** добавлен множественный выбор типа интерфейса ИС со справочником ([#129](https://github.com/dgabadulin/ArchRep/issues/129)) ([b1f54d0](https://github.com/dgabadulin/ArchRep/commit/b1f54d04c9ccfd6167d8d22dabd6064a65f497d3))
* добавлены фильтр служебных ВМ vm* и панель «Связи» в анализаторе ([5d488f1](https://github.com/dgabadulin/ArchRep/commit/5d488f1553fa64d99a609d2c427edae36b44eed6))


### Исправлено

* **analytics:** возвращён перенос хаба при раскрытии новых узлов в анализаторе ([#134](https://github.com/dgabadulin/ArchRep/issues/134)) ([82f4342](https://github.com/dgabadulin/ArchRep/commit/82f434214e0eac4f941b28857ab575d5d0638a95))
* **analytics:** исправлены масштаб, раскрытие связей и раскладка хаба в анализаторе ([#134](https://github.com/dgabadulin/ArchRep/issues/134)) ([c5c4149](https://github.com/dgabadulin/ArchRep/commit/c5c4149cdba07c4117180e54b962bd463f0a8532))
* **analytics:** палитра анализатора прокручивается целиком, «Настройки» закреплены сверху ([#116](https://github.com/dgabadulin/ArchRep/issues/116)) ([42c59ab](https://github.com/dgabadulin/ArchRep/commit/42c59abda1729161bd9d9dcd9286ac9b5714356f))
* **analytics:** панель «Связи» синхронизирована с ПКМ и устранён дрейф масштаба ([#134](https://github.com/dgabadulin/ArchRep/issues/134)) ([17d91e0](https://github.com/dgabadulin/ArchRep/commit/17d91e0bb94c5b77e8f1618053500c5f230d916e))
* **analytics:** стабилизирована ширина графа и обрезаны длинные подписи связей ([#134](https://github.com/dgabadulin/ArchRep/issues/134)) ([23ec74d](https://github.com/dgabadulin/ArchRep/commit/23ec74dd1fc0dc0ba34ca761b1769d932a8aec00))
* **analyzer:** добавлено закрытие контекстного меню при выборе другого узла или связи ([7e61697](https://github.com/dgabadulin/ArchRep/commit/7e61697ce377c8a3de15f97e5b3129c4796caa86))
* **dashboards:** убран подзаголовок категории на карточках дашбордов ([2d02b38](https://github.com/dgabadulin/ArchRep/commit/2d02b38bd4fa33094258b8201d0322592e3bbb78))
* **db:** применённые SQL-скрипты возвращены к исходному виду ([b497aa6](https://github.com/dgabadulin/ArchRep/commit/b497aa604a40fc4fba5059f61985f6dc4355ed33))
* **db:** устранено неоднозначное сравнение версии в upsert маркера схемы ([958406d](https://github.com/dgabadulin/ArchRep/commit/958406d1e84c3ff3bbbe4fab363708fb699b7411))
* **db:** устранено отставание маркера версии схемы при накате миграций ([8f23a4e](https://github.com/dgabadulin/ArchRep/commit/8f23a4e552782de83e5d1f3101bf569802a519e0))
* **graph:** исправлена высота области графа на вкладках карточки ИС ([4e2c9f1](https://github.com/dgabadulin/ArchRep/commit/4e2c9f1ad848713e197880ef5279438da6776c81))
* **graph:** исправлено вписывание графа в область на вкладках карточки ИС ([42bce3e](https://github.com/dgabadulin/ArchRep/commit/42bce3ee48d3046b3044dcdc1b7223f592c75916))
* **owners:** уточнены правила классификации функциональных вертикалей ([0ea0d07](https://github.com/dgabadulin/ArchRep/commit/0ea0d0771dc483e613d81ab998f32447975630a8))
* **refs:** исправлен поиск во всех справочниках ([#124](https://github.com/dgabadulin/ArchRep/issues/124)) ([307c087](https://github.com/dgabadulin/ArchRep/commit/307c08774a6adbcd1e16e7096bb7d227a67723fe))
* **registry:** возврат в реестр восстанавливает первую видимую строку ([#135](https://github.com/dgabadulin/ArchRep/issues/135)) ([0c41c2d](https://github.com/dgabadulin/ArchRep/commit/0c41c2dae33dbe8f25900dbba7584835496306f1))
* **registry:** исправлен возврат из карточки на исходную страницу реестра ([#135](https://github.com/dgabadulin/ArchRep/issues/135)) ([fa70262](https://github.com/dgabadulin/ArchRep/commit/fa70262d31400dbe2b08699a7d8fc47097d7bfe0))
* **registry:** при возврате из карточки прокручивается нужная запись реестра ([#135](https://github.com/dgabadulin/ArchRep/issues/135)) ([bd52e97](https://github.com/dgabadulin/ArchRep/commit/bd52e97b5e401824684fe8d79093703ffee03965))
* **systems:** убраны колонки «Кластер» и «Платформа» во вкладке «Инфраструктура» ([8a73a9c](https://github.com/dgabadulin/ArchRep/commit/8a73a9c072bf000e34c9af263a3cd382b593bcac))
* **system:** устранено неотображение выбранных типов интерфейса в карточке ИС ([#129](https://github.com/dgabadulin/ArchRep/issues/129)) ([621caa1](https://github.com/dgabadulin/ArchRep/commit/621caa12c6dd634ee3996bb3f224959d3c0809c4))

## [4.6.0](https://github.com/dgabadulin/ArchRep/compare/v4.5.0...v4.6.0) (2026-11-20)


### Новое

* **analyzer:** настройки палитры — выпадающие списки Да/Нет ([#116](https://github.com/dgabadulin/ArchRep/issues/116)) ([3a7f2bc](https://github.com/dgabadulin/ArchRep/commit/3a7f2bcb3ab81cd610f0d7367bc36a3bca6bee71))
* **system-functions:** реестр функций ИС с карточкой, фильтрами и защитой удаления ([#76](https://github.com/dgabadulin/ArchRep/issues/76)) ([00093fd](https://github.com/dgabadulin/ArchRep/commit/00093fd621930ea8184df94db6bdbfd7aa378a19))
* **ui:** пагинация и горизонтальная прокрутка табличных реестров ([#114](https://github.com/dgabadulin/ArchRep/issues/114)) ([889f9f1](https://github.com/dgabadulin/ArchRep/commit/889f9f1996c4e8bce7af62525ca3d35fd274621d))


### Исправлено

* **adr:** сохранение заключения не падает с ar_adr_statuses_id is not defined ([#115](https://github.com/dgabadulin/ArchRep/issues/115)) ([299cd61](https://github.com/dgabadulin/ArchRep/commit/299cd6151219af1e48958ca19e836765b21e77c4))
* **adr:** сохранить заключение без падения API и вернуть навигацию из схемы ([9b80d46](https://github.com/dgabadulin/ArchRep/commit/9b80d46951bde8096a7ee792595555bf7b2d8a8a))
* **analyzer:** выделение узла не скрывает его связи ([#116](https://github.com/dgabadulin/ArchRep/issues/116)) ([f354cde](https://github.com/dgabadulin/ArchRep/commit/f354cdec52f99a7556535636cdd9d652121d3791))
* **analyzer:** удалена жёлтая рамка фокуса, дублировавшая выделение узла ([004b442](https://github.com/dgabadulin/ArchRep/commit/004b4429d6262942145adf3f9a53c9b91bd42490))
* **drawio:** не размещать новые и наложенные системы поверх существующих при обновлении схемы ([8c2ccc0](https://github.com/dgabadulin/ArchRep/commit/8c2ccc06176736ee1707c9e9b4b08595614ff316))
* **drawio:** рёбра схемы решения пересчитываются при merge и не наслаиваются ([#93](https://github.com/dgabadulin/ArchRep/issues/93)) ([4df46ae](https://github.com/dgabadulin/ArchRep/commit/4df46ae5bb0e8642c21e0288b548c626ba8276bc))

## [4.5.0](https://github.com/dgabadulin/ArchRep/compare/v4.4.0...v4.5.0) (2026-11-19)


### Новое

* **analyzer:** выделение объектов и палитра свойств ([#116](https://github.com/dgabadulin/ArchRep/issues/116)) ([f5e3e42](https://github.com/dgabadulin/ArchRep/commit/f5e3e42e13946869ee9f83f6148d553a36b1d2ee))

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

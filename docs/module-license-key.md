# Ключ лицензии модуля ИСАР — формат v1

Единый источник правды по формату ключа: что выпускает инструмент модуля
(`isar-diagram-editor/tools/license`), что проверяет ядро (`backend/modules/license.js`) и что
попадает в БД/UI. Контракт модулей — [`modules-contract.md`](./modules-contract.md) §10, §16.3.

> Проверка ключа выполняется **только в ядре**. Модуль ключ не читает: он получает от ядра статус
> (`active`, `licensed`, `reason`) и работает по нему.

## 1. Контейнер

```
<base64url(payload JSON)>.<base64url(Ed25519-подпись base64url(payload))>
```

* подпись считается по **строке** `base64url(payload)`, а не по исходному JSON:

```js
const [body, sig] = key.split('.');
crypto.verify(null, Buffer.from(body, 'utf8'), crypto.createPublicKey(pem), Buffer.from(sig, 'base64url'));
```

* обе части — base64url (без `+`, `/`, `=`): ключ безопасен для `.env`, не ломается при копировании
  (обычно 400–700 символов одной строкой);
* формат **версионируется полем `v`** внутри payload; ключи без `v` (прежний payload
  `{ product, instance_id, exp, … }`) **не принимаются** — обратная совместимость не поддерживается
  (внедрений не было).

## 2. Payload v1

```json
{
  "v": 1,
  "license_id": "LIC-2026-000001",
  "kid": "isar-2026-01",
  "product": "drawio-pro",
  "customer": { "id": "cust_001", "name": "ООО «Пример»" },
  "edition": "standard",
  "features": ["adr-diagram"],
  "limits": { "users": 50 },
  "installation": {
    "mode": "uuid",
    "uuid": "8f14e45f-...",
    "ref": "k3JdQ2...",
    "strict": false
  },
  "iat": "2026-11-04T00:00:00.000Z",
  "nbf": "2026-11-04T00:00:00.000Z",
  "exp": "2027-11-03T00:00:00.000Z",
  "grace_days": 14,
  "trial": false
}
```

| Поле | Обяз. | Смысл | Что делает ядро |
|---|---|---|---|
| `v` | да | версия формата | `v !== 1` → отказ |
| `license_id` | да | идентификатор ключа для учёта/сверки с реестром лицензий | пишется в `isar_modules.license_id`; отсутствует → warning |
| `kid` | да | идентификатор пары подписи (ротация) | по нему выбирается публичный ключ; отсутствует → warning |
| `product` | да | код продукта | сравнивается с `manifest.license.product \|\| code` |
| `customer` | нет | реквизиты клиента (для акта/реестра) | не проверяется, наружу не отдаётся |
| `edition` | нет | редакция | отдаётся в `/api/config` (`edition`), по умолчанию `standard` |
| `features` | нет | список возможностей | не проверяется (задел на feature-гейты) |
| `limits` | нет | лимиты (`{ users: 50 }`) | отдаётся в статусе, в UI/БД не пишется |
| `installation` | нет | привязка к инсталляции (§4) | проверяется по правилам §4 |
| `iat` | нет | время выпуска | не проверяется (информационно) |
| `nbf` | нет | начало действия | `now < nbf` → отказ |
| `exp` | да | конец действия | `now > exp` → grace (§5) |
| `grace_days` | нет | льготный период после `exp`, дни | `exp + grace_days`; внутри — `licensed: true` + warning |
| `trial` | нет | пробный ключ | отдаётся в статусе |

## 3. Публичные ключи в env ядра

| Переменная | Формат | Назначение |
|---|---|---|
| `SYS_MODULE_LICENSE_PUBKEYS` | JSON `{"<kid>":"<base64 PEM>","<kid2>":"<base64 PEM>"}` | основной вариант: ключ выбирается по `kid` из payload (ротация без простоя) |
| `SYS_MODULE_LICENSE_PUBLIC_KEY` | PEM или base64(PEM) | fallback для любого `kid`, если `PUBKEYS` не задан |

Терпимость разбора (`normalizePublicKeys()`): значение `PUBKEYS` может быть JSON-объектом,
одиночным PEM/base64 (тогда трактуется как `{"*": …}`), ключ `"*"` подходит любому `kid`.
Ошибки разбора **не ломают старт ядра** — попадают в `warnings` и в `npm run modules:status`.

Ключ, выпущенный `tools/license` модуля, кладётся в env инсталляции:

```env
SYS_MODULE_LICENSE_PUBKEYS={"isar-2026-01":"LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0…"}
SYS_INSTANCE_ID=8f14e45f-…
SYS_MODULE_drawio_pro_LICENSE=<содержимое license-LIC-2026-000001.jwt>
```

## 4. Привязка к инсталляции (`installation.mode`)

| mode | Проверка | Несовпадение |
|---|---|---|
| `any` | не проверяется | — |
| `uuid` | `installation.uuid === SYS_INSTANCE_ID` | отказ; **если `SYS_INSTANCE_ID` не задан — тоже отказ** (fallback `<host>:<db>` для `uuid` не используется) |
| `derived` | `installation.ref === install_ref()` | `strict: true` → отказ; `strict: false` → `licensed: true` + warning |

`install_ref` — отпечаток фактического развёртывания:

```js
const raw = `${os.hostname()}:${process.env.PORT || process.env.API_PORT || 3000}:${process.env.DB_NAME || 'archrep'}`.toLowerCase();
const ref = crypto.createHash('sha256').update(raw, 'utf8').digest('base64url').slice(0, 22);
```

* переопределение — `SYS_INSTALL_REF` (например, если порт снаружи отличается или используется
  балансировщик); значение должно совпадать с тем, что зафиксировано в ключе;
* в ключ попадает хэш, а не имена сервера/БД — ключ не раскрывает инфраструктуру;
* `install_ref` показывает `npm run modules:status` (и передаётся вендору при выпуске ключа).

## 5. Порядок проверки (как в коде)

`verifyLicense(key, { env, product, instanceId, installRef, now })`:

1. ключ задан? нет → `ключ лицензии не задан (env SYS_MODULE_<code>_LICENSE)`;
2. контейнер разбирается (`<payload>.<signature>`), payload — валидный JSON;
3. `v === 1`; `product` есть и совпадает с ожидаемым;
4. `warnings`, если нет `license_id`/`kid`;
5. подпись Ed25519 (или пропуск в dev-режиме `SYS_MODULE_LICENSE_ALLOW_UNVERIFIED=true`);
6. `nbf ≤ now ≤ exp`; после `exp` — grace (`grace_days`);
7. привязка по `installation.mode` (§4);
8. результат:

```js
{
  licensed: true,
  warnings: [],
  license_id: 'LIC-2026-000001',
  kid: 'isar-2026-01',
  product: 'drawio-pro',
  edition: 'standard',
  expires_at: '2027-11-03T00:00:00.000Z',
  trial: false,
  limits: { users: 50 },
  binding: { mode: 'uuid', strict: false, match: true },
}
```

При отказе: `{ licensed: false, reason: '<понятная причина>', warnings: [] }` (плюс
`license_id`/`kid`, если payload уже разобран).

Кэш: `getLicenseStatus()` кэширует результат на 60 c, ключ кэша — `code|sha256(ключ)` (ротация
ключа **той же длины** подхватывается сразу, без ожидания TTL). Смена `SYS_INSTANCE_ID` при
неизменном ключе подхватывается после истечения TTL/перезапуска.

`SYS_MODULE_LICENSE_ALLOW_UNVERIFIED=true` — **только dev**: подпись не проверяется, в лог пишется
предупреждение; на prod режим запрещён (проверяется при деплое вручную, см. `deploy-precheck.ps1`).

## 6. Ротация ключей (`kid`)

1. вендор выпускает новую пару: `keygen --kid isar-2027-01` и **новые** ключи с новым `kid`;
2. в env инсталляции добавляется второй публичный ключ:
   `SYS_MODULE_LICENSE_PUBKEYS={"isar-2026-01":"…","isar-2027-01":"…"}`;
3. инсталляция получает новый ключ (старый продолжает работать до своего `exp`);
4. после перехода всех инсталляций старый `kid` удаляется из env.

`SYS_MODULE_LICENSE_PUBLIC_KEY` (одиночный) нужен только как аварийный fallback: он подходит
**любому** `kid`, поэтому ротацию не поддерживает.

## 7. Что видит БД и UI

| Место | Что попадает |
|---|---|
| `archrep.isar_modules` | `licensed`, `license_expires_at`, `license_id`, `license_kid`, `license_binding` (`uuid:match`, `derived:mismatch:strict`, …), `license_checked_at` |
| `GET /api/config` → `modules["<code>"]` | `{ enabled, licensed, edition, expires_at }` — формат стабилен |
| `GET /api/<code>/manifest` | `active` = `enabled && licensed`, плюс `licensed`, `edition`, `expires_at`, `reason` |
| лог API | причина отказа и `warnings` (без ключа) |

**Ключ лицензии и публичный ключ никогда не попадают в БД, `/api/config` и фронт.**

## 8. Диагностика

```bash
npm run modules:status
# instance_id: … ; install_ref: <22 симв.>
# Ключи подписи: PUBKEYS (1: isar-2026-01)
# Лицензия: активна (edition=standard, до 2027-11-03)
# license_id: LIC-2026-000001; kid: isar-2026-01
# binding: uuid (match)
```

| Симптом | Причина | Действие |
|---|---|---|
| `версия ключа «undefined» не поддерживается` | ключ старого формата | перевыпустить ключ (`tools/license`) |
| `публичный ключ для kid «…» не найден` | `kid` нет в `SYS_MODULE_LICENSE_PUBKEYS` | добавить публичный ключ в JSON |
| `подпись ключа недействительна` | не та пара/ключ повреждён при копировании | сверить `public-<kid>.pem` |
| `на инсталляции не задан SYS_INSTANCE_ID` | ключ с `mode:"uuid"`, env без `SYS_INSTANCE_ID` | задать `SYS_INSTANCE_ID` (тот, под который выпущен ключ) |
| `ключ привязан к другой инсталляции (…)` | ключ выпущен под другой `uuid` | запросить перевыпуск |
| `install_ref не совпадает` | сменились host/port/db при `strict: true` | `SYS_INSTALL_REF` или перевыпуск |
| `срок действия истёк` | закончился `exp` + `grace_days` | продлить/перевыпустить ключ |

## 9. Ограничения офлайн-проверки (приняты осознанно)

* ключ + `SYS_INSTANCE_ID` можно скопировать на другой сервер — лицензия там заработает;
* счётчика инсталляций нет; отзыв ключа не действует автоматически (CRL — кандидат на v2);
* `exp`/`nbf` проверяются по часам сервера → нужен NTP;
* доступ к env = доступ к ключу (`chmod`, секреты контейнера).

Компенсация организационная: выпуск под конкретный `instance_id`, фиксация `license_id` в
заявке/акте, учёт в реестре лицензий вендора.

## 10. Пример проверки «как в жизни»

```powershell
# 1) в репозитории модуля — пара и ключ
cd C:\work\isar-diagram-editor
node tools/license/cli.js keygen --kid core-test
node tools/license/cli.js issue --product drawio-pro --kid core-test `
  --customer-id test --instance-uuid inst-core --exp 2027-11-03 --out license.jwt

# 2) в ядре
$env:SYS_INSTANCE_ID = 'inst-core'
$env:ENABLED_MODULES = 'drawio-pro'
$env:SYS_MODULE_drawio_pro_LICENSE = Get-Content -Raw .\license.jwt
$env:SYS_MODULE_LICENSE_PUBKEYS = '{"core-test":"<base64 PEM>"}'
npm run modules:status

# 3) API
curl.exe -s http://localhost:3000/api/config
curl.exe -s http://localhost:3000/api/drawio-pro/manifest
```

Негативные проверки: другой `SYS_INSTANCE_ID` → `licensed: false` (402 на маршрутах модуля);
истёкший `exp` → отказ; неизвестный `kid` → отказ с сообщением про публичный ключ.

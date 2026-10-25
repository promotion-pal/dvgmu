# Архитектура портала ДВГМУ

Как устроены сервисы, как они связаны и откуда берутся общие схемы.

## 1. Карта

```
                       ┌──────────────┐
  браузер ────────────▶│ fesmu web    │  apps/fesmu/web (React)
     │                 └──────┬───────┘
     │ вход, /me, refresh     │ Connect RPC + cookie fesmu_at
     ▼                        ▼
┌─────────┐  JWKS     ┌──────────────┐  прокси / клиенты
│  auth   │◀──────────│  fesmu api   │──────────────┬──────────┬───────────┐
└──┬───┬──┘           └──────────────┘              │          │           │
   │   │ objectGUID → человек                       ▼          ▼           ▼
   │   └───────────────────────────────────────▶ ┌─────┐  ┌─────────┐ ┌─────────┐
   │                                             │ mdm │  │analytics│ │ tickets │
   │ пароль (WS-Trust)                           └─────┘  └─────────┘ └─────────┘
   ▼                                                ▲          ▲
┌─────────┐   Yandex 360 (SAML) ──▶ auth            │          │ анкета по QR
│  AD FS  │                         sync ───────────┘     fesmu api → file
└─────────┘                         (MDM ↔ AD, только чтение)
```

## 2. Сервисы

| Сервис | Папка | Что делает | Своя БД | Кто вызывает |
|---|---|---|---|---|
| **fesmu web** | `apps/fesmu/web` | Интерфейс портала | — | браузер |
| **fesmu api** | `apps/fesmu/api` | Логика портала: расписание, закупки, тесты, справки, опросы, права. Шлюз к сервисам. | 4 базы: purchase, infrastructure, tests, library | fesmu web |
| **auth** | `services/auth` | Вход через AD (AD FS), токены fesmu, SAML IdP для Yandex 360, активация и смена пароля в AD | identities, refresh_tokens | браузер, fesmu api, Yandex 360 |
| **mdm** | `services/mdm` | Главный справочник людей: пользователи, студенты, сотрудники, роли, доступы, подразделения, связка с AD (`ad_object_id`) | да | auth, fesmu api, sync |
| **analytics** | `services/analytics` | Опросы по QR и их ответы | да | fesmu api |
| **tickets** | `services/tickets` | Заявки (общежитие, здания) | да | fesmu api |
| **file** | `services/file` | Генерация документов (справки), разбор Excel | да | fesmu api |
| **notification** | `services/notification` | Отправка писем (SMTP) | — | сейчас в репозитории никто не вызывает |
| **sync** | `services/sync` | Сверка MDM ↔ AD: читает обе стороны и пишет расхождения в лог | — | запускается по таймеру |

**Отдельные модули** (своя генерация схем, в общую схему не входят):
- `services/dormitory` — общежитие (сайт и api);
- `services/mentor` — наставничество (сайт и api);
- `services/ojs` — журналы (Open Journal Systems, PHP).

**Статические сайты:** `apps/ksm`, `apps/guide`, `apps/unistom`, `apps/profile`, `apps/course`.

## 3. Как сервисы связаны

Сервисы общаются только по сети, через **Connect RPC** (HTTP, JSON или protobuf). Общих баз нет.

| Откуда | Куда | Как | Зачем |
|---|---|---|---|
| fesmu web | fesmu api | Connect RPC, cookie `fesmu_at` | все данные портала |
| fesmu web | auth | `/login`, `/api/v1/auth/me`, `/refresh` | вход и сессия |
| fesmu api | auth | `/.well-known/jwks.json` | проверка подписи `fesmu_at` |
| fesmu api | auth | прокси `contract.auth.v2.IdentityService` (служебный токен) | страница «Авторизация» в админке |
| fesmu api | mdm | прокси `contract.service.UserService` | люди, роли, доступы (только ADMIN) |
| fesmu api | analytics | прокси (только чтение) + модуль `survey` (запись) | опросы и отчёты |
| fesmu api | tickets | прокси (право раздела «Заявки») | заявки |
| fesmu api | file | клиент `FilesService` | справки |
| auth | AD FS | WS-Trust | проверка пароля → objectGUID |
| auth | mdm | `UserFetchByADObjectID` (служебный токен) | человек и роли по objectGUID |
| sync | mdm, AD (LDAP) | чтение | поиск расхождений |
| Yandex 360 | auth | SAML | вход в почту по учётке AD |

## 4. Вход пользователя

1. Портал проверяет сессию: `GET auth/api/v1/auth/me`. Сессии нет → экран «Войти».
2. «Войти» → `auth/login?return=<портал>`.
3. auth отправляет логин и пароль в **AD FS** (WS-Trust). AD FS отвечает утверждением с objectGUID учётки.
4. auth ищет человека в **MDM** по objectGUID (`users.ad_object_id`).
   - Нашёл и активен → auth ставит cookie `fesmu_at` (JWT, 15 мин) и `fesmu_rt` (refresh, 30 дней) и возвращает пользователя в портал.
   - Не нашёл → вход есть, но `/me` отвечает `not_linked`.
5. fesmu api проверяет `fesmu_at` по ключу из JWKS auth и пускает по ролям и правам из токена.

## 5. Общие схемы (контракты)

Схема — файл `.proto`. Он описывает сообщения, enum и методы сервиса.

**Где лежат.** Схема лежит у владельца, в папке с его именем:
```
services/mdm/api/contract/mdm/{entity,enum,service}/…
services/analytics/api/contract/analytics/…
apps/fesmu/api/contract/fesmu/{entity,enum,service}/vN/…
services/auth/api/contract/auth/{v1,v2}/…
```

**Как связаны.** Корневой `buf.yaml` объединяет все схемы в один workspace. Поэтому одна схема подключает другую по пути с именем владельца:
```proto
import "mdm/entity/user.entity.proto";   // в схеме file — тип User из mdm
```

**Генерация.** `make proto` (= `buf generate` по `buf.gen.yaml`):

| Что | Куда | Как подключают |
|---|---|---|
| Go | `packages/go` — модуль `fesmu/contract` | `import "fesmu/contract/mdm/entity"`; в `go.mod`: `replace fesmu/contract => ../../../packages/go` |
| TypeScript | `packages/ts` — пакет `@fesmu/contract` | `import … from "@fesmu/contract/mdm/entity/user.entity_pb"` |

`make proto-check` (его же запускает CI) — сгенерированный код совпадает со схемами.

**Правило совместимости.** Сервисы выкатываются в разное время.
- Можно: добавить поле с новым номером, добавить метод, добавить значение enum.
- Нельзя: удалить или перенумеровать поле, сменить тип, переименовать пакет или сервис. Для этого нужна новая версия API (пример — `auth/v1` и `auth/v2`).

**Почему dormitory и mentor вне общей схемы.** Их proto-пакеты называются так же, как у mdm (`contract.entity.User`). В одном workspace это конфликт. Решение — новая версия их API с уникальными пакетами.

## 6. Сборка и выкатка

- Каждый бэкенд — свой Docker-образ. Контекст сборки — корень репозитория. `Dockerfile.dockerignore` пускает в контекст только `packages/go` и папку api этого сервиса.
- В образ попадает только бинарник. Схемы, `.proto` и `packages/` в нём не нужны.
- Изменили схему → `make proto` → пересобрать сервисы, которые её используют.
- Стенд: `./stand.sh <сервис|fesmu> up -d --build` (нужен `STAND=…` в `.env`).

## 7. Локальный запуск всего портала

```bash
make dev-up      # весь портал в Docker (dev/docker-compose.yml)
make dev-seed    # тестовые люди в MDM
# веб http://localhost:18300 · fesmu api :18200 · auth :18201 · mdm :18205
make dev-down
```

**AD локально недоступен** — вместо AD FS работает `dev/adfs-mock`:
- тот же протокол WS-Trust, что у AD FS, поэтому код auth не меняется;
- пользователи — в `dev/adfs-mock/users.json`;
- подпись ответа не проверяется: локально `AUTH_ADFS_SIGNING_CERT_PEM` не задан. На проде он задан, и подделать ответ нельзя.

| Логин | Пароль | В MDM | Что проверяет |
|---|---|---|---|
| `admin` | `admin123` | ADMIN | вся админка |
| `staff` | `staff123` | STAFF | ограничения прав |
| `nolink` | `nolink123` | нет | ответ `not_linked` |

Не работает локально (нужен настоящий AD): запись пароля в AD (`/activate`, `/password` — режим заглушки), SAML для Yandex 360, сверка sync.

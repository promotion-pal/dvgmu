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
| **fesmu api** | `apps/fesmu/api` | Логика портала: расписание, закупки, тесты, экзаменационное тестирование, справки, опросы, права. Шлюз к сервисам. | 5 баз: purchase, infrastructure, tests, exam tests, library | fesmu web |
| **auth** | `services/auth` | Вход через AD (AD FS), токены fesmu, SAML IdP для Yandex 360, активация и смена пароля в AD | identities, refresh_tokens | браузер, fesmu api, Yandex 360 |
| **mdm** | `services/mdm` | Главный справочник людей: пользователи, студенты, сотрудники, роли, доступы, подразделения, связка с AD (`ad_object_id`) | да | auth, fesmu api, sync |
| **analytics** | `services/analytics` | Опросы по QR и их ответы | да | fesmu api |
| **tickets** | `services/tickets` | Заявки (общежитие, здания) | да | fesmu api |
| **tasks** | `services/tasks` | Каталог услуг, формы и регистрация заявок | да | fesmu api |
| **file** | `services/file` | Генерация документов (справки), разбор Excel | да | fesmu api |
| **notification** | `services/notification` | Отправка писем (SMTP) | — | сейчас в репозитории никто не вызывает |
| **sync** | `services/sync` | Сверка MDM ↔ AD: читает обе стороны и пишет расхождения в лог | — | запускается по таймеру |

Продовый `apps/fesmu/docker-compose.yml` содержит API, веб и все шесть БД
с прежними каталогами `api/db/*`; API ждёт готовности своих БД и применяет
миграции автоматически. `apps/fesmu/docker-compose.dev.yml` запускает
изолированный локальный стек из `dev/docker-compose.yml` (проект `fesmu_local`).
Права экзаменационного банка и сессий — отдельные `exam_tests.fetch/post`;
обычные `tests.fetch/post` доступа к экзаменам не дают.
Публичная страница `/exam-testing` — единая точка входа для компьютерного класса:
номер зачётки, выбор назначенного экзамена и прохождение остаются на одном адресе.
Анонимный `ExamPublicFetch` разрешает номер зачётки через фильтр MDM в UUID и
отдаёт только назначенные этому UUID открытые экзамены. `exam_assignments`
в экзаменационной БД связывает сессию с UUID MDM; старт повторно проверяет связь.
ФИО/группа и UUID результата берутся из MDM. В MDM добавлен `UserDirectoryService`
и `GET /users` с фильтрами роли/курса/группы/подразделения и пагинацией;
шлюз FESMU оставляет общий справочник ADMIN, а преподавателям предоставляет
студенческий `ExamAudienceFetch` с правом `exam_tests.post`.
Подробности: [назначения экзаменов](docs/EXAM_ASSIGNMENTS.md).

**Сайты при сервисах** (Next.js, в общем pnpm workspace, TS схем — из `@fesmu/contract`):
- `services/dormitory` — общежитие (сайт и api, пакеты `contract.dormitory.*`);
- `services/mentor` — наставничество (сайт и api, пакеты `contract.mentor.*`).

**Отдельно:** `services/ojs` — журналы (Open Journal Systems, PHP, без схем).

**Статические сайты:** `apps/ksm`, `apps/guide`, `apps/unistom`, `apps/profile`, `apps/course`.

**Панель задач:** `panel/plane-app` — Plane Community со своими PostgreSQL, Redis, RabbitMQ и MinIO. Запуск: `make panel-up` или общий `make up`. Настройки GitHub: `panel/README.md`.

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
| fesmu api | tickets | прокси (право раздела «Заявки») | заявки общежитий и зданий |
| fesmu api | tasks | прокси `CreateTask`, `PACKAGE_REQUESTS` | регистрация заявки на услугу |
| tasks | auth | `/.well-known/jwks.json` | проверка сессии FESMU через общий пакет `packages/authsession` |
| tasks | mdm | `UserFetchByUUID` | проверка профиля и получение подразделения заявителя |
| fesmu api | file | клиент `FilesService` | справки |
| auth | AD FS | WS-Trust | проверка пароля → objectGUID |
| auth | mdm | `UserFetchByADObjectID` (служебный токен) | человек и роли по objectGUID |
| sync | mdm, AD (LDAP) | чтение | поиск расхождений |
| Yandex 360 | auth | SAML | вход в почту по учётке AD |
| GitHub Actions | Plane | REST API v1, API token | статусы задач по PR и явным маркерам коммитов |

## 4. Вход пользователя

1. Портал проверяет сессию: `GET auth/api/v1/auth/me`. Сессии нет → экран «Войти».
2. «Войти» → `auth/login?return=<портал>`.
3. auth отправляет логин и пароль в **AD FS** (WS-Trust). AD FS отвечает утверждением с objectGUID учётки.
4. auth ищет человека в **MDM** по objectGUID (`users.ad_object_id`).
   - Нашёл и активен → auth ставит cookie `fesmu_at` (JWT, 15 мин) и `fesmu_rt` (refresh, 30 дней) и возвращает пользователя в портал.
   - Не нашёл → вход есть, но `/me` отвечает `not_linked`.
5. fesmu api проверяет `fesmu_at` по ключу из JWKS auth и пускает по ролям и правам из токена.

При вызове `CreateTask` портал передаёт сессию в `tasks`. Сервис проверяет токен, берёт UUID автора из него и проверяет активность профиля в MDM. Если MDM вернул одно подразделение, оно сохраняется в заявке. Очередь определяется общим маршрутом услуги.

Локальный `make dev-up` подключает `tasks` к auth и MDM. `CreateTask` доступен через API портала на `localhost:18200`, а справочники и маршруты — через веб-портал или напрямую на `localhost:4052`. Для отдельного запуска `tasks` нужны `TASKS_AUTH_JWKS_URL` и `TASKS_MDM_URL`, чтобы включить `CreateTask`.

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

**Имена пакетов.** У каждого владельца свой proto-пакет (`contract.analytics.*`, `contract.dormitory.*`, `contract.mentor.*`); общий `contract.entity` — только у mdm. Иначе в одном workspace имена конфликтуют.

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

**Новый сервис заявок `tasks`.** После входа в локальный портал откройте `/lk/tasks`
через «Сервис заявок» → «Заявки». Веб проксирует ConnectRPC с `/tasks-api` в контейнер
`tasks`. Сервис хранит данные в отдельной локальной базе. На пустой базе каталог
показывает «Услуги не найдены». Раздел `/lk/tickets` использует прежний сервис `tickets`.

Для работы над вебом с горячей перезагрузкой из корня репозитория запустите API без контейнера `web`:

```bash
docker compose -f dev/docker-compose.yml stop web
docker compose -f dev/docker-compose.yml up -d --build api tasks
make dev-seed
VITE_API_URL=http://localhost:18200 VITE_AUTH_URL=http://localhost:18201 \
  pnpm --dir apps/fesmu/web dev --port 18300 --strictPort
```

Vite по умолчанию обращается к `tasks` на `127.0.0.1:4052`. Если локальный порт
изменён через `TASKS_GRPC_PORT`, задайте `TASKS_PROXY_TARGET` при запуске Vite.
Если запущен отдельный стек `make tasks-dev`, остановите его через `make tasks-dev-stop`
или назначьте одному из стеков другой порт.

**Данные.** Локальные базы новые и пустые: боевые опросы, заявки и люди лежат в базах на сервере. Чтобы работать с реальными данными, загрузите копию базы:

```bash
# на сервере — копия базы сервиса (пример: analytics)
docker exec dvgmu_apps_analytic_db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > analytics.dump
# локально — загрузить в портал (заменяет локальные данные этой базы)
make dev-import DB=analytics FILE=~/Downloads/analytics.dump
```

В копиях mdm и analytics есть персональные данные. Храните файлы копий только у себя и удаляйте после загрузки.

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

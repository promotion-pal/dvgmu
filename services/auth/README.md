# dvgmu-auth

Сервис авторизации: вход через AD (пароль проверяет AD FS по WS-Trust) и
токены для fesmu. Порт: local `4041`, prod `4000`.

## Вход и токены fesmu

| Путь | Что делает |
|---|---|
| `/saml/idp/sso`, `/saml/idp/metadata` | SAML IdP для Yandex 360 |
| `/login?return=…`, `/logout` | форма входа для своих приложений |
| `GET /api/v1/auth/me` | текущий пользователь fesmu |
| `POST /api/v1/auth/refresh` | новая пара токенов (ротация) |
| `POST /api/v1/auth/logout` | выход: отзыв refresh, стирание cookie |
| `GET /.well-known/jwks.json` | публичный ключ для проверки access-токена |

После проверки пароля в AD FS ставится **SSO-сессия IdP** (cookie
`AUTH_SAML_IDP_COOKIE_NAME`) — у всех, кто вошёл. Вход в **Yandex 360 зависит
только от AD**, MDM в нём не участвует.

Затем auth ищет человека в MDM по objectGUID (`users.ad_object_id`). Нашёлся и
активен — выдаются **токены fesmu**, обе cookie HttpOnly + Secure + SameSite=Strict:

- `fesmu_at` — access-JWT на 15 мин (`AUTH_ACCESS_TTL`), EdDSA, домен
  `AUTH_COOKIE_DOMAIN`: `sub` = mdm uuid, `username`, `roles`, `iss`, `aud`, `exp`;
- `fesmu_rt` — refresh на 30 дней (`AUTH_REFRESH_TTL`), только хост auth, путь
  `/api/v1/auth`. В БД (`refresh_tokens`) — sha256. Каждый refresh выдаёт новый
  и отзывает старый; повторно предъявленный старый отзывает всю цепочку.
  Роли при refresh берутся из MDM заново.

### Активация и смена пароля

- `/activate` — первый вход новой учётки: логин + код активации (выдаёт
  админ в fesmu, хранится в MDM) → новый пароль. auth ставит пароль в AD,
  снимает «сменить при входе», включает учётку, гасит код и сразу входит.
  Код гасится только после записи пароля: отказ по политике его не сжигает.
- `/password` — смена пароля самим пользователем по текущему, по Kerberos
  (kpasswd, `AUTH_KRB_*`): без служебной учётки и без LDAPS; работает и при
  «сменить при следующем входе». Форма входа сама ведёт сюда, если AD FS
  отказал, а у учётки pwdLastSet = 0 (флаг читается учёткой `AUTH_LDAP_*`,
  без попытки входа — счётчик блокировки AD не растёт).
- Активации нужны `AUTH_LDAP_PWD_*` (служебная учётка с правом «Сброс
  пароля», только ldaps://) и `AUTH_MDM_INTERNAL_TOKEN`. Не больше 10 попыток
  с IP за 5 минут. Без настроек — режим заглушки: в AD ничего не пишется.

Не нашёлся — токенов fesmu нет, `/me` отвечает `403 {"error":"not_linked"}`.
Ответы `/me`: `200 {uuid, username, roles}`, `401 expired` (вызвать refresh),
`403 not_linked`, `401 unauthenticated` (отправить на `/login`; при живой
SSO-сессии он выдаст токены без пароля).

Единственная таблица — `identities` (gorm AutoMigrate при старте). `User` из
[auth/v2/user.proto](api/contract/auth/v2/user.proto) — только контракт, в БД не хранится.

## Версии

Одна папка `services/auth` — текущий код. Старые реализации лежат в git, а не
в копиях папок: `git checkout auth/v1 -- services/auth` (SAML IdP + AD FS, был
в проде), `auth/v2` (OTP/refresh, лежал в `services/auth.v2`).

Версия **API** живёт в контракте и не совпадает с версией кода:

| Каталог | Пакет | Статус | Кто зовёт |
|---|---|---|---|
| [contract/auth/v2](api/contract/auth/v2) | `contract.auth.v2` | текущий | новые клиенты |
| [contract/auth/v1](api/contract/auth/v1) | `contract.auth.service` (историческое имя, входит в URL) | заморожен, deprecated | `services/sync` |

Оба API обслуживает один процесс на одном порту. v1 — тонкий адаптер
[identity_v1.grpc.go](api/internal/grpc/identity_v1.grpc.go) поверх того же
`IdentityService`, своей логики не держит.

Правила:
- совместимое изменение (новое поле с новым номером, новый RPC) — прямо в v2;
- ломающее (удалить/переименовать поле, сменить тип или смысл) — только новый `contract/auth/v3`;
- в v1 ничего не добавлять; `make breaking` проверяет, что он совпадает по проводу с прод-контрактом (тег `auth/v1`);
- когда `sync` переедет на v2 — удалить `contract/auth/v1` и `identity_v1.grpc.go`.

## Справочник `identities` — связка AD ↔ MDM

auth здесь только **связующее звено**: `object_guid` (неизменяемый ключ AD) ↔
`mdm_id` (запись в MDM), плюс `email` для сверки. Всё содержательное о
человеке (ФИО, паспорт, отдел и т.п.) хранится в MDM, не тут — auth это
осознанно не дублирует.

`mdm_id` auth сам не ищет и в MDM не ходит: связку записывает внешний
сервис через `BatchLinkMDM2AD`.

Опционально: пустой `AUTH_DB_NAME` → справочник не поднимается. Схема — gorm AutoMigrate (SQL-версия для истории:
[db/migrations/auth](api/db/migrations/auth)).

Слои: [models.Identity](api/internal/domain/models/identity.models.go) →
[storage.IdentityStorage](api/internal/storage/identity.storage.go) →
[service.IdentityService](api/internal/service/identity.service.go) →
[grpc.IdentityHandler](api/internal/grpc/identity.grpc.go).

### Connect-RPC `IdentityService`

Контракт: [contract/auth/v2/identity.proto](api/contract/auth/v2/identity.proto) (`contract.auth.v2.IdentityService`).
Служебный RPC — вызывается сервисами, не браузером.

| RPC | Назначение |
|---|---|
| `FetchIdentityByID(id)` | одна запись по `id`; нет записи — `NotFound` |
| `FetchIdentity(page, page_size, mdm_id, object_guid, email, login, linked)` | список с пагинацией (`page` с 1, `page_size` 0 → 50, максимум 500) и `total`. Пустой фильтр не применяется; `mdm_id`/`object_guid` — точное совпадение, `email`/`login` — подстрока без учёта регистра, `linked` — есть/нет привязки к MDM |
| `BatchLinkMDM2AD(links[])` | массив пар `{mdm_id, object_guid}` → записать связку AD↔MDM. Один невалидный элемент отклоняет весь запрос (`InvalidArgument`); дубли `object_guid` в запросе — побеждает последний |

Авторизация всех RPC: заголовок `Authorization: Bearer <AUTH_INTERNAL_TOKEN>`. Пустой
`AUTH_INTERNAL_TOKEN` на сервере — RPC отклоняет любой запрос.

## Локальная проверка

```
cd api
go run ./cmd --config=config/local.yaml
go test ./...
```

Тесты `internal/storage` против реального Postgres:
`AUTH_TEST_DB_DSN="host=... dbname=..." go test ./internal/storage/`.

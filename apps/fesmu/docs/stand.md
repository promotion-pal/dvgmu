# Тестовый стенд fesmu рядом с продом

```
/home/rostik/work/fesmu       main         прод (core.fesmu.ru)
/home/rostik/work/fesmu-3.0   release/3.0  стенд (APP_DOMAIN / API_DOMAIN)
```

`docker-compose.yml` один на оба: без `STAND` в `.env` — прежние прод-имена
(`fesmu_core_app`, `fesmu_core_api`, core.fesmu.ru), с `STAND=3_0` — свои
контейнеры `fesmu_core_3_0_*`, роутеры и домены.

**На стенде всегда `./stand.sh …`, не голый `docker compose`** — без `STAND`
скрипт откажется работать.

Стенд ходит в mdm стенда (`PACKAGE_MDM=http://dvgmu_apps_3_0_mdm_api:4000`),
а базы закупок/инфраструктуры — общие с продом. api при старте применяет свои
миграции, поэтому стенд можно поднимать, только пока в release/3.0 нет новых
миграций относительно того, что уже применено в проде. Появятся — стенду нужны
копии баз, как у mdm (dvgmu_apps/docs/stand.md).

## .env стенда

Скопировать `.env` прода и дописать:

```
STAND=3_0
APP_DOMAIN=core3.fesmu.ru
API_DOMAIN=api.core3.fesmu.ru
VITE_API_URL=https://api.core3.fesmu.ru
PACKAGE_MDM=http://dvgmu_apps_3_0_mdm_api:4000
ALLOWED_ORIGINS=https://core3.fesmu.ru
```

(`PACKAGE_MDM`/`ALLOWED_ORIGINS` уже есть в `.env` — последнее значение в
файле перекрывает прежнее.)

## Вход (3.0)

Пароля сайта (`VITE_ACCESS_PASSWORD`) больше нет: страницы приложения пускают
только после входа через auth (`VITE_AUTH_URL`, по умолчанию
https://auth.fesmu.ru), api проверяет access-токен из cookie `fesmu_at` по
публичному ключу auth. Публичные страницы (`/schedule`, `/vaccination`,
`/tests/take/…`) — без входа, как и раньше.

В `.env` стенда:

```
AUTH_SERVICE_URL=http://dvgmu_apps_3_0_auth_api:4000
VITE_AUTH_URL=https://auth.fesmu.ru
```

Пустой `AUTH_SERVICE_URL` — api без защиты. `AUTH_SESSION_COOKIE_NAME`, если остался из прода, удалить (по умолчанию
`fesmu_at`). «Роли» и «Авторизация» — только для роли ADMIN (и в меню, и в api).

## Роли и разделы

Роли назначаются в MDM (Администрирование → Роли). Раскладка одна для api
(`internal/app/app.go`, `Interceptor.Access`) и фронта
(`shared/config/access.ts`, меню `widgets/layout/sidebar/nav.ts`, маршруты `App.tsx`):

| Раздел | Роли |
|---|---|
| Профиль | все, кто вошёл (технические поля — только ADMIN) |
| Заказать справку, расписание (просмотр) | STUDENT |
| Тесты (конструктор, сессии) | TEACHER |
| Инфраструктура, инвентарь, заявки, люди, расписание (правка), залы, компьютерные классы, вакцинация, закупки, задолженность | STAFF |
| Библиотека: каталог, опубликованные методички, читалка | все, кто вошёл |
| Роли, Авторизация | ADMIN |

ADMIN проходит любую проверку. Сервис api, которого нет в карте, — только ADMIN.

**Права** — действия внутри раздела, выдаются конкретному человеку (Роли →
«Права»), у ADMIN есть все. Каталог: `shared/config/permissions.ts` и
`api/internal/auth/permissions.go`.

| Право | Что даёт |
|---|---|
| `certificate.view` — просмотр справок | раздел «Справки»: журнал заказов |
| `certificate.issue` — выдача справок | «Выдать»/«Печать» в журнале, «Сформировать за студента» |

Студент заказывает справку только на себя (api проверяет по токену).

## Библиотека (3.0)

Каталог изданий, методички по дисциплинам и позиции чтения — своя база
`library_db` (модуль `api/internal/modules/library`). Недоступна — не
работает только библиотека. В `.env`:

```
POSTGRES_HOST_LIBRARY=fesmu_core_library_db
POSTGRES_USER_LIBRARY=…
POSTGRES_PASSWORD_LIBRARY=…
POSTGRES_DB_LIBRARY=fesmu_core_library_db
```

База — `fesmu_core_library_db` из `docker-compose.dev.yml`; порт наружу не
проброшен, api достаёт её только по `traefik-network`. Порт по умолчанию — 5432
(`POSTGRES_PORT_LIBRARY` — только если другой).

Файлы хранит сервис files (`PACKAGE_FILES`): издания — `library/books`,
рисунки и вложения методичек — `library/manuals` (по `FileType`). Нужен files
с миграцией `00002_files_on_disk` (dvgmu_apps, release/3.0).

Читать может любой, кто вошёл; менять — по доступам: `library.post` —
издания каталога, `manuals.post` — писать и публиковать методички.

## При вливании release/3.0 в main

Ключи сервисов сменились (`fesmu_core_app` → `core_app`, `fesmu_core_api` →
`core_api`), имена контейнеров прода прежние. Первый деплой прода:
`docker compose up -d --build --remove-orphans`.

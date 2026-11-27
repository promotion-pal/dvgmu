# DVGМУ

Монорепозиторий включает личный кабинет (`apps/lk`), API Gateway, Auth, MDM и Tickets; сервисы написаны на Go, контракты хранятся в protobuf.

## Требования

- Docker Compose
- Node.js и pnpm (версия из `package.json`)
- Go
- Buf CLI для генерации protobuf
- Atlas CLI для команд миграций

## Первичная настройка

```sh
cp .env.example .env
pnpm install
```

`.env` используется Docker Compose. Локальный файл не добавляется в Git.

## Основные команды Make

| Команда | Действие |
| --- | --- |
| `make dev` | Собирает и запускает Postgres, Tickets, MDM, Auth и API Gateway в Docker, затем запускает Vite. Фронтенд доступен на `http://localhost:5173`, Gateway — `4052`, Auth — `4053`, API задач — `4050`, MDM — `4051`. |
| `make dev-stop` | Останавливает локальные контейнеры. Данные Postgres сохраняются в Docker volumes. |
| `make prod-up` | Собирает и запускает MDM, Tickets, Auth, Gateway и LK через production Compose. Traefik делит `api.mentor.fesmu.ru`: `/api/*` идёт в Gateway, остальные маршруты — в LK. |
| `make prod-down` | Останавливает production сервисы без удаления данных Postgres. |
| `make lk-prod-up` / `make lk-prod-down` | Отдельно запускает или останавливает LK за Traefik, если backend уже поднят. |
| `make set-admin` | Интерактивно создаёт первого администратора в новой production-базе MDM; старую базу не использует. |
| `make panel-up` | Запускает Plane локально с публикацией портов 80/443; настройки и секреты — в `apps/panel/plane-app/plane.env`. |
| `make panel-prod-up` | Запускает Plane за существующим Traefik на `mentor.fesmu.ru`; требует `plane.env`, `plane.prod.env` и внешнюю Docker-сеть `traefik-network`. |
| `make panel-down` / `make panel-prod-down` | Останавливает локальный или Traefik-вариант Plane, сохраняя Docker volumes. |
| `make panel-ps` / `make panel-logs` | Показывает состояние контейнеров или следит за логами Plane. |
| `make auth-test-user` | Создаёт или обновляет тестовую учетную запись Auth по `AUTH_TEST_USER_ID`, `AUTH_TEST_EMAIL` и `AUTH_TEST_PASSWORD` из `.env`. |
| `make proto` | Генерирует Go и TypeScript код из protobuf-контрактов в `services/tickets/contract`. |
| `make tickets-migrate-status` | Показывает состояние миграций Atlas. |
| `make tickets-migrate-diff` | Создаёт миграцию на основе Go-моделей. |
| `make tickets-migrate-lint` | Проверяет последние миграции. |
| `make mdm-migrate-status` | Показывает состояние миграций MDM. |
| `make mdm-migrate-diff` | Создаёт миграцию MDM на основе Go-моделей. |
| `make mdm-migrate-lint` | Проверяет последние миграции MDM. |

Для локальной разработки сервис использует настройки `services/tickets/config/local.yaml`; значения подключения к Postgres можно менять через `.env`.

Миграционные команды выполняются из `services/tickets` и требуют установленного Atlas CLI. Для проверки production Compose:

```sh
docker compose -f services/tickets/docker-compose.yml config
```

Auth сейчас использует отдельную тестовую таблицу `auth_test_identities` для имитации внешнего провайдера, получает профиль, роли и permissions из MDM и выдает JWT. Позже тестовый адаптер заменяется на OIDC-подключение к AD FS; данные пользователей остаются в MDM. Отдельный sync-сервис для обмена изменениями профиля с AD добавим позже. Настройки БД и upstream-адреса Gateway находятся в `.env.example`.

## Архитектура API

```text
Браузер → API Gateway → Auth / MDM / Tickets
                          Auth → MDM
                    Tickets → MDM
```

- Браузер обращается к единому Gateway. При `VERSION=dev` используется `http://localhost:4052`, при `VERSION=prod` — текущий домен сайта; маршруты `/api/auth/*`, `/api/mdm/*` и `/api/tickets/*` направляются в соответствующие сервисы.
- Вход выполняет Auth. Текущий тестовый провайдер проверяет учетную запись в своей БД, связывает её с ID пользователя MDM, загружает из MDM профиль, роли и permissions и подписывает JWT.
- Gateway проверяет подпись, issuer и срок JWT. Он удаляет входящие identity-заголовки клиента и сам добавляет проверенные ID, роли, permissions и межсервисный секрет.
- Tickets получает ID из доверенного заголовка Gateway, проверяет `TASK_READ` или `TASK_CREATE` через MDM и сохраняет задачу с владельцем. ID пользователя в protobuf-запросе больше не передаётся.
- MDM разрешает пользователю читать только собственный профиль; список пользователей и изменения доступны админу. Auth использует отдельный внутренний токен для чтения профиля перед выдачей JWT.
- Базы разделены по сервисам: `dvgmu_tickets_db`, `dvgmu_mdm_db` и `dvgmu_auth_db`. В production Compose только Gateway публикуется во внешнюю сеть Traefik; Auth, MDM и Tickets принимают соединения из внутренней сети сервисов.

Для production запуска используется `make prod-up`. Убедитесь, что DNS `api.mentor.fesmu.ru` указывает на сервер Traefik, доступны его entrypoint `websecure` и certificate resolver `letsencrypt`, а внешняя сеть `traefik-network` уже создана. Make создаёт сеть `dvgmu-backend`; Gateway подключён к обеим сетям, Auth, MDM и Tickets доступны только внутри backend-сети, а LK — через Traefik.

Traefik маршрутизирует `https://api.mentor.fesmu.ru/api/*` в API Gateway; запросы к корню и остальным путям хоста получает LK. Под `/api` находятся `/api/auth/*`, `/api/mdm/*` и `/api/tickets/*`. Gateway router имеет больший приоритет, чем SPA-router LK. Для production в корневом `.env` задайте `VERSION=prod`; LK использует текущий домен как базовый адрес API и добавляет `/api/...`. Для локальной разработки используйте `VERSION=dev`, тогда LK обращается к Gateway на `http://localhost:4052`. В `.env` задайте `GATEWAY_DOMAIN=api.mentor.fesmu.ru`, `APP_DOMAIN=api.mentor.fesmu.ru`, `GATEWAY_PROD_ALLOWED_ORIGINS=https://api.mentor.fesmu.ru` и `MDM_ALLOWED_ORIGINS=https://api.mentor.fesmu.ru`.

Plane запускается отдельно от сервисов портала. Описание локального запуска и Traefik-варианта на `mentor.fesmu.ru` находится в `apps/panel/README.md`.

В локальной разработке LK использует Gateway на `localhost:4052`; production-контейнер собирается из pnpm workspace через `apps/lk/Dockerfile`, затем Nginx отдаёт SPA через Traefik. Для полного запуска на сервере используйте `make prod-up`; для одной LK при работающем backend — `make lk-prod-up`.

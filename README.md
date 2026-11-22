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
| `make prod-up` | Создаёт внутреннюю сеть, собирает и запускает MDM, Tickets, Auth и Gateway через production Compose. Требуется уже работающий Traefik и его сеть `traefik-network`. |
| `make prod-down` | Останавливает production сервисы без удаления данных Postgres. |
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

- Браузер обращается к единому адресу `VITE_GATEWAY_URL`. `/auth/*` направляется в Auth, `/api/mdm/*` — в MDM, `/api/tickets/*` — в Tickets.
- Вход выполняет Auth. Текущий тестовый провайдер проверяет учетную запись в своей БД, связывает её с ID пользователя MDM, загружает из MDM профиль, роли и permissions и подписывает JWT.
- Gateway проверяет подпись, issuer и срок JWT. Он удаляет входящие identity-заголовки клиента и сам добавляет проверенные ID, роли, permissions и межсервисный секрет.
- Tickets получает ID из доверенного заголовка Gateway, проверяет `TASK_READ` или `TASK_CREATE` через MDM и сохраняет задачу с владельцем. ID пользователя в protobuf-запросе больше не передаётся.
- MDM разрешает пользователю читать только собственный профиль; список пользователей и изменения доступны админу. Auth использует отдельный внутренний токен для чтения профиля перед выдачей JWT.
- Базы разделены по сервисам: `dvgmu_tickets_db`, `dvgmu_mdm_db` и `dvgmu_auth_db`. В production Compose только Gateway публикуется во внешнюю сеть Traefik; Auth, MDM и Tickets принимают соединения из внутренней сети сервисов.

Для production запуска используется `make prod-up`. Перед запуском нужны настройки домена/сертификата Traefik в `.env` и уже созданная Traefik сеть `traefik-network`. Make создаёт сеть `dvgmu-backend`; к сети Traefik подключается только Gateway, а Auth, MDM и Tickets доступны только внутри backend-сети.

Фронтенд по умолчанию использует Gateway на `localhost:4052` в dev и origin страницы в production. Если API размещён на отдельном домене, задайте `VITE_GATEWAY_URL` при сборке фронтенда и добавьте этот origin в `GATEWAY_PROD_ALLOWED_ORIGINS`.

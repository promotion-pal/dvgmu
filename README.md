# DVGМУ

Монорепозиторий включает фронтенд личного кабинета (`apps/lk`), protobuf-контракты (`services/tickets/contract`) и сервис задач на Go (`services/tickets`).

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
| `make dev` | Собирает и запускает Postgres и сервис задач в Docker, затем запускает Vite для личного кабинета. Фронтенд доступен на `http://localhost:5173`, API — на порту `4050`. |
| `make dev-stop` | Останавливает локальные контейнеры. Данные базы сохраняются в Docker volume. |
| `make proto` | Генерирует Go и TypeScript код из protobuf-контрактов в `services/tickets/contract`. |
| `make tickets-migrate-status` | Показывает состояние миграций Atlas. |
| `make tickets-migrate-diff` | Создаёт миграцию на основе Go-моделей. |
| `make tickets-migrate-lint` | Проверяет последние миграции. |

Для локальной разработки сервис использует настройки `services/tickets/config/local.yaml`; значения подключения к Postgres можно менять через `.env`.

Миграционные команды выполняются из `services/tickets` и требуют установленного Atlas CLI. Для проверки production Compose:

```sh
docker compose -f services/tickets/docker-compose.yml config
```

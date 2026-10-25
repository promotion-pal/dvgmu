# fesmu — монорепозиторий ДВГМУ

Портал fesmu, общие сервисы (вход, MDM, аналитика, заявки, файлы…) и сайты в одном
репозитории. Собран из `dvgmu_apps` и `fesmu` (ветки release/3.0).

Как сервисы связаны, как работает вход и общие схемы — [ARCHITECTURE.md](ARCHITECTURE.md).
Локальный запуск всего портала без AD — `make dev-up` (раздел 7 там же).

## Устройство

```
apps/
  fesmu/api           бэкенд портала (Go)
  fesmu/web           фронтенд портала (React + Vite)
  ksm, guide, profile, unistom, course   статические сайты
services/             сервисы — у каждого своя БД, compose, .env; схемы в api/contract
packages/
  go/                 Go-модуль fesmu/contract — сгенерированный Go всех схем
  ts/                 пакет @fesmu/contract — сгенерированный TS всех схем
buf.yaml              workspace всех схем
buf.gen.yaml          генерация всех схем
Makefile              make proto, make proto-check
```

## Схемы — только buf

- Схема лежит у владельца в папке с его именем:
  `services/mdm/api/contract/mdm/{entity,enum,service}`,
  `apps/fesmu/api/contract/fesmu/{entity,enum,service}/vN`, у auth — `auth/v1`, `auth/v2`.
- Путь файла начинается с имени владельца, поэтому он уникален всегда, а импорт показывает,
  чья это схема: `import "mdm/entity/user.entity.proto"`.
- Сгенерированный код лежит только в `packages/`. В сервисах сгенерированного кода нет.

```bash
make proto         # buf generate: Go → packages/go, TS → packages/ts
make proto-check   # сгенерированный код совпадает со схемами (это же в CI)
```

**Go.** Один модуль `fesmu/contract` в `packages/go`. Go-пакет = `fesmu/contract/` + папка
схемы: `fesmu/contract/mdm/entity`, `fesmu/contract/fesmu/service/v1`,
`fesmu/contract/auth/v2`. Бэкенд подключает модуль в своём `go.mod`:

```
require fesmu/contract v0.0.0
replace fesmu/contract => ../../../packages/go
```

Поэтому Docker-образ бэкенда собирается из корня репозитория: ему нужны и папка api, и
`packages/go`.

**TS.** Пакет `@fesmu/contract` в `packages/ts`, по владельцам:
`@fesmu/contract/mdm/entity/user.entity_pb`, `@fesmu/contract/fesmu/entity/v1/…`,
`@fesmu/contract/auth/v2/…`. Приложение подключает одну зависимость
`"@fesmu/contract": "workspace:*"`.

dormitory, mentor и ojs — отдельные модули со своей генерацией, в общую схему не входят.
У dormitory и mentor имена proto-пакетов совпадают с mdm (`contract.entity.User`): папка
решает конфликт путей, но не имён — для них нужна новая версия API с уникальными пакетами.

**Фронт — один pnpm workspace.** В корне `package.json`, `pnpm-workspace.yaml`,
`pnpm-lock.yaml`. Веб fesmu берёт `@fesmu/contract` из `packages/ts`. Docker-образ веба
собирается из корня, но в контекст попадает только нужное — см.
`apps/fesmu/web/Dockerfile.dockerignore`.

```bash
pnpm install
cd apps/fesmu/web && pnpm dev
```

## Стенд и прод

Один скрипт для сервисов и приложений; без `STAND=…` в `.env` он откажется работать, чтобы
не задеть прод-контейнеры:

```bash
./stand.sh mdm up -d --build
./stand.sh fesmu up -d --build
```

`.env` в git не хранятся — на сервере их нужно положить в новые пути
(`services/<svc>/.env`, `apps/fesmu/.env`).

## Перед первым push

- `.github/workflows/deploy.yml` перенесён из `dvgmu_apps` как есть: он выкатывает сервисы на
  прод из `/home/rostik/work/dvgmu_apps`. До переключения прода на этот репозиторий его нужно
  перенастроить (путь `ROOT`, фильтры путей, выкатку fesmu).
- Подробности по старым частям: `docs/PROJECT_OVERVIEW.md`, `docs/stand.md`, `apps/fesmu/docs/`.

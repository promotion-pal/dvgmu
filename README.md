# fesmu — монорепозиторий ДВГМУ

Портал fesmu, общие сервисы (вход, MDM, аналитика, заявки, файлы…) и сайты в одном
репозитории. Собран из `dvgmu_apps` и `fesmu` (ветки release/3.0).

## Устройство

```
apps/
  fesmu/api           бэкенд портала (Go) — свой go.mod и Dockerfile
  fesmu/web           фронтенд портала (React + Vite)
  ksm, guide, profile, unistom, course   статические сайты
services/             сервисы — у каждого своя БД, compose, .env и контракт в api/contract
packages/             @dvgmu/contract — сгенерированный TS всех схем, один пакет:
  package.json        единственный: имя, exports, @bufbuild/protobuf
  fesmu/              схемы apps/fesmu/api/contract
  analytics/ auth/ file/ mdm/ notification/ tickets/   схемы сервисов
buf.yaml              общий buf workspace всех контрактов
Makefile              make proto — генерация всего
scripts/contracts.sh  генератор (его вызывает make proto)
```

## Контракты — одна схема, один генератор

- Схема живёт только у владельца и лежит плоско:
  `services/<svc>/api/contract/{entity,enum,service}`, `apps/fesmu/api/contract/{entity,enum,service}/vN`.
- Корневой `buf.yaml` собирает все контракты в один workspace. Пути файлов уникальны,
  поэтому схемы ссылаются друг на друга напрямую: `import "entity/user.entity.proto"` — это mdm.
- Одна команда обновляет всё:

```bash
make proto         # Go → services/*/api/contract/gen/go и apps/fesmu/api/contract/gen/go
                   # TS → packages/<имя> (@dvgmu/contract/<имя>/…)
make proto-check   # сгенерированный код совпадает со схемами (это же в CI)
```

Что делает генератор:

- **Go сервиса** — в папку сервиса. Если сервису нужны чужие схемы (file → mdm), их Go
  ложится в подпапку `gen/go/<сервис>`. Бэкенд собирается из своей папки.
- **Go fesmu** — свои схемы и клиенты сервисов (analytics, auth, file, mdm, tickets) в
  `apps/fesmu/api/contract/gen/go/<сервис>`.
- **TS** — плоско в `packages/<имя>`. Все папки — один пакет `@dvgmu/contract` с одним
  `packages/package.json`. Приложение подключает одну зависимость и видит все схемы:
  `@dvgmu/contract/mdm/entity/user.entity_pb`. Ссылка на чужую схему внутри пакета — тот же
  путь, копий нет. `exports` разрешает пути и с `.js`, и без. Корневой `package.json`
  зависит от `@dvgmu/contract`, чтобы этот путь находился из любой папки репозитория.

dormitory, mentor и ojs — отдельные модули со своей генерацией, в общую схему не входят.
У dormitory и mentor имена proto-пакетов совпадают с mdm (`contract.entity`), поэтому
в один workspace с mdm их не добавлять без новой версии API.

**Фронт — один pnpm workspace.** В корне `package.json`, `pnpm-workspace.yaml`,
`pnpm-lock.yaml`. Веб fesmu берёт `@dvgmu/contract` из `packages/`. Docker-образ веба
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

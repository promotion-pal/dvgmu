# fesmu — монорепозиторий ДВГМУ

Портал fesmu, общие сервисы (вход, MDM, аналитика, заявки, файлы…) и сайты в одном
репозитории. Собран из `dvgmu_apps` и `fesmu` (ветки release/3.0).

## Устройство

```
apps/                 приложения — то, что видит пользователь
  fesmu/
    api/              бэкенд портала (Go, Connect-RPC) — свой go.mod, свой Dockerfile
    web/              фронтенд портала (React + Vite)
    docker-compose.yml, stand.sh, docs/
  ksm, guide, profile, unistom, course   статические сайты
services/             общие сервисы — у каждого своя БД, compose и .env
  auth/ mdm/ analytics/ tickets/ file/ notification/ sync/ dormitory/ mentor/ ojs/ dvgmu_wiki/
proto/                единая схема данных — зеркало контрактов всех сервисов (генерируется)
packages/             общие фронтовые пакеты (pnpm workspace)
  contract/           @dvgmu/contract — TS всех сервисов и fesmu, один на все фронты
scripts/              служебные скрипты (contracts.sh)
buf.yaml              buf workspace: контракт fesmu + модули proto/<имя>
utils/                разовые утилиты
```

## Правила, ради которых всё так устроено

**Каждый бэкенд собирается из своей папки.** `services/<svc>/api` и `apps/fesmu/api` —
отдельные Go-модули с собственным Dockerfile и контекстом сборки. Ничего из соседних папок им
не нужно, поэтому любой бэкенд можно унести на другой сервер (или в свой репозиторий),
скопировав одну папку.

**Единая схема данных.** Источник правды — контракт сервиса: `services/<svc>/api/contract`.

- `proto/<имя>/packages/<имя>/…` — зеркало контракта каждого сервиса с уникальными путями
  файлов. Общее для всех приложений, руками не правится.
- `@dvgmu/contract` (`packages/contract`) — один TS на всё: `@dvgmu/contract/packages/<имя>/…`
  для сервисов (analytics, auth, dormitory, files, mdm, mentor, notification, tasks) и
  `@dvgmu/contract/{entity,enum,service}/v1…` для fesmu.
- Бэкенд приложения получает Go-клиенты нужных сервисов генерацией прямо в свою папку
  (`apps/fesmu/api/contract/gen/go/packages/<имя>`) — копий `.proto` у приложений нет, а
  собирается бэкенд по-прежнему из своей папки.

```bash
scripts/contracts.sh gen     # после правки контракта сервиса или fesmu: зеркало + TS + Go fesmu
scripts/contracts.sh check   # зеркало совпадает с сервисами (это же проверяет CI)
```

Имена proto-пакетов у mdm, dormitory и mentor совпадают (`contract.entity`, `contract.service`),
поэтому модули `proto/<имя>` генерируются по одному, а не всем workspace разом. Переименовывать
их нельзя без новой версии API: имя пакета — часть адреса вызова на проде.

Сервис со своим сайтом (dormitory, mentor) пока держит и собственный TS в
`services/<svc>/packages` — сайт собирается вместе с сервисом. Новые фронты берут
`@dvgmu/contract`.

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

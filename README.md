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
packages/             общие фронтовые пакеты (pnpm workspace)
  contract/           @dvgmu/contract — TS-клиенты контрактов для веба
scripts/              служебные скрипты (sync-contracts.sh)
utils/                разовые утилиты
```

## Правила, ради которых всё так устроено

**Каждый бэкенд собирается из своей папки.** `services/<svc>/api` и `apps/fesmu/api` —
отдельные Go-модули с собственным Dockerfile и контекстом сборки. Ничего из соседних папок им
не нужно, поэтому любой бэкенд можно унести на другой сервер (или в свой репозиторий),
скопировав одну папку.

**Контракт сервиса живёт в сервисе.** Источник правды — `services/<svc>/api/contract`.
Приложение, которое ходит в сервис, держит копию нужных `.proto` у себя
(`apps/fesmu/api/contract/packages/<name>/`), чтобы оставаться самостоятельным. Копии руками не
правим:

```bash
scripts/sync-contracts.sh            # подтянуть изменения из сервисов
cd apps/fesmu/api/contract && buf generate   # Go для api + TS в packages/contract
scripts/sync-contracts.sh --check    # проверка, её же запускает CI
```

После `buf generate` файлы, где поменялась только строка-заголовок с версией генератора,
откатываем.

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

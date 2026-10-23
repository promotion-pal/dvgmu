# Тестовый стенд рядом с продом

Прод и стенд — две рабочие копии одного репозитория на сервере:

```
/home/rostik/work/dvgmu_apps       main         прод (деплоит CI на push в main)
/home/rostik/work/dvgmu_apps-3.0   release/3.0  стенд новой версии
```

Один и тот же `docker-compose.yml` даёт разные имена в зависимости от `STAND`
в `.env` сервиса:

| | прод (`STAND` нет) | стенд (`STAND=3_0`) |
|---|---|---|
| проект compose | `auth` | `dvgmu_apps_3_0_auth` |
| контейнеры | `dvgmu_apps_auth_api`, `…_db` | `dvgmu_apps_3_0_auth_api`, `…_db` |
| том / папка БД | `auth_dvgmu_apps_auth_pgdata` | `dvgmu_apps_3_0_auth_dvgmu_apps_auth_pgdata` |
| роутер Traefik | `auth-secure` | `auth-3_0-secure` |
| домен | `AUTH_DOMAIN` (по умолчанию auth.dvgmu.promotion-pal.ru) | `AUTH_DOMAIN=auth.fesmu.ru` |

БД сидят только во внутренней сети своего проекта, хост БД зашит в compose
(`auth_db`, `mdm_db`) — стенд не может подключиться к прод-базе, даже если в
`.env` остался старый `AUTH_DB_HOST`.

**На стенде всегда `./stand.sh <сервис> …`, не голый `docker compose`.**
Скрипт откажется работать без `STAND` в `.env` — иначе compose возьмёт
прод-имена и пересоздаст прод-контейнеры.

## Первый запуск (auth + mdm)

```bash
cd /home/rostik/work/dvgmu_apps-3.0
git pull
docker compose version            # нужна v2.20+ (вложенные ${A:+…${B}})

# .env стенда (скопированы из прода) — дописать:
printf '\nSTAND=3_0\n' >> services/mdm/.env
printf '\nSTAND=3_0\nAUTH_DOMAIN=auth.fesmu.ru\nALLOWED_ORIGINS=https://core.fesmu.ru\n' >> services/auth/.env

# проверить имена ДО запуска — везде должно быть 3_0
./stand.sh mdm  config | grep -E 'container_name'
./stand.sh auth config | grep -E 'container_name|Host\('
```

### mdm: копия прод-данных

Стенд mdm стартует с пустой папкой `./db`. Чтобы проверять роли на реальных
пользователях — перелить прод-базу (прод только читается):

```bash
cd /home/rostik/work/dvgmu_apps-3.0
set -a; . services/mdm/.env; set +a      # POSTGRES_USER / POSTGRES_DB

./stand.sh mdm up -d mdm_db              # только БД стенда, api пока нет
docker exec dvgmu_apps_mdm_db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > /tmp/mdm.dump
docker exec -i dvgmu_apps_3_0_mdm_db pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner < /tmp/mdm.dump
rm /tmp/mdm.dump

./stand.sh mdm up -d --build             # api стенда применит миграции 3.0 к копии
./stand.sh mdm logs -f mdm_api           # ждать "database migrations applied"
```

### auth

```bash
./stand.sh auth up -d --build
./stand.sh auth logs -f auth_api
```

`auth.fesmu.ru` должен смотреть на сервер (DNS) — сертификат Traefik выпустит сам.

### sync: связки AD ↔ MDM

С 3.0 sync читает и пишет связки в mdm (`users.ad_object_id`), auth ему не
нужен. Запись в mdm закрыта токеном — один и тот же `MDM_INTERNAL_TOKEN` в
`services/mdm/.env` и `services/sync/.env`:

```bash
TOKEN=$(openssl rand -hex 32)
printf '\nMDM_INTERNAL_TOKEN=%s\n' "$TOKEN" >> services/mdm/.env
printf '\nSTAND=3_0\nMDM_INTERNAL_TOKEN=%s\n' "$TOKEN" >> services/sync/.env
./stand.sh mdm up -d --build

./stand.sh sync build
# только чтение: отчёт по находкам
./stand.sh sync run --rm sync_api ./sync --config=config/prod.yaml --once
# записать связки unlinked_but_exists в mdm стенда (в AD ничего не пишет)
./stand.sh sync run --rm sync_api ./sync --config=config/prod.yaml --link-unlinked
```

### Проверка, что прод не тронут

```bash
docker ps --format '{{.Names}}\t{{.Status}}' | grep -E 'auth|mdm'
# прод-контейнеры dvgmu_apps_auth_*, dvgmu_apps_mdm_* — Up с прежним временем старта
```

## Обновить / остановить стенд

```bash
cd /home/rostik/work/dvgmu_apps-3.0 && git pull
./stand.sh auth up -d --build

./stand.sh auth down          # остановить, данные стенда сохраняются
./stand.sh auth down -v       # остановить и удалить том БД стенда
```

## Первый администратор

Роли назначает только ADMIN, поэтому первого — один раз прямо в базе mdm
(дальше всё через страницу «Роли» в fesmu; заведите сразу второго):

```bash
docker exec -i dvgmu_apps_3_0_mdm_db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<'SQL'
INSERT INTO user_roles (user_id, role)
SELECT id, 4 FROM users WHERE lower(username) = 'konoplev_rr'   -- 4 = ADMIN
ON CONFLICT DO NOTHING;
SQL
```

Роль попадает в токен при следующем входе или обновлении токена (≤ 15 мин).
В проде — то же самое для `dvgmu_apps_mdm_db` при переходе.

## При вливании release/3.0 в main

- Ключи сервисов сменились (`dvgmu_apps_auth_api` → `auth_api`, mdm так же),
  имена контейнеров и томов прода — прежние. В `.github/workflows/deploy.yml`
  блок auth перевести на `docker compose build auth_api` и
  `docker compose up -d --no-deps --remove-orphans auth_db auth_api`
  (`--remove-orphans` уберёт контейнеры старых ключей). mdm в CI пока
  нет — на сервере один раз:
  `cd services/mdm && docker compose up -d --build --remove-orphans`.
- БД прода уходят из `traefik-network` во внутреннюю сеть проекта —
  снаружи к ним никто не подключается (проверено по репозиториям).

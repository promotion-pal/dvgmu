# Локальный портал целиком

```bash
make dev-up     # dev/docker-compose.yml: Postgres + сервисы + fesmu api + веб + adfs-mock
make dev-seed   # тестовые люди в MDM (после первого запуска)
make dev-logs
make dev-down   # остановить (данные Postgres сохраняются в томе)
```

| Что | Адрес |
|---|---|
| веб | http://localhost:18300 |
| fesmu api | http://localhost:18200 |
| auth | http://localhost:18201 |
| mdm | http://localhost:18205 |

Проект `fesmu_local`, порты только на 127.0.0.1. Прод и стенд не затрагиваются.

## Вход без AD

AD локально недоступен. Вместо AD FS работает `dev/adfs-mock`:
- протокол тот же — WS-Trust usernamemixed, поэтому код auth не меняется;
- пользователи — `dev/adfs-mock/users.json` (логин, пароль, objectGUID, ФИО, email);
- подпись ответа не проверяется, потому что `AUTH_ADFS_SIGNING_CERT_PEM` не задан. На проде сертификат задан.

| Логин | Пароль | MDM | Проверяет |
|---|---|---|---|
| `admin` | `admin123` | ADMIN | всю админку |
| `staff` | `staff123` | STAFF | ограничения прав |
| `nolink` | `nolink123` | нет | ответ `not_linked` |

**Новый тестовый пользователь:**
1. Добавь запись в `dev/adfs-mock/users.json` с новым objectGUID.
2. Добавь строку `add …` в `dev/seed.sh` (email, ФИО, тот же objectGUID, роль).
3. `docker compose -f dev/docker-compose.yml up -d --build adfs` и `make dev-seed`.

Связь человека с AD — `users.ad_object_id` в MDM. Роли — `UserRolesSet`.

**Ключ JWT** auth создаёт при каждом старте. После перезапуска auth войди заново.

**Не работает локально:** запись пароля в AD (`/activate`, `/password` — режим заглушки), SAML для Yandex 360, сверка `sync`.

## Реальные данные

Локальные базы пустые. Копия боевой базы:

```bash
docker exec dvgmu_apps_analytic_db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > analytics.dump   # на сервере
make dev-import DB=analytics FILE=analytics.dump                                                          # локально
```

`dev/import.sh` заменяет данные одной локальной базы и перезапускает её сервис. Копии mdm и analytics содержат персональные данные: не коммить, удалить после загрузки.

## Добавить сервис в локальный портал

В `dev/docker-compose.yml`:
- `build: { context: .., dockerfile: services/<svc>/api/Dockerfile }`;
- база — новая строка `CREATE DATABASE <svc>;` в `dev/postgres-init.sql`. Скрипт выполняется только на пустом томе: `docker compose -f dev/docker-compose.yml down -v` удалит данные;
- адрес сервиса для fesmu api — `PACKAGE_<NAME>: http://<svc>:4000`.

## Проверка вручную

```bash
J=/tmp/jar.txt
curl -s -c $J -X POST http://localhost:18201/login \
  --data-urlencode username=admin --data-urlencode password=admin123 \
  --data-urlencode return=http://localhost:18300/
curl -s -b $J http://localhost:18201/api/v1/auth/me
curl -s -b $J -X POST -H 'Content-Type: application/json' \
  http://localhost:18200/contract.service.v1.UserService/UserMe -d '{}'
```

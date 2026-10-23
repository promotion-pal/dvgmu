# yandex-scim — AD → Yandex 360, официальный синхронизатор Яндекса

Это не наш код — вендорский образ **YandexADSCIM**
(`registry.yandexcloud.net/cn1v24roe2k2kcqihnke/adscim`), который сам читает
пользователей из AD по LDAP и создаёт/обновляет их в Yandex 360 через SCIM
2.0 API. Мы только конфигурируем его через `.env` (см. ниже).

Специально вынесен в отдельный сервис, а не в `services/sync`: `sync` — наш
код (MDM↔AD, мы его пишем и тестируем), а `yandex-scim` — чужой бинарник со
своим циклом обновлений и своими секретами (OAuth-токен, Domain ID). У них
разный жизненный цикл, смешивать в одном docker-compose не стоит.

## Что нужно получить перед запуском (только вручную, через админку)

**1. OAuth-токен для SCIM API:**
1. Зарегистрировать приложение по инструкции Яндекс ID:
   https://yandex.ru/dev/id/doc/ru/register-api — логиниться под владельцем
   организации.
2. В разделе доступа к данным указать `scim` и выбрать **"Управление
   федерациями"**.
3. На странице приложения скопировать **ClientID** и **Client secret**.
4. Получить токен:
   ```bash
   curl -X POST https://oauth.yandex.ru/token \
     -d "grant_type=client_credentials&client_id=<ClientID>&client_secret=<Client secret>"
   ```
   Сохранить значение токена из ответа.

**2. Domain ID организации:**
1. https://admin.yandex.ru → **Общие настройки → Единый вход (SSO)** →
   **Настроить**.
2. В разделе синхронизации SCIM (появится после ввода ClientID из шага 1)
   будет ваш **Domain ID**.

## Настройка

```bash
cp .env.example .env
```

Заполнить в `.env` (обязательно только пароль и SCIM-значения — `LDAP_URL`/
`LDAP_BASE_DN`/`LDAP_BIND_DN` уже стоят по умолчанию теми же значениями, что
у `services/auth`, менять не нужно, если у вас та же инфраструктура):
- `LDAP_BIND_PASSWORD` — тот же пароль, что `AUTH_LDAP_BIND_PASSWORD` у
  `services/auth` (read-only бинд `ldapuser@dvgmu.local`, новый аккаунт не
  нужен).
- `SCIM_BEARER_TOKEN` — токен из шага 1 выше.
- `SCIM_DOMAIN_ID` — Domain ID из шага 2 выше.

`config/application.json` (сам JSON-конфиг для образа Яндекса) нужно создать
руками один раз, подставив в него реальные значения из `.env`. В git он не
коммитится (секреты внутри), структура:

```json
{
    "adscim": {
        "source": {
            "type": "active-directory",
            "ldap": {
                "urls": ["<LDAP_URL>"],
                "paths": ["<LDAP_BASE_DN>"],
                "username": "<LDAP_BIND_DN>",
                "password": {"value": "<LDAP_BIND_PASSWORD>"}
            }
        },
        "destination": {
            "scim": {
                "bearerToken": {"value": "<SCIM_BEARER_TOKEN>"},
                "domainId": "<SCIM_DOMAIN_ID>"
            }
        },
        "sync": {
            "dryRun": "<SCIM_DRY_RUN>",
            "intervalMinutes": "<SCIM_INTERVAL_MINUTES>"
        }
    }
}
```

## Запуск

**Сначала обязательно dry-run** (`SCIM_DRY_RUN=true` в `.env` — значение по
умолчанию):

```bash
docker compose up -d
docker compose logs -f dvgmu_apps_yandex_scim
```

В логах должно быть видно, какие операции *были бы* выполнены (создание/
обновление пользователей в Yandex 360), без реальных изменений. Проверить,
что количество и состав пользователей ожидаемые.

Если в dry-run всё выглядит верно — включить реальную синхронизацию:

```bash
# в .env: SCIM_DRY_RUN=false
docker compose up -d --force-recreate
```

## Проверка / типичные ошибки

```bash
docker compose exec dvgmu_apps_yandex_scim curl -f http://localhost:3402/actuator/health
docker compose ps
```

| Ошибка в логах | Причина |
|---|---|
| `LDAP connection failed` | нет доступа с этого сервера до `192.168.2.222:389` — файрвол |
| `Invalid credentials` (LDAP) | логин должен быть в формате UPN (`user@domain`), не голый `sAMAccountName` |
| `SCIM API authentication failed` | токен невалиден/истёк — получить заново (см. выше) |
| `Connection timeout` | исходящий 443 наружу (`scim-api.passport.yandex.net`) заблокирован |

## Доступы

Нужен сетевой доступ с сервера, где запущен контейнер, до `192.168.2.222:389`
(тот же LDAP, что у `auth`/`sync`) и исходящий HTTPS наружу до
`scim-api.passport.yandex.net:443`.

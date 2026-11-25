# Auth service

Auth содержит отдельную таблицу `auth_test_identities`. В ней хранятся только тестовая связка с ID пользователя MDM, тестовый email, subject и bcrypt-хэш пароля. Профиль, роли и permissions Auth получает из MDM и не копирует в свою базу.

Локальный провайдер `test-db` имитирует результат внешнего провайдера идентификации. Он проверяет учетные данные в таблице, передает общий `ExternalIdentity` в Auth, а `IdentityMapper` связывает его с MDM-пользователем. Auth загружает пользователя из MDM и выпускает JWT на 15 минут. JWT устанавливается как cookie `dvgmu_access_token` с `HttpOnly`, `SameSite=Lax` и `Path=/`; `Secure` выключен только в локальном dev и включён в production. Ответ содержит ID пользователя, но не токен.

HTTP-маршруты регистрирует выбранный `IdentityProvider`. Поэтому будущий адаптер AD FS сможет использовать OIDC Authorization Code и callback, передать проверенную внешнюю identity в тот же процесс сопоставления с MDM и выдачи JWT. Провайдер и `IdentityMapper` заменяются независимо от хранилища профилей, JWT и Gateway.

Локальный вход: `POST http://localhost:4052/api/auth/v1/auth/token` с JSON `{"email":"...","password":"..."}`. Браузер отправляет запросы с credentials. `GET /api/auth/v1/auth/session` проверяет и продлевает действующую сессию, `POST /api/auth/v1/auth/logout` очищает cookie. После заполнения `AUTH_TEST_USER_ID`, `AUTH_TEST_EMAIL` и `AUTH_TEST_PASSWORD` в `.env` выполни `make auth-test-user`. Команда добавит тестовую identity в БД Auth; пароль в таблице не хранится.

Подключение к MDM и адреса upstream Gateway вынесены в `.env.example`. У контейнеров переменные БД унифицированы как `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSLMODE`, а настройки хоста имеют префиксы сервиса: `TICKETS_DB_*`, `MDM_DB_*`, `AUTH_DB_*`.

# Auth service

Auth содержит отдельную таблицу `auth_identities`. В ней хранятся связка с ID пользователя MDM, email, subject и bcrypt-хэш пароля. Профиль, роли и permissions Auth получает из MDM и не копирует в свою базу.

Провайдер `auth-test-db` проверяет email и пароль в базе Auth, передает общий `ExternalIdentity` в Auth, а `IdentityMapper` связывает его с MDM-пользователем. Старое значение `AUTH_PROVIDER=test-db` временно поддерживается для совместимости. После проверки Auth загружает пользователя из MDM и выпускает JWT на 15 минут. JWT устанавливается как cookie `dvgmu_access_token` с `HttpOnly`, `SameSite=Lax` и `Path=/`; `Secure` выключен только в локальном dev и включён в production. Ответ содержит ID пользователя, но не токен.

HTTP-маршруты регистрирует выбранный `IdentityProvider`. Поэтому будущий адаптер AD FS сможет использовать OIDC Authorization Code и callback, передать проверенную внешнюю identity в тот же процесс сопоставления с MDM и выдачи JWT. Провайдер и `IdentityMapper` заменяются независимо от хранилища профилей, JWT и Gateway.

Для начальной настройки запусти `make set-admin`, чтобы создать профиль администратора в MDM, затем `make set-login`, чтобы привязать к напечатанному MDM ID email и пароль. `set-login` сначала проверяет, что пользователь существует и активен в MDM, затем сохраняет пароль в Auth как bcrypt-хэш. Для входа фронтенд отправляет `POST /api/auth/v1/auth/token` с email и паролем; браузер использует credentials. `GET /api/auth/v1/auth/session` проверяет и продлевает действующую сессию, `POST /api/auth/v1/auth/logout` очищает cookie.

Подключение к MDM и адреса upstream Gateway вынесены в `.env.example`. У контейнеров переменные БД унифицированы как `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSLMODE`, а настройки хоста имеют префиксы сервиса: `TICKETS_DB_*`, `MDM_DB_*`, `AUTH_DB_*`.

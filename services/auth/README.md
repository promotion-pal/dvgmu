# Auth service

Auth содержит отдельную таблицу `auth_identities`. В ней хранятся только ID пользователя MDM, subject и bcrypt-хэш пароля. Email, профиль, роли и permissions остаются в MDM — Auth не копирует их в свою базу.

Провайдер `auth-test-db` получает пользователя по email из MDM через внутренний RPC, затем находит хэш пароля в Auth по MDM ID. Email lookup доступен только сервису с корректным `X-Internal-Service-Token`. При совпадении пароля Auth передает общий `ExternalIdentity`, а `IdentityMapper` связывает его с MDM-пользователем. Старое значение `AUTH_PROVIDER=test-db` временно поддерживается для совместимости. После проверки Auth загружает пользователя из MDM и выпускает JWT на 15 минут. JWT устанавливается как cookie `dvgmu_access_token` с `HttpOnly`, `SameSite=Lax` и `Path=/`; `Secure` выключен только в локальном dev и включён в production. Ответ содержит ID пользователя, но не токен.

HTTP-маршруты регистрирует выбранный `IdentityProvider`. Поэтому будущий адаптер AD FS сможет использовать OIDC Authorization Code и callback, передать проверенную внешнюю identity в тот же процесс сопоставления с MDM и выдачи JWT. Провайдер и `IdentityMapper` заменяются независимо от хранилища профилей, JWT и Gateway.

Для начальной настройки запусти `make set-admin`, чтобы создать профиль администратора в MDM, затем `make set-login`, чтобы задать пароль по напечатанному MDM ID. `set-login` проверяет, что пользователь существует, активен и имеет email в MDM, затем сохраняет только MDM ID, subject и bcrypt-хэш в Auth. Для входа фронтенд отправляет `POST /api/auth/v1/auth/token` с email из MDM и паролем; браузер использует credentials. `GET /api/auth/v1/auth/session` проверяет и продлевает действующую сессию, `POST /api/auth/v1/auth/logout` очищает cookie.

Подключение к MDM и адреса upstream Gateway вынесены в `.env.example`. У контейнеров переменные БД унифицированы как `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSLMODE`, а настройки хоста имеют префиксы сервиса: `TICKETS_DB_*`, `MDM_DB_*`, `AUTH_DB_*`.

# API Gateway

Локальный единый вход для API: `http://localhost:4052`.

- `POST /auth/v1/auth/token` — Auth service.
- `/api/mdm/*` — MDM; префикс `/api/mdm` удаляется перед пересылкой.
- `/api/tickets/*` — Tickets; префикс `/api/tickets` удаляется перед пересылкой.
- `GET /healthz` — проверка доступности Gateway.

`POST /auth/v1/auth/token`, `GET /auth/v1/auth/session` и `POST /auth/v1/auth/logout` — публичные маршруты Gateway; Auth проверяет учётные данные или cookie сессии. Все остальные маршруты требуют cookie `dvgmu_access_token`. Gateway проверяет подпись, issuer и срок JWT, удаляет переданные клиентом identity-заголовки и сам передаёт сервисам `X-Authenticated-User-ID`, `X-Authenticated-User-UUID`, `X-Authenticated-Roles`, `X-Authenticated-Permissions` и внутренний `X-Gateway-Secret`. Вызовы MDM и Tickets получают проверенную identity, но Gateway не пересылает им JWT cookie.

Фронтенд использует только Gateway и отправляет cookie с `credentials: include`. CORS включает credentials и принимает только origins из allowlist. В локальном dev Compose порты сервисов опубликованы на localhost для связи раздельных Compose-проектов. В production Compose у Auth, MDM и Tickets нет опубликованных портов; внешний API публикует Gateway через Traefik.

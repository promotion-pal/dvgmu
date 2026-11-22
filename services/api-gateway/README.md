# API Gateway

Локальный единый вход для API: `http://localhost:4052`.

- `POST /auth/v1/auth/token` — Auth service.
- `/api/mdm/*` — MDM; префикс `/api/mdm` удаляется перед пересылкой.
- `/api/tickets/*` — Tickets; префикс `/api/tickets` удаляется перед пересылкой.
- `GET /healthz` — проверка доступности Gateway.

Кроме входа в Auth все маршруты требуют `Authorization: Bearer <token>`. Gateway проверяет подпись, issuer и срок действия JWT, удаляет переданные клиентом identity-заголовки и сам передаёт сервисам `X-Authenticated-User-ID`, `X-Authenticated-User-UUID`, `X-Authenticated-Roles`, `X-Authenticated-Permissions` и внутренний `X-Gateway-Secret`. MDM и Tickets сверяют внутренний секрет, поэтому прямой запрос с поддельным ID не даёт доступ.

Фронтенд использует только Gateway. В локальном dev Compose порты сервисов опубликованы на localhost для связи раздельных Compose-проектов. В production Compose у Auth, MDM и Tickets нет опубликованных портов; внешний API публикует Gateway через Traefik.

/**
 * Внутренний пароль админ-панели. Отдельной авторизации у сервиса нет —
 * гейт клиентский (см. AdminGate). Значение берётся из окружения на сборке,
 * дефолт — для локального запуска.
 */
export const ADMIN_PASSWORD =
  process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? "dvgmu-dorm-2026";

export const ADMIN_SESSION_KEY = "dorm_admin_ok";

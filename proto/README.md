# proto/ — общая схема данных

Зеркало контрактов сервисов с уникальными путями (`packages/<имя>/…`). **Руками не правим**:
источник — `services/<svc>/api/contract`, обновляет `scripts/contracts.sh sync|gen`, CI
проверяет `scripts/contracts.sh check`.

Отсюда генерируются `@dvgmu/contract` (TS для всех фронтов) и Go-клиенты сервисов внутри
бэкендов приложений (например `apps/fesmu/api/contract/gen/go/packages/<имя>`).

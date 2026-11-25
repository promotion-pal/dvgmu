#!/usr/bin/env bash
# Загрузить копию боевой базы сервиса в локальный портал (make dev-import).
#
#   dev/import.sh <база> <файл.dump>
#   dev/import.sh analytics ~/Downloads/analytics.dump
#
# База — одна из dev/postgres-init.sql: mdm, auth, analytics, file, tickets,
# fesmu_purchase, fesmu_infrastructure, fesmu_tests, fesmu_library.
# Локальные данные этой базы заменяются копией. Прод не затрагивается.
#
# Снять копию на сервере (формат custom, -Fc):
#   docker exec dvgmu_apps_analytic_db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > analytics.dump
set -euo pipefail
cd "$(dirname "$0")"

db=${1:?укажите базу: analytics, mdm, …}
file=${2:?укажите файл копии (.dump)}
[ -f "$file" ] || { echo "нет файла $file" >&2; exit 1; }

compose="docker compose -f docker-compose.yml"
$compose exec -T postgres psql -U postgres -tAc "select 1 from pg_database where datname = '$db'" | grep -q 1 \
  || { echo "в локальном Postgres нет базы $db" >&2; exit 1; }

echo "загружаю $file → локальная база $db"
# --clean --if-exists: заменить таблицы; --no-owner/--no-acl: владелец на проде другой.
$compose exec -T postgres pg_restore -U postgres -d "$db" --clean --if-exists --no-owner --no-acl < "$file" \
  || echo "pg_restore завершился с предупреждениями — проверьте вывод выше"
echo "готово. Перезапускаю сервис, чтобы он применил миграции поверх копии"
case "$db" in
  fesmu_*) $compose restart api ;;
  *) $compose restart "$db" ;;
esac

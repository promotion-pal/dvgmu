#!/usr/bin/env bash
# Перенос связок AD ↔ MDM из auth (identities.object_guid ↔ mdm_id) в
# mdm (users.ad_object_id). По умолчанию только отчёт; запись — с --apply.
#
#   ./ad-links-import.sh <auth_db_container> <mdm_db_container> [--apply]
#
# Стенд: ./ad-links-import.sh dvgmu_apps_3_0_auth_db dvgmu_apps_3_0_mdm_db
# Прод:  ./ad-links-import.sh dvgmu_apps_auth_db     dvgmu_apps_mdm_db
#
# Не перезаписывает уже заполненный ad_object_id и пропускает неоднозначные
# связки (один mdm_id ↔ несколько GUID, один GUID ↔ несколько mdm_id) —
# они попадают в отчёт. Повторный запуск безопасен.
set -euo pipefail

if [ $# -lt 2 ]; then
  echo "usage: $0 <auth_db_container> <mdm_db_container> [--apply]" >&2
  exit 2
fi
auth_db=$1
mdm_db=$2
apply=${3:-}

psql_in() { # контейнер, дальше аргументы psql; логин/БД берутся из env контейнера
  local c=$1
  shift
  docker exec -i "$c" sh -c 'psql -v ON_ERROR_STOP=1 -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"' psql "$@"
}

links=$(mktemp)
trap 'rm -f "$links"' EXIT

psql_in "$auth_db" -Atc "COPY (SELECT mdm_id, lower(object_guid::text) FROM identities WHERE mdm_id > 0) TO STDOUT WITH CSV" > "$links"
echo "связок в auth (mdm_id > 0): $(wc -l < "$links")"

action="ROLLBACK"
[ "$apply" = "--apply" ] && action="COMMIT"

{
  cat <<'SQL'
BEGIN;
CREATE TEMP TABLE ad_links (mdm_id BIGINT, object_guid UUID) ON COMMIT DROP;
COPY ad_links FROM STDIN WITH CSV;
SQL
  cat "$links"
  cat <<SQL
\\.
CREATE TEMP TABLE ad_links_ok ON COMMIT DROP AS
SELECT l.mdm_id, l.object_guid
FROM ad_links l
WHERE l.mdm_id IN (SELECT mdm_id FROM ad_links GROUP BY mdm_id HAVING count(DISTINCT object_guid) = 1)
  AND l.object_guid IN (SELECT object_guid FROM ad_links GROUP BY object_guid HAVING count(DISTINCT mdm_id) = 1)
GROUP BY l.mdm_id, l.object_guid;

\\echo 'отчёт:'
SELECT
  (SELECT count(*) FROM ad_links_ok)                                                     AS ok_pairs,
  (SELECT count(DISTINCT mdm_id) FROM ad_links) - (SELECT count(*) FROM ad_links_ok)     AS ambiguous,
  (SELECT count(*) FROM ad_links_ok o WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = o.mdm_id)) AS no_mdm_user,
  (SELECT count(*) FROM ad_links_ok o JOIN users u ON u.id = o.mdm_id
     WHERE u.ad_object_id IS NOT NULL AND u.ad_object_id <> o.object_guid)               AS conflict_existing,
  (SELECT count(*) FROM ad_links_ok o JOIN users u ON u.id = o.mdm_id
     WHERE u.ad_object_id = o.object_guid)                                               AS already_set;

UPDATE users u
SET ad_object_id = o.object_guid
FROM ad_links_ok o
WHERE u.id = o.mdm_id
  AND u.ad_object_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM users x WHERE x.ad_object_id = o.object_guid);

SELECT count(*) AS users_with_ad_object_id FROM users WHERE ad_object_id IS NOT NULL;
$action;
SQL
} | psql_in "$mdm_db"

if [ "$action" = "COMMIT" ]; then
  echo "записано (COMMIT)"
else
  echo "пробный прогон: ничего не записано (ROLLBACK). Для записи: $0 $auth_db $mdm_db --apply"
fi

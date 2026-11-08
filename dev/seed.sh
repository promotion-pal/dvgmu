set -euo pipefail
cd "$(dirname "$0")"

MDM=http://localhost:18205/contract.service.UserService
call() { curl -sf -X POST -H 'Content-Type: application/json' -H 'Authorization: Bearer dev-mdm-token' "$MDM/$1" -d "$2"; }
psql_mdm() { docker compose exec -T postgres psql -U postgres -d mdm -tAc "$1"; }
psql_mdm_exec() { docker compose exec -T postgres psql -U postgres -d mdm -v ON_ERROR_STOP=1 -c "$1"; }

add() {
  local id
  id=$(psql_mdm "select id from users where email = '$1'")
  if [ -z "$id" ]; then
    id=$(call UserCreate "{\"lastName\":\"$2\",\"firstName\":\"$3\",\"email\":\"$1\"}" | sed -E 's/.*"id":"([0-9]+)".*/\1/')
  fi
  psql_mdm "update users set ad_object_id = '$4' where id = $id" >/dev/null
  call UserRolesSet "{\"id\":\"$id\",\"roles\":[\"$5\"]}" >/dev/null
  echo "MDM: $1 (id $id) — $5, objectGUID $4"
}

add admin@fesmu.local Админов Иван 11111111-1111-1111-1111-111111111111 USER_ROLE_ADMIN
add staff@fesmu.local Сотрудников Пётр 22222222-2222-2222-2222-222222222222 USER_ROLE_STAFF

roster_csv="../services/mdm/api/seeds/employee-roster.csv"
if [ ! -f "$roster_csv" ]; then
  echo "Не найден файл кадровых назначений: $roster_csv" >&2
  exit 1
fi

psql_mdm_exec "TRUNCATE employee_roster_seed"
docker compose exec -T postgres psql -U postgres -d mdm -v ON_ERROR_STOP=1 \
  -c 'COPY employee_roster_seed(source_key,source_row,full_name,department,department_title,position,position_title,status,source_status,employment_details) FROM STDIN WITH (FORMAT csv, HEADER true)' \
  < "$roster_csv"

psql_mdm_exec "WITH matched AS (
  SELECT r.source_key, count(u.id)::integer AS match_count, min(u.id) AS user_id
  FROM employee_roster_seed r
  LEFT JOIN users u ON regexp_replace(lower(trim(concat_ws(' ', u.last_name, u.first_name, nullif(u.patronymic, '')))), '\\s+', ' ', 'g')
                    = regexp_replace(lower(trim(r.full_name)), '\\s+', ' ', 'g')
  GROUP BY r.source_key
)
UPDATE employee_roster_seed r
SET match_count = matched.match_count,
    user_id = CASE WHEN matched.match_count = 1 THEN matched.user_id ELSE NULL END"

psql_mdm_exec "INSERT INTO employees(user_id,department,status,position,source_key,created_at,updated_at)
SELECT user_id, department, status, position, source_key, now(), now()
FROM employee_roster_seed
WHERE match_count = 1 AND user_id IS NOT NULL
ON CONFLICT (source_key) WHERE source_key IS NOT NULL
DO UPDATE SET user_id = EXCLUDED.user_id,
              department = EXCLUDED.department,
              status = EXCLUDED.status,
              position = EXCLUDED.position,
              updated_at = now()"

psql_mdm "SELECT 'Кадровых назначений: ' || count(*) FROM employee_roster_seed"
psql_mdm "SELECT 'Связано с пользователями: ' || count(*) FROM employee_roster_seed WHERE match_count = 1"
psql_mdm "SELECT 'Не найдено ФИО: ' || count(*) FROM employee_roster_seed WHERE match_count = 0"
psql_mdm "SELECT 'Неоднозначное ФИО: ' || count(*) FROM employee_roster_seed WHERE match_count > 1"

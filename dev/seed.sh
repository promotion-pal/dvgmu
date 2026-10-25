#!/usr/bin/env bash
# Тестовые люди в MDM для входа через adfs-mock (make dev-seed).
# admin — ADMIN, staff — STAFF; nolink в MDM нет (проверка «не связан с MDM»).
# Повторный запуск безопасен: существующие записи не дублируются.
set -euo pipefail
cd "$(dirname "$0")"

MDM=http://localhost:18205/contract.service.UserService
call() { curl -sf -X POST -H 'Content-Type: application/json' -H 'Authorization: Bearer dev-mdm-token' "$MDM/$1" -d "$2"; }
psql_mdm() { docker compose exec -T postgres psql -U postgres -d mdm -tAc "$1"; }

add() { # email, фамилия, имя, objectGUID, роль
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

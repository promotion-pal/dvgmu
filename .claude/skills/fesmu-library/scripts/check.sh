#!/usr/bin/env bash
# Проверка миграции-сида библиотеки:
#   .claude/skills/fesmu-library/scripts/check.sh apps/fesmu/api/migrations/library/<файл>.sql
# 1) содержимое методичек — через decodeSections/checkSections модуля library;
# 2) atlas.sum — пересчёт (atlas migrate hash);
# 3) если локальный портал запущен (make dev-up) — пробный прогон Up в транзакции с откатом.
set -euo pipefail

[ $# -eq 1 ] || { echo "использование: $0 <миграция.sql>"; exit 2; }
root="$(git rev-parse --show-toplevel)"
sql="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
api="$root/apps/fesmu/api"
pkg="$api/internal/modules/library"
here="$(cd "$(dirname "$0")" && pwd)"

tmp="$pkg/zz_seed_skill_test.go"
cp "$here/seed_check_test.go.tmpl" "$tmp"
trap 'rm -f "$tmp"' EXIT
echo "== проверки api"
(cd "$api" && SEED_SQL="$sql" go test -run TestSeedManualsFromSkill -count=1 -v ./internal/modules/library/ | grep -E "методичка|^(ok|FAIL|---)") \
  || { echo "FAIL: содержимое не прошло проверки api"; exit 1; }

echo "== atlas.sum"
(cd "$api" && atlas migrate hash --dir "file://migrations/library?format=goose") && echo "ok    пересчитан"

echo "== пробный прогон в локальной базе"
compose="docker compose -f $root/dev/docker-compose.yml"
if $compose ps --status running --services 2>/dev/null | grep -qx postgres; then
  up="$(sed -n '/^-- +goose Up/,/^-- +goose Down/p' "$sql" | grep -v '^-- +goose')"
  if printf 'BEGIN;\n%s\nROLLBACK;\n' "$up" | $compose exec -T postgres psql -U postgres -d fesmu_library -v ON_ERROR_STOP=1 -q >/dev/null; then
    echo "ok    SQL выполняется (откат)"
  else
    echo "FAIL: SQL не выполнился"; exit 1
  fi
else
  echo "skip  локальный портал не запущен — SQL проверится при make dev-up"
fi

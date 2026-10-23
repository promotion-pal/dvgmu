#!/usr/bin/env bash
# Запуск fesmu на тестовом стенде — вместо голого `docker compose`.
#
#   ./stand.sh up -d --build
#   ./stand.sh logs -f core_api
#
# Отказывается работать, если в .env нет STAND=…: без него compose возьмёт
# прод-имена и пересоздаст прод-контейнеры. См. docs/stand.md.
set -euo pipefail

cd "$(dirname "$0")"

stand=$( (grep -E '^STAND=' .env 2>/dev/null || true) | tail -1 | cut -d= -f2- | tr -d "\"' ")
if [ -z "$stand" ]; then
  echo "в .env нет STAND=… — это прод-конфигурация, на стенде не запускаю" >&2
  exit 1
fi

echo "стенд STAND=$stand, проект fesmu_$stand"
exec docker compose "$@"

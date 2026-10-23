#!/usr/bin/env bash
# Запуск сервиса на тестовом стенде — вместо голого `docker compose`.
#
#   ./stand.sh auth up -d --build
#   ./stand.sh mdm logs -f
#   ./stand.sh fesmu up -d --build
#
# Отказывается работать, если в services/<svc>/.env нет STAND=…: без него
# compose возьмёт прод-имена и пересоздаст прод-контейнеры. См. docs/stand.md.
set -euo pipefail

if [ $# -lt 2 ]; then
  echo "usage: $0 <service> <docker compose args...>" >&2
  exit 2
fi

svc=$1
shift
root="$(cd "$(dirname "$0")" && pwd)"
# Сервис (services/<svc>) или приложение (apps/<svc>, например fesmu).
dir="$root/services/$svc"
[ -f "$dir/docker-compose.yml" ] || dir="$root/apps/$svc"

if [ ! -f "$dir/docker-compose.yml" ]; then
  echo "нет сервиса или приложения $svc (services/$svc, apps/$svc)" >&2
  exit 2
fi

stand=$( (grep -E '^STAND=' "$dir/.env" 2>/dev/null || true) | tail -1 | cut -d= -f2- | tr -d "\"' ")
if [ -z "$stand" ]; then
  echo "в $dir/.env нет STAND=… — это прод-конфигурация, на стенде не запускаю" >&2
  exit 1
fi

cd "$dir"
project=$(docker compose config --format json | grep -o '"name": *"[^"]*"' | head -1 | cut -d'"' -f4)
echo "стенд STAND=$stand, проект $project"
exec docker compose "$@"

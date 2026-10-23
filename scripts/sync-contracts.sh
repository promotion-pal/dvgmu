#!/usr/bin/env bash
# Контракты сервисов (services/*/api/contract) — единственный источник правды.
# Приложение, которое ходит в сервис, держит у себя копию нужных .proto
# (apps/<app>/api/contract/packages/<name>/…) с переписанными импортами: так
# его бэкенд собирается из своей папки и его можно вынести на другой сервер.
# Копии руками не правим — только этим скриптом.
#
#   scripts/sync-contracts.sh          — обновить копии из сервисов
#   scripts/sync-contracts.sh --check  — только проверить, что копии не отстали (для CI)
#
# После обновления: cd apps/fesmu/api/contract && buf generate
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
check=false
[ "${1:-}" = "--check" ] && check=true

# приложение | имя пакета в приложении | папка контракта сервиса | подпапки
MAP=(
  "fesmu|analytics|services/analytics/api/contract|entity/analytic.entity.proto enum/analytic.enum.proto service/analytic.service.proto"
  "fesmu|files|services/file/api/contract|entity enum service"
  "fesmu|mdm|services/mdm/api/contract|entity enum service/user.service.proto"
  "fesmu|tasks|services/tickets/api/contract|entity enum service"
  "fesmu|auth|services/auth/api/contract/auth|v1 v2"
)

stale=0
for row in "${MAP[@]}"; do
  IFS='|' read -r app name src parts <<<"$row"
  dst="$root/apps/$app/api/contract/packages/$name"
  for part in $parts; do
    for f in $(cd "$root/$src" && find "$part" -name '*.proto' | sort); do
      # Импорты внутри контракта сервиса ("enum/…", "auth/v1/…") становятся
      # путями внутри приложения ("packages/<name>/enum/…").
      want=$(sed -E \
        -e "s#^import \"(entity|enum|service)/#import \"packages/$name/\1/#" \
        -e "s#^import \"auth/#import \"packages/auth/#" \
        "$root/$src/$f")
      target="$dst/$f"
      if [ -f "$target" ] && [ "$want" = "$(cat "$target")" ]; then
        continue
      fi
      stale=1
      if $check; then
        echo "отстала копия: apps/$app/api/contract/packages/$name/$f  (источник: $src/$f)"
      else
        mkdir -p "$(dirname "$target")"
        printf '%s\n' "$want" >"$target"
        echo "обновлено: apps/$app/api/contract/packages/$name/$f"
      fi
    done
  done
done

if $check && [ $stale -ne 0 ]; then
  echo "копии контрактов отстали — запустите scripts/sync-contracts.sh и buf generate" >&2
  exit 1
fi
$check && echo "копии контрактов совпадают с сервисами"
exit 0

#!/usr/bin/env bash
# Проверка архитектуры монорепо. Запуск из любой папки репозитория:
#   .claude/skills/fesmu-architecture/scripts/check.sh
# Код выхода 1 — есть нарушения (строки FAIL). bash 3.2-совместимо (macOS).
set -uo pipefail

root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$root"
fail=0
ok()   { echo "ok    $*"; }
bad()  { echo "FAIL  $*"; fail=1; }
warn() { echo "warn  $*"; }

# Модули со своей генерацией — правила общей схемы к ним не применяются.
EXCLUDED="dormitory mentor ojs"
is_excluded() { case " $EXCLUDED " in *" $1 "*) return 0 ;; esac; return 1; }

# 1. Общие пакеты на месте (их удаление ломает все бэкенды и веб).
[ -f packages/go/go.mod ] && grep -q '^module fesmu/contract' packages/go/go.mod \
  && ok "packages/go/go.mod (module fesmu/contract)" || bad "нет packages/go/go.mod с module fesmu/contract"
[ -f packages/ts/package.json ] && grep -q '"name": "@fesmu/contract"' packages/ts/package.json \
  && ok "packages/ts/package.json (@fesmu/contract)" || bad "нет packages/ts/package.json с name @fesmu/contract"

# 2. Модули buf.yaml: папка есть, схемы лежат в папке с именем владельца.
modules=$(grep -E '^\s*- path:' buf.yaml | sed -E 's/.*path:\s*//')
owners=""
for m in $modules; do
  owner=$(echo "$m" | cut -d/ -f2)          # services/<owner>/… или apps/<owner>/…
  owners="$owners $owner"
  if [ ! -d "$m" ]; then bad "buf.yaml: нет папки $m"; continue; fi
  stray=$(cd "$m" && find . -name '*.proto' -not -path './gen/*' | sed 's#^\./##' | grep -v "^$owner/" || true)
  [ -z "$stray" ] && ok "схемы $m лежат в $owner/" || bad "схемы $m вне папки $owner/: $(echo $stray | head -c 200)"
done

# 3. Импорты в схемах ссылаются на владельца из workspace.
for m in $modules; do
  for imp in $(grep -rhoE '^import "[^"]+"' "$m" --include='*.proto' 2>/dev/null | sed -E 's/import "([^"]+)"/\1/' | sort -u); do
    first=${imp%%/*}
    [ "$first" = google ] && continue
    case " $owners " in *" $first "*) ;; *) bad "$m: import \"$imp\" — владелец $first не в buf.yaml" ;; esac
  done
done
ok "импорты схем проверены"

# 4. Сгенерированного кода нет в бэкендах (он только в packages/).
for d in services/*/api apps/*/api; do
  [ -d "$d" ] || continue
  svc=$(echo "$d" | cut -d/ -f2)
  is_excluded "$svc" && continue
  gen=$(find "$d" \( -name '*.pb.go' -o -name '*.connect.go' \) 2>/dev/null | head -3)
  [ -z "$gen" ] && ok "$d: своего сгенерированного кода нет" || bad "$d: сгенерированный код вне packages/: $gen"
done

# 5. Бэкенд, который использует fesmu/contract, собирается из корня.
for d in services/*/api apps/*/api; do
  [ -f "$d/go.mod" ] || continue
  grep -rqs '"fesmu/contract/' "$d" --include='*.go' || continue
  grep -q 'replace fesmu/contract => ../../../packages/go' "$d/go.mod" \
    || bad "$d/go.mod: нет replace fesmu/contract => ../../../packages/go"
  [ -f "$d/Dockerfile.dockerignore" ] && grep -q '^!packages/go' "$d/Dockerfile.dockerignore" \
    || bad "$d: нет Dockerfile.dockerignore с !packages/go"
  compose="$(dirname "$d")/docker-compose.yml"
  if [ -f "$compose" ] && ! grep -q "dockerfile: \"$d/Dockerfile\"" "$compose"; then
    bad "$compose: сборка $d не из корня (нужно context: \"../..\", dockerfile: \"$d/Dockerfile\")"
  fi
done
ok "сборка бэкендов проверена"

# 6. Фронт берёт схемы только из @fesmu/contract, и файлы существуют.
for web in apps/*/web; do
  [ -d "$web/src" ] || continue
  old=$(grep -rlE '@dvgmu/contract|packages/ts/|/contract/gen/' "$web/src" 2>/dev/null | head -3)
  [ -z "$old" ] || bad "$web: старые пути к схемам в $old"
  missing=0
  for imp in $(grep -rhoE '@fesmu/contract/[A-Za-z0-9_/.]+' "$web/src" | sort -u); do
    f="packages/ts/${imp#@fesmu/contract/}"; f="${f%.js}"
    [ -f "$f.ts" ] || { bad "$web: импорт $imp — нет файла $f.ts (make proto?)"; missing=1; }
  done
  [ $missing -eq 0 ] && ok "$web: все импорты @fesmu/contract существуют"
done

# 7. Отдельные модули не попали в общую схему.
for x in $EXCLUDED; do
  echo "$modules" | grep -q "/$x/" && warn "$x в buf.yaml — у него пакеты пересекаются с mdm, нужна новая версия API"
done

[ $fail -eq 0 ] && echo "архитектура: нарушений нет" || echo "архитектура: есть нарушения (FAIL выше)"
exit $fail

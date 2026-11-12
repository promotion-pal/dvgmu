GREEN := $(shell tput setaf 2 2>/dev/null)
CYAN  := $(shell tput setaf 6 2>/dev/null)
NC    := $(shell tput sgr0 2>/dev/null)

GENERATED := packages/go packages/ts

.PHONY: proto proto-check

proto:
	@echo "$(CYAN)📝  Generating protobuf with Buf...$(NC)"
	@find $(GENERATED) \( -name '*.pb.go' -o -name '*.connect.go' -o -name '*_pb.ts' \) -not -path '*/node_modules/*' -delete
	@find $(GENERATED) -type d -empty -not -path '*/node_modules/*' -delete
	@PATH="$(CURDIR)/node_modules/.bin:$$PATH" buf generate
	@echo "$(GREEN)✅  Done!$(NC)"

proto-check: proto
	@git diff --exit-code -- $(GENERATED) >/dev/null && [ -z "$$(git ls-files --others --exclude-standard -- $(GENERATED))" ] \
		|| { git status --short -- $(GENERATED); echo "сгенерированный код отстал от схем — make proto и закоммитить" >&2; exit 1; }
	@echo "сгенерированный код совпадает со схемами"

.PHONY: dev-up dev-seed dev-seed-students dev-down dev-logs dev-import

dev-up:
	@docker compose -f dev/docker-compose.yml up -d --build
	@echo "$(GREEN)веб http://localhost:18300 · api :18200 · auth :18201$(NC) — затем make dev-seed"

dev-seed:
	@dev/seed.sh
	@$(MAKE) dev-seed-students

# Загружает постоянный student-roster.csv в локальный MDM.
dev-seed-students:
	@docker compose --profile tools -f dev/docker-compose.yml build seed-students
	@docker compose --profile tools -f dev/docker-compose.yml run --rm seed-students

# Копия боевой базы в локальный портал: make dev-import DB=analytics FILE=~/Downloads/analytics.dump
dev-import:
	@dev/import.sh $(DB) $(FILE)

dev-logs:
	@docker compose -f dev/docker-compose.yml logs -f --tail=50

dev-down:
	@docker compose -f dev/docker-compose.yml down

# Сервер: весь портал — сервисы из services/ и fesmu (базы, api, веб).
# Имена проектов, контейнеров и томов берутся из .env каждого сервиса (STAND).
#   make up                 — собрать и запустить всё
#   make up SERVICES=auth   — только эти сервисы (fesmu тоже по имени: SERVICES=fesmu)
#   make up PANEL=1         — дополнительно запустить Plane
#   make down / ps / logs S=auth
SERVICES ?= mdm auth analytics tickets file notification sync dormitory mentor fesmu
PANEL ?= 0

.PHONY: panel-up panel-down panel-logs

# Plane запускается отдельно; в make up он включается только с PANEL=1.
panel-up:
	@cd panel && ./setup.sh start

panel-down:
	@cd panel && ./setup.sh stop

panel-logs:
	@cd panel/plane-app && docker compose --env-file plane.env -f docker-compose.yaml logs -f --tail=100

.PHONY: up deploy down ps logs

# Обновить только веб и API ФЭФМУ после git pull; базы и остальные сервисы не перезапускаются.
.PHONY: fesmu-update
fesmu-update:
	@cd apps/fesmu && docker compose build core_api core_app
	@cd apps/fesmu && docker compose up -d --no-deps core_api core_app

up:
	@for s in $(SERVICES); do \
		if [ "$$s" = fesmu ]; then \
			[ -d apps/fesmu/api/db ] || echo "⚠️  нет apps/fesmu/api/db — базы fesmu будут новые, пустые"; \
			echo "$(CYAN)== fesmu: базы, api и веб$(NC)"; (cd apps/fesmu && docker compose up -d --build) || exit 1; \
		else \
			[ "$$s" != mdm ] || [ -d services/mdm/db ] || echo "⚠️  нет services/mdm/db — база mdm будет новая, пустая"; \
			echo "$(CYAN)== $$s$(NC)"; (cd services/$$s && docker compose up -d --build) || exit 1; \
		fi; \
		docker builder prune -af >/dev/null; \
	done
	@if [ "$(PANEL)" = "1" ]; then $(MAKE) panel-up; fi
	@docker ps --format '{{.Names}}\t{{.Status}}' | sort
	@df -h / | tail -1

# Единая команда выкладки на проде: обновить main и пересобрать выбранные сервисы.
# По умолчанию обновляет полный набор SERVICES; можно передать список:
#   make deploy SERVICES="mdm auth sync fesmu"
deploy:
	@git pull --ff-only origin main
	@$(MAKE) up SERVICES="$(SERVICES)" PANEL="$(PANEL)"

# Остановить и удалить контейнеры. Тома и папки баз остаются.
down:
	@for s in $(SERVICES); do \
		if [ "$$s" = fesmu ]; then \
			(cd apps/fesmu && docker compose down); \
		else (cd services/$$s && docker compose down); fi; \
	done

ps:
	@docker ps -a --format '{{.Names}}\t{{.Status}}' | sort

logs:
	@if [ "$(S)" = fesmu ]; then cd apps/fesmu && docker compose logs -f --tail=100; \
	else cd services/$(S) && docker compose logs -f --tail=100; fi

# MDM ↔ AD sync. Одноразовые create targets пишут в AD выключенные учётки
# без пароля; перед ними запускайте sync-check.
SYNC_LIMIT ?= 10
.PHONY: sync-build sync-check sync-create sync-create-students sync-create-staff sync-up

sync-build:
	@cd services/sync && docker compose build sync_api

sync-check: sync-build
	@cd services/sync && docker compose run --rm sync_api ./sync --config=config/prod.yaml --check-missing

sync-create: sync-build
	@cd services/sync && docker compose run --rm sync_api ./sync --config=config/prod.yaml --create-missing=$(SYNC_LIMIT)

sync-create-students: sync-build
	@cd services/sync && docker compose run --rm sync_api ./sync --config=config/prod.yaml --create-missing-students=$(SYNC_LIMIT)

sync-create-staff: sync-build
	@cd services/sync && docker compose run --rm sync_api ./sync --config=config/prod.yaml --create-missing-staff=$(SYNC_LIMIT)

sync-up:
	@cd services/sync && docker compose up -d --build sync_api

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

.PHONY: dev-up dev-seed dev-down dev-logs dev-import

dev-up:
	@docker compose -f dev/docker-compose.yml up -d --build
	@echo "$(GREEN)веб http://localhost:18300 · api :18200 · auth :18201$(NC) — затем make dev-seed"

dev-seed:
	@dev/seed.sh

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
#   make down / ps / logs S=auth
SERVICES ?= mdm auth analytics tickets file notification sync fesmu

.PHONY: up down ps logs

up:
	@for s in $(SERVICES); do \
		if [ "$$s" = fesmu ]; then \
			[ -d apps/fesmu/api/db ] || echo "⚠️  нет apps/fesmu/api/db — базы fesmu будут новые, пустые"; \
			echo "$(CYAN)== fesmu: базы$(NC)"; (cd apps/fesmu && docker compose -f docker-compose.dev.yml up -d) || exit 1; \
			echo "$(CYAN)== fesmu: api и веб$(NC)"; (cd apps/fesmu && docker compose up -d --build) || exit 1; \
		else \
			[ "$$s" != mdm ] || [ -d services/mdm/db ] || echo "⚠️  нет services/mdm/db — база mdm будет новая, пустая"; \
			echo "$(CYAN)== $$s$(NC)"; (cd services/$$s && docker compose up -d --build) || exit 1; \
		fi; \
		docker builder prune -af >/dev/null; \
	done
	@docker ps --format '{{.Names}}\t{{.Status}}' | sort
	@df -h / | tail -1

# Остановить и удалить контейнеры. Тома и папки баз остаются.
down:
	@for s in $(SERVICES); do \
		if [ "$$s" = fesmu ]; then \
			(cd apps/fesmu && docker compose down && docker compose -f docker-compose.dev.yml down); \
		else (cd services/$$s && docker compose down); fi; \
	done

ps:
	@docker ps -a --format '{{.Names}}\t{{.Status}}' | sort

logs:
	@if [ "$(S)" = fesmu ]; then cd apps/fesmu && docker compose logs -f --tail=100; \
	else cd services/$(S) && docker compose logs -f --tail=100; fi

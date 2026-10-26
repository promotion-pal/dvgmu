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

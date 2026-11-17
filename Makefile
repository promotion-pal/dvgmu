GREEN := $(shell tput setaf 2 2>/dev/null)
CYAN  := $(shell tput setaf 6 2>/dev/null)
NC    := $(shell tput sgr0 2>/dev/null)

GENERATED := packages/go packages/ts
TICKETS_COMPOSE := docker compose -f services/tickets/docker-compose.dev.yml
MDM_COMPOSE := docker compose -f services/mdm/docker-compose.dev.yml

.PHONY: proto dev dev-stop tickets-migrate-diff tickets-migrate-lint tickets-migrate-status mdm-migrate-diff mdm-migrate-lint mdm-migrate-status

dev:
	@$(TICKETS_COMPOSE) up -d --build
	@$(MDM_COMPOSE) up -d --build
	@pnpm --dir apps/lk dev

dev-stop:
	@$(TICKETS_COMPOSE) down
	@$(MDM_COMPOSE) down

tickets-migrate-diff:
	@cd services/tickets && atlas migrate diff --env gorm

tickets-migrate-lint:
	@cd services/tickets && atlas migrate lint --env gorm --latest 1

tickets-migrate-status:
	@cd services/tickets && atlas migrate status --env gorm

mdm-migrate-diff:
	@cd services/mdm && atlas migrate diff --env gorm

mdm-migrate-lint:
	@cd services/mdm && atlas migrate lint --env gorm --latest 1

mdm-migrate-status:
	@cd services/mdm && atlas migrate status --env gorm

proto:
	@echo "$(CYAN)📝  Generating protobuf with Buf...$(NC)"
	@mkdir -p $(GENERATED)
	@find $(GENERATED) \( -name '*.pb.go' -o -name '*.connect.go' -o -name '*_pb.ts' \) -not -path '*/node_modules/*' -delete
	@find $(GENERATED) -type d -empty -not -path '*/node_modules/*' -delete
	@PATH="$(CURDIR)/node_modules/.bin:$$PATH" buf generate
	@echo "$(GREEN)✅  Done!$(NC)"

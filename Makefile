GREEN := $(shell tput setaf 2 2>/dev/null)
CYAN  := $(shell tput setaf 6 2>/dev/null)
NC    := $(shell tput sgr0 2>/dev/null)

GENERATED := packages/go packages/ts
TICKETS_COMPOSE := docker compose -f services/tickets/docker-compose.dev.yml
MDM_COMPOSE := docker compose -f services/mdm/docker-compose.dev.yml
AUTH_COMPOSE := docker compose -f services/auth/docker-compose.dev.yml
GATEWAY_COMPOSE := docker compose -f services/api-gateway/docker-compose.dev.yml
LK_PROD_COMPOSE := docker compose -f apps/lk/docker-compose.yml

.PHONY: proto dev dev-stop prod-up prod-down lk-prod-up lk-prod-down auth-test-user tickets-migrate-diff tickets-migrate-lint tickets-migrate-status mdm-migrate-diff mdm-migrate-lint mdm-migrate-status

dev:
	@$(TICKETS_COMPOSE) up -d --build
	@$(MDM_COMPOSE) up -d --build
	@$(AUTH_COMPOSE) up -d --build
	@$(GATEWAY_COMPOSE) up -d --build
	@pnpm --dir apps/lk dev

dev-stop:
	@$(TICKETS_COMPOSE) down
	@$(MDM_COMPOSE) down
	@$(AUTH_COMPOSE) down
	@$(GATEWAY_COMPOSE) down

prod-up:
	@docker network inspect traefik-network >/dev/null 2>&1 || (echo "External Docker network traefik-network is missing. Start Traefik or create its network first." >&2; exit 1)
	@docker network inspect dvgmu-backend >/dev/null 2>&1 || docker network create dvgmu-backend
	@docker compose -f services/mdm/docker-compose.yml up -d --build
	@docker compose -f services/tickets/docker-compose.yml up -d --build
	@docker compose -f services/auth/docker-compose.yml up -d --build
	@docker compose -f services/api-gateway/docker-compose.yml up -d --build
	@$(LK_PROD_COMPOSE) up -d --build

prod-down:
	@$(LK_PROD_COMPOSE) down
	@docker compose -f services/api-gateway/docker-compose.yml down
	@docker compose -f services/auth/docker-compose.yml down
	@docker compose -f services/tickets/docker-compose.yml down
	@docker compose -f services/mdm/docker-compose.yml down

lk-prod-up:
	@docker network inspect traefik-network >/dev/null 2>&1 || (echo "External Docker network traefik-network is missing. Start Traefik or create its network first." >&2; exit 1)
	@$(LK_PROD_COMPOSE) up -d --build

lk-prod-down:
	@$(LK_PROD_COMPOSE) down

auth-test-user:
	@$(AUTH_COMPOSE) run --rm dvgmu_auth ./auth-test-user

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

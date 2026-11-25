GREEN := $(shell tput setaf 2 2>/dev/null)
CYAN  := $(shell tput setaf 6 2>/dev/null)
NC    := $(shell tput sgr0 2>/dev/null)

GENERATED := packages/go packages/ts
TICKETS_COMPOSE := docker compose -f services/tickets/docker-compose.dev.yml
MDM_COMPOSE := docker compose -f services/mdm/docker-compose.dev.yml
AUTH_COMPOSE := docker compose -f services/auth/docker-compose.dev.yml
GATEWAY_COMPOSE := docker compose -f services/api-gateway/docker-compose.dev.yml
LK_PROD_COMPOSE := docker compose -f apps/lk/docker-compose.yml
PANEL_COMPOSE := docker compose -f apps/panel/plane-app/docker-compose.yaml --env-file apps/panel/plane-app/plane.env
PANEL_TRAEFIK_COMPOSE := docker compose -f apps/panel/plane-app/docker-compose.yaml -f apps/panel/plane-app/docker-compose.traefik.yaml --env-file apps/panel/plane-app/plane.env --env-file apps/panel/plane-app/plane.prod.env

.PHONY: proto dev dev-stop prod-up prod-down lk-prod-up lk-prod-down panel-up panel-prod-up panel-down panel-prod-down panel-logs panel-ps auth-test-user tickets-migrate-diff tickets-migrate-lint tickets-migrate-status mdm-migrate-diff mdm-migrate-lint mdm-migrate-status

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

panel-up:
	@test -f apps/panel/plane-app/plane.env || (echo "Missing apps/panel/plane-app/plane.env. Copy plane.env.example and configure it first." >&2; exit 1)
	@$(PANEL_COMPOSE) up -d --build

panel-prod-up:
	@test -f apps/panel/plane-app/plane.env || (echo "Missing apps/panel/plane-app/plane.env." >&2; exit 1)
	@test -f apps/panel/plane-app/plane.prod.env || (echo "Missing apps/panel/plane-app/plane.prod.env. Copy plane.prod.env.example and configure it first." >&2; exit 1)
	@docker network inspect traefik-network >/dev/null 2>&1 || (echo "External Docker network traefik-network is missing. Start Traefik or create its network first." >&2; exit 1)
	@$(PANEL_TRAEFIK_COMPOSE) up -d --build

panel-down:
	@test -f apps/panel/plane-app/plane.env || (echo "Missing apps/panel/plane-app/plane.env." >&2; exit 1)
	@$(PANEL_COMPOSE) down

panel-prod-down:
	@test -f apps/panel/plane-app/plane.env || (echo "Missing apps/panel/plane-app/plane.env." >&2; exit 1)
	@test -f apps/panel/plane-app/plane.prod.env || (echo "Missing apps/panel/plane-app/plane.prod.env." >&2; exit 1)
	@$(PANEL_TRAEFIK_COMPOSE) down

panel-logs:
	@test -f apps/panel/plane-app/plane.env || (echo "Missing apps/panel/plane-app/plane.env." >&2; exit 1)
	@$(PANEL_COMPOSE) logs -f

panel-ps:
	@test -f apps/panel/plane-app/plane.env || (echo "Missing apps/panel/plane-app/plane.env." >&2; exit 1)
	@$(PANEL_COMPOSE) ps

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

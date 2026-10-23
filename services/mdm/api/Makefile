BINARY_NAME := dvgmu
GO := go
MAIN_PATH := ./cmd/dvgmu/main.go
CONFIG_PATH := --config=config/dev.yaml
PROTO_DIR := ./contract
VERSION := $(shell cat ../.version 2>/dev/null || echo "0.0.0")
LDFLAGS := -X 'main.Version=$(VERSION)'

GREEN  := $(shell tput setaf 2)
BLUE   := $(shell tput setaf 4)
RED    := $(shell tput setaf 1)
YELLOW := $(shell tput setaf 3)
CYAN   := $(shell tput setaf 6)
MAGENTA:= $(shell tput setaf 5)
NC     := $(shell tput sgr0)

.DEFAULT_GOAL := menu

menu:
	@clear
	@echo "${BLUE}                 🏥  DVGMU API SERVICE${NC}"
	@echo ""
	@echo "${GREEN}  1. 🚀  Run server${NC}"
	@echo "${CYAN}  2. 🔨  Build project${NC}"
	@echo "${YELLOW}  3. 📦  Install dependencies${NC}"
	@echo "${MAGENTA}  4. 🧪  Run tests${NC}"
	@echo "${GREEN}  5. 🔍  Lint code${NC}"
	@echo "${CYAN}  6. 📝  Generate protobuf${NC}"
	@echo "${YELLOW}  7. 🔍  Run gRPC UI${NC}"
	@echo "${RED}  0. ❌  Exit${NC}"
	@echo ""
	@printf "${YELLOW}👉  Select option (0-10): ${NC}"
	@read choice; \
	case $$choice in \
		1) clear && make run ;; \
		2) clear && make build ;; \
		3) clear && make deps ;; \
		4) clear && make test ;; \
		5) clear && make lint ;; \
		6) clear && make proto ;; \
		7) clear && make grpcui ;; \
		0) clear && echo "${RED}👋  Goodbye!${NC}" && exit 0 ;; \
		*) clear && echo "${RED}❌  Invalid choice!${NC}" && sleep 1 && make menu ;; \
	esac

deps:
	@echo "${YELLOW}📦  Installing dependencies...${NC}"
	$(GO) mod download
	$(GO) mod tidy
	@echo "${GREEN}✅  Done!${NC}"
	@sleep 1 && make menu

build:
	@echo "${CYAN}🔨  Building project (v$(VERSION))...${NC}"
	$(GO) build -ldflags "$(LDFLAGS)" -o $(BINARY_NAME) $(MAIN_PATH)
	@echo "${GREEN}✅  Done!${NC}"
	@sleep 1 && make menu

run:
	@echo "${GREEN}🚀  Starting server...${NC}"
	$(GO) run $(MAIN_PATH) $(CONFIG_PATH)

test:
	@echo "${MAGENTA}🧪  Running tests...${NC}"
	$(GO) test -v ./...
	@echo "${GREEN}✅  Done!${NC}"
	@sleep 2 && make menu

lint:
	@echo "${GREEN}🔍  Linting code...${NC}"
	@if command -v golangci-lint >/dev/null 2>&1; then \
		golangci-lint run ./...; \
	else \
		echo "${YELLOW}⚠️  Installing golangci-lint...${NC}"; \
		$(GO) install github.com/golangci/golangci-lint/cmd/golangci-lint@latest; \
		golangci-lint run ./...; \
	fi
	@echo "${GREEN}✅  Done!${NC}"
	@sleep 1 && make menu

proto:
	@echo "${CYAN}📝  Generating protobuf with Buf...${NC}"
	cd $(PROTO_DIR) && buf generate
	@echo "${GREEN}✅  Done!${NC}"
	@sleep 1 && make menu

grpcui:
	@echo "${YELLOW}🔍  Starting gRPC UI...${NC}"
	grpcui -plaintext 127.0.0.1:4004

create-admin:
	@echo "${CYAN}👤  Creating admin user...${NC}"
	$(GO) run ./cmd/create-admin $(CONFIG_PATH) -email=$(EMAIL) -password=$(PASSWORD)

ATLAS_ENV ?= gorm

migrate-diff:
	@echo "${CYAN}🧬  Generating migration diff from GORM models via Atlas (env=$(ATLAS_ENV))...${NC}"
	atlas migrate diff --env $(ATLAS_ENV)
	@echo "${GREEN}✅  Done!${NC}"

migrate-lint:
	@echo "${CYAN}🔍  Linting migrations via Atlas (env=$(ATLAS_ENV))...${NC}"
	atlas migrate lint --env $(ATLAS_ENV) --latest 1

migrate-status:
	@echo "${CYAN}📋  Migration status via Atlas (env=$(ATLAS_ENV))...${NC}"
	atlas migrate status --env $(ATLAS_ENV)

clean:
	@echo "${RED}🧹  Cleaning files...${NC}"
	rm -rf $(BINARY_NAME)
	rm -rf coverage.out coverage.html
	@echo "${GREEN}✅  Done!${NC}"
	@sleep 1 && make menu

dev:
	@echo "${MAGENTA}🔄  Starting with hot-reload...${NC}"
	@if command -v air >/dev/null 2>&1; then \
		air; \
	else \
		echo "${YELLOW}⚠️  Installing air...${NC}"; \
		$(GO) install github.com/cosmtrek/air@latest; \
		air; \
	fi

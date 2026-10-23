GO := go
DOCKER := docker-compose
MAIN_PATH := ./cmd/main.go
CONFIG_PATH := --config=config/dev.yaml
API_DIR := api

GREEN  := $(shell tput setaf 2)
BLUE   := $(shell tput setaf 4)
RED    := $(shell tput setaf 1)
YELLOW := $(shell tput setaf 3)
CYAN   := $(shell tput setaf 6)
MAGENTA:= $(shell tput setaf 5)
NC     := $(shell tput sgr0)

menu:
	@clear
	@echo "${BLUE}                 🏥  DVGMU API SERVICE${NC}"
	@echo ""
	@echo "${GREEN}  1. 🚀  Run dev service${NC}"
	@echo ""
	@read choice; \
	case $$choice in \
		1) clear && make dev ;; \
	esac

dev:
	@echo "${GREEN}🚀  Starting server...${NC}"
	$(DOCKER) -f docker-compose.dev.yml up -d
	cd $(API_DIR) && $(GO) run $(MAIN_PATH) $(CONFIG_PATH)
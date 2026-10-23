# Общие команды монорепо.

GREEN := $(shell tput setaf 2 2>/dev/null)
CYAN  := $(shell tput setaf 6 2>/dev/null)
NC    := $(shell tput sgr0 2>/dev/null)

.PHONY: proto proto-check

# Все схемы (корневой buf.yaml) → Go в services/*/api/contract/gen/go и
# apps/fesmu/api/contract/gen/go, TS в packages/* (@dvgmu/<имя>).
proto:
	@echo "$(CYAN)📝  Generating protobuf with Buf...$(NC)"
	@scripts/contracts.sh gen
	@echo "$(GREEN)✅  Done!$(NC)"

# То же, что в CI: сгенерированный код совпадает со схемами.
proto-check:
	@scripts/contracts.sh check

GREEN := $(shell tput setaf 2 2>/dev/null)
CYAN  := $(shell tput setaf 6 2>/dev/null)
NC    := $(shell tput sgr0 2>/dev/null)

.PHONY: proto proto-check

proto:
	@echo "$(CYAN)📝  Generating protobuf with Buf...$(NC)"
	@scripts/contracts.sh gen
	@echo "$(GREEN)✅  Done!$(NC)"

proto-check:
	@scripts/contracts.sh check

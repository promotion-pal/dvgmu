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

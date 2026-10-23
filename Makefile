# Общие команды монорепо.

GREEN := $(shell tput setaf 2 2>/dev/null)
CYAN  := $(shell tput setaf 6 2>/dev/null)
NC    := $(shell tput sgr0 2>/dev/null)

GENERATED := packages/go packages/ts

.PHONY: proto proto-check

# Все схемы (buf.yaml) → Go в packages/go, TS в packages/ts (buf.gen.yaml).
# Старый вывод удаляем: buf не убирает файлы схем, которых больше нет.
proto:
	@echo "$(CYAN)📝  Generating protobuf with Buf...$(NC)"
	@find $(GENERATED) \( -name '*.pb.go' -o -name '*.connect.go' -o -name '*_pb.ts' \) -not -path '*/node_modules/*' -delete
	@PATH="$(CURDIR)/node_modules/.bin:$$PATH" buf generate
	@echo "$(GREEN)✅  Done!$(NC)"

# То же, что в CI: сгенерированный код совпадает со схемами.
proto-check: proto
	@git diff --exit-code -- $(GENERATED) >/dev/null && [ -z "$$(git ls-files --others --exclude-standard -- $(GENERATED))" ] \
		|| { git status --short -- $(GENERATED); echo "сгенерированный код отстал от схем — make proto и закоммитить" >&2; exit 1; }
	@echo "сгенерированный код совпадает со схемами"

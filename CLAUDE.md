# fesmu — монорепо ДВГМУ

- Архитектура для людей: [ARCHITECTURE.md](ARCHITECTURE.md).
- Правила для изменений структуры (сервисы, схемы .proto, packages, фронт fesmu, Docker, права) — навык `fesmu-architecture` (`.claude/skills/fesmu-architecture/`). Используй его при любой такой задаче.
- После изменений структуры: `.claude/skills/fesmu-architecture/scripts/check.sh` и `make proto-check`.

Основные команды:

```bash
make proto        # схемы → packages/go (Go) и packages/ts (@fesmu/contract)
make proto-check  # сгенерированный код совпадает со схемами
make dev-up       # весь портал локально, вход без AD (admin/admin123) — затем make dev-seed
```

dormitory, mentor и ojs — отдельные модули со своей генерацией, в общую схему (buf.yaml) не входят.

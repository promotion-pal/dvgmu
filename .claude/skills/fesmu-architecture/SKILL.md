---
name: fesmu-architecture
description: Архитектура монорепо ДВГМУ/fesmu — куда класть код и как связывать бэкенды, общие схемы (.proto, buf, packages/go, packages/ts) и фронт fesmu. Используй этот навык ВСЕГДА, когда задача меняет структуру — новый сервис или приложение, новая или изменённая схема/enum/метод, новый модуль fesmu api, новый раздел или страница фронта, связь одного сервиса с другим, права доступа к разделу, Dockerfile/compose бэкенда, локальный запуск портала — даже если пользователь не говорит «архитектура». Также используй его перед коммитом таких изменений и при вопросах «где должен лежать…», «как подключить сервис…», «почему не собирается после make proto».
---

# Архитектура монорепо fesmu

Подробное описание для людей — `ARCHITECTURE.md` в корне. Этот навык — правила для работы с кодом.

## Карта

```
apps/<app>/api        бэкенд приложения (Go). Пример: apps/fesmu/api
apps/<app>/web        фронт приложения (React + Vite). Пример: apps/fesmu/web
services/<svc>/api    сервис (Go): своя БД, свой compose, свой .env
services/<svc>/api/contract/<svc>/{entity,enum,service}   схемы .proto сервиса
packages/go           сгенерированный Go всех схем — модуль fesmu/contract
packages/ts           сгенерированный TS всех схем — пакет @fesmu/contract
buf.yaml / buf.gen.yaml   workspace схем и генерация (make proto)
dev/                  локальный портал целиком (make dev-up), adfs-mock вместо AD
```

## Правила и почему они такие

1. **Схема живёт у владельца, в папке с его именем.** `services/mdm/api/contract/mdm/entity/user.entity.proto`. Путь `.proto` используется в `import`, в пути TS-файла и в реестре protobuf внутри программы. Без папки владельца одинаковые имена файлов у разных сервисов конфликтуют. buf не умеет добавлять префикс к путям: уникальность даёт только папка.
2. **Схемы ссылаются друг на друга с именем владельца:** `import "mdm/entity/user.entity.proto"`. Копировать `.proto` в другой сервис нельзя: появятся два источника правды.
3. **Сгенерированный код — только в `packages/`.** В `services/*/api` и `apps/*/api` нет `*.pb.go` и `*.connect.go`. Генерацию запускает только `make proto`, руками её не правят.
4. **Бэкенд подключает схемы через свой `go.mod`:** `require fesmu/contract v0.0.0` и `replace fesmu/contract => ../../../packages/go`. Поэтому Docker-образ бэкенда собирается из корня репозитория. Его `Dockerfile.dockerignore` пускает в контекст только `packages/go` и эту папку api: на сервере в корне лежат базы.
5. **Фронт берёт схемы только из `@fesmu/contract`:** `@fesmu/contract/mdm/entity/user.entity_pb`. Относительных путей в `packages/ts` и старых `@dvgmu/contract` нет.
6. **Сервисы общаются только по сети (Connect RPC).** Общих баз нет. Чужие данные получают вызовом чужого сервиса.
7. **Схемы меняются совместимо:** сервисы выкатываются в разное время. Добавлять поле с новым номером, метод или значение enum можно. Удалять, перенумеровывать, менять тип, переименовывать пакет или сервис нельзя. Для таких изменений нужна новая версия API (`<svc>/v2/…`, пример — auth v1/v2).
8. **dormitory, mentor и ojs — вне общей схемы.** У dormitory и mentor proto-пакеты совпадают с mdm (`contract.entity.User`). Не добавляй их в `buf.yaml` без новой версии их API с уникальными пакетами.

## Куда что класть

| Задача | Где | Справочник |
|---|---|---|
| Новый сервис (своя БД, своё API) | `services/<svc>/` | [backend.md](references/backend.md) |
| Логика только для портала fesmu | модуль `apps/fesmu/api/internal/modules/<name>/` | [backend.md](references/backend.md) |
| Новое сообщение, enum или метод | `.proto` владельца → `make proto` | [contracts.md](references/contracts.md) |
| Тип нужен двум сервисам | у владельца данных; второй делает `import` | [contracts.md](references/contracts.md) |
| Новый раздел или страница фронта | `apps/fesmu/web/src/{page,widgets,shared}` | [frontend.md](references/frontend.md) |
| Право на раздел | enum `PermissionSection` + api + фронт | [frontend.md](references/frontend.md) |
| Проверить всё локально, вход без AD | `dev/`, `make dev-up` | [local-dev.md](references/local-dev.md) |

Открывай только нужный справочник.

## Как работать

1. Определи, какие слои затронуты: схема, бэкенд, фронт, сборка. Прочитай справочники этих слоёв.
2. Меняй схему первой. Затем выполни `make proto`, затем пиши код бэкенда и фронта на сгенерированных типах.
3. Перед тем как сказать «готово», проверь:
   ```bash
   .claude/skills/fesmu-architecture/scripts/check.sh   # правила этого навыка
   make proto-check                                     # код совпадает со схемами
   (cd <затронутый api> && go build ./... && go vet ./... && go test ./...)
   (cd apps/fesmu/web && npx tsc -b --noEmit && npx vite build)   # если менялся фронт
   ```
   `check.sh` выводит строки `FAIL` с причиной. Исправь их, не обходи.
4. Если правило мешает задаче, не нарушай его молча. Объясни пользователю конфликт и предложи вариант: например, новую версию API вместо ломающего изменения.
5. Если изменилась карта сервисов или их связи, обнови `ARCHITECTURE.md`: таблицы «Сервисы» и «Как сервисы связаны».

## Частые ошибки

- **Файл пропал после генерации.** Проверь, что на месте `packages/go/go.mod` и `packages/ts/package.json`: `make proto` удаляет только `*.pb.go`, `*.connect.go` и `*_pb.ts`. `check.sh` это ловит.
- **`go build`: «module ../../../packages/go … no such file».** Нет `packages/go/go.mod`, или папка api лежит не на глубине `services/<svc>/api`.
- **TS: «Cannot find module '@fesmu/contract/…'».** Нет `make proto`, или нет `pnpm install`, или путь без имени владельца.
- **В Docker «replace … not found».** Образ собран не из корня: проверь `context: "../.."` в compose и `COPY packages/go packages/go` в Dockerfile.

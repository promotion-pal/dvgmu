# Общие схемы (.proto, buf, packages)

## Где лежат

| Владелец | Папка схем | Путь в import |
|---|---|---|
| сервис | `services/<svc>/api/contract/<svc>/{entity,enum,service}/` | `"<svc>/entity/x.entity.proto"` |
| fesmu | `apps/fesmu/api/contract/fesmu/{entity,enum,service}/vN/` | `"fesmu/enum/v1/x.enum.proto"` |
| auth | `services/auth/api/contract/auth/{v1,v2}/` | `"auth/v2/user.proto"` |

Корневой `buf.yaml` перечисляет папки `contract` всех модулей общей схемы. Путь в `import` считается от папки `contract`, поэтому первая часть пути — имя владельца.

## Генерация

```bash
make proto         # buf generate по buf.gen.yaml
make proto-check   # то же + проверка, что git не видит изменений (CI)
```

`buf.gen.yaml`:
- `managed` + `go_package_prefix: fesmu/contract`: Go-пакет = `fesmu/contract/` + папка схемы. Пример: `fesmu/contract/mdm/entity`.
- `protoc-gen-go` и `protoc-gen-connect-go` пишут в `packages/go`, опции `paths=import`, `module=fesmu/contract`.
- `protoc-gen-es` пишет в `packages/ts`, опции `target=ts`, `import_extension=none`.

| Схема | Go | TS |
|---|---|---|
| `mdm/entity/user.entity.proto` | `fesmu/contract/mdm/entity` | `@fesmu/contract/mdm/entity/user.entity_pb` |
| `mdm/service/user.service.proto` | `fesmu/contract/mdm/service`, клиент — `…/service/serviceconnect` | `@fesmu/contract/mdm/service/user.service_pb` |

`packages/go/go.mod` и `packages/ts/package.json` написаны руками, их не генерируют. Не удаляй их.

## Изменить схему

1. Правь `.proto` у владельца.
2. Проверь совместимость (см. ниже).
3. `make proto`.
4. Обнови код всех, кто использует эту схему. Найти их: `grep -rn "fesmu/contract/<svc>/" --include='*.go'` и `grep -rn "@fesmu/contract/<svc>/" apps/*/web/src`.
5. `.claude/skills/fesmu-architecture/scripts/check.sh`, `make proto-check`, сборка затронутых модулей.

## Тип нужен двум сервисам

- Тип описывает **владелец данных**: человек — mdm, опрос — analytics.
- Второй сервис делает `import "<владелец>/…"` и использует тип. Пример — схема file использует `mdm.entity.User`:
  ```proto
  import "mdm/entity/user.entity.proto";
  repeated contract.entity.User employees = 4;
  ```
- Не копируй сообщение в свою схему: копии расходятся.

## Совместимость

Сервисы и фронт выкатываются в разное время. Старый клиент должен работать с новой схемой, новый — со старой.

| Можно | Нельзя (нужна новая версия API) |
|---|---|
| новое поле с новым номером | удалить поле или поменять номер |
| новый метод | поменять тип поля |
| новое значение enum | переименовать proto-пакет, сервис или метод (это адрес вызова: `/contract.service.UserService/UserFetch`) |
| новое сообщение | поменять смысл поля |

Удалённое поле — `reserved <номер>;` и `reserved "<имя>";`, чтобы номер не заняли заново.

Перед выкаткой можно проверить: `buf breaking --against '.git#branch=main'`.

Новая версия API — новая папка: `<svc>/v2/…` и пакет `contract.<svc>.v2`. Старая версия работает рядом, пока на неё не перестанут ходить. Пример — `auth/v1` (заморожен) и `auth/v2`.

## Модули вне общей схемы

`services/dormitory`, `services/mentor`, `services/ojs` генерируют свои схемы сами. У dormitory и mentor proto-пакеты `contract.entity`, `contract.service`, как у mdm, — в одном workspace это конфликт имён. Подключать их к `buf.yaml` можно только после перехода на уникальные пакеты (новая версия API).

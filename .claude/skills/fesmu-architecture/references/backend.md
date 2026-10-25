# Бэкенд: сервисы и fesmu api

## Устройство папки api (сервис или приложение)

```
<svc>/api/
  cmd/                     main.go (у mdm — cmd/dvgmu)
  config/                  local.yaml (или dev.yaml), prod.yaml; переменные окружения перекрывают yaml
  contract/<svc>/          только .proto — см. contracts.md
  internal/
    app/                   сборка приложения: БД, миграции, сервер
    app/grpc/              регистрация Connect-обработчиков на http.ServeMux
    config/                структура конфига (cleanenv, теги env)
    domain/models/         модели БД и преобразование в/из proto
    grpc/                  обработчики Connect: proto → сервис → proto
    service/               бизнес-логика
    storage/               доступ к БД (gorm)
  migrations/ или db/migrations/   goose, встроены в бинарник (embed.go)
  go.mod                   свой модуль: dvgmu/<svc> (у mdm — dvgmu/api)
  Dockerfile
  Dockerfile.dockerignore
<svc>/docker-compose.yml   контейнеры dvgmu_apps${STAND:+_${STAND}}_<svc>_{api,db}
<svc>/.env                 секреты, не в git
```

Код импортирует сгенерированные схемы так:
```go
import (
    mdmentity "fesmu/contract/mdm/entity"
    "fesmu/contract/mdm/service/serviceconnect"
)
```

## Новый сервис

1. Создай `services/<svc>/api` по схеме выше. Ориентир — `services/analytics`: он небольшой.
2. Схемы — в `services/<svc>/api/contract/<svc>/{entity,enum,service}`. proto-пакет — уникальный: `contract.<svc>.entity`, `contract.<svc>.service`. Общий `contract.entity` даст конфликт с mdm.
3. Добавь модуль в корневой `buf.yaml`: `- path: services/<svc>/api/contract`. Выполни `make proto`.
4. `go.mod`:
   ```
   module dvgmu/<svc>
   require fesmu/contract v0.0.0
   replace fesmu/contract => ../../../packages/go
   ```
   Затем `go mod tidy`.
5. Dockerfile — скопируй с `services/analytics/api/Dockerfile` и замени пути. Главное:
   ```dockerfile
   WORKDIR /src
   COPY packages/go packages/go
   COPY services/<svc>/api/go.mod services/<svc>/api/go.sum services/<svc>/api/
   WORKDIR /src/services/<svc>/api
   RUN --mount=type=cache,target=/go/pkg/mod go mod download
   COPY services/<svc>/api ./
   …
   COPY services/<svc>/api/config ./config   # в финальном образе
   ```
6. `Dockerfile.dockerignore` рядом с Dockerfile:
   ```
   *
   !packages/go
   !services/<svc>/api
   services/<svc>/api/storage
   **/.git
   **/.env
   **/.env.*
   ```
7. `docker-compose.yml`: `context: "../.."`, `dockerfile: "services/<svc>/api/Dockerfile"`. Имена контейнеров — `dvgmu_apps${STAND:+_${STAND}}_<svc>_api`. Портов наружу нет, сеть `traefik-network`.
8. Если сервис нужен в CI выкатки — добавь в `.github/workflows/deploy.yml` фильтр: `services/<svc>/api/**` и `packages/go/**`.
9. Добавь сервис в `dev/docker-compose.yml`, если он нужен порталу локально, и в `ARCHITECTURE.md`.

## Связь сервисов

- Только по сети: клиент из `serviceconnect` и адрес из переменной окружения.
  ```go
  client := mdmserviceconnect.NewUserServiceClient(http.DefaultClient, cfg.MDMURL)
  ```
- Служебные вызовы защищены токеном в `Authorization: Bearer …`. Пример — `MDM_INTERNAL_TOKEN` у mdm, `AUTH_INTERNAL_TOKEN` у auth.
- Не читай чужую БД и не копируй чужие модели. Нужен тип — `import` схемы владельца.

## fesmu api (`apps/fesmu/api`)

Это шлюз портала: свои функции и доступ к сервисам.

**Где что:**
- Свои функции портала — модули `internal/modules/<name>/` (`module.go` + `module_test.go`). Пример — `survey`, `questionnaire`. Модуль реализует `Mount(mux, opts...) []string` и регистрируется в списке модулей в `internal/app/app.go`.
- Старые функции — пары `internal/grpc` + `internal/service` + `internal/storage` (расписание, инвентарь и др.). Новое пиши модулями.
- Доступ к сервисам:
  - прокси (`internal/proxy`, регистрация в `internal/app/grpc/app.go`) — запрос уходит в сервис как есть. Для analytics прокси только читает (`AllowProcedures`); запись идёт через модуль.
  - клиент — если нужна своя логика вокруг вызова (модуль `survey` → analytics).

**Права** (`internal/auth`):
- Раздел — значение enum `PermissionSection` в `apps/fesmu/api/contract/fesmu/enum/v1/permission.enum.proto`. В Go — константа `Section…` в `internal/auth/permissions.go`.
- Сервис привязывается к разделу в `internal/app/app.go`: `authInterceptor.Sections[<ServiceName>] = []auth.Section{auth.Section…}`.
- Действие определяется по имени метода (`ActionOf`): `…Fetch` и `…ByID` — просмотр (`раздел.fetch`), остальное — изменение (`раздел.post`). Называй методы чтения с этими окончаниями.
- Открытые методы (без входа) — `authInterceptor.Skip[<Procedure>] = true`. Такой метод не должен отдавать персональные данные.
- Персональные данные (люди, студенты, сотрудники) — только ADMIN.

## Миграции

goose, файлы встроены в бинарник и применяются при старте. Новая миграция — новый файл с бо́льшим номером. Старые не правь: они уже применены на проде.

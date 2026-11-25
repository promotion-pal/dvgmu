# Фронт fesmu (`apps/fesmu/web`)

React + Vite, pnpm workspace из корня. Схемы — только из `@fesmu/contract` (`packages/ts`).

## Слои `src/`

| Папка | Что там | Правило |
|---|---|---|
| `page/` | страница маршрута | тонкая: только собирает виджеты. Пример — `page/analytics/Surveys.tsx` возвращает `<AnalyticComponent />` |
| `widgets/<name>/` | раздел целиком: данные, формы, отображение | вся логика раздела здесь |
| `features/` | общие возможности: `access` (права), `provider` (пользователь), `lib` (формы, загрузка) | используется несколькими разделами |
| `shared/` | `ui` (shadcn), `components` (общие блоки), `config` (маршруты, права, API), `lib`, `hooks` | без логики конкретного раздела |

Зависимости идут вниз: `page → widgets → features → shared`. Виджет берёт другой виджет через его `index.ts` (в старом коде есть прямые импорты файлов — новые так не делай). Если код нужен двум виджетам, вынеси его в `shared` или `features`.

## Файлы виджета

```
widgets/<name>/
  index.ts              публичный экспорт — только то, что нужно снаружи
  <name>.fn.ts(x)       хуки: загрузка, состояние, вызовы API
  <name>.ui.tsx         компоненты
  <name>.form.tsx       формы (react-hook-form)
  <name>.schema.ts(x)   zod-схемы форм
  <name>.utils.ts(x)    подписи, справочники, чистые функции
  <name>.lib.ts         расчёты без React
```

Файл с компонентами экспортирует только компоненты (правило fast refresh). Функции и константы клади в `.fn`, `.utils` или `.lib`.

## Вызов API

```ts
import { createClient } from "@connectrpc/connect";
import { connectTransport } from "@/shared/config/api";
import { AnalyticService } from "@fesmu/contract/analytics/service/analytic.service_pb";
import type { Analytic } from "@fesmu/contract/analytics/entity/analytic.entity_pb";

export const analyticClient = createClient(AnalyticService, connectTransport);
```

- Все вызовы идут в fesmu api (`VITE_API_URL`). Напрямую в сервисы фронт не ходит: fesmu api проксирует их и проверяет права.
- Вход и сессия — только через auth: `shared/config/session.ts` (`/api/v1/auth/me`, `/refresh`, `/login`).
- Состояние загрузки и ошибки показывай через `CommonControlState`, ошибку сервиса — через `CommonServiceError`.

## Новый раздел

1. Схема и методы — в proto владельца (contracts.md), затем `make proto`.
2. Право — новое значение `PermissionSection` в `apps/fesmu/api/contract/fesmu/enum/v1/permission.enum.proto` → `make proto`. В api: константа `Section…` в `internal/auth/permissions.go` и привязка сервиса в `authInterceptor.Sections` (backend.md).
3. Маршрут — `shared/config/path.ts` (`ROUTE.<РАЗДЕЛ>`) и `<Route>` в `App.tsx`.
4. Меню — `widgets/layout/sidebar/nav.ts`: `permissions: permsFor(PermissionSection.X)`.
5. Подпись раздела для админки доступов — `SECTIONS` в `shared/config/permissions.ts`.
6. Кнопки изменения — `<Can section={PermissionSection.X}>…</Can>` или `useCan(PermissionSection.X)`. Без права на изменение кнопок не видно, а api всё равно откажет.
7. Виджет в `widgets/<name>/`, страница в `page/`.

## Права в коде

```ts
import { Can, useCan } from "@/features/access";
import { PermissionSection, permsFor } from "@/shared/config/permissions";

<Can section={PermissionSection.ANALYTICS}><Button>Создать</Button></Can>
const canEdit = useCan(PermissionSection.ANALYTICS);       // изменение (post)
```

Право — строка `раздел.действие` (`analytics.post`). Изменение включает просмотр. ADMIN видит всё.

## Кабинет и публичные страницы

- **Личный кабинет — под `/lk`.** Все маршруты после входа задаются в `shared/config/path.ts` через префикс `LK` (`/lk/profile`, `/lk/library/manuals/:id/edit`…) и лежат в `App.tsx` внутри `UserGate`. Корень `/` ведёт в `/lk`. Старые адреса без `/lk` (префиксы в `LEGACY_LK_PREFIXES`) перенаправляются в кабинет — новый раздел кабинета добавлять туда не нужно, он сразу с `/lk`.
- **Без входа — только `page/public/*`** (расписание, анкеты по QR, запись, прохождение теста, методички). Маршрут — `ROUTE.PUBLIC.*` в корне сайта, без `/lk`: эти адреса напечатаны в QR и разосланы, их не меняют. Персональных данных такие страницы не показывают.
- В api метод публичной страницы — в `Skip` (вход не нужен вовсе) или в `Optional` (открыт всем, но вошедшего узнаёт: например, методички — редактору с черновиками). Подробнее — backend.md.
- Каркас: служебные страницы без меню — `<Layout notViewHeader notViewSidebar />`; открытый раздел со своей шапкой и ссылкой «Личный кабинет» — `PublicLayout` (методички). `Header` кабинета вне `SidebarProvider` не работает.

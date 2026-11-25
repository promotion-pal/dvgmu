# Schedula

Schedula owns academic events, terms, venues, bookings, and changes to the published timetable. The portal serves the public timetable at `/schedula` and the signed-in timetable and editor at `/lk/schedula`. The legacy `/schedule` and `/lk/study/schedule` routes use the portal’s existing schedule service and a separate data model.

## Architecture

```text
Portal web ──Connect──> FESMU API gateway ──Connect──> Schedula API ──> PostgreSQL
                                                           └──Connect──> MDM
```

| Location | Responsibility |
| --- | --- |
| [`api/contract/schedula`](api/contract/schedula) | Source protobuf messages, enums, and RPC definitions |
| [`api/internal/app`](api/internal/app) | Configuration, database connection, embedded Goose migrations, and the HTTP server |
| [`api/internal/grpc`](api/internal/grpc) | Connect handlers, MDM account and instructor lookups, authorization, and error mapping |
| [`api/internal/service`](api/internal/service) | Catalog validation, recurrence, conflict detection, slot search, completeness, and change requests |
| [`api/internal/storage`](api/internal/storage) and [`api/migrations`](api/migrations) | GORM queries, writes serialized with a PostgreSQL transaction lock, and database constraints |
| [`apps/fesmu/api/internal/modules/schedula`](../../apps/fesmu/api/internal/modules/schedula) | Portal session verification and forwarding to Schedula |
| [`apps/fesmu/web/src/widgets/schedula`](../../apps/fesmu/web/src/widgets/schedula) | Timetable, filters, editor, catalog, and change history |

MDM owns user identities, roles, effective permissions, instructor names, and student groups and counts. Schedula stores instructor UUIDs and event audiences. The current MDM student profile supplies the group only, so the personal student timetable can automatically select whole-group events. The signed-in timetable supports explicit subgroup filtering.

The gateway overwrites incoming authorization and `X-Schedula-User` headers, strips the session cookie before forwarding, and adds the user UUID from the verified portal session. Schedula requires the shared bearer token for every RPC, including the public RPC. For signed-in calls it also resolves the actor against MDM and checks permissions. The public RPC uses its own response type with group labels and venue details. Instructor identities, subgroups, pending changes, and audit records belong to the signed-in API.

## API

The Connect service is `contract.schedula.service.SchedulaService`. Call it through the portal API under `/contract.schedula.service.SchedulaService/<Method>`. The [service definition](api/contract/schedula/service/schedula.service.proto) lists the exact request and response fields.

| RPC | Access | Behavior |
| --- | --- | --- |
| `PublicScheduleFetch` | Anonymous through the gateway | Reads published and cancelled events in the requested dates. Returns subject, site, and room filter options for the date range. |
| `ScheduleFetch` | Active students, teachers, staff, and admins | Reads the timetable, academic periods, and holiday transfers. Can select the actor’s personal timetable. Only editors can include drafts. |
| `CatalogFetch` | Same signed-in users | Returns terms, subjects, sites, rooms, and instructors. Editors also receive periods, holidays, travel times, and bookings. |
| `CatalogSave` | Editors | Upserts the supplied catalog records. Omitted records stay in the catalog. |
| `EventSave` | Editors | Creates a draft or recurring series, or updates a draft by ID and revision. |
| `EventCheckFetch` | Editors | Reports missing details and conflicts for the saved event, including dates that require a holiday transfer. |
| `EventPublish` | Editors | Publishes a draft or all remaining drafts of its series in one transaction after conflict checks. |
| `CompletenessFetch` | Editors | Reports events missing time or venue and courses, groups, or configured subgroups without a scheduled assignment in the term. |
| `SlotsFetch` | Editors and authorized staff or teachers | Finds up to 12 compatible slots within a 31-day range. Editors can account for drafts and exclude an event being rescheduled. |
| `ChangeCreate` | Editors and the event’s instructor | Submits a move, instructor replacement, room change, or cancellation for approval. |
| `ChangeDecide` | Editors | Approves or rejects a pending request. A rejection requires a reason. |
| `ChangeHistoryFetch` | Editors and teachers | Editors see all requests for the event. Teachers see their own requests. |

Editors are admins or staff and teachers with `schedule.post`. Staff and teachers with `computer_classes.fetch` or `computer_classes.post` can also search for slots. The web app uses capability flags from `ScheduleFetch` to decide which controls to show.

Dates use `YYYY-MM-DD` and inclusive bounds. With no dates, the schedule RPCs return the current Monday–Sunday week in the configured university time zone. Providing only `dateFrom` selects one day. Schedule ranges can span up to 370 days. Times use minutes from local midnight and durations use elapsed minutes. The Monday of the term’s first week anchors weekly recurrence. `academicWeek` describes the first in-term day in the requested range and is `0` when the range misses every term.

Mutation responses can contain `issues` with a successful HTTP response even when nothing was published or approved. Check for returned events or a returned change before treating the operation as complete. A stale event revision or a completed change decision returns `FailedPrecondition`. Fetch the updated record before retrying an edit.

## Scheduling rules

- Drafts can be incomplete and can overlap. Publishing checks timing, room hours, capacity, equipment, bookings, instructor and audience overlaps, travel between consecutive events, and clinical-event details. Intervals that touch at their endpoints do not overlap. Whole-group events overlap every subgroup in the group.
- Recurrence expands weekly slots into individual, dated draft events with a shared series ID. Weekly, odd-week, and even-week recurrence are supported. The editor can revise individual occurrences. A blocking issue on one draft blocks publication of the entire requested series.
- A published event on a holiday is shown in the signed-in transfer list for its term. It stays out of the normal timetable until an approved move puts it on an available date. Approved cancellations are visible as cancelled entries.
- A published event has at most one pending change. Approval rechecks the current revision and, for a non-cancellation, availability before applying the update. The history retains before and after snapshots, the author and reviewer, and their timestamps.

## Local development

From the repository root, start the portal stack and seed local MDM accounts.

```sh
make dev-up
make dev-seed
```

The portal is at `http://localhost:18300` and the gateway is at `http://localhost:18200`. The Schedula database starts empty. Sign in as a local admin, open `/lk/schedula`, and add a term, subject, site, and room in the catalog. Choose an active teacher from MDM when creating an event. Save the event as a draft, check and publish it, then open `/schedula` for the same date to verify its public representation.

To query the public RPC without a portal session, use the local gateway.

```sh
curl --fail-with-body -sS \
  -H 'Content-Type: application/json' \
  -H 'Connect-Protocol-Version: 1' \
  -d '{"filter":{"dateFrom":"2026-11-24"}}' \
  http://localhost:18200/contract.schedula.service.SchedulaService/PublicScheduleFetch
```

To run the service directly, run `go run ./cmd` from `services/schedula/api`. It loads `config/local.yaml` by default, connects to PostgreSQL, and applies embedded migrations before serving traffic. `GET /healthz` checks database connectivity and returns status `204` when healthy.

| Variable | Applies to | Purpose |
| --- | --- | --- |
| `PACKAGE_SCHEDULA` | Portal API | Internal base URL of the Schedula API. The gateway mounts the module when this URL and the shared token are set. |
| `SCHEDULA_INTERNAL_TOKEN` | Schedula and portal API | Matching bearer token supplied through the environment |
| `PACKAGE_MDM` | Schedula | Required base URL for MDM |
| `GRPC_PORT`, `SCHEDULA_TIME_ZONE` | Schedula | HTTP port and university time zone. Defaults are `4000` and `Asia/Vladivostok`. |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSLMODE` | Schedula | PostgreSQL connection. Local defaults are `localhost`, `5432`, `postgres`, database `schedula`, and SSL mode `disable`. |

The [standalone Compose file](docker-compose.yml) starts Schedula and its PostgreSQL instance without publishing host ports. It uses the external `traefik-network` for the portal API and MDM, and requires `POSTGRES_PASSWORD`, `PACKAGE_MDM`, and `SCHEDULA_INTERNAL_TOKEN`.

## Making and testing changes

1. Edit protobuf contracts under `api/contract/schedula`, then run `make proto` from the repository root. Commit the matching changes under `packages/go/schedula` and `packages/ts/schedula`. Keep existing protobuf field numbers and RPC paths compatible with deployed clients.
2. Add a new Goose migration under `api/migrations` for schema changes. Keep scheduling rules in `internal/service` and put transport permissions in `internal/grpc`.
3. Run the service and portal checks from the repository root.

   ```sh
   (cd services/schedula/api && go test ./...)
   (cd apps/fesmu/api && go test ./internal/modules/schedula ./internal/auth ./internal/proxy)
   pnpm --dir apps/fesmu/web build
   .claude/skills/fesmu-architecture/scripts/check.sh
   ```

4. Set `SCHEDULA_TEST_DSN` to a PostgreSQL URL for a disposable local database and rerun `go test -count=1 -v ./...` in `services/schedula/api` to exercise `TestScheduleLifecycle`. The test role needs permission to create schemas. The test creates its own schema, applies the migrations, exercises the Connect API with a test MDM server, and removes the schema afterward.

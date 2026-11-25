# mentor — программа наставничества ДВГМУ

Единственное из четырёх фронтенд-приложений в монорепозитории, у которого есть настоящий backend,
форма с сохранением данных и админ-панель. Next.js 16 / React 19, стили — Tailwind v4.

---

## Часть 1. Обзор для заказчика

### Ссылки

| Что | Адрес |
|---|---|
| Сайт | https://mentor.dvgmu.promotion-pal.ru |
| Админ-панель (управление курсами и заявками) | https://mentor.dvgmu.promotion-pal.ru/admin |
| Политика конфиденциальности | https://mentor.dvgmu.promotion-pal.ru/privacy |
| Образовательный портал (внешний ресурс, ссылка с сайта) | https://prom.fesmu.ru/portal |

### Что делает сайт

Сайт-визитка программы наставничества ДВГМУ с формой заявки на обучение. Один длинный лендинг с
разделами:

- **О центре** — кто такой учебно-методический центр, кто им руководит.
- **О программе** — цель программы, ожидаемые результаты обучения.
- **Документы** — нормативная база наставничества, файлы доступны для скачивания прямо с сайта
  (заявка на цикл, приказ Минздрава №167н, ФЗ №424-ФЗ).
- **Состав УМЦ** — руководство и ключевые сотрудники центра.
- **Контакты** — телефоны и email по образовательной и методической части.
- **Вопросы (FAQ)** — ответы на частые вопросы о том, кто и как проходит наставничество.
- **Заявка на обучение** — единственная часть сайта, которая реально сохраняет данные: посетитель
  выбирает курс из списка, введённого в админке, и отправляет заявку (ФИО, email, согласие на
  обработку персональных данных). Заявка попадает в базу и видна в админ-панели.

### Админ-панель

По ссылке `/admin` (с логином и паролем, см. ниже) доступны:
- **Курсы** — добавление, редактирование и удаление курсов обучения. Именно этот список видят
  посетители сайта в выпадающем списке формы заявки.
- **Заявки** — список всех заявок, поданных через сайт (ФИО, email, выбранный курс, дата подачи).
  Пока только просмотр, без возможности отредактировать или удалить заявку из интерфейса.

**Доступ в админ-панель:**
- Логин: `admin`
- Пароль: `dvgmu-mentor-2026`

Это временное решение (см. пометку в разделе для разработчика) — пароль стоит сменить перед тем,
как давать доступ посторонним, и в целом не полагаться на него как на надёжную защиту.

---

## Часть 2. Технические детали для разработчика

### Инфраструктура

| Что | Значение |
|---|---|
| Каталог сервиса | `services/mentor/` (`site/`, `api/`, `packages/`, свой `docker-compose.yml` / `.env`) |
| Контейнеры | `dvgmu_apps_mentor_web` (сайт), `dvgmu_apps_mentor_api` (Go), `dvgmu_apps_mentor_db` (Postgres) |
| API | Наружу не выставлен. Браузер бьёт на `https://mentor.dvgmu.promotion-pal.ru/api/*`, Next (rewrites) проксирует в `dvgmu_apps_mentor_api:4000` внутри docker-сети |
| Роутинг/TLS | Traefik, лейблы `traefik.http.routers.mentor-secure.rule=Host(...)`, сертификат — Let's Encrypt |
| Локальный запуск | `cd services/mentor && cp .env.example .env && docker compose -f docker-compose.dev.yml up -d` (только БД) + `cd site && pnpm dev` |

### Страницы и логика

#### `/` (`src/app/page.tsx`)
Один лендинг с якорями: `#about-center` → `#about` → `#documents` → `#teachers` → `#contacts` →
`#faq` → `#form`.

- Обзорные карточки, цель программы, состав УМЦ, контакты, FAQ-аккордеон — статичный текст,
  захардкожен прямо в компоненте.
- `#documents` — три файла на скачивание из `public/documents/*.doc|.pdf`. Файлы лежат в
  репозитории, не в БД.
- Форма «Задать вопрос» в блоке FAQ — только вёрстка, `onSubmit` не обработан, никуда не уходит.
- `#form` = компонент `ApplicationFormSection` — см. ниже.

#### `#form` / заявка на обучение (реальная, с backend)
`widgets/application-form/application-form-section.tsx` → `MentorApplicationForm`.

- Поля: Фамилия, Имя, Отчество (опц.), Email, выбор курса — `mentor-application.schema.ts` (zod):
  фамилия/имя ≥ 2 символов, email обязателен и валиден, `courseId` обязателен, `consent` обязателен
  (чекбокс согласия на обработку перс. данных, ссылается на `/privacy`).
- Список курсов подтягивается при монтировании (`useMentorCourses` → `fetchCourses`) потоковым
  RPC `MentorCourseFetch` — то есть курсы **не хардкод**, а то, что реально создано в админке.
- Отправка — RPC `MentorApplicationCreate`. Успех/ошибка — тосты через `sonner`.

#### `/admin` — панель администратора
`src/app/admin/page.tsx`. Две зоны:
- **Курсы** — форма создания (`MentorCourseCreate`) + таблица со списком (`MentorCourseFetch`),
  редактирование/удаление по месту (`MentorCourseUpdate` / `MentorCourseDelete`).
- **Заявки** — только просмотр, таблица с ФИО/email/курсом/датой подачи (`MentorApplicationFetch`).
  Редактирования/удаления заявок в UI нет (хотя в API-контракте методы `Update`/`Delete` для
  заявок есть — просто не используются на фронте).

#### `/admin/login`
Форма логин/пароль, сверяется на клиенте с константой `ADMIN_CREDENTIALS` (раздел ниже). При
успехе пишет флаг в `localStorage` (ключ `dvgmu_admin_session` = `"1"`) и редиректит на `/admin`.
`/admin` при монтировании (`useRequireAdminAuth`) проверяет тот же флаг в `localStorage` — если
его нет, редиректит обратно на `/admin/login`.

### Доступы и пароли

#### Админ-панель
- Логин: `admin`
- Пароль: `dvgmu-mentor-2026`
- Файл: `services/mentor/site/src/shared/config/admin.ts` (комментарий в коде: *«Temporary hardcoded
  credentials until proper auth is implemented»*).

**Важно про безопасность:** это не настоящая авторизация.
- Проверка целиком на клиенте — пароль лежит в JS-бандле, который отдаётся любому посетителю;
  открыть `/admin` можно, просто вручную положив `localStorage.dvgmu_admin_session = "1"` в
  консоли браузера, без ввода пароля вообще.
- gRPC-методы `MentorCourseCreate/Update/Delete` и `MentorApplicationFetch` на самом API
  ничем не защищены — их может вызвать кто угодно напрямую, минуя фронтенд и `/admin` целиком.
- Так что пароль скорее «от входной двери на сайте», а не от данных — сами данные открыты на
  уровне API уже сейчас.

#### База данных (Postgres, только внутри docker-сети, наружу не торчит)
- **Прод** (`services/mentor/docker-compose.yml`, значения из `services/mentor/.env` на сервере
  деплоя — в репозитории их нет): `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`
  пробрасываются в контейнер `dvgmu_apps_mentor_api` как `DB_USER/DB_PASSWORD/DB_NAME`,
  `DB_HOST=dvgmu_apps_mentor_db`, `sslmode=disable` (`api/config/prod.yaml`). Данные — в
  именованном томе `dvgmu_apps_mentor_pgdata`.
- **Локальная разработка** — два независимых источника, значения разные:
  - `services/mentor/.env` (не в git, `.gitignore`; шаблон — `services/mentor/.env.example`):
    `POSTGRES_USER=mentor`, `POSTGRES_DB=dvgmu_mentor_db`, `POSTGRES_PORT=5443`. Используется
    `services/mentor/docker-compose.dev.yml` (контейнер `dvgmu_apps_mentor_db`, том `./api/db/postgres`).
  - `api/config/local.yaml` (закоммичен в git, значит это осознанно dev-заглушка, не секрет):
    `user: postgres`, `password: postgres`, `dbname: dvgmu_db`, `host: localhost`. Это конфиг для
    `go run ./cmd/dvgmu --config=config/local.yaml`, то есть API-сервис, запущенный локально без
    докера, ходит в Postgres с этими кредами — они не совпадают с `.env`, при локальном
    запуске нужно свести вручную (либо поднять `docker-compose.dev.yml` с теми же значениями, что
    в `local.yaml`, либо наоборот).

#### Как фронт находит backend (`/api` + Next rewrites)
- `services/mentor/site/src/shared/config/env.ts`: если `NEXT_PUBLIC_API` не задана — дефолт `/api`
  (относительный путь, same-origin).
- `services/mentor/site/next.config.ts`: `rewrites()` проксирует `/api/:path*` →
  `${API_INTERNAL_URL}/:path*`. Дефолт `API_INTERNAL_URL` — `http://localhost:4000`; в проде
  `docker-compose.yml` передаёт `http://dvgmu_apps_mentor_api:4000` через `build.args`.
- Домен `api.app.dvgmu.promotion-pal.ru` больше не используется — API закрыт внутри docker-сети.

#### Деплой
GitHub Actions (`.github/workflows/deploy.yml`) по SSH на сервер: `secrets.SERVER_IP`,
`secrets.SERVER_USER`, `secrets.SERVER_PASSWORD` — в GitHub Secrets репозитория, из кода не видны,
здесь показать нечего.

### API-контракт (Go, connect-go, gRPC)

Прото-файлы: `services/mentor/api/contract/entity/mentor.entity.proto`,
`services/mentor/api/contract/service/mentor.service.proto`.
Фронт — TS-клиент (`@connectrpc/connect-web`) через сгенерированный `@proto/*` пакет
(`services/mentor/packages/proto`, `@dvgmu/mentor-proto`). `buf generate` (из `api/contract/`) кладёт
`_pb.ts` в `../../packages/proto`; после генерации нужен `pnpm install` в `services/mentor/packages/`.
Алиас `@proto/*` → `../packages/proto/*` в `site/tsconfig.json`, `turbopack.root` в
`site/next.config.ts` поднят на `services/mentor/`, чтобы Next видел соседний `packages/`.

**MentorApplication** (заявка): `id, firstName, lastName, patronymic, email, course_id, created_at, updated_at`
**MentorCourse** (курс): `id, title, description, date, created_at, updated_at`

Методы сервиса `MentorService`:
- `MentorApplicationCreate / ByID / Fetch (stream) / Update / Delete`
- `MentorCourseCreate / ByID / Fetch (stream) / Update / Delete`

Фронт реально использует: `MentorCourseFetch` (публичная форма и админка), `MentorApplicationCreate`
(публичная форма), `MentorCourseCreate/Update/Delete` и `MentorApplicationFetch` (админка). Остальные
методы (`*ByID`, `MentorApplicationUpdate/Delete`) есть в контракте, но на фронте нигде не вызываются.

### Известные недочёты (на будущее)

- Админка защищена только на клиенте — при необходимости реальной защиты нужна серверная проверка
  (хотя бы на уровне gRPC-интерсептора/middleware в `services/mentor/api/`), иначе пароль в
  `admin.ts` не даёт ничего, кроме скрытия ссылки от случайных посетителей.
- Локальный `api/config/local.yaml` и `services/mentor/.env` держат разные учётные данные Postgres —
  при локальной разработке без докера это может путать (сервис не подключится, если поднять БД по
  одному набору кредов, а API запустить с другим).
- Фронт локально по умолчанию ходит на `/api` → `http://localhost:4000` (Next rewrites). Если API
  слушает другой адрес — задать `API_INTERNAL_URL` в `services/mentor/site/.env.local`.

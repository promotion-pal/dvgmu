# DVGMU Apps — обзор проекта

Монорепозиторий из статических фронтенд-приложений на Next.js (`apps/*`) и самостоятельных
сервисов в `services/*` (у каждого свой `docker-compose.yml` и `.env`). Раздача — через Traefik
по доменам `*.dvgmu.promotion-pal.ru`. Источники: корневой `docker-compose.yml` (только статические
сайты ksm/guide/profile/unistom), `services/*/docker-compose.yml`, `.github/workflows/deploy.yml`.

`mentor` (Next.js сайт + Go/gRPC backend + Postgres) живёт в `services/mentor/` по тому же
стандарту, что `services/analytics` и `services/dormitory`: `site/`, `api/`, `packages/` (proto),
контейнеры `dvgmu_apps_mentor_{db,api,web}`. API наружу не выставлен — сайт проксирует `/api`
внутрь docker-сети (Next rewrites).

## 1. Ссылки и инфраструктура

| Сервис | Домен (прод) | Локальный порт | Контейнер | Что это |
|---|---|---|---|---|
| ksm | https://ksm.dvgmu.promotion-pal.ru | внутр. 3000 | `dvgmu_apps_ksm_web` | Клиника семейной медицины (лендинг) |
| unistom | https://unistom.dvgmu.promotion-pal.ru | внутр. 3000 | `dvgmu_apps_unistom_web` | Стоматология «Уни-Стом» (лендинг) |
| guide | https://guide.dvgmu.promotion-pal.ru | внутр. 3000 | `dvgmu_apps_guide_web` | Лендинг |
| mentor | https://mentor.dvgmu.promotion-pal.ru | внутр. 3000 | `dvgmu_apps_mentor_web` | Программа наставничества — единственное приложение с реальной бизнес-логикой (`services/mentor/`) |
| profile | https://profile.dvgmu.promotion-pal.ru | внутр. 3000 | `dvgmu_apps_profile_web` | Не начато, дефолтная заготовка `create-next-app` |
| wiki | https://wiki.dvgmu.promotion-pal.ru | — | `dvgmu_apps_wiki_web` | Flutter web (`services/dvgmu_wiki/`), nginx |
| mentor api | — (наружу не открыт, сайт проксирует `/api`) | внутр. 4000 | `dvgmu_apps_mentor_api` | Go/gRPC backend, обслуживает только mentor |
| mentor postgres | — (наружу не открыт) | — | `dvgmu_apps_mentor_db` | БД mentor, том `dvgmu_apps_mentor_pgdata` |

`services/dvgmu_wiki/` — Flutter-приложение (WebView-обёртка над `wiki.dvgmu.promotion-pal.ru`).
Мобильные сборки (Android/iOS) собираются отдельно. Web-таргет: бандл `flutter build web --release`
(→ `build/web/`, **коммитится в репозиторий**) раздаётся nginx-ом — Dockerfile только
`COPY build/web`, Flutter SDK на сервере не нужен. Контейнер `dvgmu_apps_wiki_web`, домен
`wiki.dvgmu.promotion-pal.ru` (`services/dvgmu_wiki/docker-compose.yml`).

**Деплой:** `.github/workflows/deploy.yml` — при пуше в `main` определяет, какие пути изменились
(`apps/*` и корневой `docker-compose.yml` для статических сайтов; `services/mentor/{site,api,packages}/**`
для mentor), и по SSH на сервере делает `git pull && docker compose build/up` только для затронутых
сервисов. Деплой-джобы сейчас закомментированы (деплой ручной).

## 2. Логика основных страниц

### mentor — mentor.dvgmu.promotion-pal.ru
Единственное приложение, подключённое к backend. Одна страница `/` с якорными секциями:

- `#about-center`, `#about`, `#documents`, `#teachers`, `#contacts`, `#faq` — статический контент
  (о центре, цель программы, нормативные документы для скачивания из `/documents/*`, состав УМЦ,
  контакты, FAQ-аккордеон). Форма «Задать вопрос» в FAQ — визуальная заглушка, никуда не отправляется.
- `#form` (`ApplicationFormSection`) — **реальная** форма заявки на обучение: ФИО, email, выбор
  курса. Список курсов подгружается с backend потоковым вызовом `MentorCourseFetch`, отправка —
  `MentorApplicationCreate` (валидация полей — `mentor-application.schema.ts`, zod).
- `/privacy` — страница политики обработки персональных данных (на неё ссылается чекбокс согласия).
- `/admin` — панель администратора: CRUD курсов (`MentorCourseCreate/Update/Delete`) и просмотр
  списка поданных заявок (`MentorApplicationFetch`).
- `/admin/login` — форма входа в панель (подробности и пароль — раздел 3).

### ksm — ksm.dvgmu.promotion-pal.ru
Статический одностраничный лендинг «Клиника семейной медицины» (структурное подразделение ДВГМУ).
Backend не использует. Секции: hero → `#about` (3 факта о клинике) → `#schedule` (режим работы) →
`#contacts` (адрес/телефоны/email/telegram). Все данные захардкожены в `page.tsx`.

### unistom — unistom.dvgmu.promotion-pal.ru
Статический лендинг стоматологической поликлиники «Уни-Стом». Backend не использует. Секции:
hero → `#services` (прайс услуг) → `#about` (о клинике, кафедры) → `#doctors` → `#news` →
`#reviews` → `#contacts`. Все данные (услуги, врачи, новости, отзывы) — моковые массивы прямо в
`page.tsx`.
⚠️ `appConfig.name` и `appConfig.address` в `shared/config/app.tsx` пустые строки — шапка и футер
сайта показывают пустой заголовок клиники. Похоже на недоделку, а не осознанное решение.

### profile — profile.dvgmu.promotion-pal.ru
Содержательных страниц ещё нет — это дефолтная заглушка `create-next-app` («To get started, edit
page.tsx…»). Разработка не начата.

### mentor api (Go, gRPC + Connect)
`services/mentor/api/` — backend на connect-go, контракт в
`services/mentor/api/contract/service/mentor.service.proto`. Обслуживает только mentor:
`MentorApplication{Create,ByID,Fetch,Update,Delete}` и `MentorCourse{Create,ByID,Fetch,Update,Delete}`.
Хранилище — Postgres (`dvgmu_apps_mentor_db`).

## 3. Пароли и доступы

⚠️ Ничего из перечисленного не является полноценным secret-management — учётные данные лежат
прямо в коде или в локальном `.env` (не в git, см. ниже).

**Админ-панель mentor** (`https://mentor.dvgmu.promotion-pal.ru/admin`):
- логин: `admin`
- пароль: `dvgmu-mentor-2026`
- Источник: `services/mentor/site/src/shared/config/admin.ts`, помечено в коде как
  *«Temporary hardcoded credentials until proper auth is implemented»*. Проверка полностью на
  клиенте (localStorage-флаг), серверной авторизации у `/admin`-эндпоинтов API нет — это не
  настоящая защита, а «замок от чемодана». У остальных трёх приложений (ksm, unistom, profile)
  админ-панелей нет вообще.

**Postgres (dev)** — из `services/mentor/.env` (файл в `.gitignore`, в репозиторий не попадает;
шаблон — `services/mentor/.env.example`):
- user: `mentor`
- db: `dvgmu_mentor_db`
- host (внутри docker-сети): `dvgmu_apps_mentor_db`

Прод-значения этих переменных (`POSTGRES_USER/PASSWORD/DB`, `MENTOR_CORS_ALLOWED_ORIGINS`,
`MENTOR_TZ`) на сервере деплоя читаются из `services/mentor/.env`, в репозитории не хранятся.

**Деплой (GitHub Actions → SSH на сервер)**:
`secrets.SERVER_IP`, `secrets.SERVER_USER`, `secrets.SERVER_PASSWORD` — хранятся в GitHub Secrets
репозитория, значения из кода не видны.

**Образовательный портал** (внешний, не часть этого репо): `https://prom.fesmu.ru/portal` —
ссылка на него есть на главной mentor (`appConfig.portal`), логика/доступы туда за пределами
этого проекта.

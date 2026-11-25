# Plane: запуск и GitHub

Из корня репозитория:

```sh
cp apps/panel/plane-app/plane.env.example apps/panel/plane-app/plane.env
# задайте локальные URL и уникальные секреты
make panel-up
make panel-ps
make panel-logs
make panel-down
```

Нужны запущенный Docker Engine и Docker Compose. Compose-файл поднимает Plane,
PostgreSQL, Valkey, RabbitMQ, MinIO и собственный proxy. Локальный режим публикует
порты 80 и 443; убедитесь, что они свободны, либо задайте другие
`LISTEN_HTTP_PORT` и `LISTEN_HTTPS_PORT` в `plane.env`.

Локальные настройки хранятся в `apps/panel/plane-app/plane.env` и не должны
попадать в Git. В шаблоне замените `CHANGE_ME` на уникальные значения как минимум
для паролей БД/RabbitMQ, `SECRET_KEY`, ключей MinIO и `LIVE_SERVER_SECRET_KEY`.
Для локального запуска задайте `APP_DOMAIN=localhost`, `WEB_URL=http://localhost`
и `CORS_ALLOWED_ORIGINS=http://localhost`. Перед обновлением сохраняйте базу
и uploads. `make panel-down` сохраняет Docker volumes; не используйте `down -v`,
если нужно сохранить данные.

## Запуск через Traefik на mentor.fesmu.ru

Для тестового домена используется override
`apps/panel/plane-app/docker-compose.traefik.yaml`. Он подключает внутренний proxy
Plane к внешней сети `traefik-network`, убирает публикацию портов 80/443 на хост
и добавляет HTTPS router `plane-mentor` для `mentor.fesmu.ru`.

На сервере, где работает Traefik:

```sh
cp apps/panel/plane-app/plane.env.example apps/panel/plane-app/plane.env
cp apps/panel/plane-app/plane.prod.env.example apps/panel/plane-app/plane.prod.env
# заполните plane.env уникальными секретами
make panel-prod-up
make panel-ps
```

Нужны существующая Docker-сеть `traefik-network`, Traefik с entrypoint `websecure`
и resolver `letsencrypt`, а DNS-запись `mentor.fesmu.ru` должна указывать на сервер
с Traefik. Порты 80/443 должны быть доступны извне для маршрутизации и выпуска
сертификата. `plane.prod.env` задаёт `APP_DOMAIN`, `WEB_URL` и CORS для HTTPS;
его локальную копию не добавляйте в Git. Остановить панель можно через
`make panel-prod-down`; Docker volumes с базой и загрузками сохраняются.

Локальный и Traefik режимы используют один Compose-проект и одни volumes.
Переключение между ними пересоздаёт proxy с соответствующей сетевой настройкой.

## GitHub Actions → Plane Community

Интеграция обновляет существующие задачи одного проекта. Она не сливает PR,
не создаёт задачи и не подтверждает успешность деплоя.

1. Запустите Plane на сервере. Для `ubuntu-latest` API должен быть доступен по HTTPS
   из GitHub. Если панель доступна только внутри сети, установите выделенный
   self-hosted runner с Python 3, доступом к Plane и меткой `plane-sync`.
   Добавьте repository variable `PLANE_RUNNER=plane-sync`. Не используйте сервер
   с привилегиями продакшена для выполнения недоверенных PR.
2. Создайте пользователя интеграции, добавьте его в проект с правом изменения
   задач. Создайте Personal API token в настройках профиля Plane.
3. GitHub → репозиторий → Settings → Secrets and variables → Actions:
   - Secret `PLANE_API_KEY`: API token.
   - Variable `PLANE_URL`: адрес Plane без завершающего `/`, например `https://plane.example.org`.
   - `PLANE_WORKSPACE`: slug рабочего пространства из URL.
   - `PLANE_PROJECT_ID`: UUID проекта из URL.
   - `PLANE_PROJECT_IDENTIFIER`: идентификатор проекта, например `FESMU`.
   - `PLANE_STATE_REVIEW`: UUID статуса «На проверке».
   - `PLANE_STATE_DONE`: UUID статуса «Готово» из группы `completed`.
4. UUID статусов получите авторизованным GET-запросом к
   `/api/v1/workspaces/<slug>/projects/<project-uuid>/states/` с заголовком
   `X-API-Key: <token>`. Не публикуйте токен в командах чата и логах.
5. GitHub → Actions → Plane task sync → Run workflow: укажите тестовую задачу,
   status=review, dry_run=true. Workflow проверит доступ, проект, задачу и статусы,
   не меняя данные. Затем повторите с dry_run=false.

### Правила

В заголовке или отдельной строке описания PR:

```text
Plane: FESMU-123, FESMU-124
```

Открытый недрафтовый PR в `main` переводит задачи в review; слияние — в done.
Закрытие без слияния ничего не меняет. Review не переоткрывает завершённые или
отменённые задачи. PR из fork не обрабатываются. После редактирования описания
без новых коммитов используйте ручной запуск или дождитесь следующего push в PR.

Для прямого push в `main` добавьте отдельную строку в сообщение коммита:

```text
Plane-Done: FESMU-123
```

Обычный номер задачи в тексте не вызывает изменений. Ошибочные номера и отсутствие
настроек при наличии маркера завершают workflow ошибкой. Повторный запуск безопасен:
уже установленный статус не меняется. Используется REST API v1 `work-items`,
для старых выпусков Community предусмотрен fallback на `issues` при HTTP 404.
Пакетные push должны содержать не более 2048 коммитов (лимит события GitHub).
Одновременные запуски сериализуются GitHub concurrency; при нескольких ожидающих
запусках GitHub может заменить ожидающий запуск новым — проверьте Actions и при
необходимости повторите вручную. Это синхронизация событий, а не сверка всей истории.

Документация API: https://developers.plane.so/api-reference/issue/update-issue-detail

## MinIO при первом запуске

MinIO собирается из официального репозитория, версия закреплена в
`panel/minio/Dockerfile`. Реестры Chainguard и Quay не используются.
Первая сборка требует доступа Docker к Docker Hub, GitHub, Alpine и Go proxy;
она может занять несколько минут. Данные остаются в томе `uploads`.
После обновления репозитория запустите `make panel-up`. Скрипт остановится
с ошибкой, если Compose не смог скачать или собрать образы.

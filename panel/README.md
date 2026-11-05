# Plane: запуск и GitHub

Из корня репозитория: `make panel-up`, `make panel-down`, `make panel-logs`.
`make up` запускает Plane после сервисов портала. `make dev-up` панель не запускает.
`make down` панель не останавливает: используйте `make panel-down`.
Настройки находятся в `panel/plane-app/plane.env` (не коммитить).
При переносе на сервер создайте этот файл из шаблона `plane.env.example`,
задайте секреты и адрес сервера. Перед обновлением сохраняйте базу и uploads.

## GitHub Actions → Plane Community

Интеграция обновляет существующие задачи одного проекта. Она не сливает PR,
не создаёт задачи и не подтверждает успешность деплоя.

1. Запустите Plane на проде. Для `ubuntu-latest` API должен быть доступен по HTTPS
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

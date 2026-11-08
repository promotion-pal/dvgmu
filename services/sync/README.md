# dvgmu-sync — сверка MDM ↔ AD

По умолчанию (обычный запуск, тикер) сервис **только читает и логирует
расхождения**, никуда ничего не пишет. Раз в `SYNC_INTERVAL` (по умолчанию 1h)
тянет два источника и сравнивает их:

- `services/mdm.UserService.UserFetch` — все пользователи MDM (источник правды)
  вместе с уже установленными связками `users.ad_object_id` (objectGUID).
- Bulk-поиск в AD напрямую по LDAP (весь `AUTH_LDAP_BASE_DN`) read-only биндом
  `AUTH_LDAP_*`.

Связки раньше хранились в `auth.identities`; с 3.0 их источник — mdm, auth
sync больше не нужен.

## Находки (`internal/reconcile`)

- `drift` — привязанный пользователь, но ФИО/email в MDM и AD расходятся.
- `missing_in_ad` — активный в MDM, аккаунта в AD не нашли ни по связке, ни по email.
- `unlinked_but_exists` — нашёлся в AD по email или sAMAccountName, связки в mdm ещё нет.
- `should_be_disabled` — в MDM неактивен, а AD-аккаунт всё ещё включён.
- `not_in_mdm` — AD-запись не сопоставилась ни с одним пользователем MDM
  (не значит "удалить" — сервисная учётка тоже сюда попадёт).

Логи — `slog` JSON, одна строка на находку + итоговая строка со счётчиками
в конце каждого прохода.

## Write-режимы (одноразовые, НЕ часть тикера)

Обычный `Run()` (тикер) всегда read-only и не зависит от write-конфига ниже.
Отдельно, явным запуском с флагом, можно применить часть находок:

```
# Привязать в mdm все unlinked_but_exists (аккаунт уже есть в AD, просто не
# привязан) — БЕЗ записи в AD, только mdm UserLinkService.UserADLinkBatch
# (нужен MDM_INTERNAL_TOKEN). Учётку AD, подошедшую нескольким пользователям,
# не привязывает — пишет в лог.
./sync --config=config/prod.yaml --link-unlinked

# Создать до N учёток в AD для missing_in_ad (реальная запись!) и сразу
# привязать их к MDM.
./sync --config=config/prod.yaml --create-missing=10
```

`--create-missing` создаёт учётку **выключенной и без пароля**
(`userAccountControl=514`) — sync намеренно не генерирует и не хранит
пароли. Пароль и включение — вручную, админом, через ADUC/PowerShell после
проверки записи. Оба флага делают ОДИН проход и выходят — не зацикливаются.

## Доступы

Обычный read-only проход (тикер) — новых доступов не требует, использует уже
существующий read-only LDAP-бинд (`AUTH_LDAP_*`).

`--create-missing` требует **отдельный** более привилегированный бинд
(`SYNC_LDAP_WRITE_*`) с правом Create на целевых OU (`SYNC_LDAP_STUDENTS_OU`
и `SYNC_LDAP_STAFF_OU`, например `OU=Students,DC=dvgmu,DC=local`) — не тот же
аккаунт, что read-only бинд выше. Пользователи с ролью `USER_ROLE_STUDENT`
идут в студенческий OU, с `USER_ROLE_STAFF` или `USER_ROLE_TEACHER` — в OU
сотрудников. Неопределённые или конфликтующие роли пропускаются с
предупреждением. Пустой OU отключает создание соответствующей категории.

В `.env` задаются полные DN папок (OU должны быть заранее созданы в AD):

```dotenv
SYNC_LDAP_STUDENTS_OU=OU=Students,DC=dvgmu,DC=local
SYNC_LDAP_STAFF_OU=OU=Staff,DC=dvgmu,DC=local
```

Команды из корня репозитория: сначала проверить кандидатов без записи, затем
создать до 10 учёток суммарно (каждая будет выключенной, без пароля):

```bash
make sync-check
make sync-create-students SYNC_LIMIT=10
make sync-create-staff SYNC_LIMIT=10
# обе категории, максимум 10 учёток суммарно:
make sync-create SYNC_LIMIT=10
```

Чтобы запустить обычную периодическую сверку в фоне:

```bash
make sync-up
```

## Локальный запуск

```
cd api
go run ./cmd/sync --config=config/dev.yaml
```

Требует туннель до `192.168.2.222:389` (тот же, что нужен `auth` для LDAP) и
доступный `mdm` (можно локально запущенные на портах из `config/dev.yaml`).

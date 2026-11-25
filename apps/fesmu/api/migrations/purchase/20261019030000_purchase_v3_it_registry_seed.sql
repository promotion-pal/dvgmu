-- +goose Up
-- Purchases of the IT block already in ПФХД 2026 and being carried out, from
-- «Единый реестр закупок ИТ-блока — 2026» (срез на 31.08.2026, 61 позиция).
-- Each row becomes a purchase of the IT department (implementing, 1) with one
-- request from the department it came from, at the stage the registry shows:
--   План, На уточнении       → APPROVED (одобрена, ждёт ТЗ)
--   В закупке                → CONTRACT_SERVICE (ТЗ в контрактной службе) or TENDERING
--   Частично законтрактовано → CONTRACTING
--   Законтрактовано          → DELIVERY (контракт заключён, исполняется)
-- Amounts are the registry's current plan (НМЦК) and fact (contract amount).
-- The vice-rector is the one over the IT department, else «цифров…», else the first.
-- +goose StatementBegin
-- IT-001: сервера
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('сервера', 'Реестр ИТ-блока 2026: IT-001; статус в реестре «Законтрактовано»; ответственный: Мордовцев П.И.; контрольный срок 12.06.2026; следующий шаг: Срочно актуализировать этап и контрольный срок; контроль: ПРОВЕРИТЬ ОСТАТОК; Этап/срок из исходника: рассмотрение ТЗ 12.06.2026', 1, 1, 'шт.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    22, 'Мордовцев П.И.', '', '', '310', 1800000000, 1800000000, 1800000000, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'сервера', 1, 1, 'шт.', 'Этап/срок из исходника: рассмотрение ТЗ 12.06.2026', 1, '', 'Мордовцев П.И.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-001): «Законтрактовано»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-001) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-002: сканер
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('сканер', 'Реестр ИТ-блока 2026: IT-002; статус в реестре «План»; ответственный: Путыгин С.В.; базовый план 2 900 000,00 ₽, корректировка 60 000,00 ₽; контрольный срок 12.06.2026; следующий шаг: Подтвердить источник дополнительного финансирования; контроль: СРОК ПРОСРОЧЕН; Дополнительная потребность | Этап/срок из исходника: рассмотрение ТЗ 12.06.2026', 1, 1, 'шт.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    10, 'Путыгин С.В.', '', '', '310', 296000000, 0, 0, 2, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'сканер', 1, 1, 'шт.', 'Дополнительная потребность | Этап/срок из исходника: рассмотрение ТЗ 12.06.2026', 1, '', 'Путыгин С.В.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-002): «План»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-002) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-003: МФУ (разбили п.8)
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('МФУ (разбили п.8)', 'Реестр ИТ-блока 2026: IT-003; статус в реестре «В закупке»; ответственный: Мордовцев П.И.; следующий шаг: Срочно актуализировать этап и контрольный срок; ТЗ передано в контрактную службу (1.07.26)', 1, 1, 'шт.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    15, 'Мордовцев П.И.', '', '', '310', 0, 0, 0, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'МФУ (разбили п.8)', 1, 1, 'шт.', 'ТЗ передано в контрактную службу (1.07.26)', 1, '', 'Мордовцев П.И.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-003): «В закупке»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-003) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-003: МФУ (см п.7), моноблок
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('МФУ (см п.7), моноблок', 'Реестр ИТ-блока 2026: IT-003; статус в реестре «План»; ответственный: Мордовцев П.И.; базовый план 1 839 000,00 ₽, корректировка (60 000,00) ₽; контрольный срок 12.06.2026; следующий шаг: Срочно актуализировать этап и контрольный срок; контроль: СРОК ПРОСРОЧЕН; Уменьшение за счет приобретения сканера.ТЗ передано в контрактную службу (1.07.26)', 1, 1, 'шт.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    10, 'Мордовцев П.И.', '', '', '310', 177900000, 0, 0, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'МФУ (см п.7), моноблок', 1, 1, 'шт.', 'Уменьшение за счет приобретения сканера.ТЗ передано в контрактную службу (1.07.26)', 1, '', 'Мордовцев П.И.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-003): «План»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-003) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-004: Поставка продукции радиоэлектронной промышленности
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Поставка продукции радиоэлектронной промышленности', 'Реестр ИТ-блока 2026: IT-004, № предложения 1-26-001X5114-0605; статус в реестре «План»; ответственный: Мордовцев П.И.; контрольный срок 12.06.2026; следующий шаг: Срочно актуализировать этап и контрольный срок; контроль: СРОК ПРОСРОЧЕН; 3 моноблока повышенной мощьности.', 1, 1, 'шт.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    10, 'Мордовцев П.И.', '26.20', '26.20', '310', 60000000, 0, 0, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Поставка продукции радиоэлектронной промышленности', 1, 1, 'шт.', '3 моноблока повышенной мощьности.', 1, '', 'Мордовцев П.И.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-004): «План»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-004) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-005: Поставка продукции радиоэлектронной промышленности: ИБП
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Поставка продукции радиоэлектронной промышленности: ИБП', 'Реестр ИТ-блока 2026: IT-005, № предложения 1-26-001X5114-0619; статус в реестре «План»; ответственный: Мордовцев П.И., Чабан А.В.; контрольный срок 30.09.2026; следующий шаг: Уточнить ТЗ, способ закупки и срок; контроль: СРОК ПРОСРОЧЕН; От Поликлиник', 1, 1, 'шт.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    10, 'Мордовцев П.И., Чабан А.В.', '26.20', '26.20', '310', 6000000, 0, 0, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Поставка продукции радиоэлектронной промышленности: ИБП', 1, 1, 'шт.', 'От Поликлиник', 85, '', 'Мордовцев П.И., Чабан А.В.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 85), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-005): «План»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-005) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-006: Поставка продукции радиоэлектронной промышленности : комммутаторы
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Поставка продукции радиоэлектронной промышленности : комммутаторы', 'Реестр ИТ-блока 2026: IT-006, № предложения 1-26-001X5114-0611; статус в реестре «Законтрактовано»; ответственный: Мордовцев П.И.; контрольный срок 05.06.2026; следующий шаг: Срочно актуализировать этап и контрольный срок; контроль: ПРОВЕРИТЬ ОСТАТОК; Этап/срок из исходника: запрос КП 05.06.2026', 1, 1, 'шт.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    22, 'Мордовцев П.И.', '26.30', '26.30', '310', 480000000, 480000000, 480000000, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Поставка продукции радиоэлектронной промышленности : комммутаторы', 1, 1, 'шт.', 'Этап/срок из исходника: запрос КП 05.06.2026', 1, '', 'Мордовцев П.И.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-006): «Законтрактовано»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-006) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-007: Приобретение неисключительных прав на программное обеспечение: средств
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Приобретение неисключительных прав на программное обеспечение: средство виртуализации', 'Реестр ИТ-блока 2026: IT-007, № предложения 1-26-001X5114-0656; статус в реестре «План»; ответственный: Габдулхакова И.А.; контрольный срок 15.06.2026; следующий шаг: Срочно актуализировать этап и контрольный срок; контроль: СРОК ПРОСРОЧЕН; Пока не приедут сервера и на них не протестированно ПО, запускать в закупку бессмысленно.', 2, 1, 'усл.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    10, 'Габдулхакова И.А.', '58.29', '58.29', '226', 55000000, 0, 0, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Приобретение неисключительных прав на программное обеспечение: средство виртуализации', 2, 1, 'усл.', 'Пока не приедут сервера и на них не протестированно ПО, запускать в закупку бессмысленно.', 1, '', 'Габдулхакова И.А.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-007): «План»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-007) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-008: Оказание услуги по заправке и восстановлению картриджей
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Оказание услуги по заправке и восстановлению картриджей', 'Реестр ИТ-блока 2026: IT-008; статус в реестре «Законтрактовано»; ответственный: Лепехина О.О.; факт 62 000,00 ₽, остаток - ₽; следующий шаг: Контролировать исполнение договора и закрывающие документы; От отдела материально-технического снабжения | Рукописная отметка ✓ на бумажной версии.', 2, 1, 'усл.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    22, 'Лепехина О.О.', '95.11.1', '95.11', '', 6200000, 6200000, 6200000, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Оказание услуги по заправке и восстановлению картриджей', 2, 1, 'усл.', 'От отдела материально-технического снабжения | Рукописная отметка ✓ на бумажной версии.', 86, '', 'Лепехина О.О.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 86), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-008): «Законтрактовано»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-008) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-009: Оказание услуги по заправке и восстановлению картриджей
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Оказание услуги по заправке и восстановлению картриджей', 'Реестр ИТ-блока 2026: IT-009; статус в реестре «Законтрактовано»; ответственный: Лепехина О.О.; факт 37 000,00 ₽, остаток - ₽; следующий шаг: Контролировать исполнение договора и закрывающие документы; От отдела материально-технического снабжения | Рукописная отметка ✓ на бумажной версии.', 2, 1, 'усл.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    22, 'Лепехина О.О.', '95.11.1', '95.11', '', 3700000, 3700000, 3700000, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Оказание услуги по заправке и восстановлению картриджей', 2, 1, 'усл.', 'От отдела материально-технического снабжения | Рукописная отметка ✓ на бумажной версии.', 86, '', 'Лепехина О.О.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 86), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-009): «Законтрактовано»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-009) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-010: Приобретение программного обеспечения антивирусной защиты на 24 месяца
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Приобретение программного обеспечения антивирусной защиты на 24 месяца', 'Реестр ИТ-блока 2026: IT-010, № предложения 1-26-001X5114-0647; статус в реестре «План»; ответственный: Габдулхакова И.А.; контрольный срок 08.06.2026; следующий шаг: Срочно актуализировать этап и контрольный срок; контроль: СРОК ПРОСРОЧЕН; ТЗ готово, Текущая лицензия истекает 29.01.2027, Если раньше закажем, не вернётся непотраченный диапозон (дат).', 2, 1, 'усл.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    10, 'Габдулхакова И.А.', '58.29', '58.29', '226', 101200000, 0, 0, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Приобретение программного обеспечения антивирусной защиты на 24 месяца', 2, 1, 'усл.', 'ТЗ готово, Текущая лицензия истекает 29.01.2027, Если раньше закажем, не вернётся непотраченный диапозон (дат).', 1, '', 'Габдулхакова И.А.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-010): «План»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-010) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-011: Приобретение неисключительных прав на программное обеспечение ММИС дек
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Приобретение неисключительных прав на программное обеспечение ММИС деканат, приемная комиссия и т.д.', 'Реестр ИТ-блока 2026: IT-011, № предложения 1-26-001X5114-0156; статус в реестре «Частично законтрактовано»; ответственный: Габдулхакова И.А.; факт 267 000,00 ₽, остаток 548 000,00 ₽; следующий шаг: Определить использование остатка или зафиксировать экономию; контроль: ЕСТЬ ОСТАТОК; Ранняя версия раскрывала состав: приемная комиссия — 270 000 руб. (законтрактовано)(факт 267 000 руб.); учебный отдел — 420 000 руб (законтрактовано).; система управления сайтом — 25 000 руб.; шаблон сайта — 100 000 руб. Итого 815 000 руб. Рукописно: «2 закупки».', 2, 1, 'усл.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    21, 'Габдулхакова И.А.', '58.29.11.000', '58.29', '226', 81500000, 81500000, 26700000, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Приобретение неисключительных прав на программное обеспечение ММИС деканат, приемная комиссия и т.д.', 2, 1, 'усл.', 'Ранняя версия раскрывала состав: приемная комиссия — 270 000 руб. (законтрактовано)(факт 267 000 руб.); учебный отдел — 420 000 руб (законтрактовано).; система управления сайтом — 25 000 руб.; шаблон сайта — 100 000 руб. Итого 815 000 руб. Рукописно: «2 закупки».', 1, '', 'Габдулхакова И.А.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-011): «Частично законтрактовано»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-011) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-012: Услуги в области информационных технологий: ПО USERGETE
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Услуги в области информационных технологий: ПО USERGETE', 'Реестр ИТ-блока 2026: IT-012, № предложения 1-26-001X5114-0338; статус в реестре «Законтрактовано»; ответственный: Габдулхакова И.А.; базовый план 1 050 000,00 ₽, корректировка (12 340,00) ₽; факт 1 037 660,00 ₽, остаток - ₽; контрольный срок 16.04.2026; следующий шаг: Контролировать исполнение договора и закрывающие документы; Экономия по конкурсным процедурам', 2, 1, 'усл.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    22, 'Габдулхакова И.А.', '58.29.11.000', '58.29', '226', 103766000, 103766000, 103766000, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Услуги в области информационных технологий: ПО USERGETE', 2, 1, 'усл.', 'Экономия по конкурсным процедурам', 1, '', 'Габдулхакова И.А.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-012): «Законтрактовано»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-012) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-013: Услуги в области информационных технологий: ПО USERGETE
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Услуги в области информационных технологий: ПО USERGETE', 'Реестр ИТ-блока 2026: IT-013, № предложения 1-26-001X5114-0340; статус в реестре «Законтрактовано»; ответственный: Габдулхакова И.А.; базовый план 420 000,00 ₽, корректировка (20 900,00) ₽; факт 399 100,00 ₽, остаток - ₽; контрольный срок 16.04.2026; следующий шаг: Контролировать исполнение договора и закрывающие документы; Экономия по конкурсным процедурам', 2, 1, 'усл.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    22, 'Габдулхакова И.А.', '58.29.11.000', '58.29', '226', 39910000, 39910000, 39910000, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Услуги в области информационных технологий: ПО USERGETE', 2, 1, 'усл.', 'Экономия по конкурсным процедурам', 1, '', 'Габдулхакова И.А.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-013): «Законтрактовано»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-013) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-014: Услуги в области информационных технологий: ПО USERGETE
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Услуги в области информационных технологий: ПО USERGETE', 'Реестр ИТ-блока 2026: IT-014, № предложения 1-26-001X5114-0343; статус в реестре «Законтрактовано»; ответственный: Габдулхакова И.А.; базовый план 185 000,00 ₽, корректировка (8 600,00) ₽; факт 176 400,00 ₽, остаток - ₽; контрольный срок 16.04.2026; следующий шаг: Контролировать исполнение договора и закрывающие документы; Экономия по конкурсным процедурам', 2, 1, 'усл.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    22, 'Габдулхакова И.А.', '58.29.11.000', '58.29', '226', 17640000, 17640000, 17640000, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Услуги в области информационных технологий: ПО USERGETE', 2, 1, 'усл.', 'Экономия по конкурсным процедурам', 1, '', 'Габдулхакова И.А.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-014): «Законтрактовано»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-014) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-015: Неисключительное имущественное право использования результатов интелле
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Неисключительное имущественное право использования результатов интеллектуальной деятельности ("Лицензий"): ПО "Программная система для обнаружения текстовых заимствований в учебных и научных работах "Антиплагиат.ВУЗ", ПО "Модуль поиска текстовых заимствов', 'Реестр ИТ-блока 2026: IT-015, № предложения 1-26-001X5114-0161; статус в реестре «План»; ответственный: Габдулхакова И.А. (Чей проект?); контрольный срок 01.10.2026; следующий шаг: Уточнить ТЗ, способ закупки и срок. Мы ли этим занимаемся?; контроль: СРОК ПРОСРОЧЕН; Рукописная пометка: «что?» (чтение неуверенное).', 2, 1, 'усл.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    10, 'Габдулхакова И.А. (Чей проект?)', '58.29.31.000', '58.29', '226', 32500000, 0, 0, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Неисключительное имущественное право использования результатов интеллектуальной деятельности ("Лицензий"): ПО "Программная система для обнаружения текстовых заимствований в учебных и научных работах "Антиплагиат.ВУЗ", ПО "Модуль поиска текстовых заимствов', 2, 1, 'усл.', 'Рукописная пометка: «что?» (чтение неуверенное).', 1, '', 'Габдулхакова И.А. (Чей проект?)',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-015): «План»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-015) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-016: Оказание услуг по предоставлению мобильного доступа к сети Интернет
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Оказание услуг по предоставлению мобильного доступа к сети Интернет', 'Реестр ИТ-блока 2026: IT-016, № предложения 1-26-001X5114-0047; статус в реестре «Законтрактовано»; ответственный: Габдулхакова И.А.; факт 137 445,00 ₽, остаток - ₽; следующий шаг: Контролировать исполнение договора и закрывающие документы', 2, 1, 'усл.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    22, 'Габдулхакова И.А.', '61.20.42.000', '61.20', '221', 13744500, 13744500, 13744500, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Оказание услуг по предоставлению мобильного доступа к сети Интернет', 2, 1, 'усл.', '', 1, '', 'Габдулхакова И.А.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-016): «Законтрактовано»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-016) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-017: Приобретение операционной системы RedOS для пользователей
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Приобретение операционной системы RedOS для пользователей', 'Реестр ИТ-блока 2026: IT-017, № предложения 1-26-001X5114-0652; статус в реестре «В закупке»; ответственный: Габдулхакова И.А.; базовый план 70 000,00 ₽, корректировка 650 000,00 ₽; контрольный срок 15.06.2026; следующий шаг: Подтвердить источник дополнительного финансирования; контроль: СРОК ПРОСРОЧЕН; Дополнительная потребность | Ранняя версия уточняет назначение: операционная система RedOS для пользователей. ТЗ в контрактной службе от 03.09ю2026', 2, 1, 'усл.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    15, 'Габдулхакова И.А.', '62.01', '62.01', '226', 72000000, 72000000, 0, 2, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Приобретение операционной системы RedOS для пользователей', 2, 1, 'усл.', 'Дополнительная потребность | Ранняя версия уточняет назначение: операционная система RedOS для пользователей. ТЗ в контрактной службе от 03.09ю2026', 1, '', 'Габдулхакова И.А.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-017): «В закупке»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-017) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-018: Приобретение операционной системы RedOS для серверов
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Приобретение операционной системы RedOS для серверов', 'Реестр ИТ-блока 2026: IT-018, № предложения 1-26-001X5114-0653; статус в реестре «В закупке»; ответственный: Габдулхакова И.А.; контрольный срок 15.06.2026; следующий шаг: Срочно актуализировать этап и контрольный срок; контроль: СРОК ПРОСРОЧЕН; Ранняя версия уточняет назначение: операционная система RedOS для серверов.  ТЗ в контрактной службе от 03.09ю2026', 2, 1, 'усл.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    15, 'Габдулхакова И.А.', '62.01', '62.01', '226', 6600000, 6600000, 0, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Приобретение операционной системы RedOS для серверов', 2, 1, 'усл.', 'Ранняя версия уточняет назначение: операционная система RedOS для серверов.  ТЗ в контрактной службе от 03.09ю2026', 1, '', 'Габдулхакова И.А.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-018): «В закупке»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-018) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-019: Приобретение ПО управления доступом: ALD Pro для управления операционн
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Приобретение ПО управления доступом: ALD Pro для управления операционными системами', 'Реестр ИТ-блока 2026: IT-019, № предложения 1-26-001X5114-0654; статус в реестре «План»; ответственный: Габдулхакова И.А.; контрольный срок 22.06.2026; следующий шаг: Срочно актуализировать этап и контрольный срок; контроль: СРОК ПРОСРОЧЕН; Ранняя версия уточняет состав: ALD Pro для управления операционными системами. Ждём приход серверов, т.к. нужно протестировать среду администрирования для РэдОС, от Астры отойдём - продление AldProo возможно не понадобится.', 2, 1, 'усл.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    10, 'Габдулхакова И.А.', '62.01', '62.01', '226', 16000000, 0, 0, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Приобретение ПО управления доступом: ALD Pro для управления операционными системами', 2, 1, 'усл.', 'Ранняя версия уточняет состав: ALD Pro для управления операционными системами. Ждём приход серверов, т.к. нужно протестировать среду администрирования для РэдОС, от Астры отойдём - продление AldProo возможно не понадобится.', 1, '', 'Габдулхакова И.А.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-019): «План»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-019) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-020: Приобретение лицензий для систем, подключаемых к ALD Pro
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Приобретение лицензий для систем, подключаемых к ALD Pro', 'Реестр ИТ-блока 2026: IT-020, № предложения 1-26-001X5114-0655; статус в реестре «План»; ответственный: Габдулхакова И.А.; контрольный срок 22.06.2026; следующий шаг: Срочно актуализировать этап и контрольный срок; контроль: СРОК ПРОСРОЧЕН; Ранняя версия уточняет состав: лицензии для систем, подключаемых к ALD Pro. Ждём приход серверов, т.к. нужно протестировать среду администрирования для РэдОС, от Астры отойдём - продление AldProo возможно не понадобится.', 2, 1, 'усл.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    10, 'Габдулхакова И.А.', '62.01', '62.01', '226', 6000000, 0, 0, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Приобретение лицензий для систем, подключаемых к ALD Pro', 2, 1, 'усл.', 'Ранняя версия уточняет состав: лицензии для систем, подключаемых к ALD Pro. Ждём приход серверов, т.к. нужно протестировать среду администрирования для РэдОС, от Астры отойдём - продление AldProo возможно не понадобится.', 1, '', 'Габдулхакова И.А.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-020): «План»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-020) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-021: Услуги в области информационных технологий  гарантия USERGETE
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Услуги в области информационных технологий  гарантия USERGETE', 'Реестр ИТ-блока 2026: IT-021, № предложения 1-26-001X5114-0337; статус в реестре «Законтрактовано»; ответственный: Габдулхакова И.А.; базовый план 650 000,00 ₽, корректировка (3 040,00) ₽; факт 646 960,00 ₽, остаток - ₽; контрольный срок 16.04.2026; следующий шаг: Контролировать исполнение договора и закрывающие документы; Экономия по конкурсным процедурам', 2, 1, 'усл.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    22, 'Габдулхакова И.А.', '62.02.30.000', '62.02', '226', 64696000, 64696000, 64696000, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Услуги в области информационных технологий  гарантия USERGETE', 2, 1, 'усл.', 'Экономия по конкурсным процедурам', 1, '', 'Габдулхакова И.А.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-021): «Законтрактовано»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-021) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-022: Оказание услуги по обновлению программного обеспечения Прометей
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Оказание услуги по обновлению программного обеспечения Прометей', 'Реестр ИТ-блока 2026: IT-022, № предложения 1-26-001X5114-0205; статус в реестре «План»; ответственный: Габдулхакова И.А.; следующий шаг: Уточнить ТЗ, способ закупки и срок; В ранней версии план составлял 105 000 руб.; принят актуальный план 120 000 руб.', 2, 1, 'усл.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    10, 'Габдулхакова И.А.', '62.09.20.190', '62.09', '226', 12000000, 0, 0, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Оказание услуги по обновлению программного обеспечения Прометей', 2, 1, 'усл.', 'В ранней версии план составлял 105 000 руб.; принят актуальный план 120 000 руб.', 1, '', 'Габдулхакова И.А.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-022): «План»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-022) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-023: Оказание консультативных услуг по вопросам управления деятельности пре
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Оказание консультативных услуг по вопросам управления деятельности предприятия', 'Реестр ИТ-блока 2026: IT-023, № предложения 1-26-001X5114-0633; статус в реестре «Частично законтрактовано»; ответственный: Романов П.Г.; базовый план 500 000,00 ₽, корректировка 562 300,00 ₽; факт 482 300,00 ₽, остаток 580 000,00 ₽; контрольный срок 29.04.2026; следующий шаг: Подтвердить источник дополнительного финансирования; контроль: ЕСТЬ ОСТАТОК; Дополнительная потребность | Рукописная пометка: «сэкономить внебюджет» (чтение неуверенное).', 2, 1, 'усл.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    21, 'Романов П.Г.', '70.22.11.000', '70.22', '226', 106230000, 106230000, 48230000, 2, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Оказание консультативных услуг по вопросам управления деятельности предприятия', 2, 1, 'усл.', 'Дополнительная потребность | Рукописная пометка: «сэкономить внебюджет» (чтение неуверенное).', 1, '', 'Романов П.Г.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-023): «Частично законтрактовано»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-023) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-024: Издание сертификата ключа подписи сроком на 12 месяцев, включая создан
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Издание сертификата ключа подписи сроком на 12 месяцев, включая создание КЭП и КПЭП, Услуги по технической поддержке информационных технологий', 'Реестр ИТ-блока 2026: IT-024, № предложения 1-26-001X5114-0257; статус в реестре «План»; ответственный: Габдулхакова И.А.; следующий шаг: Уточнить ТЗ, способ закупки и срок', 2, 1, 'усл.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    10, 'Габдулхакова И.А.', '74.90.20.149', '74.90', '226', 1620000, 0, 0, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Издание сертификата ключа подписи сроком на 12 месяцев, включая создание КЭП и КПЭП, Услуги по технической поддержке информационных технологий', 2, 1, 'усл.', '', 1, '', 'Габдулхакова И.А.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-024): «План»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-024) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-025: Оказание услуг по доступу к информационно-коммуникационной сети Интерн
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Оказание услуг по доступу к информационно-коммуникационной сети Интернет', 'Реестр ИТ-блока 2026: IT-025; статус в реестре «Законтрактовано»; ответственный: Габдулхакова И.А.; факт 67 262,00 ₽, остаток - ₽; следующий шаг: Контролировать исполнение договора и закрывающие документы', 2, 1, 'усл.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    22, 'Габдулхакова И.А.', '61.10', '61.10', '221', 6726200, 6726200, 6726200, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Оказание услуг по доступу к информационно-коммуникационной сети Интернет', 2, 1, 'усл.', '', 1, '', 'Габдулхакова И.А.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-025): «Законтрактовано»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-025) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-026: Оказание услуги по доступу к информационно-коммуникационной сети Интер
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Оказание услуги по доступу к информационно-коммуникационной сети Интернет', 'Реестр ИТ-блока 2026: IT-026; статус в реестре «Законтрактовано»; ответственный: Габдулхакова И.А.; факт 779 482,00 ₽, остаток - ₽; следующий шаг: Контролировать исполнение договора и закрывающие документы', 2, 1, 'усл.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    22, 'Габдулхакова И.А.', '61.10', '61.10', '221', 77948200, 77948200, 77948200, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Оказание услуги по доступу к информационно-коммуникационной сети Интернет', 2, 1, 'усл.', '', 1, '', 'Габдулхакова И.А.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-026): «Законтрактовано»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-026) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-027: Оказание услуг по предоставлению мобильного доступа к сети Интернет
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Оказание услуг по предоставлению мобильного доступа к сети Интернет', 'Реестр ИТ-блока 2026: IT-027; статус в реестре «Законтрактовано»; ответственный: Габдулхакова И.А.; факт 12 495,00 ₽, остаток - ₽; следующий шаг: Контролировать исполнение договора и закрывающие документы', 2, 1, 'усл.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    22, 'Габдулхакова И.А.', '61.20.42.000', '61.20', '221', 1249500, 1249500, 1249500, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Оказание услуг по предоставлению мобильного доступа к сети Интернет', 2, 1, 'усл.', '', 1, '', 'Габдулхакова И.А.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-027): «Законтрактовано»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-027) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-028: Оказание услуг по предоставлению мобильного доступа к сети Интернет
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Оказание услуг по предоставлению мобильного доступа к сети Интернет', 'Реестр ИТ-блока 2026: IT-028; статус в реестре «Законтрактовано»; ответственный: Габдулхакова И.А.; факт 3 000,00 ₽, остаток - ₽; следующий шаг: Контролировать исполнение договора и закрывающие документы', 2, 1, 'усл.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    22, 'Габдулхакова И.А.', '61.20.42.000', '61.20', '221', 300000, 300000, 300000, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Оказание услуг по предоставлению мобильного доступа к сети Интернет', 2, 1, 'усл.', '', 1, '', 'Габдулхакова И.А.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-028): «Законтрактовано»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-028) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-029: Приобретение моноблока
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Приобретение моноблока', 'Реестр ИТ-блока 2026: IT-029; статус в реестре «План»; ответственный: Казакевич А.А.; контрольный срок 10.07.2026; следующий шаг: Срочно актуализировать этап и контрольный срок; контроль: СРОК ПРОСРОЧЕН; От отдела планирования и качества образования | Этап/срок из исходника: 10.07.2026 Сумму перераспределили на моноблоки отв. Романов П.Г.  ТЗ передано в контрактную службу (1.07.26)', 1, 1, 'шт.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    10, 'Казакевич А.А.', '', '', '310', 20000000, 0, 0, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Приобретение моноблока', 1, 1, 'шт.', 'От отдела планирования и качества образования | Этап/срок из исходника: 10.07.2026 Сумму перераспределили на моноблоки отв. Романов П.Г.  ТЗ передано в контрактную службу (1.07.26)', 53, '', 'Казакевич А.А.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 53), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-029): «План»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-029) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-030: Поставка продукции радиоэлектронной промышленности (грант) 72с аспиран
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Поставка продукции радиоэлектронной промышленности (грант) 72с аспиранты  (Интерактивная панель)', 'Реестр ИТ-блока 2026: IT-030, № предложения 1-26-001X5114-0599; статус в реестре «В закупке»; ответственный: Сазонова Е.Н.; контрольный срок 11.06.2026; следующий шаг: Срочно актуализировать этап и контрольный срок; контроль: СРОК ПРОСРОЧЕН; От научного отдела | Рукописная отметка ✓ на бумажной версии. (ТЗ по панелям переданно в контрактную службу 31.08.2026)', 1, 1, 'шт.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    15, 'Сазонова Е.Н.', '26.20', '26.20', '310', 25000000, 25000000, 0, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Поставка продукции радиоэлектронной промышленности (грант) 72с аспиранты  (Интерактивная панель)', 1, 1, 'шт.', 'От научного отдела | Рукописная отметка ✓ на бумажной версии. (ТЗ по панелям переданно в контрактную службу 31.08.2026)', 87, '', 'Сазонова Е.Н.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 87), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-030): «В закупке»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-030) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-031: Поставка продукции радиоэлектронной промышленности (грант) 131 с ордин
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Поставка продукции радиоэлектронной промышленности (грант) 131 с ординаторы  (Интерактивная панель)', 'Реестр ИТ-блока 2026: IT-031, № предложения 1-26-001X5114-0134; статус в реестре «В закупке»; ответственный: Лемещенко О.В.; контрольный срок 17.07.2026; следующий шаг: Срочно актуализировать этап и контрольный срок; контроль: СРОК ПРОСРОЧЕН; От кафедры ординатуры | Рукописно: «4 шт.»; наименование предмета пометки неразборчиво.(ТЗ по панелям переданно в контрактную службу 31.08.2026)', 1, 1, 'шт.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    15, 'Лемещенко О.В.', '26.20', '26.20', '310', 30000000, 30000000, 0, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Поставка продукции радиоэлектронной промышленности (грант) 131 с ординаторы  (Интерактивная панель)', 1, 1, 'шт.', 'От кафедры ординатуры | Рукописно: «4 шт.»; наименование предмета пометки неразборчиво.(ТЗ по панелям переданно в контрактную службу 31.08.2026)', 72, '', 'Лемещенко О.В.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 72), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-031): «В закупке»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-031) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-032: Поставка медицинских изделий, ввод в эксплуатацию медицинских изделий,
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Поставка медицинских изделий, ввод в эксплуатацию медицинских изделий, обучение правилам эксплуатации специалистов, эксплуатирующих медицинские изделия (грант) 131с ординаторы', 'Реестр ИТ-блока 2026: IT-032; статус в реестре «План»; ответственный: Лемещенко О.В.; следующий шаг: Уточнить ТЗ, способ закупки и срок; От кафедры ординатуры | Позиция объединена рукописным обводом с предыдущей строкой.', 1, 1, 'шт.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    10, 'Лемещенко О.В.', '32.50', '32.50', '310', 98431135, 0, 0, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Поставка медицинских изделий, ввод в эксплуатацию медицинских изделий, обучение правилам эксплуатации специалистов, эксплуатирующих медицинские изделия (грант) 131с ординаторы', 1, 1, 'шт.', 'От кафедры ординатуры | Позиция объединена рукописным обводом с предыдущей строкой.', 72, '', 'Лемещенко О.В.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 72), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-032): «План»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-032) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-033: Ремонт источника бесперебойного питания с заменой аккумуляторных батар
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Ремонт источника бесперебойного питания с заменой аккумуляторных батарей', 'Реестр ИТ-блока 2026: IT-033; статус в реестре «План»; ответственный: Чибисов Ю.В., Чабан А.В.; следующий шаг: Уточнить ТЗ, способ закупки и срок; От Поликлиник', 2, 1, 'усл.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    10, 'Чибисов Ю.В., Чабан А.В.', '33.14', '33.14', '225', 20000000, 0, 0, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Ремонт источника бесперебойного питания с заменой аккумуляторных батарей', 2, 1, 'усл.', 'От Поликлиник', 85, '', 'Чибисов Ю.В., Чабан А.В.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 85), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-033): «План»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-033) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-034: Простая неискл. лицензия на использование Базы данных Электронная Сист
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Простая неискл. лицензия на использование Базы данных Электронная Система "Госфинансы", 2 польз.,', 'Реестр ИТ-блока 2026: IT-034; статус в реестре «План»; ответственный: Христич Г.И.; контрольный срок 01.09.2026; следующий шаг: Уточнить ТЗ, способ закупки и срок; контроль: СРОК ПРОСРОЧЕН; От бухгалтерии | Рукописная отметка ✓ на бумажной версии.', 2, 1, 'усл.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    10, 'Христич Г.И.', '58.29.32.000', '58.29', '226', 20000000, 0, 0, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Простая неискл. лицензия на использование Базы данных Электронная Система "Госфинансы", 2 польз.,', 2, 1, 'усл.', 'От бухгалтерии | Рукописная отметка ✓ на бумажной версии.', 47, '', 'Христич Г.И.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 47), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-034): «План»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-034) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-035: Оказание услуг по сопровождению и технической поддержке решения по пер
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Оказание услуг по сопровождению и технической поддержке решения по передаче структурированных электронных медицинских документов в подсистему РЭМД ЕГИСЗ с предоставлением доступа к базе обновлений (лицензия/разовая)', 'Реестр ИТ-блока 2026: IT-035; статус в реестре «Законтрактовано»; ответственный: Чибисов Ю.В., Чабан А.В.; факт 66 000,00 ₽, остаток - ₽; контрольный срок 20.02.2026; следующий шаг: Контролировать исполнение договора и закрывающие документы; От Поликлиник Контракт заключен 66 000,00', 2, 1, 'усл.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    22, 'Чибисов Ю.В., Чабан А.В.', '58.29.50.000', '58.29', '226', 6600000, 6600000, 6600000, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Оказание услуг по сопровождению и технической поддержке решения по передаче структурированных электронных медицинских документов в подсистему РЭМД ЕГИСЗ с предоставлением доступа к базе обновлений (лицензия/разовая)', 2, 1, 'усл.', 'От Поликлиник Контракт заключен 66 000,00', 85, '', 'Чибисов Ю.В., Чабан А.В.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 85), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-035): «Законтрактовано»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-035) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-036: Услуги по технической поддержке информационных технологий : ПО Медиало
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Услуги по технической поддержке информационных технологий : ПО Медиалог обновление', 'Реестр ИТ-блока 2026: IT-036; статус в реестре «Законтрактовано»; ответственный: Чибисов Ю.В., Чабан А.В.; факт 584 914,00 ₽, остаток - ₽; контрольный срок 08.05.2026; следующий шаг: Контролировать исполнение договора и закрывающие документы; От Поликлиник Контракт заключен 584 914,00 | Рукописная отметка ✓ на бумажной версии.', 2, 1, 'усл.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    22, 'Чибисов Ю.В., Чабан А.В.', '58.29.50.000', '58.29', '226', 58491400, 58491400, 58491400, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Услуги по технической поддержке информационных технологий : ПО Медиалог обновление', 2, 1, 'усл.', 'От Поликлиник Контракт заключен 584 914,00 | Рукописная отметка ✓ на бумажной версии.', 85, '', 'Чибисов Ю.В., Чабан А.В.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 85), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-036): «Законтрактовано»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-036) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-037: Услуги в области информационных технологий : услуги по техгнической по
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Услуги в области информационных технологий : услуги по техгнической поддержке и сопровождению средств криптографической защиты VIPNET 2026-2027гг', 'Реестр ИТ-блока 2026: IT-037; статус в реестре «Законтрактовано»; ответственный: Чибисов Ю.В., Чабан А.В.; контрольный срок 22.06.2026; следующий шаг: Срочно актуализировать этап и контрольный срок; контроль: ПРОВЕРИТЬ ОСТАТОК; От Поликлиник | Рукописная пометка рядом с позицией частично неразборчива. Законтрактовано 24.08.2026', 2, 1, 'усл.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    22, 'Чибисов Ю.В., Чабан А.В.', '62.02', '62.02', '226', 19662000, 19662000, 19662000, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Услуги в области информационных технологий : услуги по техгнической поддержке и сопровождению средств криптографической защиты VIPNET 2026-2027гг', 2, 1, 'усл.', 'От Поликлиник | Рукописная пометка рядом с позицией частично неразборчива. Законтрактовано 24.08.2026', 85, '', 'Чибисов Ю.В., Чабан А.В.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 85), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-037): «Законтрактовано»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-037) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-038: Услуги по сопровождению экземпляров СПС КонсультантПлюс
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Услуги по сопровождению экземпляров СПС КонсультантПлюс', 'Реестр ИТ-блока 2026: IT-038; статус в реестре «Законтрактовано»; ответственный: Ошовская И.В.; факт 599 464,20 ₽, остаток - ₽; следующий шаг: Контролировать исполнение договора и закрывающие документы; От юридического отдела, контракт заключен 599 464,20 | Рукописная пометка о сравнении с системой «Гарант» и сумме 200 тыс. руб.; остальной текст неразборчив.', 2, 1, 'усл.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    22, 'Ошовская И.В.', '62.02.20.190', '62.02', '226', 59946420, 59946420, 59946420, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Услуги по сопровождению экземпляров СПС КонсультантПлюс', 2, 1, 'усл.', 'От юридического отдела, контракт заключен 599 464,20 | Рукописная пометка о сравнении с системой «Гарант» и сумме 200 тыс. руб.; остальной текст неразборчив.', 81, '', 'Ошовская И.В.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 81), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-038): «Законтрактовано»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-038) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-039: Оказание услуг по сопровождению и технической поддержке решения по пер
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Оказание услуг по сопровождению и технической поддержке решения по передаче структурированных электронных медицинских документов в подсистему РЭМД ЕГИСЗ с предоставлением доступа к базе обновлений (базовое сопровождение 12 мес) СЭМД', 'Реестр ИТ-блока 2026: IT-039; статус в реестре «Законтрактовано»; ответственный: Чибисов Ю.В., Чабан А.В.; факт 115 850,00 ₽, остаток - ₽; контрольный срок 20.02.2026; следующий шаг: Контролировать исполнение договора и закрывающие документы; От Поликлиник, котракт заключен  115 850,00 | Рукописная отметка ✓ на бумажной версии.', 2, 1, 'усл.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    22, 'Чибисов Ю.В., Чабан А.В.', '62.02.30.000', '62.02', '226', 11585000, 11585000, 11585000, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Оказание услуг по сопровождению и технической поддержке решения по передаче структурированных электронных медицинских документов в подсистему РЭМД ЕГИСЗ с предоставлением доступа к базе обновлений (базовое сопровождение 12 мес) СЭМД', 2, 1, 'усл.', 'От Поликлиник, котракт заключен  115 850,00 | Рукописная отметка ✓ на бумажной версии.', 85, '', 'Чибисов Ю.В., Чабан А.В.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 85), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-039): «Законтрактовано»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-039) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-040: Поставка запасных частей к оргтехнике
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Поставка запасных частей к оргтехнике', 'Реестр ИТ-блока 2026: IT-040; статус в реестре «Частично законтрактовано»; ответственный: Безносюк Е.А.; факт 443 900,00 ₽, остаток 899 020,00 ₽; контрольный срок 07.09.2026; следующий шаг: Определить использование остатка или зафиксировать экономию; контроль: ЕСТЬ ОСТАТОК; От отдела материально-технического снабжения, От Поликлиник | Рукописно: «картриджи»; отметка ✓.', 1, 1, 'шт.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    21, 'Безносюк Е.А.', '28.23', '28.23', '340', 134292000, 134292000, 44390000, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Поставка запасных частей к оргтехнике', 1, 1, 'шт.', 'От отдела материально-технического снабжения, От Поликлиник | Рукописно: «картриджи»; отметка ✓.', 85, '', 'Безносюк Е.А.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 85), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-040): «Частично законтрактовано»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-040) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-041: Простая неискл. лицензия на использование Базы данных Электронная Сист
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Простая неискл. лицензия на использование Базы данных Электронная Система «ГОСЗАКАЗ»', 'Реестр ИТ-блока 2026: IT-041; статус в реестре «План»; ответственный: Зарудняя А.А.; контрольный срок 01.09.2026; следующий шаг: Уточнить ТЗ, способ закупки и срок; контроль: СРОК ПРОСРОЧЕН; От контрактной службы | Рукописная отметка ✓ на бумажной версии.', 2, 1, 'усл.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    10, 'Зарудняя А.А.', '58.29.11.000', '58.29', '226', 13000000, 0, 0, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Простая неискл. лицензия на использование Базы данных Электронная Система «ГОСЗАКАЗ»', 2, 1, 'усл.', 'От контрактной службы | Рукописная отметка ✓ на бумажной версии.', 51, '', 'Зарудняя А.А.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 51), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-041): «План»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-041) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-042: Приобретение права на программное обеспечение: гранд смета
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Приобретение права на программное обеспечение: гранд смета', 'Реестр ИТ-блока 2026: IT-042; статус в реестре «Законтрактовано»; ответственный: Амелина И.Б.; базовый план 100 000,00 ₽, корректировка (19 500,00) ₽; контрольный срок 07.05.2026; следующий шаг: Срочно актуализировать этап и контрольный срок; контроль: ПРОВЕРИТЬ ОСТАТОК; От Левченоко (Амелина) | Рукописно: «снять». Законтрактовано 05.08.2026. Мы подписывали как эксперты', 2, 1, 'усл.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    22, 'Амелина И.Б.', '58.29.32.000', '58.29', '226', 8050000, 8050000, 8050000, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Приобретение права на программное обеспечение: гранд смета', 2, 1, 'усл.', 'От Левченоко (Амелина) | Рукописно: «снять». Законтрактовано 05.08.2026. Мы подписывали как эксперты', 1, '', 'Амелина И.Б.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-042): «Законтрактовано»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-042) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-043: Услуги по технической поддержке информационных технологий: сопровожден
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Услуги по технической поддержке информационных технологий: сопровождение МИС Медиалог', 'Реестр ИТ-блока 2026: IT-043; статус в реестре «Частично законтрактовано»; ответственный: Чибисов Ю.В., Чабан А.В.; факт 237 880,00 ₽, остаток 200 008,00 ₽; контрольный срок 08.05.2026; следующий шаг: Определить использование остатка или зафиксировать экономию; контроль: ЕСТЬ ОСТАТОК; От Поликлиник', 2, 1, 'усл.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    21, 'Чибисов Ю.В., Чабан А.В.', '62.02.30.000', '62.02', '226', 43788800, 43788800, 23788000, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Услуги по технической поддержке информационных технологий: сопровождение МИС Медиалог', 2, 1, 'усл.', 'От Поликлиник', 85, '', 'Чибисов Ю.В., Чабан А.В.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 85), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-043): «Частично законтрактовано»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-043) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-044: Предоставление доступа к информационной базе данных  1С: ИТС КП ГУ ПРО
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Предоставление доступа к информационной базе данных  1С: ИТС КП ГУ ПРОФ', 'Реестр ИТ-блока 2026: IT-044; статус в реестре «Законтрактовано»; ответственный: Чибисов Ю.В., Чабан А.В.; контрольный срок 01.06.2026; следующий шаг: Срочно актуализировать этап и контрольный срок; контроль: ПРОВЕРИТЬ ОСТАТОК; От бухгалтерии', 2, 1, 'усл.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    22, 'Чибисов Ю.В., Чабан А.В.', '63.11.13.000', '63.11', '226', 7500000, 7500000, 7500000, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Предоставление доступа к информационной базе данных  1С: ИТС КП ГУ ПРОФ', 2, 1, 'усл.', 'От бухгалтерии', 47, '', 'Чибисов Ю.В., Чабан А.В.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 47), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-044): «Законтрактовано»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-044) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-045: Услуга по подключению к международной системе библиографических ссылок
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Услуга по подключению к международной системе библиографических ссылок Crossref, Регистрация цифровых идентификаторов объектов для журнальных статей текущего периода в рамках оказания услуг по подключению к международной системе библиографических ссылок C', 'Реестр ИТ-блока 2026: IT-045; статус в реестре «Законтрактовано»; ответственный: Сазонова Е.Н.; базовый план 47 400,00 ₽, корректировка (6 705,00) ₽; факт 40 695,00 ₽, остаток - ₽; контрольный срок 10.03.2026; следующий шаг: Контролировать исполнение договора и закрывающие документы; От научного отдела Контракт заключен  40 695,00 | Рукописная отметка ✓ на бумажной версии.', 2, 1, 'усл.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    22, 'Сазонова Е.Н.', '63.11.13.000', '63.11', '226', 4069500, 4069500, 4069500, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Услуга по подключению к международной системе библиографических ссылок Crossref, Регистрация цифровых идентификаторов объектов для журнальных статей текущего периода в рамках оказания услуг по подключению к международной системе библиографических ссылок C', 2, 1, 'усл.', 'От научного отдела Контракт заключен  40 695,00 | Рукописная отметка ✓ на бумажной версии.', 87, '', 'Сазонова Е.Н.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 87), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-045): «Законтрактовано»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-045) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-046: Услуги по ремонту копировально-множительной техники
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Услуги по ремонту копировально-множительной техники', 'Реестр ИТ-блока 2026: IT-046; статус в реестре «План»; ответственный: Кузнецов Д.Г.; базовый план 258 000,00 ₽, корректировка (58 000,00) ₽; следующий шаг: Уточнить ТЗ, способ закупки и срок; От издательства | Рукописно: «обслуживание + ремонт + заправка + 2027 г. сопровождение».', 2, 1, 'усл.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    10, 'Кузнецов Д.Г.', '95.11.10', '95.11', '225', 20000000, 0, 0, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Услуги по ремонту копировально-множительной техники', 2, 1, 'усл.', 'От издательства | Рукописно: «обслуживание + ремонт + заправка + 2027 г. сопровождение».', 50, '', 'Кузнецов Д.Г.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 50), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-046): «План»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-046) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-047: Услуги по техническому обслуживанию копировально-множительной техники
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Услуги по техническому обслуживанию копировально-множительной техники', 'Реестр ИТ-блока 2026: IT-047; статус в реестре «Законтрактовано»; ответственный: Кузнецов Д.Г.; факт 96 000,00 ₽, остаток - ₽; следующий шаг: Контролировать исполнение договора и закрывающие документы; От издательства Контракт заключен 96 000,00', 2, 1, 'усл.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    22, 'Кузнецов Д.Г.', '95.11.10', '95.11', '225', 9600000, 9600000, 9600000, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Услуги по техническому обслуживанию копировально-множительной техники', 2, 1, 'усл.', 'От издательства Контракт заключен 96 000,00', 50, '', 'Кузнецов Д.Г.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 50), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-047): «Законтрактовано»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-047) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-048: Продукты программные и услуги по разработке программного обеспечения: 
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Продукты программные и услуги по разработке программного обеспечения: Информационно-техническое сопровождение мед. Информационной системы «Медиалог»', 'Реестр ИТ-блока 2026: IT-048; статус в реестре «План»; ответственный: Чибисов Ю.В., Чабан А.В.; следующий шаг: Уточнить ТЗ, способ закупки и срок; От Поликлиник', 2, 1, 'усл.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    10, 'Чибисов Ю.В., Чабан А.В.', '62.02.30.000', '62.02', '226', 60000000, 0, 0, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Продукты программные и услуги по разработке программного обеспечения: Информационно-техническое сопровождение мед. Информационной системы «Медиалог»', 2, 1, 'усл.', 'От Поликлиник', 85, '', 'Чибисов Ю.В., Чабан А.В.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 85), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-048): «План»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-048) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-049: Услуги в области информационных технологий: Услуги по технической подд
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Услуги в области информационных технологий: Услуги по технической поддержке и сопровождению средств криптографической защиты информационной сети "VipNet', 'Реестр ИТ-блока 2026: IT-049; статус в реестре «Законтрактовано»; ответственный: Чибисов Ю.В., Чабан А.В.; факт 983 100,00 ₽, остаток - ₽; следующий шаг: Контролировать исполнение договора и закрывающие документы; От Поликлиник Контракт Заключен 983 100,00', 2, 1, 'усл.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    22, 'Чибисов Ю.В., Чабан А.В.', '62.02', '62.02', '226', 98310000, 98310000, 98310000, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Услуги в области информационных технологий: Услуги по технической поддержке и сопровождению средств криптографической защиты информационной сети "VipNet', 2, 1, 'усл.', 'От Поликлиник Контракт Заключен 983 100,00', 85, '', 'Чибисов Ю.В., Чабан А.В.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 85), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-049): «Законтрактовано»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-049) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-050: Услуги по адаптации, модификации и сопровождению модифицированного про
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Услуги по адаптации, модификации и сопровождению модифицированного программного обеспечения "1С: БГУ" редакция 2:.; ЗГУ', 'Реестр ИТ-блока 2026: IT-050; статус в реестре «Частично законтрактовано»; ответственный: Христич Г.И.; факт 1 200 000,00 ₽, остаток 1 400 000,00 ₽; контрольный срок 24.12.2025; следующий шаг: Определить использование остатка или зафиксировать экономию; контроль: ЕСТЬ ОСТАТОК; От Бухгалтерии Контракт заключен 600 000,00 | Рукописная отметка ✓ на бумажной версии.', 2, 1, 'усл.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    21, 'Христич Г.И.', '62.02.30.000', '62.02', '226', 260000000, 260000000, 120000000, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Услуги по адаптации, модификации и сопровождению модифицированного программного обеспечения "1С: БГУ" редакция 2:.; ЗГУ', 2, 1, 'усл.', 'От Бухгалтерии Контракт заключен 600 000,00 | Рукописная отметка ✓ на бумажной версии.', 47, '', 'Христич Г.И.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 47), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-050): «Частично законтрактовано»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-050) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-051: Неисключительные права использования «СБиС++ Электронная отчётность бю
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Неисключительные права использования «СБиС++ Электронная отчётность бюджет» и для сдачи отчетности по доп. направлению  (сроком на один год),', 'Реестр ИТ-блока 2026: IT-051; статус в реестре «Законтрактовано»; ответственный: Христич Г.И.; базовый план 11 000,00 ₽, корректировка 800,00 ₽; факт 11 800,00 ₽, остаток - ₽; контрольный срок 25.03.2026; следующий шаг: Контролировать исполнение договора и закрывающие документы; От Бухгалтерии Контракт заключен 11 800,00 | Рукописная отметка ✓ на бумажной версии.', 2, 1, 'усл.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    22, 'Христич Г.И.', '58.29.32.000', '58.29', '226', 1180000, 1180000, 1180000, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Неисключительные права использования «СБиС++ Электронная отчётность бюджет» и для сдачи отчетности по доп. направлению  (сроком на один год),', 2, 1, 'усл.', 'От Бухгалтерии Контракт заключен 11 800,00 | Рукописная отметка ✓ на бумажной версии.', 47, '', 'Христич Г.И.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 47), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-051): «Законтрактовано»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-051) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-052: Простая неисключительная лицензия без права заключения сублицензии на 
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Простая неисключительная лицензия без права заключения сублицензии на использование информационноаналитической системы (программы для ЭВМ) SCIENCE INDEX', 'Реестр ИТ-блока 2026: IT-052; статус в реестре «Законтрактовано»; ответственный: Сазонова Е.Н.; базовый план 155 000,00 ₽, корректировка (35 000,00) ₽; факт 120 000,00 ₽, остаток - ₽; контрольный срок 31.05.2026; следующий шаг: Контролировать исполнение договора и закрывающие документы; От научного отдела Контракт заключен 120 000,00 | Рукописная отметка ✓ на бумажной версии.', 2, 1, 'усл.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    22, 'Сазонова Е.Н.', '58.29.40.000', '58.29', '226', 12000000, 12000000, 12000000, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Простая неисключительная лицензия без права заключения сублицензии на использование информационноаналитической системы (программы для ЭВМ) SCIENCE INDEX', 2, 1, 'усл.', 'От научного отдела Контракт заключен 120 000,00 | Рукописная отметка ✓ на бумажной версии.', 87, '', 'Сазонова Е.Н.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 87), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-052): «Законтрактовано»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-052) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-053: Услуга по подключению к программе (годовая подписка) платформа двуязыч
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Услуга по подключению к программе (годовая подписка) платформа двуязычного сайта и электронной редакции электронного журнала', 'Реестр ИТ-блока 2026: IT-053; статус в реестре «План»; ответственный: Сазонова Е.Н.; контрольный срок 30.05.2026; следующий шаг: Срочно актуализировать этап и контрольный срок; контроль: СРОК ПРОСРОЧЕН; От научного отдела', 2, 1, 'усл.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    10, 'Сазонова Е.Н.', '58.29.50.000', '58.29', '226', 14000000, 0, 0, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Услуга по подключению к программе (годовая подписка) платформа двуязычного сайта и электронной редакции электронного журнала', 2, 1, 'усл.', 'От научного отдела', 87, '', 'Сазонова Е.Н.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 87), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-053): «План»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-053) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-054: Оказание услуг по доступу к информационно-коммуникационной сети Интерн
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Оказание услуг по доступу к информационно-коммуникационной сети Интернет на 2027 год', 'Реестр ИТ-блока 2026: IT-054; статус в реестре «На уточнении»; ответственный: Романов П.Г.; следующий шаг: Подтвердить потребность, бюджет и срок; Рукописно: «2027 — шт. с/т?» (чтение неуверенное). Потребность требует подтверждения.', 2, 1, 'усл.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    10, 'Романов П.Г.', '', '', '221', 0, 0, 0, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Оказание услуг по доступу к информационно-коммуникационной сети Интернет на 2027 год', 2, 1, 'усл.', 'Рукописно: «2027 — шт. с/т?» (чтение неуверенное). Потребность требует подтверждения.', 1, '', 'Романов П.Г.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-054): «На уточнении»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-054) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-055: Доступ к ЭБС «Консультант студента» на 2027 год (январь–ноябрь)
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Доступ к ЭБС «Консультант студента» на 2027 год (январь–ноябрь)', 'Реестр ИТ-блока 2026: IT-055; статус в реестре «На уточнении»; ответственный: Романов П.Г.; следующий шаг: Подтвердить потребность, бюджет и срок; Рукописная отметка ✓. В ранней версии бюджет не указан.', 2, 1, 'усл.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    10, 'Романов П.Г.', '63.11.13.000', '63.11', '226', 0, 0, 0, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Доступ к ЭБС «Консультант студента» на 2027 год (январь–ноябрь)', 2, 1, 'усл.', 'Рукописная отметка ✓. В ранней версии бюджет не указан.', 1, '', 'Романов П.Г.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-055): «На уточнении»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-055) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-056: Доступ к цифровому образовательному ресурсу IPRsmart на 2027 год (янва
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Доступ к цифровому образовательному ресурсу IPRsmart на 2027 год (январь–ноябрь)', 'Реестр ИТ-блока 2026: IT-056; статус в реестре «На уточнении»; ответственный: Романов П.Г.; следующий шаг: Подтвердить потребность, бюджет и срок; Рукописная отметка ✓. В ранней версии бюджет не указан.', 2, 1, 'усл.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    10, 'Романов П.Г.', '63.11.13.000', '63.11', '226', 0, 0, 0, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Доступ к цифровому образовательному ресурсу IPRsmart на 2027 год (январь–ноябрь)', 2, 1, 'усл.', 'Рукописная отметка ✓. В ранней версии бюджет не указан.', 1, '', 'Романов П.Г.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-056): «На уточнении»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-056) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-057: Подписка и доставка периодических изданий, 1-е полугодие 2027 года
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Подписка и доставка периодических изданий, 1-е полугодие 2027 года', 'Реестр ИТ-блока 2026: IT-057; статус в реестре «План»; ответственный: Романов П.Г.; следующий шаг: Уточнить ТЗ, способ закупки и срок; Уникальная позиция ранней версии; рукописная отметка ✓.', 2, 1, 'усл.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    10, 'Романов П.Г.', '', '', '226', 265665000, 0, 0, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Подписка и доставка периодических изданий, 1-е полугодие 2027 года', 2, 1, 'усл.', 'Уникальная позиция ранней версии; рукописная отметка ✓.', 1, '', 'Романов П.Г.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-057): «План»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-057) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-058: Поставка продукции радиоэлектронной промышленности: ЖК-панель
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Поставка продукции радиоэлектронной промышленности: ЖК-панель', 'Реестр ИТ-блока 2026: IT-058; статус в реестре «План»; ответственный: Романов П.Г.; следующий шаг: Уточнить ТЗ, способ закупки и срок; Ранняя версия: «ЖК-панель в 238». Рукописная пометка о ТЗ частично неразборчива.', 1, 1, 'шт.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    10, 'Романов П.Г.', '26.20', '26.20', '310', 208800000, 0, 0, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Поставка продукции радиоэлектронной промышленности: ЖК-панель', 1, 1, 'шт.', 'Ранняя версия: «ЖК-панель в 238». Рукописная пометка о ТЗ частично неразборчива.', 1, '', 'Романов П.Г.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-058): «План»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-058) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-059: Поставка продукции радиоэлектронной промышленности: источники беспереб
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Поставка продукции радиоэлектронной промышленности: источники бесперебойного питания', 'Реестр ИТ-блока 2026: IT-059; статус в реестре «План»; ответственный: Романов П.Г.; следующий шаг: Уточнить ТЗ, способ закупки и срок; Уникальная позиция ранней версии. Не объединять с ремонтом ИБП.', 1, 1, 'шт.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    10, 'Романов П.Г.', '26.20', '26.20', '310', 20000000, 0, 0, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Поставка продукции радиоэлектронной промышленности: источники бесперебойного питания', 1, 1, 'шт.', 'Уникальная позиция ранней версии. Не объединять с ремонтом ИБП.', 1, '', 'Романов П.Г.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-059): «План»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-059) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd
-- +goose StatementBegin
-- IT-060: Хозяйственные товары
WITH l AS (
  INSERT INTO "purchase_v3_lots" ("title", "description", "item_type", "quantity", "unit", "implementing_department", "curator_id",
    "status", "assignee_name", "okpd2", "okved", "kosgu", "nmck", "final_cost", "contract_amount", "plan_type", "plan_year",
    "inventory_numbers", "sign_offs", "created_by", "created_at", "updated_at")
  VALUES ('Хозяйственные товары', 'Реестр ИТ-блока 2026: IT-060; статус в реестре «План»; ответственный: Романов П.Г.; следующий шаг: Уточнить ТЗ, способ закупки и срок; Уникальная позиция ранней версии; требуется уточнить состав и источник финансирования.', 1, 1, 'шт.', 1, COALESCE(
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1),
    (SELECT id FROM "purchase_v3_curators" WHERE title ILIKE '%цифров%' ORDER BY id LIMIT 1),
    (SELECT id FROM "purchase_v3_curators" ORDER BY id LIMIT 1)),
    10, 'Романов П.Г.', '', '', '340', 20000000, 0, 0, 1, 2026,
    '[]', '[]', 'Реестр ИТ-блока 2026', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10')
  RETURNING "id"
), r AS (
  INSERT INTO "purchase_v3_requests" ("title", "item_type", "quantity", "unit", "description", "department", "author_uuid", "author_name",
    "curator_id", "implementing_department", "status", "lot_id", "sign_offs", "created_at", "updated_at")
  SELECT 'Хозяйственные товары', 1, 1, 'шт.', 'Уникальная позиция ранней версии; требуется уточнить состав и источник финансирования.', 1, '', 'Романов П.Г.',
    (SELECT curator_id FROM "purchase_v3_departments" WHERE id = 1), 1, 5, l."id", '[]', '2026-08-31 12:00:00+10', '2026-08-31 12:00:00+10'
  FROM l
  RETURNING "id"
), ll AS (
  INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
  SELECT 2, l."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (срез 31.08.2026, IT-060): «План»', '2026-08-31 12:00:00+10' FROM l
)
INSERT INTO "purchase_v3_logs" ("target", "target_id", "role", "actor_name", "action", "text", "created_at")
SELECT 1, r."id", 4, 'Реестр ИТ-блока 2026', 'import', 'Перенесена из реестра ИТ-блока (IT-060) — уже включена в закупку', '2026-08-31 12:00:00+10' FROM r;
-- +goose StatementEnd

-- +goose Down
DELETE FROM "purchase_v3_logs" WHERE "actor_name" = 'Реестр ИТ-блока 2026';
DELETE FROM "purchase_v3_requests" WHERE "lot_id" IN (SELECT id FROM "purchase_v3_lots" WHERE "created_by" = 'Реестр ИТ-блока 2026');
DELETE FROM "purchase_v3_lots" WHERE "created_by" = 'Реестр ИТ-блока 2026';

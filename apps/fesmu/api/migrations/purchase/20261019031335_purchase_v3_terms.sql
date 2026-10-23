-- +goose Up
-- modify "purchase_v3_lots" table
ALTER TABLE "purchase_v3_lots" ADD COLUMN "stage_since" timestamptz NULL, ADD COLUMN "due_at" timestamptz NULL, ADD COLUMN "due_comment" character varying(1024) NOT NULL DEFAULT '';
-- create index "idx_purchase_v3_lots_due_at" to table: "purchase_v3_lots"
CREATE INDEX "idx_purchase_v3_lots_due_at" ON "purchase_v3_lots" ("due_at");
-- modify "purchase_v3_requests" table
ALTER TABLE "purchase_v3_requests" ADD COLUMN "stage_since" timestamptz NULL;

-- Stage terms run from when a record came to its stage: for what exists,
-- its last change is the best known start.
UPDATE "purchase_v3_lots" SET "stage_since" = "updated_at" WHERE "stage_since" IS NULL;
UPDATE "purchase_v3_requests" SET "stage_since" = "updated_at" WHERE "stage_since" IS NULL;
-- Control dates of the IT registry purchases («Контрольный срок»).
UPDATE "purchase_v3_lots" SET "due_at" = '2026-06-12 18:00:00+10', "due_comment" = 'Контрольный срок из реестра ИТ-блока'
WHERE "created_by" = 'Реестр ИТ-блока 2026' AND "title" = 'сервера'
  AND ("description" LIKE 'Реестр ИТ-блока 2026: IT-001;%' OR "description" LIKE 'Реестр ИТ-блока 2026: IT-001,%');
UPDATE "purchase_v3_lots" SET "due_at" = '2026-06-12 18:00:00+10', "due_comment" = 'Контрольный срок из реестра ИТ-блока'
WHERE "created_by" = 'Реестр ИТ-блока 2026' AND "title" = 'сканер'
  AND ("description" LIKE 'Реестр ИТ-блока 2026: IT-002;%' OR "description" LIKE 'Реестр ИТ-блока 2026: IT-002,%');
UPDATE "purchase_v3_lots" SET "due_at" = '2026-06-12 18:00:00+10', "due_comment" = 'Контрольный срок из реестра ИТ-блока'
WHERE "created_by" = 'Реестр ИТ-блока 2026' AND "title" = 'МФУ (см п.7), моноблок'
  AND ("description" LIKE 'Реестр ИТ-блока 2026: IT-003;%' OR "description" LIKE 'Реестр ИТ-блока 2026: IT-003,%');
UPDATE "purchase_v3_lots" SET "due_at" = '2026-06-12 18:00:00+10', "due_comment" = 'Контрольный срок из реестра ИТ-блока'
WHERE "created_by" = 'Реестр ИТ-блока 2026' AND "title" = 'Поставка продукции радиоэлектронной промышленности'
  AND ("description" LIKE 'Реестр ИТ-блока 2026: IT-004;%' OR "description" LIKE 'Реестр ИТ-блока 2026: IT-004,%');
UPDATE "purchase_v3_lots" SET "due_at" = '2026-09-30 18:00:00+10', "due_comment" = 'Контрольный срок из реестра ИТ-блока'
WHERE "created_by" = 'Реестр ИТ-блока 2026' AND "title" = 'Поставка продукции радиоэлектронной промышленности: ИБП'
  AND ("description" LIKE 'Реестр ИТ-блока 2026: IT-005;%' OR "description" LIKE 'Реестр ИТ-блока 2026: IT-005,%');
UPDATE "purchase_v3_lots" SET "due_at" = '2026-06-05 18:00:00+10', "due_comment" = 'Контрольный срок из реестра ИТ-блока'
WHERE "created_by" = 'Реестр ИТ-блока 2026' AND "title" = 'Поставка продукции радиоэлектронной промышленности : комммутаторы'
  AND ("description" LIKE 'Реестр ИТ-блока 2026: IT-006;%' OR "description" LIKE 'Реестр ИТ-блока 2026: IT-006,%');
UPDATE "purchase_v3_lots" SET "due_at" = '2026-06-15 18:00:00+10', "due_comment" = 'Контрольный срок из реестра ИТ-блока'
WHERE "created_by" = 'Реестр ИТ-блока 2026' AND "title" = 'Приобретение неисключительных прав на программное обеспечение: средство виртуализации'
  AND ("description" LIKE 'Реестр ИТ-блока 2026: IT-007;%' OR "description" LIKE 'Реестр ИТ-блока 2026: IT-007,%');
UPDATE "purchase_v3_lots" SET "due_at" = '2026-06-08 18:00:00+10', "due_comment" = 'Контрольный срок из реестра ИТ-блока'
WHERE "created_by" = 'Реестр ИТ-блока 2026' AND "title" = 'Приобретение программного обеспечения антивирусной защиты на 24 месяца'
  AND ("description" LIKE 'Реестр ИТ-блока 2026: IT-010;%' OR "description" LIKE 'Реестр ИТ-блока 2026: IT-010,%');
UPDATE "purchase_v3_lots" SET "due_at" = '2026-04-16 18:00:00+10', "due_comment" = 'Контрольный срок из реестра ИТ-блока'
WHERE "created_by" = 'Реестр ИТ-блока 2026' AND "title" = 'Услуги в области информационных технологий: ПО USERGETE'
  AND ("description" LIKE 'Реестр ИТ-блока 2026: IT-012;%' OR "description" LIKE 'Реестр ИТ-блока 2026: IT-012,%');
UPDATE "purchase_v3_lots" SET "due_at" = '2026-04-16 18:00:00+10', "due_comment" = 'Контрольный срок из реестра ИТ-блока'
WHERE "created_by" = 'Реестр ИТ-блока 2026' AND "title" = 'Услуги в области информационных технологий: ПО USERGETE'
  AND ("description" LIKE 'Реестр ИТ-блока 2026: IT-013;%' OR "description" LIKE 'Реестр ИТ-блока 2026: IT-013,%');
UPDATE "purchase_v3_lots" SET "due_at" = '2026-04-16 18:00:00+10', "due_comment" = 'Контрольный срок из реестра ИТ-блока'
WHERE "created_by" = 'Реестр ИТ-блока 2026' AND "title" = 'Услуги в области информационных технологий: ПО USERGETE'
  AND ("description" LIKE 'Реестр ИТ-блока 2026: IT-014;%' OR "description" LIKE 'Реестр ИТ-блока 2026: IT-014,%');
UPDATE "purchase_v3_lots" SET "due_at" = '2026-10-01 18:00:00+10', "due_comment" = 'Контрольный срок из реестра ИТ-блока'
WHERE "created_by" = 'Реестр ИТ-блока 2026' AND "title" = 'Неисключительное имущественное право использования результатов интеллектуальной деятельности ("Лицензий"): ПО "Программная система для обнаружения текстовых заимствований в учебных и научных работах "Антиплагиат.ВУЗ", ПО "Модуль поиска текстовых заимствов'
  AND ("description" LIKE 'Реестр ИТ-блока 2026: IT-015;%' OR "description" LIKE 'Реестр ИТ-блока 2026: IT-015,%');
UPDATE "purchase_v3_lots" SET "due_at" = '2026-06-15 18:00:00+10', "due_comment" = 'Контрольный срок из реестра ИТ-блока'
WHERE "created_by" = 'Реестр ИТ-блока 2026' AND "title" = 'Приобретение операционной системы RedOS для пользователей'
  AND ("description" LIKE 'Реестр ИТ-блока 2026: IT-017;%' OR "description" LIKE 'Реестр ИТ-блока 2026: IT-017,%');
UPDATE "purchase_v3_lots" SET "due_at" = '2026-06-15 18:00:00+10', "due_comment" = 'Контрольный срок из реестра ИТ-блока'
WHERE "created_by" = 'Реестр ИТ-блока 2026' AND "title" = 'Приобретение операционной системы RedOS для серверов'
  AND ("description" LIKE 'Реестр ИТ-блока 2026: IT-018;%' OR "description" LIKE 'Реестр ИТ-блока 2026: IT-018,%');
UPDATE "purchase_v3_lots" SET "due_at" = '2026-06-22 18:00:00+10', "due_comment" = 'Контрольный срок из реестра ИТ-блока'
WHERE "created_by" = 'Реестр ИТ-блока 2026' AND "title" = 'Приобретение ПО управления доступом: ALD Pro для управления операционными системами'
  AND ("description" LIKE 'Реестр ИТ-блока 2026: IT-019;%' OR "description" LIKE 'Реестр ИТ-блока 2026: IT-019,%');
UPDATE "purchase_v3_lots" SET "due_at" = '2026-06-22 18:00:00+10', "due_comment" = 'Контрольный срок из реестра ИТ-блока'
WHERE "created_by" = 'Реестр ИТ-блока 2026' AND "title" = 'Приобретение лицензий для систем, подключаемых к ALD Pro'
  AND ("description" LIKE 'Реестр ИТ-блока 2026: IT-020;%' OR "description" LIKE 'Реестр ИТ-блока 2026: IT-020,%');
UPDATE "purchase_v3_lots" SET "due_at" = '2026-04-16 18:00:00+10', "due_comment" = 'Контрольный срок из реестра ИТ-блока'
WHERE "created_by" = 'Реестр ИТ-блока 2026' AND "title" = 'Услуги в области информационных технологий  гарантия USERGETE'
  AND ("description" LIKE 'Реестр ИТ-блока 2026: IT-021;%' OR "description" LIKE 'Реестр ИТ-блока 2026: IT-021,%');
UPDATE "purchase_v3_lots" SET "due_at" = '2026-04-29 18:00:00+10', "due_comment" = 'Контрольный срок из реестра ИТ-блока'
WHERE "created_by" = 'Реестр ИТ-блока 2026' AND "title" = 'Оказание консультативных услуг по вопросам управления деятельности предприятия'
  AND ("description" LIKE 'Реестр ИТ-блока 2026: IT-023;%' OR "description" LIKE 'Реестр ИТ-блока 2026: IT-023,%');
UPDATE "purchase_v3_lots" SET "due_at" = '2026-07-10 18:00:00+10', "due_comment" = 'Контрольный срок из реестра ИТ-блока'
WHERE "created_by" = 'Реестр ИТ-блока 2026' AND "title" = 'Приобретение моноблока'
  AND ("description" LIKE 'Реестр ИТ-блока 2026: IT-029;%' OR "description" LIKE 'Реестр ИТ-блока 2026: IT-029,%');
UPDATE "purchase_v3_lots" SET "due_at" = '2026-06-11 18:00:00+10', "due_comment" = 'Контрольный срок из реестра ИТ-блока'
WHERE "created_by" = 'Реестр ИТ-блока 2026' AND "title" = 'Поставка продукции радиоэлектронной промышленности (грант) 72с аспиранты  (Интерактивная панель)'
  AND ("description" LIKE 'Реестр ИТ-блока 2026: IT-030;%' OR "description" LIKE 'Реестр ИТ-блока 2026: IT-030,%');
UPDATE "purchase_v3_lots" SET "due_at" = '2026-07-17 18:00:00+10', "due_comment" = 'Контрольный срок из реестра ИТ-блока'
WHERE "created_by" = 'Реестр ИТ-блока 2026' AND "title" = 'Поставка продукции радиоэлектронной промышленности (грант) 131 с ординаторы  (Интерактивная панель)'
  AND ("description" LIKE 'Реестр ИТ-блока 2026: IT-031;%' OR "description" LIKE 'Реестр ИТ-блока 2026: IT-031,%');
UPDATE "purchase_v3_lots" SET "due_at" = '2026-09-01 18:00:00+10', "due_comment" = 'Контрольный срок из реестра ИТ-блока'
WHERE "created_by" = 'Реестр ИТ-блока 2026' AND "title" = 'Простая неискл. лицензия на использование Базы данных Электронная Система "Госфинансы", 2 польз.,'
  AND ("description" LIKE 'Реестр ИТ-блока 2026: IT-034;%' OR "description" LIKE 'Реестр ИТ-блока 2026: IT-034,%');
UPDATE "purchase_v3_lots" SET "due_at" = '2026-02-20 18:00:00+10', "due_comment" = 'Контрольный срок из реестра ИТ-блока'
WHERE "created_by" = 'Реестр ИТ-блока 2026' AND "title" = 'Оказание услуг по сопровождению и технической поддержке решения по передаче структурированных электронных медицинских документов в подсистему РЭМД ЕГИСЗ с предоставлением доступа к базе обновлений (лицензия/разовая)'
  AND ("description" LIKE 'Реестр ИТ-блока 2026: IT-035;%' OR "description" LIKE 'Реестр ИТ-блока 2026: IT-035,%');
UPDATE "purchase_v3_lots" SET "due_at" = '2026-05-08 18:00:00+10', "due_comment" = 'Контрольный срок из реестра ИТ-блока'
WHERE "created_by" = 'Реестр ИТ-блока 2026' AND "title" = 'Услуги по технической поддержке информационных технологий : ПО Медиалог обновление'
  AND ("description" LIKE 'Реестр ИТ-блока 2026: IT-036;%' OR "description" LIKE 'Реестр ИТ-блока 2026: IT-036,%');
UPDATE "purchase_v3_lots" SET "due_at" = '2026-06-22 18:00:00+10', "due_comment" = 'Контрольный срок из реестра ИТ-блока'
WHERE "created_by" = 'Реестр ИТ-блока 2026' AND "title" = 'Услуги в области информационных технологий : услуги по техгнической поддержке и сопровождению средств криптографической защиты VIPNET 2026-2027гг'
  AND ("description" LIKE 'Реестр ИТ-блока 2026: IT-037;%' OR "description" LIKE 'Реестр ИТ-блока 2026: IT-037,%');
UPDATE "purchase_v3_lots" SET "due_at" = '2026-02-20 18:00:00+10', "due_comment" = 'Контрольный срок из реестра ИТ-блока'
WHERE "created_by" = 'Реестр ИТ-блока 2026' AND "title" = 'Оказание услуг по сопровождению и технической поддержке решения по передаче структурированных электронных медицинских документов в подсистему РЭМД ЕГИСЗ с предоставлением доступа к базе обновлений (базовое сопровождение 12 мес) СЭМД'
  AND ("description" LIKE 'Реестр ИТ-блока 2026: IT-039;%' OR "description" LIKE 'Реестр ИТ-блока 2026: IT-039,%');
UPDATE "purchase_v3_lots" SET "due_at" = '2026-09-07 18:00:00+10', "due_comment" = 'Контрольный срок из реестра ИТ-блока'
WHERE "created_by" = 'Реестр ИТ-блока 2026' AND "title" = 'Поставка запасных частей к оргтехнике'
  AND ("description" LIKE 'Реестр ИТ-блока 2026: IT-040;%' OR "description" LIKE 'Реестр ИТ-блока 2026: IT-040,%');
UPDATE "purchase_v3_lots" SET "due_at" = '2026-09-01 18:00:00+10', "due_comment" = 'Контрольный срок из реестра ИТ-блока'
WHERE "created_by" = 'Реестр ИТ-блока 2026' AND "title" = 'Простая неискл. лицензия на использование Базы данных Электронная Система «ГОСЗАКАЗ»'
  AND ("description" LIKE 'Реестр ИТ-блока 2026: IT-041;%' OR "description" LIKE 'Реестр ИТ-блока 2026: IT-041,%');
UPDATE "purchase_v3_lots" SET "due_at" = '2026-05-07 18:00:00+10', "due_comment" = 'Контрольный срок из реестра ИТ-блока'
WHERE "created_by" = 'Реестр ИТ-блока 2026' AND "title" = 'Приобретение права на программное обеспечение: гранд смета'
  AND ("description" LIKE 'Реестр ИТ-блока 2026: IT-042;%' OR "description" LIKE 'Реестр ИТ-блока 2026: IT-042,%');
UPDATE "purchase_v3_lots" SET "due_at" = '2026-05-08 18:00:00+10', "due_comment" = 'Контрольный срок из реестра ИТ-блока'
WHERE "created_by" = 'Реестр ИТ-блока 2026' AND "title" = 'Услуги по технической поддержке информационных технологий: сопровождение МИС Медиалог'
  AND ("description" LIKE 'Реестр ИТ-блока 2026: IT-043;%' OR "description" LIKE 'Реестр ИТ-блока 2026: IT-043,%');
UPDATE "purchase_v3_lots" SET "due_at" = '2026-06-01 18:00:00+10', "due_comment" = 'Контрольный срок из реестра ИТ-блока'
WHERE "created_by" = 'Реестр ИТ-блока 2026' AND "title" = 'Предоставление доступа к информационной базе данных  1С: ИТС КП ГУ ПРОФ'
  AND ("description" LIKE 'Реестр ИТ-блока 2026: IT-044;%' OR "description" LIKE 'Реестр ИТ-блока 2026: IT-044,%');
UPDATE "purchase_v3_lots" SET "due_at" = '2026-03-10 18:00:00+10', "due_comment" = 'Контрольный срок из реестра ИТ-блока'
WHERE "created_by" = 'Реестр ИТ-блока 2026' AND "title" = 'Услуга по подключению к международной системе библиографических ссылок Crossref, Регистрация цифровых идентификаторов объектов для журнальных статей текущего периода в рамках оказания услуг по подключению к международной системе библиографических ссылок C'
  AND ("description" LIKE 'Реестр ИТ-блока 2026: IT-045;%' OR "description" LIKE 'Реестр ИТ-блока 2026: IT-045,%');
UPDATE "purchase_v3_lots" SET "due_at" = '2025-12-24 18:00:00+10', "due_comment" = 'Контрольный срок из реестра ИТ-блока'
WHERE "created_by" = 'Реестр ИТ-блока 2026' AND "title" = 'Услуги по адаптации, модификации и сопровождению модифицированного программного обеспечения "1С: БГУ" редакция 2:.; ЗГУ'
  AND ("description" LIKE 'Реестр ИТ-блока 2026: IT-050;%' OR "description" LIKE 'Реестр ИТ-блока 2026: IT-050,%');
UPDATE "purchase_v3_lots" SET "due_at" = '2026-03-25 18:00:00+10', "due_comment" = 'Контрольный срок из реестра ИТ-блока'
WHERE "created_by" = 'Реестр ИТ-блока 2026' AND "title" = 'Неисключительные права использования «СБиС++ Электронная отчётность бюджет» и для сдачи отчетности по доп. направлению  (сроком на один год),'
  AND ("description" LIKE 'Реестр ИТ-блока 2026: IT-051;%' OR "description" LIKE 'Реестр ИТ-блока 2026: IT-051,%');
UPDATE "purchase_v3_lots" SET "due_at" = '2026-05-31 18:00:00+10', "due_comment" = 'Контрольный срок из реестра ИТ-блока'
WHERE "created_by" = 'Реестр ИТ-блока 2026' AND "title" = 'Простая неисключительная лицензия без права заключения сублицензии на использование информационноаналитической системы (программы для ЭВМ) SCIENCE INDEX'
  AND ("description" LIKE 'Реестр ИТ-блока 2026: IT-052;%' OR "description" LIKE 'Реестр ИТ-блока 2026: IT-052,%');
UPDATE "purchase_v3_lots" SET "due_at" = '2026-05-30 18:00:00+10', "due_comment" = 'Контрольный срок из реестра ИТ-блока'
WHERE "created_by" = 'Реестр ИТ-блока 2026' AND "title" = 'Услуга по подключению к программе (годовая подписка) платформа двуязычного сайта и электронной редакции электронного журнала'
  AND ("description" LIKE 'Реестр ИТ-блока 2026: IT-053;%' OR "description" LIKE 'Реестр ИТ-блока 2026: IT-053,%');


-- +goose Down
-- reverse: modify "purchase_v3_requests" table
ALTER TABLE "purchase_v3_requests" DROP COLUMN "stage_since";
-- reverse: create index "idx_purchase_v3_lots_due_at" to table: "purchase_v3_lots"
DROP INDEX "idx_purchase_v3_lots_due_at";
-- reverse: modify "purchase_v3_lots" table
ALTER TABLE "purchase_v3_lots" DROP COLUMN "due_comment", DROP COLUMN "due_at", DROP COLUMN "stage_since";

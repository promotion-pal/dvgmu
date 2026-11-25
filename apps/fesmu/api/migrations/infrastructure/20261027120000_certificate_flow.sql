-- +goose Up
-- Путь справки через деканат: заказана → готова к выдаче (напечатана) → выдана;
-- или отклонена с причиной. Факультет — по зачётке на момент заказа (0 — не
-- определён); группа и зачётка — снимок для журнала деканата.
ALTER TABLE "certificate_orders"
  ADD COLUMN "faculty_code" integer NOT NULL DEFAULT 0,
  ADD COLUMN "group" character varying(64) NOT NULL DEFAULT '',
  ADD COLUMN "record_book" character varying(32) NOT NULL DEFAULT '',
  ADD COLUMN "prepared_by" character varying(255) NOT NULL DEFAULT '',
  ADD COLUMN "ready_at" timestamptz NULL,
  ADD COLUMN "cancel_reason" text NOT NULL DEFAULT '';
CREATE INDEX "idx_certificate_orders_faculty_status" ON "certificate_orders" ("faculty_code", "status");

-- +goose Down
DROP INDEX "idx_certificate_orders_faculty_status";
ALTER TABLE "certificate_orders"
  DROP COLUMN "cancel_reason",
  DROP COLUMN "ready_at",
  DROP COLUMN "prepared_by",
  DROP COLUMN "record_book",
  DROP COLUMN "group",
  DROP COLUMN "faculty_code";

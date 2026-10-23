-- +goose Up
-- Журнал заказанных справок: заказ студента (ordered) → выдача (issued).
-- ФИО и кто заказал/выдал — снимок на момент действия.
CREATE TABLE "certificate_orders" (
  "id" bigserial NOT NULL,
  "student_mdm_id" bigint NOT NULL,
  "student_name" character varying(255) NOT NULL,
  "type" integer NOT NULL,
  "copies" integer NOT NULL DEFAULT 1,
  "status" smallint NOT NULL DEFAULT 1,
  "ordered_by" character varying(255) NOT NULL,
  "issued_by" character varying(255) NOT NULL DEFAULT '',
  "issued_at" timestamptz NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);
CREATE INDEX "idx_certificate_orders_student" ON "certificate_orders" ("student_mdm_id");
CREATE INDEX "idx_certificate_orders_status_created" ON "certificate_orders" ("status", "created_at" DESC);

-- +goose Down
DROP TABLE "certificate_orders";

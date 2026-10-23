-- +goose Up
-- modify "purchase_v2_curators" table
ALTER TABLE "purchase_v2_curators" ADD COLUMN "user_uuid" character varying(64) NOT NULL DEFAULT '', ADD COLUMN "user_name" character varying(255) NOT NULL DEFAULT '';
-- create index "idx_purchase_v2_curators_user_uuid" to table: "purchase_v2_curators"
CREATE INDEX "idx_purchase_v2_curators_user_uuid" ON "purchase_v2_curators" ("user_uuid");
-- modify "purchase_v2_lots" table
ALTER TABLE "purchase_v2_lots" ADD COLUMN "implementing_department" integer NOT NULL DEFAULT 0, ADD COLUMN "assignee_uuid" character varying(64) NOT NULL DEFAULT '', ADD COLUMN "assignee_name" character varying(255) NOT NULL DEFAULT '';
-- create index "idx_purchase_v2_lots_implementing_department" to table: "purchase_v2_lots"
CREATE INDEX "idx_purchase_v2_lots_implementing_department" ON "purchase_v2_lots" ("implementing_department");
-- modify "purchase_v2_requests" table
ALTER TABLE "purchase_v2_requests" ADD COLUMN "department_id" integer NOT NULL DEFAULT 0, ADD COLUMN "implementing_department" integer NOT NULL DEFAULT 0, ADD COLUMN "author_uuid" character varying(64) NOT NULL DEFAULT '';
-- create index "idx_purchase_v2_requests_department_id" to table: "purchase_v2_requests"
CREATE INDEX "idx_purchase_v2_requests_department_id" ON "purchase_v2_requests" ("department_id");
-- create index "idx_purchase_v2_requests_implementing_department" to table: "purchase_v2_requests"
CREATE INDEX "idx_purchase_v2_requests_implementing_department" ON "purchase_v2_requests" ("implementing_department");
-- create "purchase_v2_categories" table
CREATE TABLE "purchase_v2_categories" (
  "id" bigserial NOT NULL,
  "name" character varying(255) NOT NULL,
  "okpd2_prefix" character varying(32) NOT NULL,
  "department" integer NOT NULL,
  PRIMARY KEY ("id")
);
-- create "purchase_v2_departments" table
CREATE TABLE "purchase_v2_departments" (
  "id" integer NOT NULL,
  "name" character varying(255) NOT NULL,
  "curator_id" bigint NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_purchase_v2_departments_curator" FOREIGN KEY ("curator_id") REFERENCES "purchase_v2_curators" ("id") ON UPDATE NO ACTION ON DELETE SET NULL
);
-- create index "idx_purchase_v2_departments_curator_id" to table: "purchase_v2_departments"
CREATE INDEX "idx_purchase_v2_departments_curator_id" ON "purchase_v2_departments" ("curator_id");

-- +goose Down
-- reverse: create index "idx_purchase_v2_departments_curator_id" to table: "purchase_v2_departments"
DROP INDEX "idx_purchase_v2_departments_curator_id";
-- reverse: create "purchase_v2_departments" table
DROP TABLE "purchase_v2_departments";
-- reverse: create "purchase_v2_categories" table
DROP TABLE "purchase_v2_categories";
-- reverse: create index "idx_purchase_v2_requests_implementing_department" to table: "purchase_v2_requests"
DROP INDEX "idx_purchase_v2_requests_implementing_department";
-- reverse: create index "idx_purchase_v2_requests_department_id" to table: "purchase_v2_requests"
DROP INDEX "idx_purchase_v2_requests_department_id";
-- reverse: modify "purchase_v2_requests" table
ALTER TABLE "purchase_v2_requests" DROP COLUMN "author_uuid", DROP COLUMN "implementing_department", DROP COLUMN "department_id";
-- reverse: create index "idx_purchase_v2_lots_implementing_department" to table: "purchase_v2_lots"
DROP INDEX "idx_purchase_v2_lots_implementing_department";
-- reverse: modify "purchase_v2_lots" table
ALTER TABLE "purchase_v2_lots" DROP COLUMN "assignee_name", DROP COLUMN "assignee_uuid", DROP COLUMN "implementing_department";
-- reverse: create index "idx_purchase_v2_curators_user_uuid" to table: "purchase_v2_curators"
DROP INDEX "idx_purchase_v2_curators_user_uuid";
-- reverse: modify "purchase_v2_curators" table
ALTER TABLE "purchase_v2_curators" DROP COLUMN "user_name", DROP COLUMN "user_uuid";

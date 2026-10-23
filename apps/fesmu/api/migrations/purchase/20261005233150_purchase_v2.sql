-- +goose Up
-- create "purchase_v2_curators" table
CREATE TABLE "purchase_v2_curators" (
  "id" bigserial NOT NULL,
  "name" character varying(255) NOT NULL,
  "position" character varying(255) NOT NULL DEFAULT '',
  "sort_order" bigint NOT NULL DEFAULT 0,
  PRIMARY KEY ("id")
);
-- create "purchase_v2_logs" table
CREATE TABLE "purchase_v2_logs" (
  "id" bigserial NOT NULL,
  "target" smallint NOT NULL,
  "target_id" bigint NOT NULL,
  "actor_role" smallint NOT NULL,
  "actor_name" character varying(255) NOT NULL DEFAULT '',
  "action" character varying(64) NOT NULL,
  "text" character varying(4096) NOT NULL,
  "comment" character varying(4096) NOT NULL DEFAULT '',
  "created_at" timestamptz NULL,
  PRIMARY KEY ("id")
);
-- create index "idx_purchase_v2_logs_target" to table: "purchase_v2_logs"
CREATE INDEX "idx_purchase_v2_logs_target" ON "purchase_v2_logs" ("target", "target_id");
-- create "purchase_v2_lots" table
CREATE TABLE "purchase_v2_lots" (
  "id" bigserial NOT NULL,
  "title" character varying(255) NOT NULL,
  "description" character varying(4096) NOT NULL DEFAULT '',
  "curator_id" bigint NOT NULL,
  "status" smallint NOT NULL,
  "quantity" numeric NOT NULL,
  "unit" character varying(32) NOT NULL DEFAULT '',
  "comment" character varying(4096) NOT NULL DEFAULT '',
  "okpd2" character varying(32) NOT NULL DEFAULT '',
  "ktru" character varying(64) NOT NULL DEFAULT '',
  "okved" character varying(32) NOT NULL DEFAULT '',
  "codes_auto" boolean NOT NULL DEFAULT false,
  "funding_source" smallint NOT NULL DEFAULT 0,
  "kosgu" character varying(32) NOT NULL DEFAULT '',
  "economist_comment" character varying(2048) NOT NULL DEFAULT '',
  "plan_type" smallint NOT NULL DEFAULT 0,
  "plan_year" bigint NOT NULL DEFAULT 0,
  "commission_comment" character varying(2048) NOT NULL DEFAULT '',
  "approvals" jsonb NOT NULL,
  "last_comment" character varying(2048) NOT NULL DEFAULT '',
  "created_by" character varying(255) NOT NULL DEFAULT '',
  "created_at" timestamptz NULL,
  "updated_at" timestamptz NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_purchase_v2_lots_curator" FOREIGN KEY ("curator_id") REFERENCES "purchase_v2_curators" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- create index "idx_purchase_v2_lots_curator_id" to table: "purchase_v2_lots"
CREATE INDEX "idx_purchase_v2_lots_curator_id" ON "purchase_v2_lots" ("curator_id");
-- create index "idx_purchase_v2_lots_plan_year" to table: "purchase_v2_lots"
CREATE INDEX "idx_purchase_v2_lots_plan_year" ON "purchase_v2_lots" ("plan_year");
-- create index "idx_purchase_v2_lots_status" to table: "purchase_v2_lots"
CREATE INDEX "idx_purchase_v2_lots_status" ON "purchase_v2_lots" ("status");
-- create "purchase_v2_quotations" table
CREATE TABLE "purchase_v2_quotations" (
  "id" bigserial NOT NULL,
  "lot_id" bigint NOT NULL,
  "supplier" character varying(255) NOT NULL,
  "unit_price" bigint NOT NULL,
  "note" character varying(1024) NOT NULL DEFAULT '',
  "file_name" character varying(255) NOT NULL DEFAULT '',
  "file_size" bigint NOT NULL DEFAULT 0,
  "file_content" bytea NULL,
  "created_by" character varying(255) NOT NULL DEFAULT '',
  "created_at" timestamptz NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_purchase_v2_lots_quotations" FOREIGN KEY ("lot_id") REFERENCES "purchase_v2_lots" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- create index "idx_purchase_v2_quotations_lot_id" to table: "purchase_v2_quotations"
CREATE INDEX "idx_purchase_v2_quotations_lot_id" ON "purchase_v2_quotations" ("lot_id");
-- create "purchase_v2_requests" table
CREATE TABLE "purchase_v2_requests" (
  "id" bigserial NOT NULL,
  "title" character varying(255) NOT NULL,
  "quantity" numeric NOT NULL,
  "unit" character varying(32) NOT NULL DEFAULT '',
  "description" character varying(4096) NOT NULL DEFAULT '',
  "department" character varying(255) NOT NULL DEFAULT '',
  "curator_id" bigint NOT NULL,
  "status" smallint NOT NULL,
  "author_name" character varying(255) NOT NULL DEFAULT '',
  "lot_id" bigint NULL,
  "approvals" jsonb NOT NULL,
  "last_comment" character varying(2048) NOT NULL DEFAULT '',
  "created_at" timestamptz NULL,
  "updated_at" timestamptz NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_purchase_v2_requests_curator" FOREIGN KEY ("curator_id") REFERENCES "purchase_v2_curators" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "fk_purchase_v2_requests_lot" FOREIGN KEY ("lot_id") REFERENCES "purchase_v2_lots" ("id") ON UPDATE NO ACTION ON DELETE SET NULL
);
-- create index "idx_purchase_v2_requests_curator_id" to table: "purchase_v2_requests"
CREATE INDEX "idx_purchase_v2_requests_curator_id" ON "purchase_v2_requests" ("curator_id");
-- create index "idx_purchase_v2_requests_lot_id" to table: "purchase_v2_requests"
CREATE INDEX "idx_purchase_v2_requests_lot_id" ON "purchase_v2_requests" ("lot_id");
-- create index "idx_purchase_v2_requests_status" to table: "purchase_v2_requests"
CREATE INDEX "idx_purchase_v2_requests_status" ON "purchase_v2_requests" ("status");

-- +goose Down
-- reverse: create index "idx_purchase_v2_requests_status" to table: "purchase_v2_requests"
DROP INDEX "idx_purchase_v2_requests_status";
-- reverse: create index "idx_purchase_v2_requests_lot_id" to table: "purchase_v2_requests"
DROP INDEX "idx_purchase_v2_requests_lot_id";
-- reverse: create index "idx_purchase_v2_requests_curator_id" to table: "purchase_v2_requests"
DROP INDEX "idx_purchase_v2_requests_curator_id";
-- reverse: create "purchase_v2_requests" table
DROP TABLE "purchase_v2_requests";
-- reverse: create index "idx_purchase_v2_quotations_lot_id" to table: "purchase_v2_quotations"
DROP INDEX "idx_purchase_v2_quotations_lot_id";
-- reverse: create "purchase_v2_quotations" table
DROP TABLE "purchase_v2_quotations";
-- reverse: create index "idx_purchase_v2_lots_status" to table: "purchase_v2_lots"
DROP INDEX "idx_purchase_v2_lots_status";
-- reverse: create index "idx_purchase_v2_lots_plan_year" to table: "purchase_v2_lots"
DROP INDEX "idx_purchase_v2_lots_plan_year";
-- reverse: create index "idx_purchase_v2_lots_curator_id" to table: "purchase_v2_lots"
DROP INDEX "idx_purchase_v2_lots_curator_id";
-- reverse: create "purchase_v2_lots" table
DROP TABLE "purchase_v2_lots";
-- reverse: create index "idx_purchase_v2_logs_target" to table: "purchase_v2_logs"
DROP INDEX "idx_purchase_v2_logs_target";
-- reverse: create "purchase_v2_logs" table
DROP TABLE "purchase_v2_logs";
-- reverse: create "purchase_v2_curators" table
DROP TABLE "purchase_v2_curators";

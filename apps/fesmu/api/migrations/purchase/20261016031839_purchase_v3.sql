-- +goose Up
-- create "purchase_v3_categories" table
CREATE TABLE "purchase_v3_categories" (
  "id" bigserial NOT NULL,
  "name" character varying(255) NOT NULL,
  "okpd2_prefix" character varying(32) NOT NULL,
  "implementing_department" integer NOT NULL,
  PRIMARY KEY ("id")
);
-- create "purchase_v3_curators" table
CREATE TABLE "purchase_v3_curators" (
  "id" bigserial NOT NULL,
  "title" character varying(255) NOT NULL,
  "short_title" character varying(64) NOT NULL DEFAULT '',
  "person_name" character varying(255) NOT NULL DEFAULT '',
  "user_uuid" character varying(64) NOT NULL DEFAULT '',
  "user_name" character varying(255) NOT NULL DEFAULT '',
  "sort_order" integer NOT NULL DEFAULT 0,
  PRIMARY KEY ("id")
);
-- create index "idx_purchase_v3_curators_user_uuid" to table: "purchase_v3_curators"
CREATE INDEX "idx_purchase_v3_curators_user_uuid" ON "purchase_v3_curators" ("user_uuid");
-- create "purchase_v3_logs" table
CREATE TABLE "purchase_v3_logs" (
  "id" bigserial NOT NULL,
  "target" smallint NOT NULL,
  "target_id" bigint NOT NULL,
  "role" smallint NOT NULL,
  "actor_name" character varying(255) NOT NULL DEFAULT '',
  "actor_uuid" character varying(64) NOT NULL DEFAULT '',
  "action" character varying(64) NOT NULL,
  "text" character varying(4096) NOT NULL,
  "comment" character varying(4096) NOT NULL DEFAULT '',
  "created_at" timestamptz NULL,
  PRIMARY KEY ("id")
);
-- create index "idx_purchase_v3_logs_target" to table: "purchase_v3_logs"
CREATE INDEX "idx_purchase_v3_logs_target" ON "purchase_v3_logs" ("target", "target_id");
-- create "purchase_v3_departments" table
CREATE TABLE "purchase_v3_departments" (
  "id" integer NOT NULL,
  "name" character varying(255) NOT NULL,
  "curator_id" bigint NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_purchase_v3_departments_curator" FOREIGN KEY ("curator_id") REFERENCES "purchase_v3_curators" ("id") ON UPDATE NO ACTION ON DELETE SET NULL
);
-- create index "idx_purchase_v3_departments_curator_id" to table: "purchase_v3_departments"
CREATE INDEX "idx_purchase_v3_departments_curator_id" ON "purchase_v3_departments" ("curator_id");
-- create "purchase_v3_protocols" table
CREATE TABLE "purchase_v3_protocols" (
  "id" bigserial NOT NULL,
  "number" character varying(64) NOT NULL,
  "held_at" timestamptz NOT NULL,
  "chairman" character varying(255) NOT NULL DEFAULT '',
  "secretary" character varying(255) NOT NULL DEFAULT '',
  "comment" character varying(4096) NOT NULL DEFAULT '',
  "decisions" jsonb NOT NULL,
  "file_name" character varying(255) NOT NULL DEFAULT '',
  "file_size" bigint NOT NULL DEFAULT 0,
  "file_content" bytea NULL,
  "created_by" character varying(255) NOT NULL DEFAULT '',
  "created_at" timestamptz NULL,
  PRIMARY KEY ("id")
);
-- create "purchase_v3_lots" table
CREATE TABLE "purchase_v3_lots" (
  "id" bigserial NOT NULL,
  "title" character varying(255) NOT NULL,
  "description" character varying(4096) NOT NULL DEFAULT '',
  "item_type" smallint NOT NULL,
  "quantity" numeric NOT NULL,
  "unit" character varying(32) NOT NULL DEFAULT '',
  "implementing_department" integer NOT NULL,
  "curator_id" bigint NOT NULL,
  "status" smallint NOT NULL,
  "assignee_uuid" character varying(64) NOT NULL DEFAULT '',
  "assignee_name" character varying(255) NOT NULL DEFAULT '',
  "specification" text NOT NULL DEFAULT '',
  "curator_justification" character varying(4096) NOT NULL DEFAULT '',
  "okpd2" character varying(32) NOT NULL DEFAULT '',
  "ktru" character varying(64) NOT NULL DEFAULT '',
  "okved" character varying(32) NOT NULL DEFAULT '',
  "codes_auto" boolean NOT NULL DEFAULT false,
  "funding_source" smallint NOT NULL DEFAULT 0,
  "kosgu" character varying(32) NOT NULL DEFAULT '',
  "nmck" bigint NOT NULL DEFAULT 0,
  "economist_comment" character varying(2048) NOT NULL DEFAULT '',
  "plan_type" smallint NOT NULL DEFAULT 0,
  "plan_year" integer NOT NULL DEFAULT 0,
  "protocol_id" bigint NULL,
  "commission_comment" character varying(2048) NOT NULL DEFAULT '',
  "tech_spec" text NOT NULL DEFAULT '',
  "final_cost" bigint NOT NULL DEFAULT 0,
  "final_cost_comment" character varying(2048) NOT NULL DEFAULT '',
  "law" smallint NOT NULL DEFAULT 0,
  "method" smallint NOT NULL DEFAULT 0,
  "contract_service_comment" character varying(2048) NOT NULL DEFAULT '',
  "notice_number" character varying(64) NOT NULL DEFAULT '',
  "notice_at" timestamptz NULL,
  "supplier" character varying(255) NOT NULL DEFAULT '',
  "supplier_inn" character varying(16) NOT NULL DEFAULT '',
  "contract_number" character varying(64) NOT NULL DEFAULT '',
  "contract_at" timestamptz NULL,
  "contract_amount" bigint NOT NULL DEFAULT 0,
  "delivery_due" timestamptz NULL,
  "delivered_at" timestamptz NULL,
  "accepted_at" timestamptz NULL,
  "acceptance_comment" character varying(2048) NOT NULL DEFAULT '',
  "inventory_numbers" jsonb NOT NULL,
  "completed_at" timestamptz NULL,
  "sign_offs" jsonb NOT NULL,
  "last_comment" character varying(2048) NOT NULL DEFAULT '',
  "created_by" character varying(255) NOT NULL DEFAULT '',
  "created_at" timestamptz NULL,
  "updated_at" timestamptz NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_purchase_v3_lots_curator" FOREIGN KEY ("curator_id") REFERENCES "purchase_v3_curators" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "fk_purchase_v3_lots_protocol" FOREIGN KEY ("protocol_id") REFERENCES "purchase_v3_protocols" ("id") ON UPDATE NO ACTION ON DELETE SET NULL
);
-- create index "idx_purchase_v3_lots_assignee_uuid" to table: "purchase_v3_lots"
CREATE INDEX "idx_purchase_v3_lots_assignee_uuid" ON "purchase_v3_lots" ("assignee_uuid");
-- create index "idx_purchase_v3_lots_curator_id" to table: "purchase_v3_lots"
CREATE INDEX "idx_purchase_v3_lots_curator_id" ON "purchase_v3_lots" ("curator_id");
-- create index "idx_purchase_v3_lots_implementing_department" to table: "purchase_v3_lots"
CREATE INDEX "idx_purchase_v3_lots_implementing_department" ON "purchase_v3_lots" ("implementing_department");
-- create index "idx_purchase_v3_lots_plan_year" to table: "purchase_v3_lots"
CREATE INDEX "idx_purchase_v3_lots_plan_year" ON "purchase_v3_lots" ("plan_year");
-- create index "idx_purchase_v3_lots_protocol_id" to table: "purchase_v3_lots"
CREATE INDEX "idx_purchase_v3_lots_protocol_id" ON "purchase_v3_lots" ("protocol_id");
-- create index "idx_purchase_v3_lots_status" to table: "purchase_v3_lots"
CREATE INDEX "idx_purchase_v3_lots_status" ON "purchase_v3_lots" ("status");
-- create "purchase_v3_documents" table
CREATE TABLE "purchase_v3_documents" (
  "id" bigserial NOT NULL,
  "lot_id" bigint NOT NULL,
  "kind" smallint NOT NULL,
  "note" character varying(1024) NOT NULL DEFAULT '',
  "file_name" character varying(255) NOT NULL,
  "file_size" bigint NOT NULL,
  "file_content" bytea NULL,
  "created_by" character varying(255) NOT NULL DEFAULT '',
  "created_at" timestamptz NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_purchase_v3_lots_documents" FOREIGN KEY ("lot_id") REFERENCES "purchase_v3_lots" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- create index "idx_purchase_v3_documents_lot_id" to table: "purchase_v3_documents"
CREATE INDEX "idx_purchase_v3_documents_lot_id" ON "purchase_v3_documents" ("lot_id");
-- create "purchase_v3_quotations" table
CREATE TABLE "purchase_v3_quotations" (
  "id" bigserial NOT NULL,
  "lot_id" bigint NOT NULL,
  "supplier" character varying(255) NOT NULL,
  "supplier_inn" character varying(16) NOT NULL DEFAULT '',
  "unit_price" bigint NOT NULL,
  "note" character varying(1024) NOT NULL DEFAULT '',
  "file_name" character varying(255) NOT NULL DEFAULT '',
  "file_size" bigint NOT NULL DEFAULT 0,
  "file_content" bytea NULL,
  "created_by" character varying(255) NOT NULL DEFAULT '',
  "created_at" timestamptz NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_purchase_v3_lots_quotations" FOREIGN KEY ("lot_id") REFERENCES "purchase_v3_lots" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- create index "idx_purchase_v3_quotations_lot_id" to table: "purchase_v3_quotations"
CREATE INDEX "idx_purchase_v3_quotations_lot_id" ON "purchase_v3_quotations" ("lot_id");
-- create "purchase_v3_requests" table
CREATE TABLE "purchase_v3_requests" (
  "id" bigserial NOT NULL,
  "title" character varying(255) NOT NULL,
  "item_type" smallint NOT NULL,
  "quantity" numeric NOT NULL,
  "unit" character varying(32) NOT NULL DEFAULT '',
  "description" character varying(4096) NOT NULL DEFAULT '',
  "department" integer NOT NULL,
  "author_uuid" character varying(64) NOT NULL,
  "author_name" character varying(255) NOT NULL,
  "curator_id" bigint NULL,
  "implementing_department" integer NOT NULL DEFAULT 0,
  "status" smallint NOT NULL,
  "lot_id" bigint NULL,
  "merged_into_id" bigint NULL,
  "sign_offs" jsonb NOT NULL,
  "last_comment" character varying(2048) NOT NULL DEFAULT '',
  "created_at" timestamptz NULL,
  "updated_at" timestamptz NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_purchase_v3_requests_curator" FOREIGN KEY ("curator_id") REFERENCES "purchase_v3_curators" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "fk_purchase_v3_requests_lot" FOREIGN KEY ("lot_id") REFERENCES "purchase_v3_lots" ("id") ON UPDATE NO ACTION ON DELETE SET NULL,
  CONSTRAINT "fk_purchase_v3_requests_merged_into" FOREIGN KEY ("merged_into_id") REFERENCES "purchase_v3_requests" ("id") ON UPDATE NO ACTION ON DELETE SET NULL
);
-- create index "idx_purchase_v3_requests_author_uuid" to table: "purchase_v3_requests"
CREATE INDEX "idx_purchase_v3_requests_author_uuid" ON "purchase_v3_requests" ("author_uuid");
-- create index "idx_purchase_v3_requests_curator_id" to table: "purchase_v3_requests"
CREATE INDEX "idx_purchase_v3_requests_curator_id" ON "purchase_v3_requests" ("curator_id");
-- create index "idx_purchase_v3_requests_department" to table: "purchase_v3_requests"
CREATE INDEX "idx_purchase_v3_requests_department" ON "purchase_v3_requests" ("department");
-- create index "idx_purchase_v3_requests_implementing_department" to table: "purchase_v3_requests"
CREATE INDEX "idx_purchase_v3_requests_implementing_department" ON "purchase_v3_requests" ("implementing_department");
-- create index "idx_purchase_v3_requests_lot_id" to table: "purchase_v3_requests"
CREATE INDEX "idx_purchase_v3_requests_lot_id" ON "purchase_v3_requests" ("lot_id");
-- create index "idx_purchase_v3_requests_merged_into_id" to table: "purchase_v3_requests"
CREATE INDEX "idx_purchase_v3_requests_merged_into_id" ON "purchase_v3_requests" ("merged_into_id");
-- create index "idx_purchase_v3_requests_status" to table: "purchase_v3_requests"
CREATE INDEX "idx_purchase_v3_requests_status" ON "purchase_v3_requests" ("status");

-- +goose Down
-- reverse: create index "idx_purchase_v3_requests_status" to table: "purchase_v3_requests"
DROP INDEX "idx_purchase_v3_requests_status";
-- reverse: create index "idx_purchase_v3_requests_merged_into_id" to table: "purchase_v3_requests"
DROP INDEX "idx_purchase_v3_requests_merged_into_id";
-- reverse: create index "idx_purchase_v3_requests_lot_id" to table: "purchase_v3_requests"
DROP INDEX "idx_purchase_v3_requests_lot_id";
-- reverse: create index "idx_purchase_v3_requests_implementing_department" to table: "purchase_v3_requests"
DROP INDEX "idx_purchase_v3_requests_implementing_department";
-- reverse: create index "idx_purchase_v3_requests_department" to table: "purchase_v3_requests"
DROP INDEX "idx_purchase_v3_requests_department";
-- reverse: create index "idx_purchase_v3_requests_curator_id" to table: "purchase_v3_requests"
DROP INDEX "idx_purchase_v3_requests_curator_id";
-- reverse: create index "idx_purchase_v3_requests_author_uuid" to table: "purchase_v3_requests"
DROP INDEX "idx_purchase_v3_requests_author_uuid";
-- reverse: create "purchase_v3_requests" table
DROP TABLE "purchase_v3_requests";
-- reverse: create index "idx_purchase_v3_quotations_lot_id" to table: "purchase_v3_quotations"
DROP INDEX "idx_purchase_v3_quotations_lot_id";
-- reverse: create "purchase_v3_quotations" table
DROP TABLE "purchase_v3_quotations";
-- reverse: create index "idx_purchase_v3_documents_lot_id" to table: "purchase_v3_documents"
DROP INDEX "idx_purchase_v3_documents_lot_id";
-- reverse: create "purchase_v3_documents" table
DROP TABLE "purchase_v3_documents";
-- reverse: create index "idx_purchase_v3_lots_status" to table: "purchase_v3_lots"
DROP INDEX "idx_purchase_v3_lots_status";
-- reverse: create index "idx_purchase_v3_lots_protocol_id" to table: "purchase_v3_lots"
DROP INDEX "idx_purchase_v3_lots_protocol_id";
-- reverse: create index "idx_purchase_v3_lots_plan_year" to table: "purchase_v3_lots"
DROP INDEX "idx_purchase_v3_lots_plan_year";
-- reverse: create index "idx_purchase_v3_lots_implementing_department" to table: "purchase_v3_lots"
DROP INDEX "idx_purchase_v3_lots_implementing_department";
-- reverse: create index "idx_purchase_v3_lots_curator_id" to table: "purchase_v3_lots"
DROP INDEX "idx_purchase_v3_lots_curator_id";
-- reverse: create index "idx_purchase_v3_lots_assignee_uuid" to table: "purchase_v3_lots"
DROP INDEX "idx_purchase_v3_lots_assignee_uuid";
-- reverse: create "purchase_v3_lots" table
DROP TABLE "purchase_v3_lots";
-- reverse: create "purchase_v3_protocols" table
DROP TABLE "purchase_v3_protocols";
-- reverse: create index "idx_purchase_v3_departments_curator_id" to table: "purchase_v3_departments"
DROP INDEX "idx_purchase_v3_departments_curator_id";
-- reverse: create "purchase_v3_departments" table
DROP TABLE "purchase_v3_departments";
-- reverse: create index "idx_purchase_v3_logs_target" to table: "purchase_v3_logs"
DROP INDEX "idx_purchase_v3_logs_target";
-- reverse: create "purchase_v3_logs" table
DROP TABLE "purchase_v3_logs";
-- reverse: create index "idx_purchase_v3_curators_user_uuid" to table: "purchase_v3_curators"
DROP INDEX "idx_purchase_v3_curators_user_uuid";
-- reverse: create "purchase_v3_curators" table
DROP TABLE "purchase_v3_curators";
-- reverse: create "purchase_v3_categories" table
DROP TABLE "purchase_v3_categories";

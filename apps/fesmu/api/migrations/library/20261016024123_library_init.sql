-- +goose Up
-- create "library_files" table
CREATE TABLE "library_files" (
  "id" bigint NOT NULL,
  "name" character varying(512) NOT NULL,
  "mime_type" character varying(255) NOT NULL DEFAULT '',
  "size" bigint NOT NULL DEFAULT 0,
  "created_by" character varying(255) NOT NULL DEFAULT '',
  "created_at" timestamptz NULL,
  PRIMARY KEY ("id")
);
-- create "library_manuals" table
CREATE TABLE "library_manuals" (
  "id" bigserial NOT NULL,
  "discipline" character varying(255) NOT NULL,
  "title" character varying(512) NOT NULL,
  "specialty" character varying(255) NOT NULL DEFAULT '',
  "course" integer NOT NULL DEFAULT 0,
  "semester" integer NOT NULL DEFAULT 0,
  "authors" character varying(512) NOT NULL DEFAULT '',
  "annotation" character varying(4096) NOT NULL DEFAULT '',
  "status" integer NOT NULL,
  "draft" jsonb NOT NULL,
  "published" jsonb NULL,
  "draft_changed" boolean NOT NULL DEFAULT false,
  "updated_by" character varying(255) NOT NULL DEFAULT '',
  "created_at" timestamptz NULL,
  "updated_at" timestamptz NULL,
  "published_at" timestamptz NULL,
  PRIMARY KEY ("id")
);
-- create index "idx_library_manuals_discipline" to table: "library_manuals"
CREATE INDEX "idx_library_manuals_discipline" ON "library_manuals" ("discipline");
-- create "library_progress" table
CREATE TABLE "library_progress" (
  "user_uuid" character varying(64) NOT NULL,
  "kind" integer NOT NULL,
  "ref_id" bigint NOT NULL,
  "position" character varying(255) NOT NULL DEFAULT '',
  "percent" integer NOT NULL DEFAULT 0,
  "updated_at" timestamptz NULL,
  PRIMARY KEY ("user_uuid", "kind", "ref_id")
);
-- create index "idx_library_progress_updated_at" to table: "library_progress"
CREATE INDEX "idx_library_progress_updated_at" ON "library_progress" ("updated_at");
-- create "library_items" table
CREATE TABLE "library_items" (
  "id" bigserial NOT NULL,
  "kind" integer NOT NULL,
  "title" character varying(512) NOT NULL,
  "authors" character varying(512) NOT NULL DEFAULT '',
  "year" integer NOT NULL DEFAULT 0,
  "publisher" character varying(255) NOT NULL DEFAULT '',
  "description" character varying(8192) NOT NULL DEFAULT '',
  "discipline" character varying(255) NOT NULL DEFAULT '',
  "file_id" bigint NULL,
  "url" character varying(2048) NOT NULL DEFAULT '',
  "created_by" character varying(255) NOT NULL DEFAULT '',
  "created_at" timestamptz NULL,
  "updated_at" timestamptz NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_library_items_file" FOREIGN KEY ("file_id") REFERENCES "library_files" ("id") ON UPDATE NO ACTION ON DELETE SET NULL
);
-- create index "idx_library_items_discipline" to table: "library_items"
CREATE INDEX "idx_library_items_discipline" ON "library_items" ("discipline");
-- create index "idx_library_items_file_id" to table: "library_items"
CREATE INDEX "idx_library_items_file_id" ON "library_items" ("file_id");

-- +goose Down
-- reverse: create index "idx_library_items_file_id" to table: "library_items"
DROP INDEX "idx_library_items_file_id";
-- reverse: create index "idx_library_items_discipline" to table: "library_items"
DROP INDEX "idx_library_items_discipline";
-- reverse: create "library_items" table
DROP TABLE "library_items";
-- reverse: create index "idx_library_progress_updated_at" to table: "library_progress"
DROP INDEX "idx_library_progress_updated_at";
-- reverse: create "library_progress" table
DROP TABLE "library_progress";
-- reverse: create index "idx_library_manuals_discipline" to table: "library_manuals"
DROP INDEX "idx_library_manuals_discipline";
-- reverse: create "library_manuals" table
DROP TABLE "library_manuals";
-- reverse: create "library_files" table
DROP TABLE "library_files";

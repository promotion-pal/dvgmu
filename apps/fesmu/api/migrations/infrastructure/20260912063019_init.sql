-- +goose Up
-- create "infrastructures" table
CREATE TABLE "infrastructures" (
  "id" bigserial NOT NULL,
  "title" character varying(255) NOT NULL,
  "description" character varying(1024) NULL,
  "floor" integer NULL,
  "room" integer NULL,
  "location" smallint NULL,
  "created_at" timestamptz NULL,
  "updated_at" timestamptz NULL,
  PRIMARY KEY ("id")
);
-- create "inventories" table
CREATE TABLE "inventories" (
  "id" bigserial NOT NULL,
  "title" character varying(255) NOT NULL,
  "description" character varying(1024) NULL,
  "inventory_number" character varying(64) NOT NULL,
  "serial_number" character varying(64) NULL,
  "purchase_price" numeric NULL,
  "purchase_date" timestamptz NULL,
  "infrastructure_id" bigint NULL,
  "responsible_user_id" bigint NULL,
  "status" smallint NULL,
  "type" smallint NULL,
  "created_at" timestamptz NULL,
  "updated_at" timestamptz NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "uni_inventories_inventory_number" UNIQUE ("inventory_number")
);

-- +goose Down
-- reverse: create "inventories" table
DROP TABLE "inventories";
-- reverse: create "infrastructures" table
DROP TABLE "infrastructures";

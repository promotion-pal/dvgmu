-- +goose Up
-- create "purchase_v3_visits" table
CREATE TABLE "purchase_v3_visits" (
  "id" bigserial NOT NULL,
  "user_uuid" character varying(64) NOT NULL,
  "user_name" character varying(255) NOT NULL DEFAULT '',
  "created_at" timestamptz NOT NULL,
  PRIMARY KEY ("id")
);
-- create index "idx_purchase_v3_visits_created_at" to table: "purchase_v3_visits"
CREATE INDEX "idx_purchase_v3_visits_created_at" ON "purchase_v3_visits" ("created_at");
-- create index "idx_purchase_v3_visits_user" to table: "purchase_v3_visits"
CREATE INDEX "idx_purchase_v3_visits_user" ON "purchase_v3_visits" ("user_uuid", "created_at");

-- +goose Down
-- reverse: create index "idx_purchase_v3_visits_user" to table: "purchase_v3_visits"
DROP INDEX "idx_purchase_v3_visits_user";
-- reverse: create index "idx_purchase_v3_visits_created_at" to table: "purchase_v3_visits"
DROP INDEX "idx_purchase_v3_visits_created_at";
-- reverse: create "purchase_v3_visits" table
DROP TABLE "purchase_v3_visits";

-- +goose Up
-- modify "purchase_v2_lots" table
ALTER TABLE "purchase_v2_lots" ADD COLUMN "item_type" smallint NOT NULL DEFAULT 1;
-- modify "purchase_v2_requests" table
ALTER TABLE "purchase_v2_requests" ALTER COLUMN "curator_id" DROP NOT NULL, ADD COLUMN "item_type" smallint NOT NULL DEFAULT 1, ADD COLUMN "merged_into_id" bigint NULL, ADD CONSTRAINT "fk_purchase_v2_requests_merged_into" FOREIGN KEY ("merged_into_id") REFERENCES "purchase_v2_requests" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;
-- create index "idx_purchase_v2_requests_merged_into_id" to table: "purchase_v2_requests"
CREATE INDEX "idx_purchase_v2_requests_merged_into_id" ON "purchase_v2_requests" ("merged_into_id");

-- +goose Down
-- reverse: create index "idx_purchase_v2_requests_merged_into_id" to table: "purchase_v2_requests"
DROP INDEX "idx_purchase_v2_requests_merged_into_id";
-- reverse: modify "purchase_v2_requests" table
ALTER TABLE "purchase_v2_requests" DROP CONSTRAINT "fk_purchase_v2_requests_merged_into", DROP COLUMN "merged_into_id", DROP COLUMN "item_type", ALTER COLUMN "curator_id" SET NOT NULL;
-- reverse: modify "purchase_v2_lots" table
ALTER TABLE "purchase_v2_lots" DROP COLUMN "item_type";

-- +goose Up
-- modify "purchase_v2_lots" table
ALTER TABLE "purchase_v2_lots" ADD COLUMN "nmck" bigint NOT NULL DEFAULT 0;

-- +goose Down
-- reverse: modify "purchase_v2_lots" table
ALTER TABLE "purchase_v2_lots" DROP COLUMN "nmck";

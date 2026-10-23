-- +goose Up
-- modify "purchase_v3_lots" table
ALTER TABLE "purchase_v3_lots" ADD COLUMN "review_note" text NOT NULL DEFAULT '';

-- +goose Down
-- reverse: modify "purchase_v3_lots" table
ALTER TABLE "purchase_v3_lots" DROP COLUMN "review_note";

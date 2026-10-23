-- +goose Up
-- modify "hall_bookings" table: when the organizer consented to personal data processing
ALTER TABLE "hall_bookings" ADD COLUMN "consented_at" timestamptz NULL;

-- +goose Down
-- reverse: modify "hall_bookings" table
ALTER TABLE "hall_bookings" DROP COLUMN "consented_at";

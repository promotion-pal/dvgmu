-- +goose Up
-- A booking now holds the hall for an interval and records who booked it.
-- rename a column from "time" to "time_start"
ALTER TABLE "hall_bookings" RENAME COLUMN "time" TO "time_start";
-- modify "hall_bookings" table
ALTER TABLE "hall_bookings" ADD COLUMN "time_end" character varying(5) NULL, ADD COLUMN "organizer" character varying(255) NOT NULL DEFAULT '', ADD COLUMN "contact" character varying(255) NOT NULL DEFAULT '';
-- existing bookings (the seed) only knew their start: assume one hour
UPDATE "hall_bookings" SET "time_end" = to_char("time_start"::time + interval '1 hour', 'HH24:MI');
ALTER TABLE "hall_bookings" ALTER COLUMN "time_end" SET NOT NULL;
-- overlaps are now checked by interval in storage; the exact-start unique index is superseded
DROP INDEX "idx_hall_bookings_slot";
-- create index "idx_hall_bookings_hall_date" to table: "hall_bookings"
CREATE INDEX "idx_hall_bookings_hall_date" ON "hall_bookings" ("hall_id", "date");

-- +goose Down
-- reverse: create index "idx_hall_bookings_hall_date" to table: "hall_bookings"
DROP INDEX "idx_hall_bookings_hall_date";
CREATE UNIQUE INDEX "idx_hall_bookings_slot" ON "hall_bookings" ("hall_id", "date", "time_start");
-- reverse: modify "hall_bookings" table
ALTER TABLE "hall_bookings" DROP COLUMN "contact", DROP COLUMN "organizer", DROP COLUMN "time_end";
ALTER TABLE "hall_bookings" RENAME COLUMN "time_start" TO "time";

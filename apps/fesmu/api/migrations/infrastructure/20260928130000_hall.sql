-- +goose Up
-- create "halls" table
CREATE TABLE "halls" (
  "id" bigserial NOT NULL,
  "name" character varying(255) NOT NULL,
  "building" character varying(255) NULL,
  "tone" character varying(32) NOT NULL,
  "created_at" timestamptz NULL,
  "updated_at" timestamptz NULL,
  PRIMARY KEY ("id")
);
-- create "hall_bookings" table
CREATE TABLE "hall_bookings" (
  "id" bigserial NOT NULL,
  "hall_id" bigint NOT NULL,
  "date" character varying(10) NOT NULL,
  "time" character varying(5) NOT NULL,
  "title" character varying(255) NOT NULL,
  "created_at" timestamptz NULL,
  "updated_at" timestamptz NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_hall_bookings_hall" FOREIGN KEY ("hall_id") REFERENCES "halls" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- create index "idx_hall_bookings_slot" to table: "hall_bookings"
CREATE UNIQUE INDEX "idx_hall_bookings_slot" ON "hall_bookings" ("hall_id", "date", "time");

-- +goose Down
-- reverse: create "hall_bookings" table
DROP TABLE "hall_bookings";
-- reverse: create "halls" table
DROP TABLE "halls";

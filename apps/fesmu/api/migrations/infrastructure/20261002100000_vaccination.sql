-- +goose Up
-- create "vaccination_days" table
CREATE TABLE "vaccination_days" (
  "id" bigserial NOT NULL,
  "date" character varying(10) NOT NULL,
  "title" character varying(255) NOT NULL,
  "place" character varying(255) NOT NULL DEFAULT '',
  "note" character varying(1024) NOT NULL DEFAULT '',
  "created_at" timestamptz NULL,
  "updated_at" timestamptz NULL,
  PRIMARY KEY ("id")
);
-- create index "idx_vaccination_days_date" to table: "vaccination_days"
CREATE INDEX "idx_vaccination_days_date" ON "vaccination_days" ("date");
-- create "vaccination_slots" table
CREATE TABLE "vaccination_slots" (
  "id" bigserial NOT NULL,
  "day_id" bigint NOT NULL,
  "time_start" character varying(5) NOT NULL,
  "time_end" character varying(5) NOT NULL,
  "capacity" integer NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_vaccination_days_slots" FOREIGN KEY ("day_id") REFERENCES "vaccination_days" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- create index "idx_vaccination_slots_day_id" to table: "vaccination_slots"
CREATE INDEX "idx_vaccination_slots_day_id" ON "vaccination_slots" ("day_id");
-- create "vaccination_signups" table
CREATE TABLE "vaccination_signups" (
  "id" bigserial NOT NULL,
  "day_id" bigint NOT NULL,
  "slot_id" bigint NOT NULL,
  "full_name" character varying(255) NOT NULL,
  "name_key" character varying(255) NOT NULL,
  "consented_at" timestamptz NULL,
  "created_at" timestamptz NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_vaccination_signups_day" FOREIGN KEY ("day_id") REFERENCES "vaccination_days" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_vaccination_slots_signups" FOREIGN KEY ("slot_id") REFERENCES "vaccination_slots" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- create index "idx_vaccination_signups_slot_id" to table: "vaccination_signups"
CREATE INDEX "idx_vaccination_signups_slot_id" ON "vaccination_signups" ("slot_id");
-- one name per day: "idx_vaccination_signups_day_name" to table: "vaccination_signups"
CREATE UNIQUE INDEX "idx_vaccination_signups_day_name" ON "vaccination_signups" ("day_id", "name_key");

-- +goose Down
DROP TABLE "vaccination_signups";
DROP TABLE "vaccination_slots";
DROP TABLE "vaccination_days";

-- +goose Up
-- create "computer_class_sessions" table
CREATE TABLE "computer_class_sessions" (
  "id" bigserial NOT NULL,
  "date" character varying(10) NOT NULL,
  "time_start" character varying(5) NOT NULL,
  "time_end" character varying(5) NOT NULL,
  "room" character varying(255) NOT NULL,
  "title" character varying(255) NOT NULL,
  "groups" character varying(255) NOT NULL DEFAULT '',
  "note" character varying(1024) NOT NULL DEFAULT '',
  "created_at" timestamptz NULL,
  "updated_at" timestamptz NULL,
  PRIMARY KEY ("id")
);
-- create index "idx_computer_class_sessions_date_room" to table: "computer_class_sessions"
CREATE INDEX "idx_computer_class_sessions_date_room" ON "computer_class_sessions" ("date", "room");

-- +goose Down
-- reverse: create "computer_class_sessions" table
DROP TABLE "computer_class_sessions";

-- +goose Up
-- The schedule tables used to be created by self-contained modules with their
-- own goose history (schedule_goose_db_version, schedulecollect_goose_db_version),
-- so on databases they already ran on the tables exist: create only if missing.
-- create "schedule_timetables" table
CREATE TABLE IF NOT EXISTS "schedule_timetables" (
  "id" character varying(64) NOT NULL,
  "program_id" character varying(64) NOT NULL,
  "course" integer NOT NULL,
  "title" character varying(255) NOT NULL,
  "semester_start" character varying(10) NOT NULL,
  "body" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL,
  PRIMARY KEY ("id")
);
-- create index "idx_schedule_timetables_program_course" to table: "schedule_timetables"
CREATE INDEX IF NOT EXISTS "idx_schedule_timetables_program_course" ON "schedule_timetables" ("program_id", "course");
-- create "schedule_collect_entries" table
CREATE TABLE IF NOT EXISTS "schedule_collect_entries" (
  "id" character varying(64) NOT NULL,
  "group_name" character varying(255) NOT NULL,
  "stud_in_lesson" integer NOT NULL,
  "day" integer NOT NULL,
  "les" integer NOT NULL,
  "aud" character varying(255) NOT NULL,
  "week" integer NOT NULL,
  "subg" integer NOT NULL,
  "name" character varying(255) NOT NULL,
  "caf_id" character varying(64) NOT NULL,
  "subject" character varying(255) NOT NULL,
  "subj_type" character varying(64) NOT NULL,
  "date" character varying(10) NOT NULL,
  "subj_caf_id" character varying(64) NOT NULL,
  "prep_id" character varying(64) NOT NULL,
  "themas" text NOT NULL DEFAULT '',
  "substitution_name" character varying(255) NOT NULL DEFAULT '',
  "substitution_prep_id" character varying(64) NOT NULL DEFAULT '',
  "substitution_subject" character varying(255) NOT NULL DEFAULT '',
  "substitution_subj_type" character varying(64) NOT NULL DEFAULT '',
  "substitution_subj_caf_id" character varying(64) NOT NULL DEFAULT '',
  "substitution_themas" text NOT NULL DEFAULT '',
  "created_at" timestamptz NOT NULL,
  PRIMARY KEY ("id")
);
-- create index "idx_schedulecollect_group_date" to table: "schedule_collect_entries"
CREATE INDEX IF NOT EXISTS "idx_schedulecollect_group_date" ON "schedule_collect_entries" ("group_name", "date");
-- drop the retired per-module migration histories
DROP TABLE IF EXISTS "schedule_goose_db_version";
DROP TABLE IF EXISTS "schedulecollect_goose_db_version";

-- +goose Down
-- reverse: create "schedule_collect_entries" table
DROP TABLE "schedule_collect_entries";
-- reverse: create "schedule_timetables" table
DROP TABLE "schedule_timetables";

-- +goose Up
-- create "test_sessions" table
CREATE TABLE "test_sessions" (
  "id" bigserial NOT NULL,
  "test_id" bigint NULL,
  "token" character varying(64) NOT NULL,
  "topic" character varying(255) NOT NULL,
  "department" character varying(255) NOT NULL DEFAULT '',
  "description" character varying(1024) NOT NULL DEFAULT '',
  "note" character varying(255) NOT NULL DEFAULT '',
  "duration_minutes" bigint NOT NULL,
  "question_count" bigint NOT NULL DEFAULT 0,
  "shuffle" boolean NOT NULL DEFAULT false,
  "show_result" boolean NOT NULL DEFAULT false,
  "is_open" boolean NOT NULL DEFAULT true,
  "closes_at" timestamptz NULL,
  "questions" jsonb NOT NULL,
  "created_at" timestamptz NULL,
  "updated_at" timestamptz NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_test_sessions_test" FOREIGN KEY ("test_id") REFERENCES "tests" ("id") ON UPDATE NO ACTION ON DELETE SET NULL
);
-- create index "idx_test_sessions_test_id" to table: "test_sessions"
CREATE INDEX "idx_test_sessions_test_id" ON "test_sessions" ("test_id");
-- create index "idx_test_sessions_token" to table: "test_sessions"
CREATE UNIQUE INDEX "idx_test_sessions_token" ON "test_sessions" ("token");
-- create "test_attempts" table
CREATE TABLE "test_attempts" (
  "id" bigserial NOT NULL,
  "session_id" bigint NOT NULL,
  "token" character varying(64) NOT NULL,
  "full_name" character varying(255) NOT NULL,
  "student_group" character varying(64) NOT NULL DEFAULT '',
  "seed" bigint NOT NULL,
  "status" smallint NOT NULL DEFAULT 1,
  "answers" jsonb NOT NULL,
  "score" bigint NOT NULL DEFAULT 0,
  "total" bigint NOT NULL DEFAULT 0,
  "started_at" timestamptz NOT NULL,
  "deadline" timestamptz NOT NULL,
  "finished_at" timestamptz NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_test_sessions_attempts" FOREIGN KEY ("session_id") REFERENCES "test_sessions" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- create index "idx_test_attempts_session_id" to table: "test_attempts"
CREATE INDEX "idx_test_attempts_session_id" ON "test_attempts" ("session_id");
-- create index "idx_test_attempts_token" to table: "test_attempts"
CREATE UNIQUE INDEX "idx_test_attempts_token" ON "test_attempts" ("token");

-- +goose Down
-- reverse: create index "idx_test_attempts_token" to table: "test_attempts"
DROP INDEX "idx_test_attempts_token";
-- reverse: create index "idx_test_attempts_session_id" to table: "test_attempts"
DROP INDEX "idx_test_attempts_session_id";
-- reverse: create "test_attempts" table
DROP TABLE "test_attempts";
-- reverse: create index "idx_test_sessions_token" to table: "test_sessions"
DROP INDEX "idx_test_sessions_token";
-- reverse: create index "idx_test_sessions_test_id" to table: "test_sessions"
DROP INDEX "idx_test_sessions_test_id";
-- reverse: create "test_sessions" table
DROP TABLE "test_sessions";

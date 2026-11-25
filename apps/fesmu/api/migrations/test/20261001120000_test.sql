-- +goose Up
-- create "tests" table
CREATE TABLE "tests" (
  "id" bigserial NOT NULL,
  "topic" character varying(255) NOT NULL,
  "description" character varying(1024) NOT NULL DEFAULT '',
  "created_at" timestamptz NULL,
  "updated_at" timestamptz NULL,
  PRIMARY KEY ("id")
);
-- create index "idx_tests_topic" to table: "tests"
CREATE INDEX "idx_tests_topic" ON "tests" ("topic");
-- create "test_questions" table
CREATE TABLE "test_questions" (
  "id" bigserial NOT NULL,
  "test_id" bigint NOT NULL,
  "position" bigint NOT NULL,
  "text" text NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_tests_questions" FOREIGN KEY ("test_id") REFERENCES "tests" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- create index "idx_test_questions_test_id" to table: "test_questions"
CREATE INDEX "idx_test_questions_test_id" ON "test_questions" ("test_id");
-- create "test_answers" table
CREATE TABLE "test_answers" (
  "id" bigserial NOT NULL,
  "question_id" bigint NOT NULL,
  "position" bigint NOT NULL,
  "text" text NOT NULL,
  "is_correct" boolean NOT NULL DEFAULT false,
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_test_questions_answers" FOREIGN KEY ("question_id") REFERENCES "test_questions" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- create index "idx_test_answers_question_id" to table: "test_answers"
CREATE INDEX "idx_test_answers_question_id" ON "test_answers" ("question_id");

-- +goose Down
-- reverse: create index "idx_test_answers_question_id" to table: "test_answers"
DROP INDEX "idx_test_answers_question_id";
-- reverse: create "test_answers" table
DROP TABLE "test_answers";
-- reverse: create index "idx_test_questions_test_id" to table: "test_questions"
DROP INDEX "idx_test_questions_test_id";
-- reverse: create "test_questions" table
DROP TABLE "test_questions";
-- reverse: create index "idx_tests_topic" to table: "tests"
DROP INDEX "idx_tests_topic";
-- reverse: create "tests" table
DROP TABLE "tests";

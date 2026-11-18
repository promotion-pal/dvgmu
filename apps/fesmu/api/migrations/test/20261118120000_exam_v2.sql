-- +goose Up
ALTER TABLE tests ADD COLUMN exam_settings jsonb NOT NULL DEFAULT '{}';
ALTER TABLE test_sessions ADD COLUMN exam_settings jsonb NOT NULL DEFAULT '{}';
ALTER TABLE test_attempts ADD COLUMN instruction_accepted_at timestamptz;
ALTER TABLE test_attempts ADD COLUMN events jsonb;
CREATE TABLE exam_v2_banks (id bigserial PRIMARY KEY, revision bigint NOT NULL DEFAULT 1, payload jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE exam_v2_variants (id bigserial PRIMARY KEY, bank_id bigint NOT NULL CONSTRAINT fk_exam_v2_variants_bank REFERENCES exam_v2_banks(id) ON DELETE CASCADE, test_id bigint CONSTRAINT fk_exam_v2_variants_test REFERENCES tests(id) ON DELETE SET NULL, title text NOT NULL, duration_minutes integer NOT NULL, show_result boolean NOT NULL);
CREATE INDEX idx_exam_v2_variants_bank_id ON exam_v2_variants(bank_id);
-- +goose Down
DROP TABLE exam_v2_variants;
DROP TABLE exam_v2_banks;
ALTER TABLE test_attempts DROP COLUMN events;
ALTER TABLE test_attempts DROP COLUMN instruction_accepted_at;
ALTER TABLE test_sessions DROP COLUMN exam_settings;
ALTER TABLE tests DROP COLUMN exam_settings;

-- +goose Up
ALTER TABLE test_sessions ADD COLUMN audience jsonb NOT NULL DEFAULT '{}';
ALTER TABLE test_attempts ADD COLUMN mdm_user_uuid varchar(36) NOT NULL DEFAULT '';
CREATE TABLE exam_assignments (
 id bigserial PRIMARY KEY,
 session_id bigint NOT NULL,
 mdm_user_uuid uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_test_sessions_assignments FOREIGN KEY(session_id) REFERENCES test_sessions(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX idx_exam_assignment_student ON exam_assignments(session_id,mdm_user_uuid);
CREATE INDEX idx_exam_assignments_mdm_user_uuid ON exam_assignments(mdm_user_uuid);

-- +goose Down
DROP TABLE exam_assignments;
ALTER TABLE test_attempts DROP COLUMN mdm_user_uuid;
ALTER TABLE test_sessions DROP COLUMN audience;

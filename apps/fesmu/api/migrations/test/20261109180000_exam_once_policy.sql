-- +goose Up
ALTER TABLE test_sessions ADD COLUMN exam_subject_key varchar(32) NOT NULL DEFAULT '';
UPDATE test_sessions s SET exam_subject_key =
 CASE WHEN btrim(t.discipline)='' THEN md5('legacy-test:' || t.id::text)
 ELSE md5(lower(btrim(regexp_replace(t.department,'[[:space:]]+',' ','g'))) || chr(31) || t.semester::text || chr(31) || lower(btrim(regexp_replace(t.discipline,'[[:space:]]+',' ','g')))) END
FROM tests t WHERE t.id=s.test_id;
UPDATE test_sessions SET exam_subject_key=md5('legacy-session:' || id::text) WHERE exam_subject_key='';
CREATE TABLE exam_participations (
 id bigserial PRIMARY KEY,
 mdm_user_uuid uuid NOT NULL,
 subject_key varchar(32) NOT NULL,
 attempt_id bigint,
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_exam_participations_attempt FOREIGN KEY(attempt_id) REFERENCES test_attempts(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX idx_exam_subject_student ON exam_participations(mdm_user_uuid,subject_key);
CREATE INDEX idx_exam_participations_attempt_id ON exam_participations(attempt_id);
-- Preserve already used entitlements, preferring a finished historical attempt.
INSERT INTO exam_participations(mdm_user_uuid,subject_key,attempt_id,created_at)
SELECT DISTINCT ON (a.mdm_user_uuid::uuid,s.exam_subject_key)
 a.mdm_user_uuid::uuid,s.exam_subject_key,a.id,a.started_at
FROM test_attempts a JOIN test_sessions s ON s.id=a.session_id
WHERE a.mdm_user_uuid ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
ORDER BY a.mdm_user_uuid::uuid,s.exam_subject_key,(a.status<>1) DESC,a.started_at,a.id;

-- +goose Down
DROP TABLE exam_participations;
ALTER TABLE test_sessions DROP COLUMN exam_subject_key;

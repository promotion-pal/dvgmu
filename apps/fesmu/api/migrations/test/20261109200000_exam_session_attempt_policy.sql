-- +goose Up
-- Rebuild the derived participation ledger from real attempts. Results and
-- assignments remain intact; orphaned subject limits must no longer block access.
ALTER TABLE exam_participations ADD COLUMN session_id bigint;
DELETE FROM exam_participations;
DROP INDEX idx_exam_subject_student;
ALTER TABLE exam_participations DROP COLUMN subject_key;
ALTER TABLE exam_participations ALTER COLUMN session_id SET NOT NULL;
ALTER TABLE exam_participations ADD CONSTRAINT fk_exam_participations_session
 FOREIGN KEY(session_id) REFERENCES test_sessions(id) ON DELETE CASCADE;
CREATE INDEX idx_exam_participations_session_id ON exam_participations(session_id);
CREATE UNIQUE INDEX idx_exam_session_student ON exam_participations(mdm_user_uuid,session_id);
INSERT INTO exam_participations(mdm_user_uuid,session_id,attempt_id,created_at)
SELECT DISTINCT ON (a.mdm_user_uuid::uuid,a.session_id)
 a.mdm_user_uuid::uuid,a.session_id,a.id,a.started_at
FROM test_attempts a JOIN test_sessions s ON s.id=a.session_id
WHERE a.mdm_user_uuid ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
ORDER BY a.mdm_user_uuid::uuid,a.session_id,(a.status<>1) DESC,a.started_at,a.id;
ALTER TABLE test_sessions DROP COLUMN exam_subject_key;

-- +goose Down
ALTER TABLE test_sessions ADD COLUMN exam_subject_key varchar(32) NOT NULL DEFAULT '';
UPDATE test_sessions s SET exam_subject_key =
 CASE WHEN btrim(t.discipline)='' THEN md5('legacy-test:' || t.id::text)
 ELSE md5(lower(btrim(regexp_replace(t.department,'[[:space:]]+',' ','g'))) || chr(31) || t.semester::text || chr(31) || lower(btrim(regexp_replace(t.discipline,'[[:space:]]+',' ','g')))) END
FROM tests t WHERE t.id=s.test_id;
UPDATE test_sessions SET exam_subject_key=md5('legacy-session:' || id::text) WHERE exam_subject_key='';
DELETE FROM exam_participations;
DROP INDEX idx_exam_session_student;
DROP INDEX idx_exam_participations_session_id;
ALTER TABLE exam_participations DROP CONSTRAINT fk_exam_participations_session;
ALTER TABLE exam_participations DROP COLUMN session_id;
ALTER TABLE exam_participations ADD COLUMN subject_key varchar(32) NOT NULL DEFAULT '';
CREATE UNIQUE INDEX idx_exam_subject_student ON exam_participations(mdm_user_uuid,subject_key);
INSERT INTO exam_participations(mdm_user_uuid,subject_key,attempt_id,created_at)
SELECT DISTINCT ON (a.mdm_user_uuid::uuid,s.exam_subject_key)
 a.mdm_user_uuid::uuid,s.exam_subject_key,a.id,a.started_at
FROM test_attempts a JOIN test_sessions s ON s.id=a.session_id
WHERE a.mdm_user_uuid ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
ORDER BY a.mdm_user_uuid::uuid,s.exam_subject_key,(a.status<>1) DESC,a.started_at,a.id;
ALTER TABLE exam_participations ALTER COLUMN subject_key DROP DEFAULT;

-- +goose Up
ALTER TABLE exam_assignments ADD COLUMN full_name varchar(255) NOT NULL DEFAULT '';
ALTER TABLE exam_assignments ADD COLUMN student_group varchar(64) NOT NULL DEFAULT '';
-- Recover historical recipient labels from the most recent known attempt.
UPDATE exam_assignments a SET full_name=known.full_name,student_group=known.student_group
FROM (
 SELECT DISTINCT ON (session_id,mdm_user_uuid) session_id,mdm_user_uuid,full_name,student_group
 FROM test_attempts WHERE mdm_user_uuid<>''
 ORDER BY session_id,mdm_user_uuid,started_at DESC,id DESC
) known
WHERE known.session_id=a.session_id AND lower(known.mdm_user_uuid)=a.mdm_user_uuid::text;

-- +goose Down
ALTER TABLE exam_assignments DROP COLUMN student_group;
ALTER TABLE exam_assignments DROP COLUMN full_name;

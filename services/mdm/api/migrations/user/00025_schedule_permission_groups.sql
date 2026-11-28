-- +goose Up
WITH groups AS (
    INSERT INTO user_permission_groups (name, description)
    VALUES
        ('Расписание: отдел расписания', 'Подготовка и публикация расписания, согласование изменений, отчёты и входящие сведения'),
        ('Расписание: отдел тестирования', 'Общая сетка расписания и подбор слотов для аттестации')
    ON CONFLICT (name) DO NOTHING
    RETURNING id, name
)
INSERT INTO user_permission_group_permissions (group_id, permission)
SELECT groups.id, rights.permission
FROM groups
JOIN (VALUES
    ('Расписание: отдел расписания', 'schedule.post'),
    ('Расписание: отдел расписания', 'schedule_drafts.post'),
    ('Расписание: отдел расписания', 'schedule_publication.post'),
    ('Расписание: отдел расписания', 'schedule_changes.post'),
    ('Расписание: отдел расписания', 'schedule_intake.fetch'),
    ('Расписание: отдел расписания', 'schedule_reports.fetch'),
    ('Расписание: отдел расписания', 'schedule_catalog.post'),
    ('Расписание: отдел тестирования', 'schedule_testing.fetch')
) AS rights(name, permission) USING (name);

-- +goose Down
SELECT 1;

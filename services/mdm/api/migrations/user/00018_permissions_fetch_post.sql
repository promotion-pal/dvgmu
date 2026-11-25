-- +goose Up
-- Права в единой схеме "раздел.fetch" (просмотр) / "раздел.post" (изменение,
-- включает просмотр). Прежние имена переводятся так, чтобы у людей и в
-- наборах доступа осталось ровно то, что было: раздел целиком — post,
-- журнал справок — certificate.fetch, выдача справок — certificate.post.
CREATE TEMP TABLE permission_rename (old VARCHAR(64), new VARCHAR(64)) ON COMMIT DROP;
INSERT INTO permission_rename (old, new) VALUES
    ('certificate.view', 'certificate.fetch'),
    ('certificate.issue', 'certificate.post'),
    ('infrastructure.view', 'infrastructure.post'),
    ('inventory.view', 'inventory.post'),
    ('tickets.view', 'tickets.post'),
    ('schedule.edit', 'schedule.post'),
    ('halls.manage', 'halls.post'),
    ('computer_classes.manage', 'computer_classes.post'),
    ('vaccination.manage', 'vaccination.post');

INSERT INTO user_permissions (user_id, permission)
SELECT p.user_id, r.new FROM user_permissions p JOIN permission_rename r ON r.old = p.permission
ON CONFLICT DO NOTHING;
DELETE FROM user_permissions WHERE permission IN (SELECT old FROM permission_rename);

INSERT INTO access_group_permissions (group_id, permission)
SELECT p.group_id, r.new FROM access_group_permissions p JOIN permission_rename r ON r.old = p.permission
ON CONFLICT DO NOTHING;
DELETE FROM access_group_permissions WHERE permission IN (SELECT old FROM permission_rename);

-- +goose Down
-- Обратно не переводится: прежние имена больше не понимает ни api, ни фронт.
SELECT 1;

-- +goose Up
DROP TABLE IF EXISTS access_group_departments;
ALTER TABLE access_groups RENAME TO user_permission_groups;
ALTER TABLE access_group_permissions RENAME TO user_permission_group_permissions;
ALTER TABLE user_access_groups RENAME TO user_permission_group_users;

ALTER INDEX IF EXISTS idx_user_access_groups_group RENAME TO idx_user_permission_group_users_group;

-- +goose Down
ALTER INDEX IF EXISTS idx_user_permission_group_users_group RENAME TO idx_user_access_groups_group;
ALTER TABLE user_permission_group_users RENAME TO user_access_groups;
ALTER TABLE user_permission_group_permissions RENAME TO access_group_permissions;
ALTER TABLE user_permission_groups RENAME TO access_groups;

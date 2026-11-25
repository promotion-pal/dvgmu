-- +goose Up
ALTER TABLE user_roles DROP CONSTRAINT user_roles_role_check;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_check CHECK (role IN (1, 2, 3, 4)); -- 4 = ADMIN

-- +goose Down
DELETE FROM user_roles WHERE role = 4;
ALTER TABLE user_roles DROP CONSTRAINT user_roles_role_check;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_check CHECK (role IN (1, 2, 3));

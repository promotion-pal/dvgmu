-- +goose Up
-- Права пользователя на отдельные действия (напр. certificate.view): роль
-- открывает раздел, право — действие внутри. Каталог прав ведёт приложение
-- (fesmu), здесь только формат "раздел.действие".
CREATE TABLE user_permissions (
    user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    permission VARCHAR(64) NOT NULL CHECK (permission ~ '^[a-z][a-z_]*\.[a-z][a-z_]*$'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, permission)
);

-- +goose Down
DROP TABLE user_permissions;

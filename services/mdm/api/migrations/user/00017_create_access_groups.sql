-- +goose Up
-- Наборы доступа: администратор собирает права ("раздел.действие") в набор
-- и выдаёт набор людям. Итоговые права человека — его собственные
-- (user_permissions) плюс права всех его наборов; правка набора сразу
-- действует у всех, кому он выдан.
CREATE TABLE access_groups (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE access_group_permissions (
    group_id BIGINT NOT NULL REFERENCES access_groups (id) ON DELETE CASCADE,
    permission VARCHAR(64) NOT NULL CHECK (permission ~ '^[a-z][a-z_]*\.[a-z][a-z_]*$'),
    PRIMARY KEY (group_id, permission)
);

CREATE TABLE user_access_groups (
    user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    group_id BIGINT NOT NULL REFERENCES access_groups (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, group_id)
);
CREATE INDEX idx_user_access_groups_group ON user_access_groups (group_id);

-- +goose Down
DROP TABLE user_access_groups;
DROP TABLE access_group_permissions;
DROP TABLE access_groups;

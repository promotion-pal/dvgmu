-- +goose Up
CREATE TABLE user_permissions (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission SMALLINT NOT NULL CHECK (permission IN (1, 2, 3, 4)),
    PRIMARY KEY (user_id, permission)
);

-- +goose Down
DROP TABLE user_permissions;

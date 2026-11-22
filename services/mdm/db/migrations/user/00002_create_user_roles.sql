-- +goose Up
CREATE TABLE user_roles (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role SMALLINT NOT NULL CHECK (role IN (1, 2, 3)),
    PRIMARY KEY (user_id, role)
);

-- +goose Down
DROP TABLE user_roles;

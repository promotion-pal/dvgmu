-- +goose Up
CREATE TABLE queues (
    code VARCHAR(64) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

-- +goose Down
DROP TABLE queues;

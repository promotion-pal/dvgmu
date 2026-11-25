-- +goose Up
CREATE TABLE task_registration_keys (
    author_id TEXT NOT NULL,
    key VARCHAR(128) NOT NULL,
    fingerprint TEXT NOT NULL,
    task_id BIGINT CONSTRAINT fk_task_registration_keys_task REFERENCES tasks(id) ON DELETE RESTRICT,
    PRIMARY KEY (author_id, key)
);

CREATE INDEX task_registration_keys_task_id_idx ON task_registration_keys (task_id);

-- +goose Down
DROP TABLE task_registration_keys;

-- +goose Up
CREATE TABLE queue_view_access (
    queue_code VARCHAR(64) NOT NULL,
    user_uuid UUID NOT NULL,
    PRIMARY KEY (queue_code, user_uuid),
    CONSTRAINT fk_queue_view_access_queue FOREIGN KEY (queue_code) REFERENCES queues (code) ON DELETE RESTRICT
);

-- +goose Down
DROP TABLE queue_view_access;

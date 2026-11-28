-- +goose Up
CREATE TABLE schedule_collect_batches (
    id UUID PRIMARY KEY,
    author_uuid UUID NOT NULL,
    payload_hash CHAR(64) NOT NULL,
    UNIQUE (author_uuid, id)
);

ALTER TABLE schedule_collect_entries
    ADD COLUMN batch_id UUID,
    ADD COLUMN batch_row INTEGER,
    ADD CONSTRAINT schedule_collect_batch_row CHECK (
        (batch_id IS NULL AND batch_row IS NULL)
        OR (batch_id IS NOT NULL AND author_uuid IS NOT NULL AND batch_row IS NOT NULL AND batch_row BETWEEN 1 AND 50)
    ),
    ADD CONSTRAINT schedule_collect_batch_fk
        FOREIGN KEY (author_uuid, batch_id) REFERENCES schedule_collect_batches (author_uuid, id),
    ADD CONSTRAINT schedule_collect_batch_row_unique UNIQUE (batch_id, batch_row);

-- +goose Down
ALTER TABLE schedule_collect_entries DROP COLUMN batch_row, DROP COLUMN batch_id;
DROP TABLE schedule_collect_batches;

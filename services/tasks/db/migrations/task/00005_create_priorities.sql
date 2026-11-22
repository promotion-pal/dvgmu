-- +goose Up
CREATE TABLE priorities (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(64) NOT NULL,
    name VARCHAR(150) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE UNIQUE INDEX priorities_code_key ON priorities (code);
CREATE INDEX priorities_sort_order_id_idx ON priorities (sort_order, id);

-- +goose Down
DROP TABLE priorities;

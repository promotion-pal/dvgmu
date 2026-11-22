-- +goose Up
CREATE TABLE statuses (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(64) NOT NULL,
    name VARCHAR(150) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    terminal BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE UNIQUE INDEX statuses_code_key ON statuses (code);
CREATE INDEX statuses_sort_order_id_idx ON statuses (sort_order, id);

-- +goose Down
DROP TABLE statuses;

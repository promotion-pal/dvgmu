-- +goose Up
CREATE TABLE services (
    id BIGSERIAL PRIMARY KEY,
    direction_id BIGINT NOT NULL CONSTRAINT fk_services_direction REFERENCES directions (id) ON DELETE RESTRICT,
    code VARCHAR(64) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE UNIQUE INDEX services_direction_code_key ON services (direction_id, code);
CREATE INDEX services_direction_id_idx ON services (direction_id, id);

-- +goose Down
DROP TABLE services;

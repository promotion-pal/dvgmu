-- +goose Up
CREATE TABLE militaries (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users (id) ON UPDATE CASCADE ON DELETE CASCADE,

    commissariat VARCHAR(255),
    vus_code VARCHAR(16),

    rank INTEGER NOT NULL,
    document INTEGER NOT NULL,
    validity INTEGER NOT NULL,

    has_deferment BOOLEAN NOT NULL DEFAULT false,
    deferment_expires_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);

CREATE INDEX idx_militaries_user_id ON militaries (user_id);

-- +goose Down
DROP TABLE militaries;

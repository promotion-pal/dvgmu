-- +goose Up
CREATE TABLE analytics (
    id BIGSERIAL PRIMARY KEY,
    qr BIGINT NOT NULL DEFAULT 0,
    name TEXT NOT NULL,
    transcript TEXT NOT NULL DEFAULT '',
    type SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE analytic_ratings (
    id BIGSERIAL PRIMARY KEY,
    analytic_id BIGINT NOT NULL REFERENCES analytics (id) ON DELETE CASCADE,
    comment TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- +goose Down
DROP TABLE analytic_ratings;
DROP TABLE analytics;

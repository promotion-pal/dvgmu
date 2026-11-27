-- +goose Up
CREATE TABLE terms (
    id text PRIMARY KEY,
    name text NOT NULL,
    date_from date NOT NULL,
    date_to date NOT NULL CHECK (date_to >= date_from),
    EXCLUDE USING gist (daterange(date_from, date_to, '[]') WITH &&)
);

CREATE TABLE subjects (
    id text PRIMARY KEY,
    name text NOT NULL
);
CREATE UNIQUE INDEX subjects_name_idx ON subjects (lower(name));

CREATE TABLE sites (
    id text PRIMARY KEY,
    name text NOT NULL,
    address text NOT NULL,
    meeting_point text NOT NULL DEFAULT '',
    clinical boolean NOT NULL DEFAULT false
);

CREATE TABLE rooms (
    id text PRIMARY KEY,
    site_id text NOT NULL REFERENCES sites (id),
    name text NOT NULL,
    capacity integer NOT NULL CHECK (capacity > 0),
    equipment jsonb,
    opens_at integer NOT NULL CHECK (opens_at BETWEEN 0 AND 1439),
    closes_at integer NOT NULL CHECK (closes_at BETWEEN opens_at + 1 AND 1440),
    UNIQUE (site_id, name)
);

CREATE TABLE academic_periods (
    id text PRIMARY KEY,
    term_id text NOT NULL REFERENCES terms (id),
    "group" text NOT NULL,
    subgroup text NOT NULL DEFAULT '',
    course integer NOT NULL CHECK (course > 0),
    type integer NOT NULL CHECK (type BETWEEN 1 AND 4),
    date_from date NOT NULL,
    date_to date NOT NULL CHECK (date_to >= date_from)
);

CREATE TABLE holidays (
    date date PRIMARY KEY,
    name text NOT NULL
);

CREATE TABLE travel_times (
    from_site_id text NOT NULL REFERENCES sites (id),
    to_site_id text NOT NULL REFERENCES sites (id),
    minutes integer NOT NULL CHECK (minutes > 0),
    PRIMARY KEY (from_site_id, to_site_id),
    CHECK (from_site_id <> to_site_id)
);

CREATE TABLE bookings (
    id text PRIMARY KEY,
    room_id text NOT NULL REFERENCES rooms (id),
    date date NOT NULL,
    start_minute integer NOT NULL CHECK (start_minute >= 0),
    duration_minutes integer NOT NULL CHECK (duration_minutes > 0 AND start_minute + duration_minutes <= 1440),
    title text NOT NULL,
    cancelled boolean NOT NULL DEFAULT false
);
CREATE INDEX bookings_active_date_idx ON bookings (date) WHERE NOT cancelled;

CREATE TABLE events (
    id text PRIMARY KEY,
    revision integer NOT NULL CHECK (revision > 0),
    status integer NOT NULL CHECK (status BETWEEN 1 AND 3),
    term_id text NOT NULL REFERENCES terms (id),
    subject_id text NOT NULL REFERENCES subjects (id),
    type integer NOT NULL CHECK (type BETWEEN 1 AND 11),
    audiences jsonb NOT NULL CHECK (jsonb_typeof(audiences) = 'array' AND jsonb_array_length(audiences) > 0),
    instructor_id text NOT NULL DEFAULT '',
    department text NOT NULL DEFAULT '',
    date date,
    start_minute integer,
    duration_minutes integer NOT NULL DEFAULT 0 CHECK (duration_minutes BETWEEN 0 AND 1440),
    room_id text REFERENCES rooms (id),
    meeting_point text NOT NULL DEFAULT '',
    expected_attendance integer NOT NULL DEFAULT 0 CHECK (expected_attendance >= 0),
    equipment jsonb,
    series_id text,
    change_type integer NOT NULL DEFAULT 0 CHECK (change_type BETWEEN 0 AND 4),
    author_id text NOT NULL,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    CHECK (start_minute IS NULL OR (date IS NOT NULL AND start_minute >= 0 AND duration_minutes > 0 AND start_minute + duration_minutes <= 1440)),
    CHECK (status = 1 OR (start_minute IS NOT NULL AND room_id IS NOT NULL))
);
CREATE INDEX events_date_status_idx ON events (date, status);
CREATE INDEX events_series_idx ON events (series_id) WHERE series_id IS NOT NULL;

CREATE TABLE changes (
    id text PRIMARY KEY,
    event_id text NOT NULL REFERENCES events (id),
    event_revision integer NOT NULL CHECK (event_revision > 0),
    type integer NOT NULL CHECK (type BETWEEN 1 AND 4),
    status integer NOT NULL CHECK (status BETWEEN 1 AND 3),
    before jsonb NOT NULL,
    after jsonb NOT NULL,
    reason text NOT NULL CHECK (length(trim(reason)) > 0),
    author_id text NOT NULL,
    submitted_at timestamptz NOT NULL,
    reviewer_id text NOT NULL DEFAULT '',
    decided_at timestamptz,
    decision text NOT NULL DEFAULT ''
);
CREATE INDEX changes_event_idx ON changes (event_id, submitted_at);
CREATE UNIQUE INDEX changes_pending_idx ON changes (event_id) WHERE status = 1;

-- +goose Down
DROP TABLE changes, events, bookings, travel_times, holidays, academic_periods, rooms, sites, subjects, terms;

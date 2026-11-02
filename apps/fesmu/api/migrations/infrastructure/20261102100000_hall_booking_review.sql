-- +goose Up
ALTER TABLE hall_bookings ADD COLUMN status varchar(16) NOT NULL DEFAULT 'APPROVED';
ALTER TABLE hall_bookings ADD COLUMN applicant_role varchar(64) NOT NULL DEFAULT '';
ALTER TABLE hall_bookings ADD COLUMN applicant_id varchar(64) NOT NULL DEFAULT '';
ALTER TABLE hall_bookings ADD COLUMN review_comment text NOT NULL DEFAULT '';
ALTER TABLE hall_bookings ADD COLUMN reviewed_by varchar(255) NOT NULL DEFAULT '';
ALTER TABLE hall_bookings ADD COLUMN reviewed_at timestamptz;

-- New requests wait for a reviewer; existing bookings already hold their slots.
-- +goose Down
ALTER TABLE hall_bookings DROP COLUMN reviewed_at, DROP COLUMN reviewed_by, DROP COLUMN review_comment, DROP COLUMN applicant_id, DROP COLUMN applicant_role, DROP COLUMN status;

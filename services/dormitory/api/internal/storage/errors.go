package storage

import (
	"errors"

	"github.com/jackc/pgx/v5/pgconn"
)

// Доменные конфликты записи на дежурство.
var (
	ErrDutySlotTaken  = errors.New("на этом этаже эта дата уже занята")
	ErrUserMonthTaken = errors.New("студент уже записан на дежурство в этом месяце")
)

// mapUniqueViolation переводит нарушение уникального индекса Postgres
// в доменную ошибку по имени индекса.
func mapUniqueViolation(err error) error {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != "23505" {
		return err
	}

	switch pgErr.ConstraintName {
	case "uq_dorm_reg_floor_date":
		return ErrDutySlotTaken
	case "uq_dorm_reg_user_month":
		return ErrUserMonthTaken
	default:
		return err
	}
}

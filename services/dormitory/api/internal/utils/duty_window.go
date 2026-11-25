package utils

import "time"

// Правила записи на дежурство (зеркалит site/src/shared/lib/duty-window.ts):
//   дежурство всегда назначается на следующий календарный месяц

// BookingBlockReason возвращает причину отказа в записи по правилам курса,
// либо "" если запись разрешена.
func BookingBlockReason(course int) string {
	if course < 1 || course > 6 {
		return "курс не определён — проверьте номер группы"
	}
	return ""
}

// NextMonth — первое число следующего месяца относительно t.
func NextMonth(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month()+1, 1, 0, 0, 0, 0, t.Location())
}

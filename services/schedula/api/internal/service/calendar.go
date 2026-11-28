package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"connectrpc.com/connect"

	"dvgmu/schedula/internal/domain/models"
	pb "fesmu/contract/schedula/entity"
	scheduleenum "fesmu/contract/schedula/enum"
)

func date(value string) (time.Time, error) {
	d, err := time.Parse(time.DateOnly, value)
	if err != nil || d.Year() < 1900 || d.Year() > 9999 {
		return time.Time{}, invalid("укажите дату в формате ГГГГ-ММ-ДД")
	}
	return d, nil
}

func dateRange(first, last string, maxDays int) (time.Time, time.Time, error) {
	from, err := date(first)
	if err != nil {
		return time.Time{}, time.Time{}, err
	}
	to, err := date(last)
	if err != nil {
		return time.Time{}, time.Time{}, err
	}
	if to.Before(from) || !to.Before(from.AddDate(0, 0, maxDays)) {
		return time.Time{}, time.Time{}, invalid(fmt.Sprintf("период должен содержать от 1 до %d дней", maxDays))
	}
	return from, to, nil
}

func monday(d time.Time) time.Time {
	return d.AddDate(0, 0, -(int(d.Weekday())+6)%7)
}

func academicWeek(d, termStart time.Time) int32 {
	return int32(monday(d).Sub(monday(termStart))/(7*24*time.Hour)) + 1
}

func (s *Service) weekInRange(ctx context.Context, from, to time.Time) (int32, error) {
	term, err := s.store.FirstTermInRange(ctx, from, to)
	if err != nil || term.DateFrom.IsZero() {
		return 0, err
	}
	if from.Before(term.DateFrom) {
		from = term.DateFrom
	}
	return academicWeek(from, term.DateFrom), nil
}

func scheduleRange(filter *pb.ScheduleFilter, now time.Time) (time.Time, time.Time, error) {
	from, to := filter.GetDateFrom(), filter.GetDateTo()
	if from == "" && to == "" {
		today, _ := date(now.Format(time.DateOnly))
		start := monday(today)
		return start, start.AddDate(0, 0, 6), nil
	}
	if to == "" {
		to = from
	}
	return dateRange(from, to, 370)
}

func expand(event models.Event, series *pb.Series, term models.Term) ([]models.Event, error) {
	if series == nil {
		return []models.Event{event}, nil
	}
	if event.Date == nil || series.Recurrence < scheduleenum.Recurrence_RECURRENCE_WEEKLY || series.Recurrence > scheduleenum.Recurrence_RECURRENCE_EVEN || len(series.Slots) == 0 || len(series.Slots) > 14 {
		return nil, invalid("укажите даты, повторение и время серии")
	}
	from, to, err := dateRange(event.Date.Format(time.DateOnly), series.DateTo, 370)
	if err != nil {
		return nil, err
	}
	if from.Before(term.DateFrom) || to.After(term.DateTo) {
		return nil, invalid("серия выходит за границы семестра")
	}
	for i, slot := range series.Slots {
		if slot.GetWeekday() < 1 || slot.GetWeekday() > 7 || !validTime(slot.GetStartMinute(), slot.GetDurationMinutes()) {
			return nil, invalid("некорректное время в серии")
		}
		for _, previous := range series.Slots[:i] {
			if previous.Weekday == slot.Weekday && intersects(
				previous.StartMinute, previous.StartMinute+previous.DurationMinutes,
				slot.StartMinute, slot.StartMinute+slot.DurationMinutes,
			) {
				return nil, invalid("в один день недели занятия серии пересекаются")
			}
		}
	}

	seriesID := event.ID
	events := make([]models.Event, 0)
	for d := from; !d.After(to); d = d.AddDate(0, 0, 1) {
		week := academicWeek(d, term.DateFrom)
		if (series.Recurrence == scheduleenum.Recurrence_RECURRENCE_ODD && week%2 == 0) ||
			(series.Recurrence == scheduleenum.Recurrence_RECURRENCE_EVEN && week%2 != 0) {
			continue
		}
		for _, slot := range series.Slots {
			if slot.Weekday != int32((int(d.Weekday())+6)%7+1) {
				continue
			}
			copy := event
			copy.ID = newID()
			copy.Date, copy.StartMinute = &d, &slot.StartMinute
			copy.DurationMinutes, copy.SeriesID = slot.DurationMinutes, &seriesID
			events = append(events, copy)
		}
	}
	if len(events) == 0 || len(events) > 370 {
		return nil, invalid("серия должна содержать от 1 до 370 занятий")
	}
	return events, nil
}

func (c catalog) periodProblem(event models.Event, audience models.Audience) string {
	period, overlap := c.periodOn(event.TermID, audience.Group, audience.Subgroup, *event.Date)
	if period == 0 && audience.Subgroup != "" {
		period, overlap = c.periodOn(event.TermID, audience.Group, "", *event.Date)
	}
	if overlap {
		return "проверка учебного периода невозможна, в графике пересекаются даты"
	}
	switch period {
	case scheduleenum.PeriodType_PERIOD_TYPE_PRACTICE:
		switch event.Type {
		case scheduleenum.EventType_EVENT_TYPE_PRACTICE, scheduleenum.EventType_EVENT_TYPE_CLINICAL_CYCLE:
			return ""
		}
		return "в этот день по учебному графику проходит практика"
	case scheduleenum.PeriodType_PERIOD_TYPE_EXAMS:
		switch event.Type {
		case scheduleenum.EventType_EVENT_TYPE_EXAM, scheduleenum.EventType_EVENT_TYPE_CONSULTATION, scheduleenum.EventType_EVENT_TYPE_RETAKE,
			scheduleenum.EventType_EVENT_TYPE_GIA, scheduleenum.EventType_EVENT_TYPE_COMPUTER_CLASS_TEST:
			return ""
		}
		return "в этот день по учебному графику проходит сессия"
	case scheduleenum.PeriodType_PERIOD_TYPE_HOLIDAYS:
		return "в этот день по учебному графику каникулы"
	}
	return ""
}

func (c catalog) periodOn(term, group, subgroup string, day time.Time) (scheduleenum.PeriodType, bool) {
	var found scheduleenum.PeriodType
	for _, period := range c.periods[[3]string{term, group, subgroup}] {
		if day.Before(period.DateFrom) || day.After(period.DateTo) {
			continue
		}
		if found != 0 {
			return found, true
		}
		found = period.Type
	}
	return found, false
}

func invalid(message string) error {
	return connect.NewError(connect.CodeInvalidArgument, errors.New(message))
}

package models

import (
	"fmt"
	"regexp"
	"strings"
	"time"

	entity "fesmu/contract/fesmu/entity/v1"
	enum "fesmu/contract/fesmu/enum/v1"
)

var scheduleClockRe = regexp.MustCompile(`^([01]?\d|2[0-3]):[0-5]\d$`)

// ScheduleValidate checks a timetable as a whole: required fields, formats and the
// references between its parts (slots, groups, subjects, or lectures and
// cycles for a cycle-based one). It returns the first problem found, worded
// for the person filling the form in.
func ScheduleValidate(t *entity.ScheduleTimetable) error {
	if t == nil {
		return scheduleInvalid("расписание не передано")
	}
	if strings.TrimSpace(t.GetTitle()) == "" {
		return scheduleInvalid("укажите название расписания")
	}
	if p := t.GetProgram(); p == nil || strings.TrimSpace(p.GetId()) == "" || strings.TrimSpace(p.GetName()) == "" {
		return scheduleInvalid("укажите специальность (идентификатор и название)")
	}
	if t.GetCourse() < 1 {
		return scheduleInvalid("курс должен быть не меньше 1")
	}

	sem := t.GetSemester()
	if sem == nil || strings.TrimSpace(sem.GetLabel()) == "" {
		return scheduleInvalid("укажите название семестра")
	}
	start, err := scheduleParseDate(sem.GetStart())
	if err != nil {
		return scheduleInvalid("начало семестра: %v", err)
	}
	end, err := scheduleParseDate(sem.GetEnd())
	if err != nil {
		return scheduleInvalid("конец семестра: %v", err)
	}
	if end.Before(start) {
		return scheduleInvalid("семестр заканчивается раньше, чем начинается")
	}

	groups, err := scheduleUniqueGroups(t.GetGroups())
	if err != nil {
		return err
	}
	subjects, err := scheduleValidateSubjects(t.GetSubjects())
	if err != nil {
		return err
	}

	if t.GetFormat() == enum.ScheduleFormat_SCHEDULE_FORMAT_CYCLES {
		if len(t.GetEntries()) > 0 {
			return scheduleInvalid("в расписании циклами занятия задаются циклами и лекциями, а не сеткой пар")
		}
		if err := scheduleValidateLectures(t.GetLectures(), groups, subjects); err != nil {
			return err
		}
		if err := scheduleValidateCycles(t.GetCycles(), groups, subjects); err != nil {
			return err
		}
	} else {
		if len(t.GetLectures()) > 0 || len(t.GetCycles()) > 0 {
			return scheduleInvalid("лекции по датам и циклы бывают только в расписании циклами")
		}
		slotIndex, err := scheduleValidateSlots(t.GetSlots())
		if err != nil {
			return err
		}
		if err := scheduleValidateEntries(t.GetEntries(), groups, slotIndex, len(t.GetSlots()), subjects); err != nil {
			return err
		}
	}
	return scheduleValidatePeriods(t.GetPeriods())
}

func scheduleValidateLectures(list []*entity.ScheduleLecture, groups, subjects map[string]bool) error {
	seen := make(map[string]bool, len(list))
	for i, l := range list {
		n := i + 1
		if strings.TrimSpace(l.GetId()) == "" {
			return scheduleInvalid("лекция №%d: пустой идентификатор", n)
		}
		if seen[l.GetId()] {
			return scheduleInvalid("лекция №%d: идентификатор %q повторяется", n, l.GetId())
		}
		seen[l.GetId()] = true

		if !subjects[l.GetSubjectId()] {
			return scheduleInvalid("лекция №%d: предмета %q нет в списке", n, l.GetSubjectId())
		}
		if !scheduleClockRe.MatchString(l.GetStart()) || !scheduleClockRe.MatchString(l.GetEnd()) {
			return scheduleInvalid("лекция №%d: время должно быть в формате ЧЧ:ММ", n)
		}
		if scheduleMinutes(l.GetEnd()) <= scheduleMinutes(l.GetStart()) {
			return scheduleInvalid("лекция №%d заканчивается раньше, чем начинается", n)
		}
		if len(l.GetDates()) == 0 {
			return scheduleInvalid("лекция №%d: укажите хотя бы одну дату", n)
		}
		for _, d := range l.GetDates() {
			if _, err := scheduleParseDate(d); err != nil {
				return scheduleInvalid("лекция №%d: дата %q: %v", n, d, err)
			}
		}
		if !l.GetRemote() && strings.TrimSpace(l.GetRoom()) == "" {
			return scheduleInvalid("лекция №%d: укажите аудиторию или отметьте, что она с применением ДОТ", n)
		}
		for _, g := range l.GetGroupIds() {
			if !groups[g] {
				return scheduleInvalid("лекция №%d: группы %q нет в расписании", n, g)
			}
		}
	}
	return nil
}

func scheduleValidateCycles(list []*entity.ScheduleCycle, groups, subjects map[string]bool) error {
	seen := make(map[string]bool, len(list))
	for i, c := range list {
		n := i + 1
		if strings.TrimSpace(c.GetId()) == "" {
			return scheduleInvalid("цикл №%d: пустой идентификатор", n)
		}
		if seen[c.GetId()] {
			return scheduleInvalid("цикл №%d: идентификатор %q повторяется", n, c.GetId())
		}
		seen[c.GetId()] = true

		if !subjects[c.GetSubjectId()] {
			return scheduleInvalid("цикл №%d: предмета %q нет в списке", n, c.GetSubjectId())
		}
		if len(c.GetGroupIds()) == 0 {
			return scheduleInvalid("цикл №%d: выберите хотя бы одну группу", n)
		}
		for _, g := range c.GetGroupIds() {
			if !groups[g] {
				return scheduleInvalid("цикл №%d: группы %q нет в расписании", n, g)
			}
		}
		from, err := scheduleParseDate(c.GetFrom())
		if err != nil {
			return scheduleInvalid("цикл №%d, начало: %v", n, err)
		}
		to, err := scheduleParseDate(c.GetTo())
		if err != nil {
			return scheduleInvalid("цикл №%d, конец: %v", n, err)
		}
		if to.Before(from) {
			return scheduleInvalid("цикл №%d заканчивается раньше, чем начинается", n)
		}
	}
	return nil
}

func scheduleUniqueGroups(list []string) (map[string]bool, error) {
	if len(list) == 0 {
		return nil, scheduleInvalid("добавьте хотя бы одну группу")
	}
	seen := make(map[string]bool, len(list))
	for _, g := range list {
		if strings.TrimSpace(g) == "" {
			return nil, scheduleInvalid("название группы не может быть пустым")
		}
		if seen[g] {
			return nil, scheduleInvalid("группа %q указана дважды", g)
		}
		seen[g] = true
	}
	return seen, nil
}

// scheduleValidateSlots returns each slot id's position, since an entry's span is
// counted in consecutive slots.
func scheduleValidateSlots(slots []*entity.ScheduleSlot) (map[string]int, error) {
	if len(slots) == 0 {
		return nil, scheduleInvalid("добавьте хотя бы одну пару в сетку времени")
	}
	index := make(map[string]int, len(slots))
	for i, s := range slots {
		if strings.TrimSpace(s.GetId()) == "" {
			return nil, scheduleInvalid("пара №%d: пустой идентификатор", i+1)
		}
		if _, dup := index[s.GetId()]; dup {
			return nil, scheduleInvalid("пара %q указана дважды", s.GetId())
		}
		if !scheduleClockRe.MatchString(s.GetStart()) || !scheduleClockRe.MatchString(s.GetEnd()) {
			return nil, scheduleInvalid("пара №%d: время должно быть в формате ЧЧ:ММ", i+1)
		}
		if scheduleMinutes(s.GetEnd()) <= scheduleMinutes(s.GetStart()) {
			return nil, scheduleInvalid("пара №%d заканчивается раньше, чем начинается", i+1)
		}
		index[s.GetId()] = i
	}
	return index, nil
}

func scheduleValidateSubjects(list []*entity.ScheduleSubject) (map[string]bool, error) {
	seen := make(map[string]bool, len(list))
	for _, s := range list {
		if strings.TrimSpace(s.GetId()) == "" || strings.TrimSpace(s.GetName()) == "" {
			return nil, scheduleInvalid("у каждого предмета должны быть идентификатор и название")
		}
		if seen[s.GetId()] {
			return nil, scheduleInvalid("предмет %q указан дважды", s.GetName())
		}
		seen[s.GetId()] = true
	}
	return seen, nil
}

func scheduleValidateEntries(
	entries []*entity.ScheduleEntry,
	groups map[string]bool,
	slotIndex map[string]int,
	slotCount int,
	subjects map[string]bool,
) error {
	seen := make(map[string]bool, len(entries))
	for i, e := range entries {
		n := i + 1
		if strings.TrimSpace(e.GetId()) == "" {
			return scheduleInvalid("занятие №%d: пустой идентификатор", n)
		}
		if seen[e.GetId()] {
			return scheduleInvalid("занятие №%d: идентификатор %q повторяется", n, e.GetId())
		}
		seen[e.GetId()] = true

		if e.GetWeekday() < 1 || e.GetWeekday() > 7 {
			return scheduleInvalid("занятие №%d: день недели должен быть от 1 до 7", n)
		}
		pos, ok := slotIndex[e.GetSlotId()]
		if !ok {
			return scheduleInvalid("занятие №%d: пары %q нет в сетке времени", n, e.GetSlotId())
		}
		if e.GetSpan() < 0 {
			return scheduleInvalid("занятие №%d: длительность не может быть отрицательной", n)
		}
		if span := max(int(e.GetSpan()), 1); pos+span > slotCount {
			return scheduleInvalid("занятие №%d выходит за последнюю пару сетки", n)
		}
		if !subjects[e.GetSubjectId()] {
			return scheduleInvalid("занятие №%d: предмета %q нет в списке", n, e.GetSubjectId())
		}
		if len(e.GetGroupIds()) == 0 {
			return scheduleInvalid("занятие №%d: выберите хотя бы одну группу", n)
		}
		for _, g := range e.GetGroupIds() {
			if !groups[g] {
				return scheduleInvalid("занятие №%d: группы %q нет в расписании", n, g)
			}
		}
		if s := e.GetStartsAt(); s != "" && !scheduleClockRe.MatchString(s) {
			return scheduleInvalid("занятие №%d: время начала должно быть в формате ЧЧ:ММ", n)
		}
		if e.GetHours() < 0 || e.GetTotal() < 0 {
			return scheduleInvalid("занятие №%d: часы и количество занятий не могут быть отрицательными", n)
		}
		for _, d := range e.GetDates() {
			if _, err := scheduleParseDate(d); err != nil {
				return scheduleInvalid("занятие №%d: дата %q: %v", n, d, err)
			}
		}
	}
	return nil
}

func scheduleValidatePeriods(list []*entity.SchedulePeriod) error {
	for i, p := range list {
		n := i + 1
		if strings.TrimSpace(p.GetLabel()) == "" {
			return scheduleInvalid("период №%d: укажите название", n)
		}
		if p.GetKind() == enum.SchedulePeriodKind_SCHEDULE_PERIOD_KIND_UNSPECIFIED {
			return scheduleInvalid("период №%d: укажите тип", n)
		}
		from, err := scheduleParseDate(p.GetFrom())
		if err != nil {
			return scheduleInvalid("период №%d, начало: %v", n, err)
		}
		to, err := scheduleParseDate(p.GetTo())
		if err != nil {
			return scheduleInvalid("период №%d, конец: %v", n, err)
		}
		if to.Before(from) {
			return scheduleInvalid("период №%d заканчивается раньше, чем начинается", n)
		}
	}
	return nil
}

// ScheduleNormalize fills the defaults the contract leaves implicit, so what is stored
// never carries an "unspecified" enum or a zero span.
func ScheduleNormalize(t *entity.ScheduleTimetable) {
	if t.GetFormat() == enum.ScheduleFormat_SCHEDULE_FORMAT_UNSPECIFIED {
		t.Format = enum.ScheduleFormat_SCHEDULE_FORMAT_WEEKLY
	}
	for _, e := range t.GetEntries() {
		if e.GetKind() == enum.ScheduleEntryKind_SCHEDULE_ENTRY_KIND_UNSPECIFIED {
			e.Kind = enum.ScheduleEntryKind_SCHEDULE_ENTRY_KIND_PRACTICE
		}
		if e.GetWeeks() == enum.ScheduleWeeks_SCHEDULE_WEEKS_UNSPECIFIED {
			e.Weeks = enum.ScheduleWeeks_SCHEDULE_WEEKS_EVERY
		}
		if e.GetSpan() < 1 {
			e.Span = 1
		}
	}
}

func scheduleParseDate(s string) (time.Time, error) {
	d, err := time.Parse("2006-01-02", s)
	if err != nil {
		return time.Time{}, fmt.Errorf("дата должна быть в формате ГГГГ-ММ-ДД")
	}
	return d, nil
}

func scheduleMinutes(clock string) int {
	var h, m int
	fmt.Sscanf(clock, "%d:%d", &h, &m)
	return h*60 + m
}

func scheduleInvalid(format string, args ...any) error {
	return fmt.Errorf("%w: %s", ErrScheduleInvalid, fmt.Sprintf(format, args...))
}

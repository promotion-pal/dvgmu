package service

import (
	"context"
	"errors"
	"slices"

	"gorm.io/gorm"

	"dvgmu/schedula/internal/domain/models"
	"dvgmu/schedula/internal/storage"
	pb "fesmu/contract/schedula/entity"
	scheduleenum "fesmu/contract/schedula/enum"
)

type Group struct {
	Code   string
	Course int32
	Count  int32
}

type GroupsFetch func(context.Context) ([]Group, error)

func (s *Service) Completeness(ctx context.Context, termID string) ([]*pb.CompletenessGap, error) {
	term, err := s.store.Term(ctx, termID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, invalid("выберите семестр")
	}
	if err != nil {
		return nil, err
	}
	groups, err := s.groups(ctx)
	if err != nil {
		return nil, err
	}
	events, err := s.store.TermEvents(ctx, term)
	if err != nil {
		return nil, err
	}
	periods, err := s.store.Periods(ctx, term.DateFrom, term.DateTo)
	if err != nil {
		return nil, err
	}
	holidays, err := s.store.Holidays(ctx, term.DateFrom, term.DateTo)
	if err != nil {
		return nil, err
	}
	c := catalogFromRows(storage.Catalog{Holidays: holidays})
	assigned := make(map[models.Audience]bool)
	assignedCourses := make(map[int32]bool)
	var gaps []*pb.CompletenessGap
	for _, event := range events {
		before := len(gaps)
		addEventGap := func(kind scheduleenum.CompletenessGapType) {
			gaps = append(gaps, &pb.CompletenessGap{Type: kind, Event: eventProto(event, c)})
		}
		if !event.Timed() {
			addEventGap(scheduleenum.CompletenessGapType_COMPLETENESS_GAP_TYPE_TIME)
		}
		if event.RoomID == nil {
			addEventGap(scheduleenum.CompletenessGapType_COMPLETENESS_GAP_TYPE_ROOM)
		}
		if missingInstructor(event) {
			addEventGap(scheduleenum.CompletenessGapType_COMPLETENESS_GAP_TYPE_INSTRUCTOR)
		}
		if missingClinicalDetails(event) {
			addEventGap(scheduleenum.CompletenessGapType_COMPLETENESS_GAP_TYPE_CLINICAL_DETAILS)
		}
		if len(gaps) != before || c.holidays[*event.Date] != "" {
			continue
		}
		for _, a := range event.Audiences {
			assignedCourses[a.Course] = true
			assigned[a] = true
			assigned[models.Audience{Group: a.Group, Course: a.Course}] = true
		}
	}
	seenCourses := make(map[int32]bool)
	seenGroups := make(map[models.Audience]bool)
	add := func(kind scheduleenum.CompletenessGapType, a models.Audience) {
		gaps = append(gaps, &pb.CompletenessGap{Type: kind, Audience: &pb.Audience{Group: a.Group, Subgroup: a.Subgroup, Course: a.Course}})
	}
	for _, group := range groups {
		if group.Code == "" || group.Course == 0 {
			continue
		}
		a := models.Audience{Group: group.Code, Course: group.Course}
		if !seenCourses[group.Course] && !assignedCourses[group.Course] {
			add(scheduleenum.CompletenessGapType_COMPLETENESS_GAP_TYPE_COURSE, models.Audience{Course: group.Course})
		}
		seenCourses[group.Course] = true
		if !seenGroups[a] && !assigned[a] {
			add(scheduleenum.CompletenessGapType_COMPLETENESS_GAP_TYPE_GROUP, a)
		}
		seenGroups[a] = true
	}
	for _, p := range periods {
		a := models.Audience{Group: p.Group, Subgroup: p.Subgroup, Course: p.Course}
		if p.TermID == termID && p.Subgroup != "" && !seenGroups[a] && !assigned[a] {
			add(scheduleenum.CompletenessGapType_COMPLETENESS_GAP_TYPE_SUBGROUP, a)
			seenGroups[a] = true
		}
	}
	return gaps, nil
}

func attendance(event models.Event, groups []Group) models.Event {
	if slices.ContainsFunc(event.Audiences, func(a models.Audience) bool { return a.Subgroup != "" }) {
		return event
	}
	var count int32
	for _, a := range event.Audiences {
		var groupCount int32
		for _, group := range groups {
			if group.Code == a.Group && (group.Course == 0 || group.Course == a.Course) {
				groupCount += group.Count
			}
		}
		if groupCount == 0 {
			return event
		}
		count += groupCount
	}
	event.ExpectedAttendance = count
	return event
}

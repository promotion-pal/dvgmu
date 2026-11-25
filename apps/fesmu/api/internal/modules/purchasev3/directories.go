package purchasev3

import (
	"context"
	"strings"
)

// Directories the route follows, kept by whoever has DIRECTORIES: which
// direction each department belongs to, who on the portal each vice-rector
// is, which department carries out each kind of purchase.

func (s *Service) requireDirectories(ctx context.Context) error {
	a, err := s.begin(ctx)
	if err != nil {
		return err
	}
	if !a.can(permDirectories) {
		return needPerm(permDirectories)
	}
	return nil
}

type curatorInput struct {
	id                                                int64
	title, shortTitle, personName, userUUID, userName string
	sortOrder                                         int32
}

func (s *Service) CuratorSave(ctx context.Context, in curatorInput) (int64, error) {
	if err := s.requireDirectories(ctx); err != nil {
		return 0, err
	}
	in.title, in.shortTitle, in.personName = strings.TrimSpace(in.title), strings.TrimSpace(in.shortTitle), strings.TrimSpace(in.personName)
	in.userUUID, in.userName = strings.TrimSpace(in.userUUID), strings.TrimSpace(in.userName)
	switch {
	case in.title == "" || tooLong(in.title, 255):
		return 0, invalid("укажите должность проректора (до 255 символов)")
	case tooLong(in.shortTitle, 64) || tooLong(in.personName, 255) || tooLong(in.userUUID, 64):
		return 0, invalid("краткое название или ФИО слишком длинные")
	}
	c := &Curator{}
	if in.id != 0 {
		found, err := s.store.curator(ctx, in.id)
		if err != nil {
			return 0, err
		}
		c = found
	}
	c.Title, c.ShortTitle, c.PersonName, c.SortOrder = in.title, in.shortTitle, in.personName, in.sortOrder
	c.UserUUID, c.UserName = in.userUUID, cut(in.userName, 255)
	if c.UserUUID == "" {
		c.UserName = ""
	}
	if err := s.store.saveCurator(ctx, c); err != nil {
		return 0, err
	}
	return c.ID, nil
}

func (s *Service) CuratorDelete(ctx context.Context, id int64) error {
	if err := s.requireDirectories(ctx); err != nil {
		return err
	}
	used, err := s.store.curatorInUse(ctx, id)
	if err != nil {
		return err
	}
	if used {
		return wrongState("к направлению отнесены отделы, заявки или закупки — сначала перенесите их")
	}
	return s.store.deleteCurator(ctx, id)
}

func (s *Service) DepartmentSave(ctx context.Context, department int32, curatorID int64) error {
	if err := s.requireDirectories(ctx); err != nil {
		return err
	}
	d, err := s.store.department(ctx, department)
	if err != nil {
		return err
	}
	d.CuratorID = nil
	if curatorID != 0 {
		if _, err := s.store.curator(ctx, curatorID); err != nil {
			return err
		}
		d.CuratorID = &curatorID
	}
	return s.store.saveDepartment(ctx, d)
}

type categoryInput struct {
	id           int64
	name, okpd2  string
	implementing int32
}

func (s *Service) CategorySave(ctx context.Context, in categoryInput) (int64, error) {
	if err := s.requireDirectories(ctx); err != nil {
		return 0, err
	}
	in.name, in.okpd2 = strings.TrimSpace(in.name), strings.TrimSpace(in.okpd2)
	switch {
	case in.name == "" || tooLong(in.name, 255):
		return 0, invalid("укажите название вида закупок (до 255 символов)")
	case in.okpd2 == "" || tooLong(in.okpd2, 32):
		return 0, invalid("укажите начало кода ОКПД2, например 26.20")
	}
	if _, err := s.store.department(ctx, in.implementing); err != nil {
		return 0, err
	}
	c := &Category{ID: in.id, Name: in.name, Okpd2Prefix: in.okpd2, ImplementingDepartment: in.implementing}
	if err := s.store.saveCategory(ctx, c); err != nil {
		return 0, err
	}
	return c.ID, nil
}

func (s *Service) CategoryDelete(ctx context.Context, id int64) error {
	if err := s.requireDirectories(ctx); err != nil {
		return err
	}
	return s.store.deleteCategory(ctx, id)
}

package purchase

import (
	"context"
	"strings"

	"dvgmu/api/internal/auth"
)

// Directories the flow routes by, kept by the administrator: who each
// vice-rector is on the portal, which vice-rector is over each department,
// which department carries out each category of purchase.

func (s *Service) requireAdmin(ctx context.Context) error {
	if err := s.ready(); err != nil {
		return err
	}
	return auth.RequireRole(ctx)
}

type curatorInput struct {
	id                                 int64
	name, position, userUUID, userName string
}

func (s *Service) CuratorSave(ctx context.Context, in curatorInput) (int64, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return 0, err
	}
	in.name, in.position = strings.TrimSpace(in.name), strings.TrimSpace(in.position)
	in.userUUID, in.userName = strings.TrimSpace(in.userUUID), strings.TrimSpace(in.userName)
	if in.name == "" || tooLong(in.name, 255) || tooLong(in.position, 255) || tooLong(in.userUUID, 64) {
		return 0, invalid("укажите название проректора (до 255 символов)")
	}
	c := &Curator{ID: in.id}
	if in.id != 0 {
		found, err := s.store.curator(ctx, in.id)
		if err != nil {
			return 0, err
		}
		c = found
	}
	if in.userUUID != "" {
		bound, err := s.store.curatorByUser(ctx, in.userUUID)
		if err != nil {
			return 0, err
		}
		if bound != 0 && bound != c.ID {
			return 0, invalid("этот пользователь уже привязан к другому проректору")
		}
	}
	c.Name, c.Position, c.UserUUID, c.UserName = in.name, in.position, in.userUUID, cut(in.userName, 255)
	if err := s.store.saveCurator(ctx, c); err != nil {
		return 0, err
	}
	return c.ID, nil
}

func (s *Service) DepartmentSave(ctx context.Context, department int32, curatorID int64) error {
	if err := s.requireAdmin(ctx); err != nil {
		return err
	}
	d, err := s.store.department(ctx, department)
	if err != nil {
		return err
	}
	if curatorID != 0 {
		if _, err := s.store.curator(ctx, curatorID); err != nil {
			return err
		}
	}
	d.CuratorID = curatorPtr(curatorID)
	return s.store.saveDepartment(ctx, d)
}

type categoryInput struct {
	id          int64
	name, okpd2 string
	department  int32
}

func (s *Service) CategorySave(ctx context.Context, in categoryInput) (int64, error) {
	if err := s.requireAdmin(ctx); err != nil {
		return 0, err
	}
	in.name, in.okpd2 = strings.TrimSpace(in.name), strings.TrimSpace(in.okpd2)
	switch {
	case in.name == "" || tooLong(in.name, 255):
		return 0, invalid("укажите название категории (до 255 символов)")
	case in.okpd2 == "" || tooLong(in.okpd2, 32):
		return 0, invalid("укажите начало кода ОКПД2, например 26.20")
	}
	if _, err := s.store.department(ctx, in.department); err != nil {
		return 0, err
	}
	c := &Category{ID: in.id, Name: in.name, Okpd2Prefix: in.okpd2, Department: in.department}
	if err := s.store.saveCategory(ctx, c); err != nil {
		return 0, err
	}
	return c.ID, nil
}

func (s *Service) CategoryDelete(ctx context.Context, id int64) error {
	if err := s.requireAdmin(ctx); err != nil {
		return err
	}
	return s.store.deleteCategory(ctx, id)
}

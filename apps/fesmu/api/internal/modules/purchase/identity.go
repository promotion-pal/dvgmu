package purchase

import (
	"context"
	"strings"
	"sync"
	"time"

	enum "dvgmu/api/contract/gen/go/enum/v2"
	"dvgmu/api/internal/auth"
)

// Profile is what the flow needs to know about a portal user: the name for
// the log and the department (MDM UserEmployeeDepartment) that scopes what
// they may act on.
type Profile struct {
	Name       string
	Department int32
}

// Employee is someone a head may give a purchase to prepare.
type Employee struct {
	UUID       string
	Name       string
	Department int32
	// Position is the job title from MDM; empty until set.
	Position string
}

// Profiles reads the employees from MDM: who is in which department.
type Profiles interface {
	Employees(ctx context.Context) ([]Employee, error)
}

const profileTTL = 5 * time.Minute

// profileCache keeps MDM's employee list for a few minutes: every change asks
// who the user is, and departments rarely change.
type profileCache struct {
	src Profiles

	mu          sync.Mutex
	employees   []Employee
	employeesAt time.Time
}

func newProfileCache(src Profiles) *profileCache {
	if src == nil {
		return nil
	}
	return &profileCache{src: src}
}

// Profile is the user's name and department from the employee list; a user
// who is no employee has none. Someone in several departments counts in the
// first MDM lists.
func (c *profileCache) Profile(ctx context.Context, uuid string) (Profile, error) {
	if c == nil || uuid == "" {
		return Profile{}, nil
	}
	list, err := c.Employees(ctx)
	if err != nil {
		return Profile{}, err
	}
	for _, e := range list {
		if e.UUID == uuid {
			return Profile{Name: e.Name, Department: e.Department}, nil
		}
	}
	return Profile{}, nil
}

func (c *profileCache) Employees(ctx context.Context) ([]Employee, error) {
	if c == nil {
		return nil, nil
	}
	c.mu.Lock()
	list, at := c.employees, c.employeesAt
	c.mu.Unlock()
	if list != nil && time.Since(at) < profileTTL {
		return list, nil
	}
	list, err := c.src.Employees(ctx)
	if err != nil {
		return nil, err
	}
	c.mu.Lock()
	c.employees, c.employeesAt = list, time.Now()
	c.mu.Unlock()
	return list, nil
}

// actor is who performs a call, and what scopes them.
type actor struct {
	role       enum.PurchaseActorRole
	name       string
	uuid       string
	department int32
	// The vice-rector the user is (bound in the directory); for ADMIN, the
	// one picked on the page, 0 — any.
	curatorID int64
	admin     bool
}

// whoAmI is the signed-in user: login, admin, MDM profile. A profile MDM
// cannot give is left empty — the user then acts as if without a department.
func (s *Service) whoAmI(ctx context.Context) (uuid, name string, department int32, admin bool) {
	u, ok := auth.UserFromContext(ctx)
	if !ok {
		return "", "", 0, false
	}
	p, err := s.profiles.Profile(ctx, u.UUID)
	if err != nil {
		s.log.Warn("purchase: mdm profile unavailable", "uuid", u.UUID, "error", err.Error())
	}
	name = p.Name
	if name == "" {
		name = u.Username
	}
	return u.UUID, name, p.Department, u.HasRole()
}

// actorOf reads the acting role from the call and lets it through only with
// the right to that role's section (requireRole): every change goes through
// here. Who the user is — department, the vice-rector they are — comes from
// MDM and the directory, not from the call; only ADMIN, testing, may pick a
// vice-rector and type a name.
func (s *Service) actorOf(ctx context.Context, role enum.PurchaseActorRole, typedName string, curatorID int64) (actor, error) {
	if roleLabel[role] == "" {
		return actor{}, invalid("выберите роль, от лица которой действуете")
	}
	if err := requireRole(ctx, role); err != nil {
		return actor{}, err
	}
	uuid, name, department, admin := s.whoAmI(ctx)
	a := actor{role: role, uuid: uuid, name: name, department: department, admin: admin}
	if typed := strings.TrimSpace(typedName); admin && typed != "" {
		a.name = typed
	}
	if a.name == "" {
		a.name = roleLabel[role]
	}
	a.name = cut(a.name, 255)

	if role == roleViceRector {
		bound := int64(0)
		if s.store != nil {
			var err error
			if bound, err = s.store.curatorByUser(ctx, uuid); err != nil {
				return actor{}, err
			}
		}
		switch {
		case admin && curatorID != 0:
			a.curatorID = curatorID
		case bound != 0:
			a.curatorID = bound
		case !admin:
			return actor{}, forbidden("вы не привязаны к проректору в справочнике закупок — обратитесь к администратору")
		}
	}
	return a, nil
}

// inDepartment fails unless the user belongs to department dep (ADMIN — any).
func (a actor) inDepartment(dep int32, what string) error {
	if a.admin {
		return nil
	}
	if a.department == 0 {
		return forbidden("в вашем профиле не указан отдел — обратитесь к администратору")
	}
	if a.department != dep {
		return forbidden("%s другого отдела", what)
	}
	return nil
}

// curates fails unless the acting vice-rector curates curatorID.
func (a actor) curates(curatorID int64) error {
	if a.admin && a.curatorID == 0 {
		return nil
	}
	if a.curatorID != curatorID {
		return forbidden("это курирует другой проректор")
	}
	return nil
}

// owns fails unless uuid is the user (ADMIN — anyone's). Records made before
// authors were kept (empty uuid) stay open to their role.
func (a actor) owns(uuid, what string) error {
	if a.admin || uuid == "" || uuid == a.uuid {
		return nil
	}
	return forbidden("%s другого сотрудника", what)
}

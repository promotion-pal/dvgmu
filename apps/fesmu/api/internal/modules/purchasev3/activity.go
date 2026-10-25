package purchasev3

import (
	"context"
	"slices"
	"strings"
	"time"

	entity "fesmu/contract/fesmu/entity/v3"
	enum "fesmu/contract/fesmu/enum/v3"
	"google.golang.org/protobuf/types/known/timestamppb"
)

// recentActions is how many of an employee's latest actions come with the
// statistics.
const recentActions = 15

// university is the time zone the days of activity are counted in.
var university = time.FixedZone("Владивосток", 10*60*60)

// ActivityFetch is who works in the module: the log of the requests and
// purchases the user sees (an administrator — of all), per employee, over the
// last days (0 — all time), most active first. Imported records have no
// author and are not counted.
func (s *Service) ActivityFetch(ctx context.Context, days int32) ([]*entity.PurchaseActivity, error) {
	a, err := s.begin(ctx)
	if err != nil {
		return nil, err
	}
	if !a.can(permViewActivity) {
		return nil, needPerm(permViewActivity)
	}
	departments, err := s.store.departments(ctx)
	if err != nil {
		return nil, err
	}
	requests, err := s.store.requests(ctx)
	if err != nil {
		return nil, err
	}
	lots, err := s.store.lots(ctx)
	if err != nil {
		return nil, err
	}
	logs, err := s.store.logs(ctx)
	if err != nil {
		return nil, err
	}

	v := a.viewer(departments)
	seen := map[enum.PurchaseLogTarget]map[int64]bool{logRequest: {}, logLot: {}}
	if !v.all {
		requests, lots = v.visible(requests, lots)
		for _, r := range requests {
			seen[logRequest][r.ID] = true
		}
		for _, l := range lots {
			seen[logLot][l.ID] = true
		}
	}
	var since time.Time
	if days > 0 {
		since = s.now().AddDate(0, 0, -int(days))
	}

	type tally struct {
		out     *entity.PurchaseActivity
		records map[[2]int64]bool
		days    map[string]bool
		roles   map[enum.PurchaseRole]bool
	}
	byUser := map[string]*tally{}
	for _, l := range logs {
		if l.ActorUUID == "" || l.CreatedAt.Before(since) {
			continue
		}
		if !v.all && (l.Target == logProtocol && !v.plan || l.Target != logProtocol && !seen[l.Target][l.TargetID]) {
			continue
		}
		t := byUser[l.ActorUUID]
		if t == nil {
			t = &tally{
				out:     &entity.PurchaseActivity{Uuid: l.ActorUUID, FirstAt: timestamppb.New(l.CreatedAt)},
				records: map[[2]int64]bool{}, days: map[string]bool{}, roles: map[enum.PurchaseRole]bool{},
			}
			byUser[l.ActorUUID] = t
		}
		o := t.out
		o.Name = l.ActorName
		o.Total++
		switch {
		case l.Action == "create" && l.Target == logRequest:
			o.Created++
		case l.Action == "forward" || l.Action == "commission":
			o.Forwards++
		case l.Action == "return" || l.Action == "reject":
			o.Returns++
		case strings.HasSuffix(l.Action, "_add") && l.Action != "requests_add":
			o.Files++
		default:
			o.Edits++
		}
		if l.Target != logProtocol {
			t.records[[2]int64{int64(l.Target), l.TargetID}] = true
		}
		t.days[l.CreatedAt.In(university).Format(time.DateOnly)] = true
		if l.Role != enum.PurchaseRole_PURCHASE_ROLE_UNSPECIFIED {
			t.roles[l.Role] = true
		}
		o.LastAt = timestamppb.New(l.CreatedAt)
		o.Recent = append(o.Recent, l.ToProto())
		if len(o.Recent) > recentActions {
			o.Recent = o.Recent[1:]
		}
	}

	// Position and departments from MDM, when it answers.
	type profile struct {
		position    string
		departments []int32
	}
	profiles := map[string]*profile{}
	if s.profiles != nil {
		if list, err := s.profiles.Employees(ctx); err == nil {
			for _, e := range list {
				p := profiles[e.UUID]
				if p == nil {
					p = &profile{}
					profiles[e.UUID] = p
				}
				if e.Position != "" {
					p.position = e.Position
				}
				if e.Department != 0 && !slices.Contains(p.departments, e.Department) {
					p.departments = append(p.departments, e.Department)
				}
			}
		} else {
			s.log.WarnContext(ctx, "purchase v3: employees for activity", "err", err)
		}
	}

	out := make([]*entity.PurchaseActivity, 0, len(byUser))
	for uuid, t := range byUser {
		o := t.out
		o.Records = int32(len(t.records))
		o.ActiveDays = int32(len(t.days))
		for r := range t.roles {
			o.Roles = append(o.Roles, r)
		}
		slices.Sort(o.Roles)
		slices.Reverse(o.Recent)
		if p := profiles[uuid]; p != nil {
			o.Position = p.position
			for _, d := range p.departments {
				o.Departments = append(o.Departments, dep(d))
			}
		}
		out = append(out, o)
	}
	slices.SortFunc(out, func(x, y *entity.PurchaseActivity) int {
		if x.Total != y.Total {
			return int(y.Total - x.Total)
		}
		return strings.Compare(x.Name, y.Name)
	})
	return out, nil
}

package purchase

import (
	"context"

	"dvgmu/api/internal/auth"
)

// viewer is what the signed-in user may see of the purchases: each role adds
// its own part, and only the economists, the commission and ADMIN see all.
//
//	employee     — own requests, the purchases they went into, the purchases
//	               given to them to prepare
//	dept head    — requests of their department, and everything their
//	               department carries out
//	vice-rector  — requests of the departments they curate, and the purchases
//	               they curate or that hold such requests
type viewer struct {
	all bool

	uuid       string
	department int32
	curatorID  int64

	employee, head, viceRector bool
}

// viewerOf reads the user's rights, MDM department and vice-rector binding.
// Without a signed-in user (auth switched off) nothing is hidden.
func (s *Service) viewerOf(ctx context.Context) (viewer, error) {
	u, ok := auth.UserFromContext(ctx)
	if !ok {
		return viewer{all: true}, nil
	}
	if u.HasRole() || u.Can(auth.SectionPurchaseEconomist, auth.ActionFetch) || u.Can(auth.SectionPurchaseCommission, auth.ActionFetch) {
		return viewer{all: true}, nil
	}
	uuid, _, department, _ := s.whoAmI(ctx)
	curatorID, err := s.store.curatorByUser(ctx, uuid)
	if err != nil {
		return viewer{}, err
	}
	return viewer{
		uuid:       uuid,
		department: department,
		curatorID:  curatorID,
		employee:   u.Can(auth.SectionPurchaseRequest, auth.ActionFetch),
		head:       u.Can(auth.SectionPurchaseHead, auth.ActionFetch) && department != 0,
		viceRector: u.Can(auth.SectionPurchaseViceRector, auth.ActionFetch) && curatorID != 0,
	}, nil
}

// ownRequest: the request itself is in the viewer's part.
func (v viewer) ownRequest(r *Request) bool {
	return v.all ||
		v.employee && r.AuthorUUID == v.uuid ||
		v.head && (r.DepartmentID == v.department || r.ImplementingDepartment == v.department) ||
		v.viceRector && r.curator() == v.curatorID
}

// ownLot: the purchase itself is in the viewer's part, or holds a request
// that is.
func (v viewer) ownLot(l *Lot, requests []*Request) bool {
	if v.all ||
		v.employee && l.AssigneeUUID == v.uuid ||
		v.head && l.ImplementingDepartment == v.department ||
		v.viceRector && l.CuratorID == v.curatorID {
		return true
	}
	for _, r := range requests {
		if r.LotID != nil && *r.LotID == l.ID && v.ownRequest(r) {
			return true
		}
	}
	return false
}

// visible splits requests and lots to what the viewer sees. A request inside
// a visible purchase is visible too: it is part of what they look at.
func (v viewer) visible(requests []*Request, lots []*Lot) ([]*Request, []*Lot) {
	if v.all {
		return requests, lots
	}
	lotSeen := map[int64]bool{}
	var outLots []*Lot
	for _, l := range lots {
		if v.ownLot(l, requests) {
			lotSeen[l.ID] = true
			outLots = append(outLots, l)
		}
	}
	var outRequests []*Request
	for _, r := range requests {
		if v.ownRequest(r) || r.LotID != nil && lotSeen[*r.LotID] {
			outRequests = append(outRequests, r)
		}
	}
	return outRequests, outLots
}

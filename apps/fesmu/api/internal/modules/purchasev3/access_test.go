package purchasev3

import (
	"errors"
	"slices"
	"testing"

	enum "dvgmu/api/contract/gen/go/enum/v3"
)

const (
	depIT  = 1
	depAHU = 55
	depLab = 30
)

func who(uuid string, departments []int32, curators []int64, perms ...enum.PurchasePermission) actor {
	a := actor{uuid: uuid, name: uuid, departments: departments, curators: curators, perms: map[enum.PurchasePermission]bool{}}
	for _, p := range perms {
		a.perms[p] = true
	}
	return a
}

func TestPermCode(t *testing.T) {
	if got := permCode(permViewDirection); got != "purchase.view_direction" {
		t.Errorf("got %q", got)
	}
	if got := permCode(permRequestCreate); got != "purchase.request_create" {
		t.Errorf("got %q", got)
	}
	if len(allPerms()) != len(enum.PurchasePermission_name)-1 {
		t.Error("a right has no label")
	}
}

func TestRequestScopes(t *testing.T) {
	curator := int64(7)
	r := &Request{AuthorUUID: "emp", Department: depLab, CuratorID: &curator, ImplementingDepartment: depIT}

	head := who("head", []int32{depLab}, nil, permHeadReview)
	otherHead := who("head2", []int32{depAHU}, nil, permHeadReview)
	headStage, _, _ := stageOf(requestRoute, reqHeadReview)
	if err := head.mayRequest(headStage, r); err != nil {
		t.Errorf("head of the department: %v", err)
	}
	if err := otherHead.mayRequest(headStage, r); !errors.Is(err, ErrForbidden) {
		t.Errorf("head of another department must be refused, got %v", err)
	}
	noRight := who("head", []int32{depLab}, nil)
	if err := noRight.mayRequest(headStage, r); !errors.Is(err, ErrForbidden) {
		t.Errorf("without the right must be refused, got %v", err)
	}

	curStage, _, _ := stageOf(requestRoute, reqCurator)
	if err := who("dt", nil, []int64{7}, permRequestCurator).mayRequest(curStage, r); err != nil {
		t.Errorf("vice-rector of the direction: %v", err)
	}
	if err := who("ahu", nil, []int64{8}, permRequestCurator).mayRequest(curStage, r); !errors.Is(err, ErrForbidden) {
		t.Errorf("vice-rector of another direction must be refused, got %v", err)
	}

	admin := actor{admin: true}
	if err := admin.mayRequest(curStage, r); err != nil {
		t.Errorf("admin may act anywhere: %v", err)
	}
}

func TestAllowedFollowsTheStage(t *testing.T) {
	r := &Request{AuthorUUID: "emp", Department: depLab, Status: reqHeadReview}
	author := who("emp", []int32{depLab}, nil, permRequestCreate)
	got := author.allowedRequest(r)
	if len(got.Moves) != 0 || got.Edit || !got.Remove {
		t.Errorf("author while the head reviews: may only delete, got %v", got)
	}
	head := who("head", []int32{depLab}, nil, permHeadReview)
	got = head.allowedRequest(r)
	want := []enum.PurchaseMove{moveForward, moveReturn, moveReject}
	if !slices.Equal(got.Moves, want) || !got.Edit || got.Remove {
		t.Errorf("head: got %v", got)
	}

	l := &Lot{Status: lotCommission}
	if moves := who("c", nil, nil, permCommission).allowedLot(l).Moves; !slices.Equal(moves, []enum.PurchaseMove{moveReturn}) {
		t.Errorf("commission decides by protocol, may only return by hand: %v", moves)
	}
	l = &Lot{Status: lotSpecification, AssigneeUUID: "u2"}
	if got := who("u3", nil, nil, permLotPrepare).allowedLot(l); len(got.Moves) != 0 {
		t.Errorf("not the assignee: %v", got)
	}
	if got := who("u2", nil, nil, permLotPrepare).allowedLot(l); len(got.Moves) != 2 || !got.Edit {
		t.Errorf("assignee: %v", got)
	}
}

func TestVisibility(t *testing.T) {
	dt := int64(7)
	departments := []*Department{{ID: depIT, CuratorID: &dt}, {ID: depLab, CuratorID: &dt}, {ID: depAHU}}
	lotID := int64(1)
	requests := []*Request{
		{ID: 1, AuthorUUID: "emp", Department: depLab, Status: reqHeadReview},
		{ID: 2, AuthorUUID: "x", Department: depAHU, ImplementingDepartment: depIT, LotID: &lotID, Status: reqInPurchase},
		{ID: 3, AuthorUUID: "y", Department: depAHU, Status: reqHeadReview},
	}
	lots := []*Lot{{ID: 1, ImplementingDepartment: depIT, CuratorID: dt}, {ID: 2, ImplementingDepartment: depAHU, AssigneeUUID: "emp"}}

	ids := func(rs []*Request, ls []*Lot) (r []int64, l []int64) {
		for _, x := range rs {
			r = append(r, x.ID)
		}
		for _, x := range ls {
			l = append(l, x.ID)
		}
		return r, l
	}

	// An employee: own request, and the purchase given to them.
	r, l := ids(who("emp", []int32{depLab}, nil, permRequestCreate).viewer(departments).visible(requests, lots))
	if !slices.Equal(r, []int64{1}) || !slices.Equal(l, []int64{2}) {
		t.Errorf("employee sees %v %v", r, l)
	}
	// The vice-rector for digital transformation: the direction's requests
	// (by department, even before the head approves) and purchases.
	r, l = ids(who("dt", nil, []int64{dt}, permViewDirection).viewer(departments).visible(requests, lots))
	if !slices.Equal(r, []int64{1, 2}) || !slices.Equal(l, []int64{1}) {
		t.Errorf("vice-rector sees %v %v", r, l)
	}
	// Economists see everything.
	r, l = ids(who("eco", nil, nil, permEconomist).viewer(departments).visible(requests, lots))
	if len(r) != 3 || len(l) != 2 {
		t.Errorf("economist sees %v %v", r, l)
	}
}

func TestAuthorDepartment(t *testing.T) {
	if _, err := who("a", nil, nil).authorDepartment(0); !errors.Is(err, ErrInvalid) {
		t.Error("no department must be refused")
	}
	if _, err := who("a", []int32{1, 2}, nil).authorDepartment(0); !errors.Is(err, ErrInvalid) {
		t.Error("several departments: must ask which")
	}
	if d, err := who("a", []int32{1, 2}, nil).authorDepartment(2); err != nil || d != 2 {
		t.Errorf("chosen department: %d %v", d, err)
	}
	if _, err := who("a", []int32{1}, nil).authorDepartment(2); !errors.Is(err, ErrForbidden) {
		t.Error("someone else's department must be refused")
	}
	admin := actor{admin: true}
	if d, err := admin.authorDepartment(55); err != nil || d != 55 {
		t.Errorf("admin without a department files for any: %d %v", d, err)
	}
	if _, err := admin.authorDepartment(0); !errors.Is(err, ErrInvalid) {
		t.Error("admin without a department must name one")
	}
}

// An administrator may act anywhere, but only what is theirs by their own
// rights is their task.
func TestAdminTasksAreOwnOnly(t *testing.T) {
	l := &Lot{Status: lotApproved, ImplementingDepartment: depIT}
	admin := actor{uuid: "adm", admin: true, perms: map[enum.PurchasePermission]bool{}}
	got := admin.allowedLot(l)
	if len(got.Moves) == 0 || got.Mine {
		t.Errorf("admin outside their department: moves %v, mine %v", got.Moves, got.Mine)
	}
	head := who("head", []int32{depIT}, nil, permLotManage)
	head.admin = true
	if got := head.allowedLot(l); !got.Mine {
		t.Error("an administrator who is also the IT head: the purchase is theirs")
	}
}

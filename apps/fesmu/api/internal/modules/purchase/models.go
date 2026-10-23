package purchase

import (
	"math"
	"time"

	"google.golang.org/protobuf/types/known/timestamppb"

	entity "dvgmu/api/contract/gen/go/entity/v2"
	enum "dvgmu/api/contract/gen/go/enum/v2"
)

// Curator is a vice-rector who curates purchases. The list is seeded by the
// migration; the administrator binds each to the portal user who is that
// vice-rector (UserUUID — MDM uuid).
type Curator struct {
	ID        int64  `gorm:"primaryKey;autoIncrement"`
	Name      string `gorm:"size:255;not null"`
	Position  string `gorm:"size:255;not null;default:''"`
	SortOrder int    `gorm:"not null;default:0"`
	UserUUID  string `gorm:"size:64;not null;default:'';index"`
	UserName  string `gorm:"size:255;not null;default:''"`
}

func (Curator) TableName() string { return "purchase_v2_curators" }

// Department is an MDM department (UserEmployeeDepartment) and the
// vice-rector over it: a request goes to its department's head, then to
// that vice-rector.
type Department struct {
	ID        int32    `gorm:"primaryKey;autoIncrement:false"`
	Name      string   `gorm:"size:255;not null"`
	CuratorID *int64   `gorm:"index"`
	Curator   *Curator `gorm:"foreignKey:CuratorID;constraint:OnDelete:SET NULL"`
}

func (Department) TableName() string { return "purchase_v2_departments" }

// Category tells which department carries out purchases whose ОКПД2 starts
// with Okpd2Prefix (guessed from the title, codes.go).
type Category struct {
	ID          int64  `gorm:"primaryKey;autoIncrement"`
	Name        string `gorm:"size:255;not null"`
	Okpd2Prefix string `gorm:"size:32;not null"`
	Department  int32  `gorm:"not null"`
}

func (Category) TableName() string { return "purchase_v2_categories" }

// Approval is a stage's latest sign-off. Stage orders the flow (flow.go);
// sign-offs stored before stages existed have none and are placed by role.
type Approval struct {
	Role    enum.PurchaseActorRole `json:"role"`
	Stage   int                    `json:"stage,omitempty"`
	Name    string                 `json:"name"`
	Comment string                 `json:"comment,omitempty"`
	At      time.Time              `json:"at"`
}

// Request is what an employee asks to buy.
type Request struct {
	ID          int64   `gorm:"primaryKey;autoIncrement"`
	Title       string  `gorm:"size:255;not null"`
	Quantity    float64 `gorm:"not null"`
	Unit        string  `gorm:"size:32;not null;default:''"`
	Description string  `gorm:"size:4096;not null;default:''"`
	Department  string  `gorm:"size:255;not null;default:''"`
	// The author's MDM department; 0 for requests made before departments.
	DepartmentID int32 `gorm:"not null;default:0;index"`
	// The department that carries the purchase out, set by the vice-rector.
	ImplementingDepartment int32 `gorm:"not null;default:0;index"`

	ItemType enum.PurchaseItemType `gorm:"type:smallint;not null;default:1"`

	// The vice-rector over the author's department, set when the head approves.
	CuratorID *int64   `gorm:"index"`
	Curator   *Curator `gorm:"foreignKey:CuratorID;constraint:OnDelete:RESTRICT"`

	Status     enum.PurchaseRequestStatus `gorm:"type:smallint;not null;index"`
	AuthorName string                     `gorm:"size:255;not null;default:''"`
	AuthorUUID string                     `gorm:"size:64;not null;default:''"`

	// Set while the request is part of a purchase.
	LotID *int64 `gorm:"index"`
	Lot   *Lot   `gorm:"foreignKey:LotID;constraint:OnDelete:SET NULL"`

	// Set once the department head merged it into another request.
	MergedIntoID *int64   `gorm:"index"`
	MergedInto   *Request `gorm:"foreignKey:MergedIntoID;constraint:OnDelete:SET NULL"`

	Approvals   []Approval `gorm:"type:jsonb;serializer:json;not null"`
	LastComment string     `gorm:"size:2048;not null;default:''"`

	CreatedAt time.Time
	UpdatedAt time.Time
}

func (Request) TableName() string { return "purchase_v2_requests" }

// Lot is a purchase: one or more requests the implementing department's
// head merged.
type Lot struct {
	ID          int64                 `gorm:"primaryKey;autoIncrement"`
	Title       string                `gorm:"size:255;not null"`
	Description string                `gorm:"size:4096;not null;default:''"`
	ItemType    enum.PurchaseItemType `gorm:"type:smallint;not null;default:1"`

	ImplementingDepartment int32 `gorm:"not null;default:0;index"`
	// Who prepares the specification and offers, given by the head.
	AssigneeUUID string `gorm:"size:64;not null;default:''"`
	AssigneeName string `gorm:"size:255;not null;default:''"`

	// The vice-rector over the implementing department.
	CuratorID int64    `gorm:"not null;index"`
	Curator   *Curator `gorm:"foreignKey:CuratorID;constraint:OnDelete:RESTRICT"`

	Status   enum.PurchaseLotStatus `gorm:"type:smallint;not null;index"`
	Quantity float64                `gorm:"not null"`
	Unit     string                 `gorm:"size:32;not null;default:''"`
	Comment  string                 `gorm:"size:4096;not null;default:''"`

	Okpd2         string                     `gorm:"size:32;not null;default:''"`
	Ktru          string                     `gorm:"size:64;not null;default:''"`
	Okved         string                     `gorm:"size:32;not null;default:''"`
	CodesAuto     bool                       `gorm:"not null;default:false"`
	FundingSource enum.PurchaseFundingSource `gorm:"type:smallint;not null;default:0"`
	Kosgu         string                     `gorm:"size:32;not null;default:''"`
	// НМЦК in kopecks as the economist set it; 0 until then.
	Nmck             int64  `gorm:"not null;default:0"`
	EconomistComment string `gorm:"size:2048;not null;default:''"`

	PlanType          enum.PurchasePlanType `gorm:"type:smallint;not null;default:0"`
	PlanYear          int                   `gorm:"not null;default:0;index"`
	CommissionComment string                `gorm:"size:2048;not null;default:''"`

	Approvals   []Approval `gorm:"type:jsonb;serializer:json;not null"`
	LastComment string     `gorm:"size:2048;not null;default:''"`
	CreatedBy   string     `gorm:"size:255;not null;default:''"`

	Quotations []Quotation `gorm:"foreignKey:LotID;constraint:OnDelete:CASCADE"`

	CreatedAt time.Time
	UpdatedAt time.Time
}

func (Lot) TableName() string { return "purchase_v2_lots" }

// Quotation is a commercial offer (КП). The file is read only on download.
type Quotation struct {
	ID          int64  `gorm:"primaryKey;autoIncrement"`
	LotID       int64  `gorm:"not null;index"`
	Supplier    string `gorm:"size:255;not null"`
	UnitPrice   int64  `gorm:"not null"`
	Note        string `gorm:"size:1024;not null;default:''"`
	FileName    string `gorm:"size:255;not null;default:''"`
	FileSize    int64  `gorm:"not null;default:0"`
	FileContent []byte `gorm:"type:bytea"`
	CreatedBy   string `gorm:"size:255;not null;default:''"`
	CreatedAt   time.Time
}

func (Quotation) TableName() string { return "purchase_v2_quotations" }

// Log is one change of a request or a purchase.
type Log struct {
	ID        int64                  `gorm:"primaryKey;autoIncrement"`
	Target    enum.PurchaseLogTarget `gorm:"type:smallint;not null;index:idx_purchase_v2_logs_target,priority:1"`
	TargetID  int64                  `gorm:"not null;index:idx_purchase_v2_logs_target,priority:2"`
	ActorRole enum.PurchaseActorRole `gorm:"type:smallint;not null"`
	ActorName string                 `gorm:"size:255;not null;default:''"`
	Action    string                 `gorm:"size:64;not null"`
	Text      string                 `gorm:"size:4096;not null"`
	Comment   string                 `gorm:"size:4096;not null;default:''"`
	CreatedAt time.Time
}

func (Log) TableName() string { return "purchase_v2_logs" }

// Price is what the offers say a unit costs: the average (comparable prices
// method) and the lowest, and the average times quantity.
func (l *Lot) Price() (avg, low, total int64) {
	if len(l.Quotations) == 0 {
		return 0, 0, 0
	}
	var sum int64
	low = l.Quotations[0].UnitPrice
	for _, q := range l.Quotations {
		sum += q.UnitPrice
		low = min(low, q.UnitPrice)
	}
	avg = int64(math.Round(float64(sum) / float64(len(l.Quotations))))
	total = int64(math.Round(float64(avg) * l.Quantity))
	return avg, low, total
}

// Amount is what the purchase costs in the plan: the economist's НМЦК, or
// the offers' average times quantity until the economist sets one.
func (l *Lot) Amount() int64 {
	if l.Nmck > 0 {
		return l.Nmck
	}
	_, _, total := l.Price()
	return total
}

func (c *Curator) ToProto() *entity.PurchaseCurator {
	return &entity.PurchaseCurator{Id: c.ID, Name: c.Name, Position: c.Position, UserUuid: c.UserUUID, UserName: c.UserName}
}

func (d *Department) ToProto() *entity.PurchaseDepartment {
	pb := &entity.PurchaseDepartment{Department: d.ID, Name: d.Name}
	if d.CuratorID != nil {
		pb.CuratorId = *d.CuratorID
	}
	return pb
}

func (c *Category) ToProto() *entity.PurchaseCategory {
	return &entity.PurchaseCategory{Id: c.ID, Name: c.Name, Okpd2Prefix: c.Okpd2Prefix, Department: c.Department}
}

func approvalsToProto(list []Approval) []*entity.PurchaseApproval {
	out := make([]*entity.PurchaseApproval, 0, len(list))
	for _, a := range list {
		out = append(out, &entity.PurchaseApproval{
			Role:    a.Role,
			Name:    a.Name,
			Comment: a.Comment,
			At:      timestamppb.New(a.At),
		})
	}
	return out
}

func (l *Log) ToProto() *entity.PurchaseLog {
	return &entity.PurchaseLog{
		Id:        l.ID,
		Target:    l.Target,
		TargetId:  l.TargetID,
		ActorRole: l.ActorRole,
		ActorName: l.ActorName,
		Action:    l.Action,
		Text:      l.Text,
		Comment:   l.Comment,
		CreatedAt: timestamppb.New(l.CreatedAt),
	}
}

func logsToProto(list []*Log) []*entity.PurchaseLog {
	out := make([]*entity.PurchaseLog, 0, len(list))
	for _, l := range list {
		out = append(out, l.ToProto())
	}
	return out
}

func (r *Request) ToProto(logs []*Log) *entity.PurchaseRequest {
	pb := &entity.PurchaseRequest{
		Id:                     r.ID,
		Title:                  r.Title,
		Quantity:               r.Quantity,
		Unit:                   r.Unit,
		Description:            r.Description,
		Department:             r.Department,
		ItemType:               r.ItemType,
		CuratorId:              r.curator(),
		DepartmentId:           r.DepartmentID,
		ImplementingDepartment: r.ImplementingDepartment,
		AuthorUuid:             r.AuthorUUID,
		Status:                 r.Status,
		AuthorName:             r.AuthorName,
		Approvals:              approvalsToProto(r.Approvals),
		LastComment:            r.LastComment,
		Logs:                   logsToProto(logs),
		CreatedAt:              timestamppb.New(r.CreatedAt),
		UpdatedAt:              timestamppb.New(r.UpdatedAt),
	}
	if r.LotID != nil {
		pb.LotId = *r.LotID
	}
	if r.MergedIntoID != nil {
		pb.MergedIntoId = *r.MergedIntoID
	}
	return pb
}

// curator is the request's vice-rector, 0 while the head has not chosen one.
func (r *Request) curator() int64 {
	if r.CuratorID == nil {
		return 0
	}
	return *r.CuratorID
}

func (q *Quotation) ToProto() *entity.PurchaseQuotation {
	return &entity.PurchaseQuotation{
		Id:        q.ID,
		LotId:     q.LotID,
		Supplier:  q.Supplier,
		UnitPrice: q.UnitPrice,
		Note:      q.Note,
		FileName:  q.FileName,
		FileSize:  q.FileSize,
		CreatedBy: q.CreatedBy,
		CreatedAt: timestamppb.New(q.CreatedAt),
	}
}

func (l *Lot) ToProto(requestIDs []int64, logs []*Log) *entity.PurchaseLot {
	avg, low, total := l.Price()
	quotations := make([]*entity.PurchaseQuotation, 0, len(l.Quotations))
	for i := range l.Quotations {
		quotations = append(quotations, l.Quotations[i].ToProto())
	}
	return &entity.PurchaseLot{
		Id:                     l.ID,
		Title:                  l.Title,
		Description:            l.Description,
		ItemType:               l.ItemType,
		CuratorId:              l.CuratorID,
		ImplementingDepartment: l.ImplementingDepartment,
		AssigneeUuid:           l.AssigneeUUID,
		AssigneeName:           l.AssigneeName,
		Status:                 l.Status,
		Quantity:               l.Quantity,
		Unit:                   l.Unit,
		Comment:                l.Comment,
		Okpd2:                  l.Okpd2,
		Ktru:                   l.Ktru,
		Okved:                  l.Okved,
		CodesAuto:              l.CodesAuto,
		FundingSource:          l.FundingSource,
		Kosgu:                  l.Kosgu,
		EconomistComment:       l.EconomistComment,
		PlanType:               l.PlanType,
		PlanYear:               int32(l.PlanYear),
		CommissionComment:      l.CommissionComment,
		UnitPrice:              avg,
		MinUnitPrice:           low,
		TotalAmount:            l.Amount(),
		Nmck:                   l.Nmck,
		CalcAmount:             total,
		RequestIds:             requestIDs,
		Quotations:             quotations,
		Approvals:              approvalsToProto(l.Approvals),
		LastComment:            l.LastComment,
		Logs:                   logsToProto(logs),
		CreatedBy:              l.CreatedBy,
		CreatedAt:              timestamppb.New(l.CreatedAt),
		UpdatedAt:              timestamppb.New(l.UpdatedAt),
	}
}

// Tables lists the module's gorm models, for the migration loader.
func Tables() []any {
	return []any{&Curator{}, &Department{}, &Category{}, &Request{}, &Lot{}, &Quotation{}, &Log{}}
}

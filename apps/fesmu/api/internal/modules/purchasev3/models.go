package purchasev3

import (
	"math"
	"time"

	"google.golang.org/protobuf/types/known/timestamppb"

	entity "dvgmu/api/contract/gen/go/entity/v3"
	enum "dvgmu/api/contract/gen/go/enum/v3"
	mdm "dvgmu/api/contract/gen/go/packages/mdm/enum"
)

// Curator is a vice-rector's direction ("Проректор по цифровой
// трансформации"). The departments it curates point at it; the portal user
// bound to it (UserUUID — MDM uuid) acts for the whole direction.
type Curator struct {
	ID         int64  `gorm:"primaryKey;autoIncrement"`
	Title      string `gorm:"size:255;not null"`
	ShortTitle string `gorm:"size:64;not null;default:''"`
	PersonName string `gorm:"size:255;not null;default:''"`
	UserUUID   string `gorm:"size:64;not null;default:'';index"`
	UserName   string `gorm:"size:255;not null;default:''"`
	SortOrder  int32  `gorm:"not null;default:0"`
}

func (Curator) TableName() string { return "purchase_v3_curators" }

// Department is an MDM department (UserEmployeeDepartment, same numbers) and
// the direction it belongs to.
type Department struct {
	ID        int32    `gorm:"primaryKey;autoIncrement:false"`
	Name      string   `gorm:"size:255;not null"`
	CuratorID *int64   `gorm:"index"`
	Curator   *Curator `gorm:"foreignKey:CuratorID;constraint:OnDelete:SET NULL"`
}

func (Department) TableName() string { return "purchase_v3_departments" }

// Category: purchases whose ОКПД2 starts with Okpd2Prefix are carried out by
// ImplementingDepartment.
type Category struct {
	ID                     int64  `gorm:"primaryKey;autoIncrement"`
	Name                   string `gorm:"size:255;not null"`
	Okpd2Prefix            string `gorm:"size:32;not null"`
	ImplementingDepartment int32  `gorm:"not null"`
}

func (Category) TableName() string { return "purchase_v3_categories" }

// SignOff is a stage's latest sign-off. Stage is the status the record was
// at — a request's or a purchase's, by the record it is kept on.
type SignOff struct {
	Role    enum.PurchaseRole `json:"role"`
	Stage   int32             `json:"stage"`
	Name    string            `json:"name"`
	UUID    string            `json:"uuid,omitempty"`
	Comment string            `json:"comment,omitempty"`
	At      time.Time         `json:"at"`
}

// Request is what an employee asks to buy.
type Request struct {
	ID          int64                 `gorm:"primaryKey;autoIncrement"`
	Title       string                `gorm:"size:255;not null"`
	ItemType    enum.PurchaseItemType `gorm:"type:smallint;not null"`
	Quantity    float64               `gorm:"not null"`
	Unit        string                `gorm:"size:32;not null;default:''"`
	Description string                `gorm:"size:4096;not null;default:''"`

	// The author's MDM department.
	Department int32  `gorm:"not null;index"`
	AuthorUUID string `gorm:"size:64;not null;index"`
	AuthorName string `gorm:"size:255;not null"`
	// The direction over the department, set when the head approves.
	CuratorID *int64   `gorm:"index"`
	Curator   *Curator `gorm:"foreignKey:CuratorID;constraint:OnDelete:RESTRICT"`
	// Set when the vice-rector approves.
	ImplementingDepartment int32 `gorm:"not null;default:0;index"`

	Status enum.PurchaseRequestStatus `gorm:"type:smallint;not null;index"`
	// When the request came to its stage: the stage's term runs from here.
	StageSince *time.Time

	LotID        *int64   `gorm:"index"`
	Lot          *Lot     `gorm:"foreignKey:LotID;constraint:OnDelete:SET NULL"`
	MergedIntoID *int64   `gorm:"index"`
	MergedInto   *Request `gorm:"foreignKey:MergedIntoID;constraint:OnDelete:SET NULL"`

	SignOffs    []SignOff `gorm:"type:jsonb;serializer:json;not null"`
	LastComment string    `gorm:"size:2048;not null;default:''"`

	CreatedAt time.Time
	UpdatedAt time.Time
}

func (Request) TableName() string { return "purchase_v3_requests" }

// Lot is a purchase: requests the implementing head merged, carried through
// to acceptance and the inventory.
type Lot struct {
	ID          int64                 `gorm:"primaryKey;autoIncrement"`
	Title       string                `gorm:"size:255;not null"`
	Description string                `gorm:"size:4096;not null;default:''"`
	ItemType    enum.PurchaseItemType `gorm:"type:smallint;not null"`
	Quantity    float64               `gorm:"not null"`
	Unit        string                `gorm:"size:32;not null;default:''"`

	ImplementingDepartment int32                  `gorm:"not null;index"`
	CuratorID              int64                  `gorm:"not null;index"`
	Curator                *Curator               `gorm:"foreignKey:CuratorID;constraint:OnDelete:RESTRICT"`
	Status                 enum.PurchaseLotStatus `gorm:"type:smallint;not null;index"`
	AssigneeUUID           string                 `gorm:"size:64;not null;default:'';index"`
	AssigneeName           string                 `gorm:"size:255;not null;default:''"`
	// When the purchase came to its stage: the stage's term runs from here.
	StageSince *time.Time
	// The purchase's control date, set by the implementing head.
	DueAt      *time.Time `gorm:"index"`
	DueComment string     `gorm:"size:1024;not null;default:''"`
	// What to check after the transfer from a plan or registry; empty once checked.
	ReviewNote string `gorm:"type:text;not null;default:''"`

	Specification        string `gorm:"type:text;not null;default:''"`
	CuratorJustification string `gorm:"size:4096;not null;default:''"`

	Okpd2     string `gorm:"size:32;not null;default:''"`
	Ktru      string `gorm:"size:64;not null;default:''"`
	Okved     string `gorm:"size:32;not null;default:''"`
	CodesAuto bool   `gorm:"not null;default:false"`

	FundingSource    enum.PurchaseFundingSource `gorm:"type:smallint;not null;default:0"`
	Kosgu            string                     `gorm:"size:32;not null;default:''"`
	Nmck             int64                      `gorm:"not null;default:0"`
	EconomistComment string                     `gorm:"size:2048;not null;default:''"`

	PlanType          enum.PurchasePlanType `gorm:"type:smallint;not null;default:0"`
	PlanYear          int32                 `gorm:"not null;default:0;index"`
	ProtocolID        *int64                `gorm:"index"`
	Protocol          *Protocol             `gorm:"foreignKey:ProtocolID;constraint:OnDelete:SET NULL"`
	CommissionComment string                `gorm:"size:2048;not null;default:''"`

	TechSpec               string              `gorm:"type:text;not null;default:''"`
	FinalCost              int64               `gorm:"not null;default:0"`
	FinalCostComment       string              `gorm:"size:2048;not null;default:''"`
	Law                    enum.PurchaseLaw    `gorm:"type:smallint;not null;default:0"`
	Method                 enum.PurchaseMethod `gorm:"type:smallint;not null;default:0"`
	ContractServiceComment string              `gorm:"size:2048;not null;default:''"`

	NoticeNumber      string `gorm:"size:64;not null;default:''"`
	NoticeAt          *time.Time
	Supplier          string `gorm:"size:255;not null;default:''"`
	SupplierInn       string `gorm:"size:16;not null;default:''"`
	ContractNumber    string `gorm:"size:64;not null;default:''"`
	ContractAt        *time.Time
	ContractAmount    int64 `gorm:"not null;default:0"`
	DeliveryDue       *time.Time
	DeliveredAt       *time.Time
	AcceptedAt        *time.Time
	AcceptanceComment string   `gorm:"size:2048;not null;default:''"`
	InventoryNumbers  []string `gorm:"type:jsonb;serializer:json;not null"`
	CompletedAt       *time.Time

	SignOffs    []SignOff `gorm:"type:jsonb;serializer:json;not null"`
	LastComment string    `gorm:"size:2048;not null;default:''"`
	CreatedBy   string    `gorm:"size:255;not null;default:''"`

	Quotations []Quotation `gorm:"foreignKey:LotID;constraint:OnDelete:CASCADE"`
	Documents  []Document  `gorm:"foreignKey:LotID;constraint:OnDelete:CASCADE"`

	CreatedAt time.Time
	UpdatedAt time.Time
}

func (Lot) TableName() string { return "purchase_v3_lots" }

// Quotation is a commercial offer (КП). The file is read only on download.
type Quotation struct {
	ID          int64  `gorm:"primaryKey;autoIncrement"`
	LotID       int64  `gorm:"not null;index"`
	Supplier    string `gorm:"size:255;not null"`
	SupplierInn string `gorm:"size:16;not null;default:''"`
	UnitPrice   int64  `gorm:"not null"`
	Note        string `gorm:"size:1024;not null;default:''"`
	FileName    string `gorm:"size:255;not null;default:''"`
	FileSize    int64  `gorm:"not null;default:0"`
	FileContent []byte `gorm:"type:bytea"`
	CreatedBy   string `gorm:"size:255;not null;default:''"`
	CreatedAt   time.Time
}

func (Quotation) TableName() string { return "purchase_v3_quotations" }

// Document is a file of a purchase: ТЗ, contract, acceptance act and so on.
type Document struct {
	ID          int64                     `gorm:"primaryKey;autoIncrement"`
	LotID       int64                     `gorm:"not null;index"`
	Kind        enum.PurchaseDocumentKind `gorm:"type:smallint;not null"`
	Note        string                    `gorm:"size:1024;not null;default:''"`
	FileName    string                    `gorm:"size:255;not null"`
	FileSize    int64                     `gorm:"not null"`
	FileContent []byte                    `gorm:"type:bytea"`
	CreatedBy   string                    `gorm:"size:255;not null;default:''"`
	CreatedAt   time.Time
}

func (Document) TableName() string { return "purchase_v3_documents" }

// Decision is one purchase's line in a protocol, as it was at the meeting.
type Decision struct {
	LotID     int64                           `json:"lot_id"`
	LotTitle  string                          `json:"lot_title"`
	CuratorID int64                           `json:"curator_id"`
	Amount    int64                           `json:"amount"`
	Decision  enum.PurchaseCommissionDecision `json:"decision"`
	PlanType  enum.PurchasePlanType           `json:"plan_type,omitempty"`
	PlanYear  int32                           `json:"plan_year,omitempty"`
	Comment   string                          `json:"comment,omitempty"`
}

// Protocol is a budget commission meeting and its decisions.
type Protocol struct {
	ID          int64      `gorm:"primaryKey;autoIncrement"`
	Number      string     `gorm:"size:64;not null"`
	HeldAt      time.Time  `gorm:"not null"`
	Chairman    string     `gorm:"size:255;not null;default:''"`
	Secretary   string     `gorm:"size:255;not null;default:''"`
	Comment     string     `gorm:"size:4096;not null;default:''"`
	Decisions   []Decision `gorm:"type:jsonb;serializer:json;not null"`
	FileName    string     `gorm:"size:255;not null;default:''"`
	FileSize    int64      `gorm:"not null;default:0"`
	FileContent []byte     `gorm:"type:bytea"`
	CreatedBy   string     `gorm:"size:255;not null;default:''"`
	CreatedAt   time.Time
}

func (Protocol) TableName() string { return "purchase_v3_protocols" }

// Log is one change, never edited.
type Log struct {
	ID        int64                  `gorm:"primaryKey;autoIncrement"`
	Target    enum.PurchaseLogTarget `gorm:"type:smallint;not null;index:idx_purchase_v3_logs_target,priority:1"`
	TargetID  int64                  `gorm:"not null;index:idx_purchase_v3_logs_target,priority:2"`
	Role      enum.PurchaseRole      `gorm:"type:smallint;not null"`
	ActorName string                 `gorm:"size:255;not null;default:''"`
	ActorUUID string                 `gorm:"size:64;not null;default:''"`
	Action    string                 `gorm:"size:64;not null"`
	Text      string                 `gorm:"size:4096;not null"`
	Comment   string                 `gorm:"size:4096;not null;default:''"`
	CreatedAt time.Time
}

func (Log) TableName() string { return "purchase_v3_logs" }

// Tables lists the module's gorm models, for the migration loader.
func Tables() []any {
	return []any{&Curator{}, &Department{}, &Category{}, &Protocol{}, &Request{}, &Lot{}, &Quotation{}, &Document{}, &Log{}}
}

// ── Money ───────────────────────────────────────────────────────────────

// Price is what the offers say: the average unit price (comparable prices
// method), the lowest, the average times quantity, and the coefficient of
// variation in percent.
func (l *Lot) Price() (avg, low, total int64, variation float64) {
	n := len(l.Quotations)
	if n == 0 {
		return 0, 0, 0, 0
	}
	var sum float64
	low = l.Quotations[0].UnitPrice
	for _, q := range l.Quotations {
		sum += float64(q.UnitPrice)
		low = min(low, q.UnitPrice)
	}
	mean := sum / float64(n)
	var sq float64
	for _, q := range l.Quotations {
		d := float64(q.UnitPrice) - mean
		sq += d * d
	}
	if mean > 0 {
		variation = math.Round(math.Sqrt(sq/float64(n))/mean*1000) / 10
	}
	avg = int64(math.Round(mean))
	total = int64(math.Round(float64(avg) * l.Quantity))
	return avg, low, total, variation
}

// Amount is what the purchase costs now: the final cost, else НМЦК, else
// the offers' average times quantity.
func (l *Lot) Amount() int64 {
	switch {
	case l.FinalCost > 0:
		return l.FinalCost
	case l.Nmck > 0:
		return l.Nmck
	}
	_, _, total, _ := l.Price()
	return total
}

// ── Protobuf ────────────────────────────────────────────────────────────

func dep(id int32) mdm.UserEmployeeDepartment { return mdm.UserEmployeeDepartment(id) }

func ts(t *time.Time) *timestamppb.Timestamp {
	if t == nil {
		return nil
	}
	return timestamppb.New(*t)
}

func idOf(p *int64) int64 {
	if p == nil {
		return 0
	}
	return *p
}

func (c *Curator) ToProto() *entity.PurchaseCurator {
	return &entity.PurchaseCurator{
		Id: c.ID, Title: c.Title, ShortTitle: c.ShortTitle, PersonName: c.PersonName,
		UserUuid: c.UserUUID, UserName: c.UserName, SortOrder: c.SortOrder,
	}
}

func (d *Department) ToProto() *entity.PurchaseDepartment {
	return &entity.PurchaseDepartment{Department: dep(d.ID), Name: d.Name, CuratorId: idOf(d.CuratorID)}
}

func (c *Category) ToProto() *entity.PurchaseCategory {
	return &entity.PurchaseCategory{Id: c.ID, Name: c.Name, Okpd2Prefix: c.Okpd2Prefix, ImplementingDepartment: dep(c.ImplementingDepartment)}
}

func requestSignOffs(list []SignOff) []*entity.PurchaseSignOff {
	out := make([]*entity.PurchaseSignOff, 0, len(list))
	for _, s := range list {
		out = append(out, &entity.PurchaseSignOff{
			Role:  s.Role,
			Stage: &entity.PurchaseSignOff_RequestStatus{RequestStatus: enum.PurchaseRequestStatus(s.Stage)},
			Name:  s.Name, Uuid: s.UUID, Comment: s.Comment, At: timestamppb.New(s.At),
		})
	}
	return out
}

func lotSignOffs(list []SignOff) []*entity.PurchaseSignOff {
	out := make([]*entity.PurchaseSignOff, 0, len(list))
	for _, s := range list {
		out = append(out, &entity.PurchaseSignOff{
			Role:  s.Role,
			Stage: &entity.PurchaseSignOff_LotStatus{LotStatus: enum.PurchaseLotStatus(s.Stage)},
			Name:  s.Name, Uuid: s.UUID, Comment: s.Comment, At: timestamppb.New(s.At),
		})
	}
	return out
}

func (l *Log) ToProto() *entity.PurchaseLog {
	return &entity.PurchaseLog{
		Id: l.ID, Target: l.Target, TargetId: l.TargetID, Role: l.Role,
		ActorName: l.ActorName, ActorUuid: l.ActorUUID, Action: l.Action,
		Text: l.Text, Comment: l.Comment, CreatedAt: timestamppb.New(l.CreatedAt),
	}
}

func logsToProto(list []*Log) []*entity.PurchaseLog {
	out := make([]*entity.PurchaseLog, 0, len(list))
	for _, l := range list {
		out = append(out, l.ToProto())
	}
	return out
}

func (r *Request) ToProto(logs []*Log, allowed *entity.PurchaseAllowed, suggested int32) *entity.PurchaseRequest {
	return &entity.PurchaseRequest{
		Id: r.ID, Title: r.Title, ItemType: r.ItemType, Quantity: r.Quantity, Unit: r.Unit,
		Description: r.Description, Department: dep(r.Department),
		AuthorUuid: r.AuthorUUID, AuthorName: r.AuthorName,
		CuratorId: idOf(r.CuratorID), ImplementingDepartment: dep(r.ImplementingDepartment),
		SuggestedDepartment: dep(suggested),
		StageSince:          ts(r.StageSince), StageDue: ts(requestStageDue(r)),
		Status: r.Status, LotId: idOf(r.LotID), MergedIntoId: idOf(r.MergedIntoID),
		SignOffs: requestSignOffs(r.SignOffs), LastComment: r.LastComment,
		Logs: logsToProto(logs), Allowed: allowed,
		CreatedAt: timestamppb.New(r.CreatedAt), UpdatedAt: timestamppb.New(r.UpdatedAt),
	}
}

func (q *Quotation) ToProto() *entity.PurchaseQuotation {
	return &entity.PurchaseQuotation{
		Id: q.ID, LotId: q.LotID, Supplier: q.Supplier, SupplierInn: q.SupplierInn,
		UnitPrice: q.UnitPrice, Note: q.Note, FileName: q.FileName, FileSize: q.FileSize,
		CreatedBy: q.CreatedBy, CreatedAt: timestamppb.New(q.CreatedAt),
	}
}

func (d *Document) ToProto() *entity.PurchaseDocument {
	return &entity.PurchaseDocument{
		Id: d.ID, LotId: d.LotID, Kind: d.Kind, FileName: d.FileName, FileSize: d.FileSize,
		Note: d.Note, CreatedBy: d.CreatedBy, CreatedAt: timestamppb.New(d.CreatedAt),
	}
}

func (l *Lot) ToProto(requestIDs []int64, logs []*Log, allowed *entity.PurchaseAllowed) *entity.PurchaseLot {
	avg, low, calc, variation := l.Price()
	quotations := make([]*entity.PurchaseQuotation, 0, len(l.Quotations))
	for i := range l.Quotations {
		quotations = append(quotations, l.Quotations[i].ToProto())
	}
	documents := make([]*entity.PurchaseDocument, 0, len(l.Documents))
	for i := range l.Documents {
		documents = append(documents, l.Documents[i].ToProto())
	}
	return &entity.PurchaseLot{
		Id: l.ID, Title: l.Title, Description: l.Description, ItemType: l.ItemType,
		Quantity: l.Quantity, Unit: l.Unit,
		ImplementingDepartment: dep(l.ImplementingDepartment), CuratorId: l.CuratorID,
		Status: l.Status, AssigneeUuid: l.AssigneeUUID, AssigneeName: l.AssigneeName,
		StageSince: ts(l.StageSince), StageDue: ts(lotStageDue(l)), DueAt: ts(l.DueAt), DueComment: l.DueComment, ReviewNote: l.ReviewNote,
		Specification: l.Specification, CuratorJustification: l.CuratorJustification,
		Okpd2: l.Okpd2, Ktru: l.Ktru, Okved: l.Okved, CodesAuto: l.CodesAuto,
		FundingSource: l.FundingSource, Kosgu: l.Kosgu, Nmck: l.Nmck, EconomistComment: l.EconomistComment,
		UnitPrice: avg, MinUnitPrice: low, CalcAmount: calc, PriceVariation: variation,
		TotalAmount: l.Amount(),
		PlanType:    l.PlanType, PlanYear: l.PlanYear, ProtocolId: idOf(l.ProtocolID),
		CommissionComment: l.CommissionComment,
		TechSpec:          l.TechSpec, FinalCost: l.FinalCost, FinalCostComment: l.FinalCostComment,
		Law: l.Law, Method: l.Method, ContractServiceComment: l.ContractServiceComment,
		NoticeNumber: l.NoticeNumber, NoticeAt: ts(l.NoticeAt),
		Supplier: l.Supplier, SupplierInn: l.SupplierInn,
		ContractNumber: l.ContractNumber, ContractAt: ts(l.ContractAt), ContractAmount: l.ContractAmount,
		DeliveryDue: ts(l.DeliveryDue), DeliveredAt: ts(l.DeliveredAt),
		AcceptedAt: ts(l.AcceptedAt), AcceptanceComment: l.AcceptanceComment,
		InventoryNumbers: l.InventoryNumbers, CompletedAt: ts(l.CompletedAt),
		RequestIds: requestIDs, Quotations: quotations, Documents: documents,
		SignOffs: lotSignOffs(l.SignOffs), LastComment: l.LastComment,
		Logs: logsToProto(logs), Allowed: allowed, CreatedBy: l.CreatedBy,
		CreatedAt: timestamppb.New(l.CreatedAt), UpdatedAt: timestamppb.New(l.UpdatedAt),
	}
}

func (p *Protocol) ToProto() *entity.PurchaseProtocol {
	decisions := make([]*entity.PurchaseProtocolDecision, 0, len(p.Decisions))
	for _, d := range p.Decisions {
		decisions = append(decisions, &entity.PurchaseProtocolDecision{
			LotId: d.LotID, LotTitle: d.LotTitle, CuratorId: d.CuratorID, Amount: d.Amount,
			Decision: d.Decision, PlanType: d.PlanType, PlanYear: d.PlanYear, Comment: d.Comment,
		})
	}
	return &entity.PurchaseProtocol{
		Id: p.ID, Number: p.Number, HeldAt: timestamppb.New(p.HeldAt),
		Chairman: p.Chairman, Secretary: p.Secretary, Comment: p.Comment,
		Decisions: decisions, FileName: p.FileName, FileSize: p.FileSize,
		CreatedBy: p.CreatedBy, CreatedAt: timestamppb.New(p.CreatedAt),
	}
}

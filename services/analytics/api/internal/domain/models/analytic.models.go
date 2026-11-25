package models

import (
	"errors"
	"time"
)

type Analytic struct {
	ID         int64 `gorm:"primaryKey;autoIncrement"`
	QR         int64
	Name       string
	Transcript string
	Type       int32
	Ratings    []AnalyticRating `gorm:"foreignKey:AnalyticID"`
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

type AnalyticRating struct {
	ID         int64 `gorm:"primaryKey;autoIncrement"`
	AnalyticID int64
	Comment    string

	// --- ОБЩИЙ БЛОК: РЕСПОНДЕНТ (для всех опросников) ---
	RespondentLastName   string
	RespondentFirstName  string
	RespondentMiddleName string
	RespondentOffice     string
	RespondentDepartment string

	WorkplacePcPowerRating         int32
	WorkplaceOsBootRating          int32
	WorkplaceSoftwareStableRating  int32
	WorkplaceNetworkSpeedRating    int32
	WorkplaceMonitorRating         int32
	WorkplaceKeyboardMouseRating   int32
	WorkplaceMediaDevicesRating    int32
	WorkplaceOfficeEquipmentRating int32
	WorkplaceFurnitureRating       int32
	WorkplaceSpaceOrgRating        int32
	WorkplaceEnvironmentRating     int32
	WorkplaceHasNetwork            bool

	// Туалет
	PurityRating   int32
	SmellRating    int32
	HasToiletPaper bool
	HasSoap        bool

	// Лекционный зал
	Comfort     int32
	Equipment   int32
	Cleanliness int32

	// --- БЛОК ИНФОРМАЦИОННОЙ БЕЗОПАСНОСТИ (INFORMATION_SECURITY) ---
	InformationSecurityPosition                  string
	InformationSecurityComputerProficiency       int32
	InformationSecurityInfoType                  int32
	InformationSecurityResources                 []int32 `gorm:"serializer:json"`
	InformationSecurityResourcesOther            string
	InformationSecurityPdnPurpose                string
	InformationSecurityStorageForm               string
	InformationSecurityPdnActions                string
	InformationSecurityThirdPartyAgreements      bool
	InformationSecurityPdnDestroyedAfterTerm     bool
	InformationSecurityPdnToArchive              bool
	InformationSecurityOs                        int32
	InformationSecurityHasCorporateEmail         bool
	InformationSecurityCorporateEmailPersonalUse bool

	// --- БЛОК ТЕХНИЧЕСКОГО СНАБЖЕНИЯ (TECHNICAL_SUPPLY) ---
	TechnicalSupplyHasInternet       bool
	TechnicalSupplyHasHeadset        bool
	TechnicalSupplyHasWorkplace      bool
	TechnicalSupplyHasCorporateEmail bool
	TechnicalSupplyHasComputer       bool
	TechnicalSupplyHasMonitor        bool
	TechnicalSupplyHasPhone          bool
	TechnicalSupplyHasPrinterAccess  bool
	TechnicalSupplyHasSoftware       bool
	TechnicalSupplyHasDomainAccount  bool

	CreatedAt time.Time
	UpdatedAt time.Time
}

// AnalyticPatch — изменяемые поля объекта опроса; nil — поле не трогаем.
type AnalyticPatch struct {
	Name       *string
	Transcript *string
	Type       *int32
	QR         *int64
}

// ErrQRTaken — номер QR уже у другого объекта: по нему анкета открывается,
// два объекта с одним номером сделали бы ссылку неоднозначной.
var ErrQRTaken = errors.New("QR number is already used by another analytic")

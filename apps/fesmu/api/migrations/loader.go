package main

import (
	"fmt"
	"io"
	"os"

	"ariga.io/atlas-provider-gorm/gormschema"

	"dvgmu/api/internal/domain/models"
	"dvgmu/api/internal/modules/library"
	"dvgmu/api/internal/modules/purchase"
	"dvgmu/api/internal/modules/purchasev3"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintf(os.Stderr, "service name argument is required\n")
		os.Exit(1)
	}

	service := os.Args[1]
	var stmts string
	var err error

	switch service {
	case "infrastructure":
		stmts, err = gormschema.New("postgres").Load(
			&models.Inventory{},
			&models.Infrastructure{},
			&models.Schedule{},
			&models.ScheduleCollect{},
			&models.Hall{},
			&models.HallBooking{},
			&models.ComputerClassSession{},
			&models.VaccinationDay{},
			&models.VaccinationSlot{},
			&models.VaccinationSignup{},
		)
	case "test":
		stmts, err = gormschema.New("postgres").Load(
			&models.Test{},
			&models.TestQuestion{},
			&models.TestAnswer{},
			&models.TestV2Answer{},
			&models.TestSession{},
			&models.TestAttempt{},
			&models.TestImage{},
			&models.ExamAssignment{},
			&models.ExamParticipation{},
		)
	case "purchase":
		stmts, err = gormschema.New("postgres").Load(append(purchase.Tables(), purchasev3.Tables()...)...)
	case "library":
		stmts, err = gormschema.New("postgres").Load(library.Tables()...)
	default:
		fmt.Fprintf(os.Stderr, "unknown service: %s\n", service)
		os.Exit(1)
	}

	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to load gorm schema for %s: %v\n", service, err)
		os.Exit(1)
	}

	io.WriteString(os.Stdout, stmts)
}

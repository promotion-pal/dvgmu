package examv2

import (
	"connectrpc.com/connect"
	"context"
	api "dvgmu/api"
	"dvgmu/api/internal/auth"
	"dvgmu/api/internal/domain/models"
	"dvgmu/api/internal/storage"
	pb "fesmu/contract/fesmu/exam/service/v2"
	"github.com/google/uuid"
	"github.com/pressly/goose/v3"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"os"
	"testing"
)

func TestV2PostgresGenerateFrozenVariantsAndRevision(t *testing.T) {
	dsn := os.Getenv("EXAM_TEST_DB_DSN")
	if dsn == "" {
		t.Skip("EXAM_TEST_DB_DSN not set")
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	sql, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	defer sql.Close()
	goose.SetBaseFS(api.MigrationsFS)
	if err := goose.SetDialect("postgres"); err != nil {
		t.Fatal(err)
	}
	if err := goose.Up(sql, "migrations/test"); err != nil {
		t.Fatal(err)
	}
	ctx := auth.WithUser(context.Background(), &auth.User{UUID: uuid.NewString(), Roles: []string{auth.RoleAdmin}})
	m := New(db, nil)
	b := validBank()
	b.Discipline = uuid.NewString()
	b.ApprovedBy = ""
	b.ReviewNotes = ""
	saved, err := m.BankSave(ctx, connect.NewRequest(&pb.BankSaveRequest{Bank: b}))
	if err != nil {
		t.Fatal(err)
	}
	b = saved.Msg.Bank
	generated := []int64{}
	t.Cleanup(func() {
		for _, id := range generated {
			db.Delete(&models.Test{}, id)
		}
		db.Delete(&BankRecord{}, b.Id)
	})
	result, err := m.VariantsGenerate(ctx, connect.NewRequest(&pb.VariantsGenerateRequest{BankId: b.Id, Revision: b.Revision}))
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Msg.Variants) != 2 {
		t.Fatal("incorrect number of variants")
	}
	for _, v := range result.Msg.Variants {
		generated = append(generated, v.TestId)
		test, err := storage.TestStorageNew(db).TestByID(ctx, v.TestId)
		if err != nil {
			t.Fatal(err)
		}
		if len(test.Questions) != 1 || !test.ExamSettings.Enabled || test.ExamSettings.Discipline != b.Discipline {
			t.Fatal("blueprint not frozen")
		}
	}
	// Old revision must never overwrite or regenerate from an unseen bank edit.
	b.Discipline += " edited"
	if _, err := m.BankSave(ctx, connect.NewRequest(&pb.BankSaveRequest{Bank: b})); err != nil {
		t.Fatal(err)
	}
	if _, err := m.VariantsGenerate(ctx, connect.NewRequest(&pb.VariantsGenerateRequest{BankId: b.Id, Revision: b.Revision})); connect.CodeOf(err) != connect.CodeAborted {
		t.Fatal("stale revision accepted", err)
	}
	old, err := storage.TestStorageNew(db).TestByID(ctx, generated[0])
	if err != nil {
		t.Fatal(err)
	}
	if old.ExamSettings.Discipline == b.Discipline {
		t.Fatal("bank edits changed historical variant")
	}
}

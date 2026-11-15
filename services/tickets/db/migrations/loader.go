package main

import (
	"fmt"
	"io"
	"os"

	"ariga.io/atlas-provider-gorm/gormschema"
	"dvgmu/tickets/internal/domain/models"
)

func main() {
	statements, err := gormschema.New("postgres").Load(&models.Task{})
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to load GORM schema: %v\n", err)
		os.Exit(1)
	}
	_, _ = io.WriteString(os.Stdout, statements)
}

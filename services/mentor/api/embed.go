package api

import "embed"

//go:embed db/migrations
var MigrationsFS embed.FS

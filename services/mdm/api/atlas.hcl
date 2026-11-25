data "external_schema" "gorm" {
  program = [
    "go",
    "run",
    "-mod=mod",
    "./migrations",
  ]
}

env "gorm" {
  src = data.external_schema.gorm.url
  dev = "docker://postgres/16/dev?search_path=public"

  migration {
    dir = "file://migrations/user?format=goose"
  }

  format {
    migrate {
      diff = "{{ sql . \"  \" }}"
    }
  }
}

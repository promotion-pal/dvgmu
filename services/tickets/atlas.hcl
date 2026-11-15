data "external_schema" "gorm" {
  program = ["go", "run", "-mod=mod", "./db/migrations"]
}

env "gorm" {
  src = data.external_schema.gorm.url
  dev = "docker://postgres/17/dev?search_path=public"

  migration {
    dir = "file://db/migrations/task?format=goose"
  }

  format {
    migrate {
      diff = "{{ sql . \"  \" }}"
    }
  }
}

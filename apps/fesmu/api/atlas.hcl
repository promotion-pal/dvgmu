variable "service" {
  type    = string
  default = "infrastructure"
}

data "external_schema" "gorm" {
  program = [
    "go",
    "run",
    "-mod=mod",
    "./migrations/loader.go",
    var.service,
  ]
}

env "gorm" {
  src = data.external_schema.gorm.url
  dev = "docker://postgres/16/dev?search_path=public"

  migration {
    dir = "file://migrations/${var.service}?format=goose"
  }

  format {
    migrate {
      diff = "{{ sql . \"  \" }}"
    }
  }
}

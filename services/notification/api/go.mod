module dvgmu/notification

go 1.26.4

require (
	connectrpc.com/connect v1.20.0
	connectrpc.com/grpcreflect v1.3.0
	github.com/ilyakaznacheev/cleanenv v1.5.0
	github.com/joho/godotenv v1.5.1
	github.com/rs/cors v1.11.1
	golang.org/x/net v0.57.0
	google.golang.org/protobuf v1.36.11
)

require (
	github.com/BurntSushi/toml v1.2.1 // indirect
	github.com/kr/pretty v0.3.0 // indirect
	github.com/rogpeppe/go-internal v1.16.0 // indirect
	golang.org/x/text v0.40.0 // indirect
	gopkg.in/check.v1 v1.0.0-20201130134442-10cb98267c6c // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
	olympos.io/encoding/edn v0.0.0-20201019073823-d3554ca0b0a3 // indirect
)

require fesmu/contract v0.0.0

// Сгенерированный Go всех схем — make proto в корне монорепо.
replace fesmu/contract => ../../../packages/go

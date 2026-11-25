module dvgmu/auth

go 1.26.4

require (
	connectrpc.com/connect v1.20.0
	connectrpc.com/grpcreflect v1.3.0
	github.com/beevik/etree v1.5.0
	github.com/crewjam/saml v0.5.1
	github.com/go-ldap/ldap/v3 v3.4.14
	github.com/golang-jwt/jwt/v5 v5.3.1
	github.com/google/uuid v1.6.0
	github.com/ilyakaznacheev/cleanenv v1.5.0
	github.com/jcmturner/gokrb5/v8 v8.4.4
	github.com/joho/godotenv v1.5.1
	github.com/rs/cors v1.11.1
	github.com/russellhaering/goxmldsig v1.4.0
	golang.org/x/net v0.57.0
	google.golang.org/protobuf v1.36.11
	gorm.io/driver/postgres v1.6.2
	gorm.io/gorm v1.31.2
)

require (
	github.com/Azure/go-ntlmssp v0.1.1 // indirect
	github.com/BurntSushi/toml v1.2.1 // indirect
	github.com/go-asn1-ber/asn1-ber v1.5.8 // indirect
	github.com/hashicorp/go-uuid v1.0.3 // indirect
	github.com/jackc/pgpassfile v1.0.0 // indirect
	github.com/jackc/pgservicefile v0.0.0-20240606120523-5a60cdf6a761 // indirect
	github.com/jackc/pgx/v5 v5.10.0 // indirect
	github.com/jackc/puddle/v2 v2.2.2 // indirect
	github.com/jcmturner/aescts/v2 v2.0.0 // indirect
	github.com/jcmturner/dnsutils/v2 v2.0.0 // indirect
	github.com/jcmturner/gofork v1.7.6 // indirect
	github.com/jcmturner/rpc/v2 v2.0.3 // indirect
	github.com/jinzhu/inflection v1.0.0 // indirect
	github.com/jinzhu/now v1.1.5 // indirect
	github.com/jonboulle/clockwork v0.2.2 // indirect
	github.com/mattermost/xml-roundtrip-validator v0.1.0 // indirect
	github.com/rogpeppe/go-internal v1.16.0 // indirect
	golang.org/x/crypto v0.54.0 // indirect
	golang.org/x/sync v0.22.0 // indirect
	golang.org/x/text v0.40.0 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
	olympos.io/encoding/edn v0.0.0-20201019073823-d3554ca0b0a3 // indirect
)

require fesmu/contract v0.0.0

// Сгенерированный Go всех схем — make proto в корне монорепо.
replace fesmu/contract => ../../../packages/go

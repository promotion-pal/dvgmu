package config

import (
	"flag"
	"os"
	"time"

	"github.com/ilyakaznacheev/cleanenv"
)

type Config struct {
	Env      string         `yaml:"env" env:"ENV" env-default:"local"`
	GRPC     GRPCConfig     `yaml:"grpc"`
	Database DatabaseConfig `yaml:"database"`
	Auth     AuthConfig     `yaml:"auth"`
	LDAP     LDAPConfig     `yaml:"ldap"`
	IdP      IdPConfig      `yaml:"saml"`
	ADFS     ADFSConfig     `yaml:"adfs"`
	MDM      MDMConfig      `yaml:"mdm"`
	Session  SessionConfig  `yaml:"session"`
	Password PasswordConfig `yaml:"password"`
	Kerberos KerberosConfig `yaml:"kerberos"`
}

// KerberosConfig — смена пароля пользователем самому себе (/password) по
// kpasswd: без служебной учётки и без LDAPS. Пустой Realm — страница
// /password в режиме заглушки.
type KerberosConfig struct {
	Realm   string `yaml:"realm" env:"AUTH_KRB_REALM"`
	KDC     string `yaml:"kdc" env:"AUTH_KRB_KDC" env-default:"dvgmu-ad.dvgmu.local:88"`
	KPasswd string `yaml:"kpasswd" env:"AUTH_KRB_KPASSWD" env-default:"dvgmu-ad.dvgmu.local:464"`
}

type GRPCConfig struct {
	Port    int           `yaml:"port" env:"GRPC_PORT"`
	Timeout time.Duration `yaml:"timeout" env:"GRPC_TIMEOUT"`
	// AllowedOrigins — CORS-источники для Connect-RPC/SAML-роутов.
	AllowedOrigins []string `yaml:"allowed_origins" env:"ALLOWED_ORIGINS" env-separator:"," env-default:"http://localhost:3000,http://localhost:5173,https://auth.dvgmu.promotion-pal.ru"`
}

// DatabaseConfig — Postgres под справочник identities. Пустой DBName →
// справочник не поднимается.
type DatabaseConfig struct {
	Host     string `yaml:"host" env:"AUTH_DB_HOST" env-default:"localhost"`
	Port     string `yaml:"port" env:"AUTH_DB_PORT" env-default:"5432"`
	User     string `yaml:"user" env:"AUTH_DB_USER" env-default:"auth"`
	Password string `yaml:"password" env:"AUTH_DB_PASSWORD"`
	DBName   string `yaml:"dbname" env:"AUTH_DB_NAME"`
	SSLMode  string `yaml:"sslmode" env:"AUTH_DB_SSLMODE" env-default:"disable"`
}

type AuthConfig struct {
	// JWTSecret/AccessTokenTTL — SSO-сессия самого IdP (cookie CookieName из
	// IdPConfig): чтобы повторный вход в Yandex 360 не спрашивал пароль. Есть
	// у любого, кто вошёл через AD, связан он с MDM или нет. Токены fesmu —
	// отдельно, см. SessionConfig.
	JWTSecret      string        `yaml:"jwt_secret" env:"AUTH_JWT_SECRET"`
	AccessTokenTTL time.Duration `yaml:"access_token_ttl" env:"AUTH_ACCESS_TOKEN_TTL" env-default:"24h"`
	// InternalToken защищает служебные write-RPC (напр. IdentityService.LinkMDM)
	// от вызова снаружи — этот же Connect-сервер торчит наружу через Traefik
	// на auth.dvgmu.promotion-pal.ru, "внутри docker-сети" не защита сама
	// по себе. Пусто — такие RPC отклоняют любой запрос.
	InternalToken string `yaml:"internal_token" env:"AUTH_INTERNAL_TOKEN"`
}

type LDAPConfig struct {
	// URL — адрес контроллера домена, напр. ldap://192.168.2.222:389 или ldaps://host:636.
	URL string `yaml:"url" env:"AUTH_LDAP_URL"`
	// StartTLS — включить StartTLS поверх ldap:// (игнорируется для ldaps://).
	StartTLS bool `yaml:"start_tls" env:"AUTH_LDAP_START_TLS" env-default:"false"`
	// InsecureSkipVerify — не проверять сертификат сервера (только для тестовых стендов).
	InsecureSkipVerify bool `yaml:"insecure_skip_verify" env:"AUTH_LDAP_INSECURE_SKIP_VERIFY" env-default:"false"`
	// BindDN/BindPassword — служебная учётка для поиска пользователей (напр. ldapuser@dvgmu.local).
	BindDN       string `yaml:"bind_dn" env:"AUTH_LDAP_BIND_DN"`
	BindPassword string `yaml:"bind_password" env:"AUTH_LDAP_BIND_PASSWORD"`
	// BaseDN — корень поиска, напр. DC=dvgmu,DC=local.
	BaseDN string `yaml:"base_dn" env:"AUTH_LDAP_BASE_DN"`
	// UserFilter — шаблон фильтра поиска пользователя, %s заменяется на sAMAccountName.
	UserFilter string `yaml:"user_filter" env:"AUTH_LDAP_USER_FILTER" env-default:"(sAMAccountName=%s)"`
}

// IdPConfig — сторона SAML Identity Provider: auth выступает IdP для Yandex 360.
// Yandex редиректит пользователя на /saml/idp/sso, мы показываем свою форму
// логина, проверяем логин/пароль через AD FS (см. ADFSConfig) и возвращаем
// Yandex подписанный SAML-Response. Без CertPEM/KeyPEM роуты /saml/idp/* не
// поднимаются — это не "выключатель", а отражение того, что ключ подписи ещё
// не сгенерирован.
type IdPConfig struct {
	// EntityID — идентификатор ("издатель") этого IdP; ровно это значение
	// вводится в настройке SSO в Yandex 360 как "Идентификатор поставщика".
	EntityID string `yaml:"entity_id" env:"AUTH_SAML_IDP_ENTITY_ID" env-default:"https://auth.dvgmu.promotion-pal.ru/saml/idp/metadata"`
	// BaseURL — публичный базовый URL сервиса; от него строятся
	// /saml/idp/metadata и /saml/idp/sso (последний — это "SSO URL" для Yandex).
	BaseURL string `yaml:"base_url" env:"AUTH_SAML_IDP_BASE_URL" env-default:"https://auth.dvgmu.promotion-pal.ru"`
	// CertPEM/KeyPEM — сертификат и ключ подписи SAML-ответов (самоподписанные,
	// сгенерировать один раз и не менять — иначе Yandex перестанет доверять
	// подписи). Именно этот сертификат загружается в Yandex 360 как
	// "Сертификат поставщика".
	//   openssl req -x509 -newkey rsa:2048 -nodes -keyout idp.key -out idp.crt -days 3650 -subj "/CN=auth.dvgmu.promotion-pal.ru"
	CertPEM string `yaml:"cert_pem" env:"AUTH_SAML_IDP_CERT_PEM"`
	KeyPEM  string `yaml:"key_pem" env:"AUTH_SAML_IDP_KEY_PEM"`
	// SPEntityID — Entity ID Yandex 360 как SP (со слэшем на конце).
	SPEntityID string `yaml:"sp_entity_id" env:"AUTH_SAML_IDP_SP_ENTITY_ID" env-default:"https://yandex.ru/"`
	// SPACSURLs — список Assertion Consumer Service Yandex (HTTP-POST),
	// включая региональные (passport.yandex.ru/.com/...). Через запятую.
	SPACSURLs []string `yaml:"sp_acs_urls" env:"AUTH_SAML_IDP_SP_ACS_URLS" env-separator:"," env-default:"https://passport.yandex.ru/auth/sso/commit"`
	// EmailDomain — если AD FS не прислал email (у учётки не заполнен mail),
	// адрес достраивается как "<логин>@<EmailDomain>". Пусто — email обязателен.
	EmailDomain string `yaml:"email_domain" env:"AUTH_SAML_IDP_EMAIL_DOMAIN"`
	// NameIDSource — что кладём в <NameID> ответа: "email" (по умолчанию —
	// Yandex 360 сопоставляет пользователя по адресу), "guid" (objectGUID,
	// неизменяемый — если SP матчит по нему) или "upn" (userPrincipalName —
	// тот же логин, которым пользователя провизионит SCIM-синхронизация
	// services/sync/yandex-scim; нужен, если учётки в Yandex 360 уже заведены
	// по SCIM и матчить SSO-вход надо на них, а не на email).
	NameIDSource string `yaml:"name_id_source" env:"AUTH_SAML_IDP_NAMEID" env-default:"email"`
	// NameIDFormat — формат NameID при NameIDSource=guid или upn. Для email формат
	// всегда emailAddress.
	NameIDFormat string `yaml:"name_id_format" env:"AUTH_SAML_IDP_NAME_ID_FORMAT" env-default:"urn:oasis:names:tc:SAML:2.0:nameid-format:persistent"`
	// CookieDomain/CookieName — cookie с JWT, которую auth ставит после
	// успешного логина (для внутреннего SSO прочих сервисов на поддоменах).
	CookieDomain string `yaml:"cookie_domain" env:"AUTH_SAML_IDP_COOKIE_DOMAIN" env-default:".dvgmu.promotion-pal.ru"`
	CookieName   string `yaml:"cookie_name" env:"AUTH_SAML_IDP_COOKIE_NAME" env-default:"dvgmu_session"`
	// HelpDeskURL — ссылка на Help Desk, показывается на форме логина при
	// неудачном входе (у части учёток AD не настроен/кривой email, а простой
	// повтор пароля это не чинит). Пусто — блок не показывается.
	HelpDeskURL string `yaml:"help_desk_url" env:"AUTH_SAML_IDP_HELPDESK_URL" env-default:"https://hd.fesmu.ru"`
	// ForceLogin — каждый вход (Yandex 360 и /login) только через ввод логина
	// и пароля на нашей форме: SSO-сессия IdP не пропускает без пароля. Вход
	// в Яндекс всё равно сразу выдаёт токены fesmu — в core без второго входа.
	ForceLogin bool `yaml:"force_login" env:"AUTH_SAML_IDP_FORCE_LOGIN" env-default:"true"`
	// LoginAllowedReturnHosts — allow-list хостов для ?return= на /login
	// (SSO для остальных приложений, не через SAML/Yandex) — защита от open
	// redirect. Пусто — сработает только LoginDefaultReturnURL.
	LoginAllowedReturnHosts []string `yaml:"login_allowed_return_hosts" env:"AUTH_LOGIN_ALLOWED_RETURN_HOSTS" env-separator:","`
	// LoginDefaultReturnURL — куда редиректить после /login, если ?return= не передан.
	LoginDefaultReturnURL string `yaml:"login_default_return_url" env:"AUTH_LOGIN_DEFAULT_RETURN_URL"`
}

// ADFSConfig — как auth изнутри сети проверяет логин/пароль: WS-Trust-запрос
// (usernamemixed) в AD FS, который возвращает подписанную SAML-ассерцию с
// данными пользователя. Пусто (WSTrustURL) — /saml/idp/sso вернёт понятную
// ошибку, пока админ AD FS не заведёт Relying Party Trust на RelyingPartyID.
type ADFSConfig struct {
	// WSTrustURL — обычно https://<adfs-host>/adfs/services/trust/13/usernamemixed
	WSTrustURL string `yaml:"ws_trust_url" env:"AUTH_ADFS_WSTRUST_URL"`
	// RelyingPartyID — идентификатор Relying Party Trust этого брокера в AD FS
	// (значение <wsa:Address> в <AppliesTo>). По умолчанию совпадает с нашим
	// SAML EntityID.
	RelyingPartyID string `yaml:"relying_party_id" env:"AUTH_ADFS_RELYING_PARTY_ID"`
	// SigningCertPEM — token-signing сертификат AD FS для проверки подписи
	// возвращаемой ассерции. Пусто — подпись не проверяется (только лог-warn).
	SigningCertPEM string `yaml:"signing_cert_pem" env:"AUTH_ADFS_SIGNING_CERT_PEM"`
	// ObjectGUIDClaim — имя claim, в котором AD FS отдаёт objectGUID (base64).
	// Пусто — objectGUID берётся отдельным LDAP-поиском (нужен AUTH_LDAP_*).
	ObjectGUIDClaim string `yaml:"object_guid_claim" env:"AUTH_ADFS_OBJECT_GUID_CLAIM"`
	// UPNSuffix — если пользователь ввёл логин без домена (ivanov), auth
	// дописывает "@<suffix>" перед запросом в AD FS: usernamemixed не принимает
	// голый sAMAccountName. Напр. dvgmu.local. Пусто — логин уходит как есть.
	UPNSuffix string `yaml:"upn_suffix" env:"AUTH_ADFS_UPN_SUFFIX"`
	// InsecureSkipVerify — не проверять TLS-сертификат AD FS (только тестовые стенды).
	InsecureSkipVerify bool          `yaml:"insecure_skip_verify" env:"AUTH_ADFS_INSECURE_SKIP_VERIFY" env-default:"false"`
	Timeout            time.Duration `yaml:"timeout" env:"AUTH_ADFS_TIMEOUT" env-default:"10s"`
}

// MDMConfig — адрес services/mdm: после входа через AD пользователь ищется
// там по objectGUID (users.ad_object_id). Пусто — токены fesmu не выдаются
// никому, вход в Yandex 360 работает.
type MDMConfig struct {
	ServiceURL string `yaml:"service_url" env:"AUTH_MDM_SERVICE_URL"`
	// InternalToken — MDM_INTERNAL_TOKEN у mdm: проверка кодов активации.
	InternalToken string `yaml:"-" env:"AUTH_MDM_INTERNAL_TOKEN"`
}

// PasswordConfig — запись паролей в AD (/activate, /password): служебная
// учётка с правом «Сброс пароля» на OU пользователей и ТОЛЬКО защищённое
// соединение (ldaps://…:636) — по открытому AD пароль не меняет. Пусто —
// страницы отвечают «временно недоступно». Поиск — от AUTH_LDAP_BASE_DN.
type PasswordConfig struct {
	URL                string `yaml:"url" env:"AUTH_LDAP_PWD_URL"`
	BindDN             string `yaml:"bind_dn" env:"AUTH_LDAP_PWD_BIND_DN"`
	BindPassword       string `yaml:"-" env:"AUTH_LDAP_PWD_BIND_PASSWORD"`
	InsecureSkipVerify bool   `yaml:"insecure_skip_verify" env:"AUTH_LDAP_PWD_INSECURE_SKIP_VERIFY" env-default:"false"`
}

// SessionConfig — токены fesmu для пользователей, связанных с MDM:
// access-JWT (EdDSA, sub = mdm uuid, username, roles) и refresh-токен в БД.
// Оба только в HttpOnly-cookie.
type SessionConfig struct {
	// SigningKeyPEM — приватный Ed25519-ключ подписи access-токенов (PKCS8 PEM):
	//   openssl genpkey -algorithm ed25519
	// Публичная часть отдаётся в /.well-known/jwks.json. Пусто — ключ
	// генерируется при старте (токены перестают проверяться после рестарта).
	SigningKeyPEM string        `yaml:"-" env:"AUTH_JWT_SIGNING_KEY_PEM"`
	Issuer        string        `yaml:"issuer" env:"AUTH_JWT_ISSUER" env-default:"auth-service"`
	Audience      string        `yaml:"audience" env:"AUTH_JWT_AUDIENCE" env-default:"fesmu"`
	AccessTTL     time.Duration `yaml:"access_ttl" env:"AUTH_ACCESS_TTL" env-default:"15m"`
	RefreshTTL    time.Duration `yaml:"refresh_ttl" env:"AUTH_REFRESH_TTL" env-default:"720h"`
	// CookieDomain — домен access-cookie (напр. .fesmu.ru), чтобы её видел
	// api fesmu на другом поддомене. Refresh-cookie всегда только на хосте auth.
	CookieDomain  string `yaml:"cookie_domain" env:"AUTH_COOKIE_DOMAIN"`
	AccessCookie  string `yaml:"access_cookie" env:"AUTH_ACCESS_COOKIE" env-default:"fesmu_at"`
	RefreshCookie string `yaml:"refresh_cookie" env:"AUTH_REFRESH_COOKIE" env-default:"fesmu_rt"`
}

func MustLoad() *Config {
	configPath := fetchConfigPath()
	if configPath == "" {
		panic("config path is empty")
	}

	return MustLoadPath(configPath)
}

func MustLoadPath(configPath string) *Config {
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		panic("config file does not exist: " + configPath)
	}

	var cfg Config

	if err := cleanenv.ReadConfig(configPath, &cfg); err != nil {
		panic("cannot read config: " + err.Error())
	}

	return &cfg
}

func fetchConfigPath() string {
	var res string

	if !flag.Parsed() {
		flag.StringVar(&res, "config", "", "path to config file")
		flag.Parse()
	}

	if res == "" {
		res = os.Getenv("CONFIG_PATH")
	}

	return res
}

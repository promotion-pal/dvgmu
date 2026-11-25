// Заглушка AD FS для локального запуска: отвечает на WS-Trust usernamemixed так
// же, как настоящий AD FS, но пользователей берёт из users.json. auth не
// отличает её от AD FS — проверка подписи выключена, потому что
// AUTH_ADFS_SIGNING_CERT_PEM не задан. Только для разработки: на проде auth
// смотрит в настоящий AD FS и проверяет подпись.
package main

import (
	"encoding/json"
	"encoding/xml"
	"fmt"
	"html"
	"io"
	"log"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"
)

type user struct {
	Login      string `json:"login"`
	Password   string `json:"password"`
	ObjectGUID string `json:"object_guid"`
	Email      string `json:"email"`
	FirstName  string `json:"first_name"`
	LastName   string `json:"last_name"`
}

// Имя claim с objectGUID — то же значение задаётся auth в AUTH_ADFS_OBJECT_GUID_CLAIM.
const guidClaim = "http://schemas.microsoft.com/identity/claims/objectguid"

var (
	// Точное имя тега: <o:Username> — не <o:UsernameToken>.
	usernameRe = regexp.MustCompile(`(?s)<(?:\w+:)?Username(?:\s[^>]*)?>(.*?)</(?:\w+:)?Username>`)
	passwordRe = regexp.MustCompile(`(?s)<(?:\w+:)?Password(?:\s[^>]*)?>(.*?)</(?:\w+:)?Password>`)
	appliesRe  = regexp.MustCompile(`(?s)<(?:\w+:)?Address(?:\s[^>]*)?>(.*?)</(?:\w+:)?Address>`)
)

func main() {
	path := envOr("USERS_FILE", "/app/users.json")
	raw, err := os.ReadFile(path)
	if err != nil {
		log.Fatalf("read %s: %v", path, err)
	}
	var users []user
	if err := json.Unmarshal(raw, &users); err != nil {
		log.Fatalf("parse %s: %v", path, err)
	}
	byLogin := map[string]user{}
	for _, u := range users {
		byLogin[strings.ToLower(u.Login)] = u
	}
	log.Printf("adfs-mock: %d пользователей из %s", len(users), path)

	http.HandleFunc("/adfs/services/trust/13/usernamemixed", func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(io.LimitReader(r.Body, 1<<20))
		login := normalize(unescape(first(usernameRe, body)))
		password := unescape(first(passwordRe, body))
		u, ok := byLogin[login]
		w.Header().Set("Content-Type", "application/soap+xml; charset=utf-8")
		if !ok || u.Password != password {
			log.Printf("adfs-mock: отказ для %q", login)
			w.WriteHeader(http.StatusInternalServerError)
			io.WriteString(w, fault)
			return
		}
		log.Printf("adfs-mock: вход %q", login)
		io.WriteString(w, response(u, unescape(first(appliesRe, body))))
	})
	http.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) { io.WriteString(w, "ok") })

	addr := envOr("ADDR", ":8080")
	log.Printf("adfs-mock: слушаю %s", addr)
	log.Fatal(http.ListenAndServe(addr, nil))
}

// normalize — логин без домена: "FESMU\ivanov", "ivanov@fesmu.local" → "ivanov".
func normalize(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	if i := strings.LastIndex(s, `\`); i >= 0 {
		s = s[i+1:]
	}
	if i := strings.Index(s, "@"); i >= 0 {
		s = s[:i]
	}
	return s
}

func response(u user, audience string) string {
	now := time.Now().UTC()
	t := func(d time.Duration) string { return now.Add(d).Format("2006-01-02T15:04:05.000Z") }
	attr := func(name, value string) string {
		return fmt.Sprintf(`<saml:Attribute Name="%s"><saml:AttributeValue>%s</saml:AttributeValue></saml:Attribute>`,
			name, esc(value))
	}
	return `<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"><s:Body>` +
		`<trust:RequestSecurityTokenResponseCollection xmlns:trust="http://docs.oasis-open.org/ws-sx/ws-trust/200512">` +
		`<trust:RequestSecurityTokenResponse><trust:RequestedSecurityToken>` +
		`<saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="_` + fmt.Sprint(now.UnixNano()) +
		`" IssueInstant="` + t(0) + `" Version="2.0">` +
		`<saml:Issuer>http://adfs-mock/adfs/services/trust</saml:Issuer>` +
		`<saml:Subject><saml:NameID>` + esc(u.Email) + `</saml:NameID></saml:Subject>` +
		`<saml:Conditions NotBefore="` + t(-time.Minute) + `" NotOnOrAfter="` + t(time.Hour) + `">` +
		`<saml:AudienceRestriction><saml:Audience>` + esc(audience) + `</saml:Audience></saml:AudienceRestriction></saml:Conditions>` +
		`<saml:AttributeStatement>` +
		attr("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress", u.Email) +
		attr("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname", u.FirstName) +
		attr("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname", u.LastName) +
		attr(guidClaim, u.ObjectGUID) +
		`</saml:AttributeStatement>` +
		`<saml:AuthnStatement AuthnInstant="` + t(0) + `"><saml:AuthnContext><saml:AuthnContextClassRef>` +
		`urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement>` +
		`</saml:Assertion></trust:RequestedSecurityToken></trust:RequestSecurityTokenResponse>` +
		`</trust:RequestSecurityTokenResponseCollection></s:Body></s:Envelope>`
}

// Тот же отказ, что у AD FS при неверном пароле: auth распознаёт его как
// «неверный логин или пароль».
const fault = `<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"><s:Body><s:Fault>` +
	`<s:Code><s:Value>s:Sender</s:Value><s:Subcode><s:Value xmlns:a="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">a:FailedAuthentication</s:Value></s:Subcode></s:Code>` +
	`<s:Reason><s:Text xml:lang="en-US">ID3242: The security token could not be authenticated or authorized.</s:Text></s:Reason>` +
	`</s:Fault></s:Body></s:Envelope>`

func first(re *regexp.Regexp, b []byte) string {
	if m := re.FindSubmatch(b); m != nil {
		return string(m[1])
	}
	return ""
}

func unescape(s string) string { return html.UnescapeString(s) }

func esc(s string) string {
	var b strings.Builder
	_ = xml.EscapeText(&b, []byte(s))
	return b.String()
}

func envOr(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

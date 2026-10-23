package saml

import (
	"bytes"
	"compress/flate"
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/base64"
	"encoding/pem"
	"encoding/xml"
	"fmt"
	"html"
	"math/big"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	crewjamsaml "github.com/crewjam/saml"

	"dvgmu/auth/internal/config"
	"dvgmu/auth/internal/domain/models"
	"dvgmu/auth/internal/utils"
	token "dvgmu/auth/internal/utils/token"
)

func mustErrInvalidCreds() error { return utils.ErrInvalidCredentials }

type fakeADFS struct {
	assertion *crewjamsaml.Assertion
	err       error
}

func (f fakeADFS) RequestAssertion(context.Context, string, string) (*crewjamsaml.Assertion, error) {
	return f.assertion, f.err
}

func genKeyPair(t *testing.T) (certPEM, keyPEM string) {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	tmpl := &x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject:      pkix.Name{CommonName: "auth.test"},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().Add(24 * time.Hour),
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &key.PublicKey, key)
	if err != nil {
		t.Fatal(err)
	}
	certPEM = string(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}))
	keyPEM = string(pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(key)}))
	return
}

func testIdP(t *testing.T, adfs ADFSAuthenticator) *IdP {
	t.Helper()
	return testIdPWith(t, adfs, false)
}

func testIdPWith(t *testing.T, adfs ADFSAuthenticator, forceLogin bool) *IdP {
	t.Helper()
	certPEM, keyPEM := genKeyPair(t)
	cfg := config.IdPConfig{
		EntityID:     "http://auth.test/saml/idp/metadata",
		BaseURL:      "http://auth.test",
		CertPEM:      certPEM,
		KeyPEM:       keyPEM,
		SPEntityID:   "https://yandex.ru/",
		SPACSURLs:    []string{"https://passport.yandex.ru/auth/sso/commit"},
		NameIDFormat: "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent",
		CookieName:   "dvgmu_session",
		HelpDeskURL:  "https://hd.fesmu.ru",
		ForceLogin:   forceLogin,
	}
	idp, err := NewIdP(cfg, SessionDeps{
		ADFS:      adfs,
		Tokens:    token.NewManager("test-secret", time.Hour),
		GUIDClaim: "objectGUID",
	})
	if err != nil {
		t.Fatalf("NewIdP: %v", err)
	}
	if idp == nil {
		t.Fatal("NewIdP returned nil")
	}
	return idp
}

func authnRequestGET(t *testing.T) *http.Request {
	t.Helper()
	xmlReq := fmt.Sprintf(`<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="_req1" Version="2.0" IssueInstant="%s" Destination="http://auth.test/saml/idp/sso" AssertionConsumerServiceURL="https://passport.yandex.ru/auth/sso/commit" ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"><saml:Issuer>https://yandex.ru/</saml:Issuer></samlp:AuthnRequest>`,
		time.Now().UTC().Format(time.RFC3339))

	var deflated bytes.Buffer
	fw, _ := flate.NewWriter(&deflated, flate.DefaultCompression)
	_, _ = fw.Write([]byte(xmlReq))
	_ = fw.Close()
	encoded := base64.StdEncoding.EncodeToString(deflated.Bytes())

	u := "http://auth.test/saml/idp/sso?SAMLRequest=" + url.QueryEscape(encoded) + "&RelayState=abc123"
	return httptest.NewRequest(http.MethodGet, u, nil)
}

func cannedAssertion(t *testing.T) *crewjamsaml.Assertion {
	t.Helper()
	guid := base64.StdEncoding.EncodeToString(bytes.Repeat([]byte{0x11}, 16))
	raw := `<Assertion xmlns="urn:oasis:names:tc:SAML:2.0:assertion" ID="_a" Version="2.0" IssueInstant="2026-09-08T00:00:00Z"><Issuer>adfs</Issuer><AttributeStatement>` +
		`<Attribute Name="User.EmailAddress"><AttributeValue>ivanov@fesmu.ru</AttributeValue></Attribute>` +
		`<Attribute Name="User.Firstname"><AttributeValue>Ivan</AttributeValue></Attribute>` +
		`<Attribute Name="User.Surname"><AttributeValue>Ivanov</AttributeValue></Attribute>` +
		`<Attribute Name="objectGUID"><AttributeValue>` + guid + `</AttributeValue></Attribute>` +
		`</AttributeStatement></Assertion>`
	var a crewjamsaml.Assertion
	if err := xml.Unmarshal([]byte(raw), &a); err != nil {
		t.Fatal(err)
	}
	return &a
}

func TestIdPFlow_ShowsLoginFormThenPostsSignedResponse(t *testing.T) {
	idp := testIdP(t, fakeADFS{assertion: cannedAssertion(t)})

	// 1. GET с AuthnRequest -> форма логина
	getReq := authnRequestGET(t)
	getRec := httptest.NewRecorder()
	idp.ServeSSO(getRec, getReq)

	if getRec.Code != http.StatusOK {
		t.Fatalf("GET /sso: status %d, body: %s", getRec.Code, getRec.Body.String())
	}
	body := getRec.Body.String()
	if !strings.Contains(body, `name="username"`) || !strings.Contains(body, `name="SAMLRequest"`) {
		t.Fatalf("login form missing fields: %s", body)
	}
	if !strings.Contains(body, "hd.fesmu.ru") {
		t.Fatalf("help desk block must be shown on the clean form too: %s", body)
	}

	samlReqField := extractHiddenValue(t, body, "SAMLRequest")
	relayField := extractHiddenValue(t, body, "RelayState")
	if relayField != "abc123" {
		t.Fatalf("RelayState not preserved: %q", relayField)
	}

	// 2. POST с учётными данными + пробросом AuthnRequest -> авто-сабмит форма на ACS
	form := url.Values{}
	form.Set("username", "ivanov@fesmu.ru")
	form.Set("password", "secret")
	form.Set("SAMLRequest", samlReqField)
	form.Set("RelayState", relayField)

	postReq := httptest.NewRequest(http.MethodPost, "http://auth.test/saml/idp/sso", strings.NewReader(form.Encode()))
	postReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	postRec := httptest.NewRecorder()
	idp.ServeSSO(postRec, postReq)

	if postRec.Code != http.StatusOK {
		t.Fatalf("POST /sso: status %d, body: %s", postRec.Code, postRec.Body.String())
	}
	out := postRec.Body.String()
	if !strings.Contains(out, "https://passport.yandex.ru/auth/sso/commit") {
		t.Fatalf("response form does not target Yandex ACS: %s", out)
	}
	if !strings.Contains(out, `name="RelayState" value="abc123"`) {
		t.Fatalf("RelayState not echoed to ACS: %s", out)
	}

	// session cookie выставлена
	if cookies := postRec.Result().Cookies(); len(cookies) == 0 || cookies[0].Name != "dvgmu_session" {
		t.Fatalf("session cookie not set: %#v", cookies)
	}

	// декодируем SAMLResponse
	respB64 := extractHiddenValue(t, out, "SAMLResponse")
	respXML, err := base64.StdEncoding.DecodeString(respB64)
	if err != nil {
		t.Fatalf("decode SAMLResponse: %v", err)
	}
	s := string(respXML)
	if !strings.Contains(s, "ds:Signature") && !strings.Contains(s, ":Signature") {
		t.Fatalf("SAMLResponse is not signed: %s", s)
	}
	// NameID по умолчанию = email (Yandex 360 матчит по адресу)
	if !strings.Contains(s, `nameid-format:emailAddress">ivanov@fesmu.ru</saml:NameID>`) &&
		!strings.Contains(s, `>ivanov@fesmu.ru</saml:NameID>`) {
		t.Fatalf("NameID должен быть email: %s", s)
	}
	if !strings.Contains(s, "User.EmailAddress") || !strings.Contains(s, "ivanov@fesmu.ru") {
		t.Fatalf("email attribute missing: %s", s)
	}
}

func TestIdPFlow_InvalidPasswordRerendersForm(t *testing.T) {
	idp := testIdP(t, fakeADFS{err: mustErrInvalidCreds()})

	getRec := httptest.NewRecorder()
	idp.ServeSSO(getRec, authnRequestGET(t))
	samlReqField := extractHiddenValue(t, getRec.Body.String(), "SAMLRequest")

	form := url.Values{}
	form.Set("username", "ivanov@fesmu.ru")
	form.Set("password", "wrong")
	form.Set("SAMLRequest", samlReqField)

	postReq := httptest.NewRequest(http.MethodPost, "http://auth.test/saml/idp/sso", strings.NewReader(form.Encode()))
	postReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	postRec := httptest.NewRecorder()
	idp.ServeSSO(postRec, postReq)

	if postRec.Code != http.StatusUnauthorized {
		t.Fatalf("want 401, got %d", postRec.Code)
	}
	body := postRec.Body.String()
	if !strings.Contains(body, "Неверный логин или пароль") {
		t.Fatalf("error banner missing: %s", body)
	}
	if strings.Contains(body, "SAMLResponse") {
		t.Fatalf("must not issue a response on bad credentials")
	}
	if !strings.Contains(body, "https://hd.fesmu.ru") {
		t.Fatalf("help desk block missing on failed login: %s", body)
	}
}

// cannedAssertionMissingFirstName — AD FS прислал Surname, но не Firstname
// (типичная неполная учётка AD).
func cannedAssertionMissingFirstName(t *testing.T) *crewjamsaml.Assertion {
	t.Helper()
	guid := base64.StdEncoding.EncodeToString(bytes.Repeat([]byte{0x22}, 16))
	raw := `<Assertion xmlns="urn:oasis:names:tc:SAML:2.0:assertion" ID="_a" Version="2.0" IssueInstant="2026-09-08T00:00:00Z"><Issuer>adfs</Issuer><AttributeStatement>` +
		`<Attribute Name="User.EmailAddress"><AttributeValue>derbentsev@fesmu.ru</AttributeValue></Attribute>` +
		`<Attribute Name="User.Surname"><AttributeValue>Дербенцев</AttributeValue></Attribute>` +
		`<Attribute Name="objectGUID"><AttributeValue>` + guid + `</AttributeValue></Attribute>` +
		`</AttributeStatement></Assertion>`
	var a crewjamsaml.Assertion
	if err := xml.Unmarshal([]byte(raw), &a); err != nil {
		t.Fatal(err)
	}
	return &a
}

// TestIdPFlow_IncompleteNameStillLogsIn — регрессия: неполное ФИО от AD FS
// НЕ должно блокировать вход (уже пробовали блокировать, пользователь явно
// попросил откатить). Логируется предупреждение, но SAML-Response выпускается
// как обычно — что прислал AD FS, то и уходит в Yandex.
func TestIdPFlow_IncompleteNameStillLogsIn(t *testing.T) {
	idp := testIdP(t, fakeADFS{assertion: cannedAssertionMissingFirstName(t)})

	getRec := httptest.NewRecorder()
	idp.ServeSSO(getRec, authnRequestGET(t))
	samlReqField := extractHiddenValue(t, getRec.Body.String(), "SAMLRequest")

	form := url.Values{}
	form.Set("username", "derbentsev@fesmu.ru")
	form.Set("password", "correct")
	form.Set("SAMLRequest", samlReqField)

	postReq := httptest.NewRequest(http.MethodPost, "http://auth.test/saml/idp/sso", strings.NewReader(form.Encode()))
	postReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	postRec := httptest.NewRecorder()
	idp.ServeSSO(postRec, postReq)

	if postRec.Code != http.StatusOK {
		t.Fatalf("incomplete name must NOT block login: status %d, body: %s", postRec.Code, postRec.Body.String())
	}
	if !strings.Contains(postRec.Body.String(), "https://passport.yandex.ru/auth/sso/commit") {
		t.Fatalf("response form does not target Yandex ACS: %s", postRec.Body.String())
	}
}

func extractHiddenValue(t *testing.T, page, name string) string {
	t.Helper()
	marker := `name="` + name + `" value="`
	i := strings.Index(page, marker)
	if i < 0 {
		t.Fatalf("field %q not found in: %s", name, page)
	}
	rest := page[i+len(marker):]
	return html.UnescapeString(rest[:strings.Index(rest, `"`)])
}

// ForceLogin: живая SSO-сессия не пропускает в Yandex 360 без формы.
func TestIdPFlow_ForceLoginIgnoresSSOCookie(t *testing.T) {
	sso, _, err := token.NewManager("test-secret", time.Hour).Issue(
		&models.User{ExternalID: "guid-1", Email: "ivanov@fesmu.ru"}, token.ProviderSAML)
	if err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		force    bool
		wantForm bool
	}{{true, true}, {false, false}} {
		idp := testIdPWith(t, fakeADFS{}, tc.force)
		req := authnRequestGET(t)
		req.AddCookie(&http.Cookie{Name: "dvgmu_session", Value: sso})
		rec := httptest.NewRecorder()
		idp.ServeSSO(rec, req)

		body := rec.Body.String()
		gotForm := strings.Contains(body, `name="username"`)
		if gotForm != tc.wantForm {
			t.Fatalf("force=%v: login form shown=%v, body: %.300s", tc.force, gotForm, body)
		}
		if !tc.wantForm && !strings.Contains(body, "SAMLResponse") {
			t.Fatalf("force=false: expected SAMLResponse from the SSO session, body: %.300s", body)
		}
	}
}

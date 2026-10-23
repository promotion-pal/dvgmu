package adfs

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"encoding/hex"
	"encoding/pem"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"strings"
	"text/template"
	"time"

	"github.com/beevik/etree"
	crewjamsaml "github.com/crewjam/saml"
	dsig "github.com/russellhaering/goxmldsig"

	"dvgmu/auth/internal/utils"
)

const (
	wsTrustNS        = "http://docs.oasis-open.org/ws-sx/ws-trust/200512"
	actionIssue      = wsTrustNS + "/RST/Issue"
	requestTypeIssue = wsTrustNS + "/Issue"
	keyTypeBearer    = wsTrustNS + "/Bearer"
	samlTokenType    = "urn:oasis:names:tc:SAML:2.0:assertion"
	timeLayout       = "2006-01-02T15:04:05.000Z"
)

type Config struct {
	WSTrustURL         string
	RelyingPartyID     string
	SigningCertPEM     string
	InsecureSkipVerify bool
	Timeout            time.Duration
}

type Client struct {
	cfg         Config
	http        *http.Client
	signingCert *x509.Certificate
}

func NewClient(cfg Config) (*Client, error) {
	if cfg.Timeout == 0 {
		cfg.Timeout = 10 * time.Second
	}
	c := &Client{
		cfg: cfg,
		http: &http.Client{
			Timeout: cfg.Timeout,
			Transport: &http.Transport{
				TLSClientConfig: &tls.Config{InsecureSkipVerify: cfg.InsecureSkipVerify}, //nolint:gosec // тестовый стенд AD FS
			},
		},
	}

	if strings.TrimSpace(cfg.SigningCertPEM) != "" {
		block, _ := pem.Decode([]byte(cfg.SigningCertPEM))
		if block == nil {
			return nil, fmt.Errorf("adfs signing_cert_pem: not a valid PEM block")
		}
		cert, err := x509.ParseCertificate(block.Bytes)
		if err != nil {
			return nil, fmt.Errorf("adfs signing_cert_pem: %w", err)
		}
		c.signingCert = cert
	}

	return c, nil
}

func (c *Client) Enabled() bool {
	return c != nil && strings.TrimSpace(c.cfg.WSTrustURL) != ""
}

func (c *Client) VerifiesSignature() bool { return c != nil && c.signingCert != nil }

var rstTemplate = template.Must(template.New("rst").Parse(strings.Join([]string{
	`<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"`,
	` xmlns:a="http://www.w3.org/2005/08/addressing"`,
	` xmlns:u="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">`,
	`<s:Header>`,
	`<a:Action s:mustUnderstand="1">{{.Action}}</a:Action>`,
	`<a:To s:mustUnderstand="1">{{.To}}</a:To>`,
	`<o:Security s:mustUnderstand="1" xmlns:o="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">`,
	`<u:Timestamp u:Id="_0"><u:Created>{{.Created}}</u:Created><u:Expires>{{.Expires}}</u:Expires></u:Timestamp>`,
	`<o:UsernameToken u:Id="{{.TokenID}}"><o:Username>{{.Username}}</o:Username><o:Password>{{.Password}}</o:Password></o:UsernameToken>`,
	`</o:Security>`,
	`</s:Header>`,
	`<s:Body>`,
	`<trust:RequestSecurityToken xmlns:trust="http://docs.oasis-open.org/ws-sx/ws-trust/200512">`,
	`<wsp:AppliesTo xmlns:wsp="http://schemas.xmlsoap.org/ws/2004/09/policy">`,
	`<a:EndpointReference><a:Address>{{.AppliesTo}}</a:Address></a:EndpointReference>`,
	`</wsp:AppliesTo>`,
	`<trust:KeyType>{{.KeyType}}</trust:KeyType>`,
	`<trust:RequestType>{{.RequestType}}</trust:RequestType>`,
	`<trust:TokenType>{{.TokenType}}</trust:TokenType>`,
	`</trust:RequestSecurityToken>`,
	`</s:Body>`,
	`</s:Envelope>`,
}, "")))

func (c *Client) RequestAssertion(ctx context.Context, username, password string) (*crewjamsaml.Assertion, error) {
	now := time.Now().UTC()

	var body bytes.Buffer
	if err := rstTemplate.Execute(&body, map[string]string{
		"Action":      actionIssue,
		"To":          c.cfg.WSTrustURL,
		"Created":     now.Format(timeLayout),
		"Expires":     now.Add(5 * time.Minute).Format(timeLayout),
		"TokenID":     "uuid-" + randHex(16),
		"Username":    xmlEscape(username),
		"Password":    xmlEscape(password),
		"AppliesTo":   xmlEscape(c.cfg.RelyingPartyID),
		"KeyType":     keyTypeBearer,
		"RequestType": requestTypeIssue,
		"TokenType":   samlTokenType,
	}); err != nil {
		return nil, fmt.Errorf("adfs: build RST: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.cfg.WSTrustURL, &body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", fmt.Sprintf("application/soap+xml; charset=utf-8; action=%q", actionIssue))

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("adfs: ws-trust request: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, fmt.Errorf("adfs: read response: %w", err)
	}

	return c.parseResponse(raw)
}

func (c *Client) parseResponse(raw []byte) (*crewjamsaml.Assertion, error) {
	doc := etree.NewDocument()
	if err := doc.ReadFromBytes(raw); err != nil {
		return nil, fmt.Errorf("adfs: parse soap response: %w", err)
	}

	if fault := doc.FindElement("//*[local-name()='Fault']"); fault != nil {
		reason := strings.TrimSpace(textOf(fault.FindElement(".//*[local-name()='Text']")))
		subcode := strings.TrimSpace(textOf(fault.FindElement(".//*[local-name()='Subcode']/*[local-name()='Value']")))
		if strings.Contains(subcode, "FailedAuthentication") ||
			strings.Contains(strings.ToLower(reason), "incorrect") ||
			strings.Contains(strings.ToLower(reason), "authentication failure") {
			return nil, utils.ErrInvalidCredentials
		}
		return nil, fmt.Errorf("adfs ws-trust fault: %s %s", subcode, reason)
	}

	assertionEl := doc.FindElement("//*[local-name()='RequestedSecurityToken']/*[local-name()='Assertion']")
	if assertionEl == nil {
		return nil, fmt.Errorf("adfs: response contains no SAML assertion")
	}
	assertionEl = withInheritedNamespaces(assertionEl)

	if c.signingCert != nil {
		if err := c.verifySignature(assertionEl); err != nil {
			return nil, fmt.Errorf("verify assertion signature: %w", err)
		}
	}

	frag := etree.NewDocument()
	frag.SetRoot(assertionEl)
	xmlBytes, err := frag.WriteToBytes()
	if err != nil {
		return nil, err
	}

	var assertion crewjamsaml.Assertion
	if err := xml.Unmarshal(xmlBytes, &assertion); err != nil {
		return nil, fmt.Errorf("adfs: unmarshal assertion: %w", err)
	}
	return &assertion, nil
}

func (c *Client) verifySignature(el *etree.Element) error {
	store := &dsig.MemoryX509CertificateStore{Roots: []*x509.Certificate{c.signingCert}}
	ctx := dsig.NewDefaultValidationContext(store)
	ctx.IdAttribute = "ID"
	if _, err := ctx.Validate(el); err != nil {
		return err
	}
	return nil
}

func withInheritedNamespaces(el *etree.Element) *etree.Element {
	clone := el.Copy()
	seen := map[string]bool{}
	for _, a := range clone.Attr {
		if a.Space == "xmlns" || (a.Space == "" && a.Key == "xmlns") {
			seen[a.FullKey()] = true
		}
	}
	for p := el.Parent(); p != nil; p = p.Parent() {
		for _, a := range p.Attr {
			if (a.Space == "xmlns" || (a.Space == "" && a.Key == "xmlns")) && !seen[a.FullKey()] {
				clone.Attr = append(clone.Attr, a)
				seen[a.FullKey()] = true
			}
		}
	}
	return clone
}

func textOf(el *etree.Element) string {
	if el == nil {
		return ""
	}
	return el.Text()
}

func xmlEscape(s string) string {
	var b bytes.Buffer
	_ = xml.EscapeText(&b, []byte(s))
	return b.String()
}

func randHex(n int) string {
	buf := make([]byte, n)
	_, _ = rand.Read(buf)
	return hex.EncodeToString(buf)
}

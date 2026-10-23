package adfs

import (
	"errors"
	"strings"
	"testing"

	"dvgmu/auth/internal/utils"
)

func newTestClient(t *testing.T) *Client {
	t.Helper()
	c, err := NewClient(Config{WSTrustURL: "https://adfs.example/adfs/services/trust/13/usernamemixed"})
	if err != nil {
		t.Fatalf("NewClient: %v", err)
	}
	return c
}

const rstrOK = `<?xml version="1.0"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <s:Body>
    <trust:RequestSecurityTokenResponseCollection xmlns:trust="http://docs.oasis-open.org/ws-sx/ws-trust/200512">
      <trust:RequestSecurityTokenResponse>
        <trust:RequestedSecurityToken>
          <Assertion xmlns="urn:oasis:names:tc:SAML:2.0:assertion" ID="_a1" Version="2.0" IssueInstant="2026-09-08T00:00:00Z">
            <Issuer>http://adfs.example/adfs/services/trust</Issuer>
            <Subject><NameID>ivanov@fesmu.ru</NameID></Subject>
            <AttributeStatement>
              <Attribute Name="User.EmailAddress"><AttributeValue>Ivanov@fesmu.ru</AttributeValue></Attribute>
              <Attribute Name="User.Firstname"><AttributeValue>Иван</AttributeValue></Attribute>
              <Attribute Name="User.Surname"><AttributeValue>Иванов</AttributeValue></Attribute>
              <Attribute Name="objectGUID"><AttributeValue>a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4</AttributeValue></Attribute>
            </AttributeStatement>
          </Assertion>
        </trust:RequestedSecurityToken>
      </trust:RequestSecurityTokenResponse>
    </trust:RequestSecurityTokenResponseCollection>
  </s:Body>
</s:Envelope>`

const rstrFault = `<?xml version="1.0"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:a="http://www.w3.org/2005/08/addressing">
  <s:Body>
    <s:Fault>
      <s:Code><s:Value>s:Sender</s:Value><s:Subcode><s:Value>a:FailedAuthentication</s:Value></s:Subcode></s:Code>
      <s:Reason><s:Text xml:lang="en-US">Authentication failure.</s:Text></s:Reason>
    </s:Fault>
  </s:Body>
</s:Envelope>`

func TestParseResponse_OK(t *testing.T) {
	c := newTestClient(t)

	assertion, err := c.parseResponse([]byte(rstrOK))
	if err != nil {
		t.Fatalf("parseResponse: %v", err)
	}

	var names []string
	for _, st := range assertion.AttributeStatements {
		for _, a := range st.Attributes {
			names = append(names, a.Name)
		}
	}
	if len(names) != 4 {
		t.Fatalf("want 4 attributes, got %d (%v)", len(names), names)
	}
}

func TestParseResponse_FaultIsInvalidCredentials(t *testing.T) {
	c := newTestClient(t)

	_, err := c.parseResponse([]byte(rstrFault))
	if !errors.Is(err, utils.ErrInvalidCredentials) {
		t.Fatalf("want ErrInvalidCredentials, got %v", err)
	}
}

func TestParseResponse_NoAssertion(t *testing.T) {
	c := newTestClient(t)

	_, err := c.parseResponse([]byte(`<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"><s:Body/></s:Envelope>`))
	if err == nil || errors.Is(err, utils.ErrInvalidCredentials) {
		t.Fatalf("want a plain error, got %v", err)
	}
}

func TestRSTTemplateEscapesCredentials(t *testing.T) {
	var b strings.Builder
	err := rstTemplate.Execute(&b, map[string]string{
		"Action": actionIssue, "To": "https://adfs.example",
		"Created": "2026-09-08T00:00:00.000Z", "Expires": "2026-09-08T00:05:00.000Z",
		"TokenID": "uuid-x", "Username": xmlEscape("a<b&c"), "Password": xmlEscape(`p"'>&`),
		"AppliesTo": xmlEscape("urn:x"), "KeyType": keyTypeBearer,
		"RequestType": requestTypeIssue, "TokenType": samlTokenType,
	})
	if err != nil {
		t.Fatalf("execute: %v", err)
	}
	out := b.String()
	if strings.Contains(out, "a<b&c") || strings.Contains(out, `p"'>&`) {
		t.Fatalf("credentials not XML-escaped: %s", out)
	}
	if !strings.Contains(out, "a&lt;b&amp;c") {
		t.Fatalf("expected escaped username, got: %s", out)
	}
}

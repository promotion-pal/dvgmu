package saml

import (
	"net/http"
	"os"

	crewjamsaml "github.com/crewjam/saml"
)

// staticSPProvider отдаёт метадату единственного известного SP — Yandex 360,
// собранную из конфига (Yandex свою SAML-метадату не публикует).
type staticSPProvider struct {
	entityID string
	metadata *crewjamsaml.EntityDescriptor
}

func newStaticSPProvider(entityID string, acsURLs []string) *staticSPProvider {
	acs := make([]crewjamsaml.IndexedEndpoint, 0, len(acsURLs))
	for i, u := range acsURLs {
		endpoint := crewjamsaml.IndexedEndpoint{
			Binding:  crewjamsaml.HTTPPostBinding,
			Location: u,
			Index:    i + 1,
		}
		if i == 0 {
			def := true
			endpoint.IsDefault = &def
		}
		acs = append(acs, endpoint)
	}

	wantSigned := true
	md := &crewjamsaml.EntityDescriptor{
		EntityID: entityID,
		SPSSODescriptors: []crewjamsaml.SPSSODescriptor{{
			SSODescriptor: crewjamsaml.SSODescriptor{
				RoleDescriptor: crewjamsaml.RoleDescriptor{
					ProtocolSupportEnumeration: "urn:oasis:names:tc:SAML:2.0:protocol",
				},
			},
			WantAssertionsSigned:      &wantSigned,
			AssertionConsumerServices: acs,
		}},
	}

	return &staticSPProvider{entityID: entityID, metadata: md}
}

func (p *staticSPProvider) GetServiceProvider(_ *http.Request, id string) (*crewjamsaml.EntityDescriptor, error) {
	if id != p.entityID {
		return nil, os.ErrNotExist
	}
	return p.metadata, nil
}

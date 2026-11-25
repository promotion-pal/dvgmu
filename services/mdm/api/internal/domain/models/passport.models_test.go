package models

import "testing"

func TestPassportEncryptRoundTrip(t *testing.T) {
	if err := InitPassportEncryption("test-secret"); err != nil {
		t.Fatalf("init: %v", err)
	}

	p := &Passport{
		Series:              "1234",
		Number:              "567890",
		Snils:               "12345678901",
		BirthPlace:          "г. Хабаровск",
		ResidentialAddress:  "г. Хабаровск, ул. Ленина, д. 1",
		RegistrationAddress: "г. Хабаровск, ул. Муравьёва-Амурского, д. 2",
	}

	if err := p.encryptSensitiveFields(); err != nil {
		t.Fatalf("encrypt: %v", err)
	}
	if p.Series == "1234" || p.Number == "567890" || p.Snils == "12345678901" ||
		p.BirthPlace == "г. Хабаровск" || p.ResidentialAddress == "г. Хабаровск, ул. Ленина, д. 1" ||
		p.RegistrationAddress == "г. Хабаровск, ул. Муравьёва-Амурского, д. 2" {
		t.Fatalf("fields were not encrypted: %+v", p)
	}
	if len(p.Series) > 255 || len(p.Number) > 255 || len(p.Snils) > 255 {
		t.Fatalf("encrypted fields exceed column size: %+v", p)
	}

	if err := p.decryptSensitiveFields(); err != nil {
		t.Fatalf("decrypt: %v", err)
	}
	if p.Series != "1234" || p.Number != "567890" || p.Snils != "12345678901" ||
		p.BirthPlace != "г. Хабаровск" || p.ResidentialAddress != "г. Хабаровск, ул. Ленина, д. 1" ||
		p.RegistrationAddress != "г. Хабаровск, ул. Муравьёва-Амурского, д. 2" {
		t.Fatalf("round trip mismatch: %+v", p)
	}
}

package user

import (
	"testing"

	mdmenum "dvgmu/api/contract/gen/go/mdm/enum"
)

// Titles taken from the distinct values of a real student export, including
// the legacy "(полном)" school certificate wording that used to fall through.
func TestMapEducationType(t *testing.T) {
	cases := map[string]mdmenum.EducationType{
		"Аттестат о среднем общем образовании":                                              mdmenum.EducationType_EDUCATION_TYPE_SCHOOL_SECONDARY,
		"Аттестат о среднем (полном) общем образовании  (из ЕПГУ)":                          mdmenum.EducationType_EDUCATION_TYPE_SCHOOL_SECONDARY,
		"Аттестат о среднем (полном) общем образовании для награжденных серебряной медалью": mdmenum.EducationType_EDUCATION_TYPE_SCHOOL_SECONDARY,
		"Аттестат об основном общем образовании":                                            mdmenum.EducationType_EDUCATION_TYPE_SCHOOL_BASIC,
		"Диплом о среднем профессиональном образовании с отличием":                          mdmenum.EducationType_EDUCATION_TYPE_COLLEGE,
		"Диплом бакалавра":   mdmenum.EducationType_EDUCATION_TYPE_BACHELOR,
		"Диплом специалиста": mdmenum.EducationType_EDUCATION_TYPE_SPECIALIST,
		"Аттестат":           mdmenum.EducationType_EDUCATION_TYPE_UNSPECIFIED,
		"":                   mdmenum.EducationType_EDUCATION_TYPE_UNSPECIFIED,
	}
	for raw, want := range cases {
		if got := mapEducationType(raw); got != want {
			t.Errorf("mapEducationType(%q) = %v, want %v", raw, got, want)
		}
	}
}

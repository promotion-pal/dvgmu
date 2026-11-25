package models

import (
	"errors"
	"slices"
	"testing"

	"fesmu/contract/mdm/enum"
)

func TestNormalizeRoles(t *testing.T) {
	var (
		student = enum.UserRole_USER_ROLE_STUDENT
		staff   = enum.UserRole_USER_ROLE_STAFF
		teacher = enum.UserRole_USER_ROLE_TEACHER
	)

	tests := []struct {
		name    string
		in      []enum.UserRole
		want    []enum.UserRole
		wantErr error
	}{
		{name: "empty clears all", in: nil, want: []enum.UserRole{}},
		{name: "sorted and deduplicated", in: []enum.UserRole{teacher, student, teacher}, want: []enum.UserRole{student, teacher}},
		{name: "all four", in: []enum.UserRole{enum.UserRole_USER_ROLE_ADMIN, staff, teacher, student}, want: []enum.UserRole{student, staff, teacher, enum.UserRole_USER_ROLE_ADMIN}},
		{name: "unspecified rejected", in: []enum.UserRole{student, enum.UserRole_USER_ROLE_UNSPECIFIED}, wantErr: ErrInvalidRole},
		{name: "unknown value rejected", in: []enum.UserRole{enum.UserRole(99)}, wantErr: ErrInvalidRole},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := NormalizeRoles(tt.in)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("err = %v, want %v", err, tt.wantErr)
			}
			if tt.wantErr == nil && !slices.Equal(got, tt.want) {
				t.Fatalf("got %v, want %v", got, tt.want)
			}
		})
	}
}

func TestUserToProtoRoles(t *testing.T) {
	u := &User{UUID: "6f1c1b7e-1d2a-4c8e-9a51-0e3c2f6d7b10", Roles: []UserRole{
		{Role: enum.UserRole_USER_ROLE_TEACHER},
		{Role: enum.UserRole_USER_ROLE_STUDENT},
	}}

	pb := u.ToProto()
	if pb.GetUuid() != u.UUID {
		t.Fatalf("uuid = %q", pb.GetUuid())
	}
	want := []enum.UserRole{enum.UserRole_USER_ROLE_STUDENT, enum.UserRole_USER_ROLE_TEACHER}
	if !slices.Equal(pb.GetRoles(), want) {
		t.Fatalf("roles = %v, want %v", pb.GetRoles(), want)
	}
}

func TestNormalizePermissions(t *testing.T) {
	got, err := NormalizePermissions([]string{" Certificate.View ", "certificate.issue", "certificate.view"})
	if err != nil || !slices.Equal(got, []string{"certificate.issue", "certificate.view"}) {
		t.Fatalf("got %v, %v", got, err)
	}
	for _, bad := range []string{"certificate", "certificate.", ".view", "cert-ificate.view", "сертификат.просмотр", "a.b.c"} {
		if _, err := NormalizePermissions([]string{bad}); !errors.Is(err, ErrInvalidPermission) {
			t.Errorf("%q accepted", bad)
		}
	}
	if got, err := NormalizePermissions(nil); err != nil || len(got) != 0 {
		t.Fatalf("empty: %v %v", got, err)
	}
}

// Package reconcile — чистая логика сравнения MDM и AD без сети:
// на входе уже загруженные срезы, на выходе список находок. Никаких записей
// никуда не делает — это dry-run ядро.
package reconcile

import (
	"strings"

	"dvgmu/sync/internal/adldap"
	"dvgmu/sync/internal/mdmclient"
)

type FindingKind string

const (
	// KindDrift — активный в MDM пользователь привязан к AD-записи, но поля
	// (ФИО/email) расходятся.
	KindDrift FindingKind = "drift"
	// KindMissingInAD — активный в MDM пользователь: аккаунта в AD не нашли
	// ни по связке, ни по email — похоже, аккаунт нужно завести.
	KindMissingInAD FindingKind = "missing_in_ad"
	// KindUnlinkedButExists — аккаунт в AD нашёлся по email, но связки через
	// в mdm (users.ad_object_id) ещё нет.
	KindUnlinkedButExists FindingKind = "unlinked_but_exists"
	// KindShouldBeDisabled — MDM говорit "неактивен", а сопоставленный
	// AD-аккаунт всё ещё включён.
	KindShouldBeDisabled FindingKind = "should_be_disabled"
	// KindNotInMDM — AD-запись не сопоставилась ни с одним MDM-пользователем
	// (ни по связке, ни по email). Не значит "нужно удалить" — просто
	// требует ручной проверки (может быть служебная учётка).
	KindNotInMDM FindingKind = "not_in_mdm"
)

const statusActive = "USER_STATUS_ACTIVE"
const statusInactive = "USER_STATUS_INACTIVE"

type Finding struct {
	Kind       FindingKind
	MDMID      int64
	Email      string
	FirstName  string
	LastName   string
	ObjectGUID string
	Detail     string
}

type Report struct {
	Findings []Finding
}

func (r Report) Counts() map[FindingKind]int {
	counts := make(map[FindingKind]int)
	for _, f := range r.Findings {
		counts[f.Kind]++
	}
	return counts
}

// Run сравнивает MDM (вместе с его связками users.ad_object_id) с AD и
// возвращает находки. Ничего не пишет ни в mdm, ни в AD.
func Run(mdmUsers []mdmclient.User, adEntries []adldap.Entry) Report {
	byGUID := make(map[string]adldap.Entry, len(adEntries))
	byEmail := make(map[string]adldap.Entry, len(adEntries))
	bySAM := make(map[string]adldap.Entry, len(adEntries))
	for _, e := range adEntries {
		byGUID[normalizeGUID(e.ObjectGUID)] = e
		if e.Email != "" {
			byEmail[normalizeEmail(e.Email)] = e
		}
		if e.SAMAccountName != "" {
			bySAM[e.SAMAccountName] = e
		}
	}

	matchedGUIDs := make(map[string]bool, len(adEntries))
	var findings []Finding

	for _, u := range mdmUsers {
		var adEntry adldap.Entry
		var found, matchedViaGUID bool

		if u.ADObjectID != "" {
			if e, ok := byGUID[normalizeGUID(u.ADObjectID)]; ok {
				adEntry, found, matchedViaGUID = e, true, true
			}
		}
		if !found {
			if e, ok := byEmail[normalizeEmail(u.Email)]; ok {
				adEntry, found = e, true
			}
		}
		if !found {
			// email у AD-записи может быть не заполнен (обычная ситуация) —
			// пробуем по производному логину. Живой случай: Constraint
			// Violation при попытке Create означало, что sAMAccountName уже
			// занят где-то в лесу AD — человек уже есть, просто без mail.
			if e, ok := bySAM[SAMAccountNameFromEmail(u.Email)]; ok {
				adEntry, found = e, true
			}
		}

		if !found {
			if u.Status == statusActive {
				findings = append(findings, Finding{
					Kind:      KindMissingInAD,
					MDMID:     u.ID,
					Email:     u.Email,
					FirstName: u.FirstName,
					LastName:  u.LastName,
					Detail:    "нет аккаунта в AD ни по связке, ни по email, ни по sAMAccountName",
				})
			}
			continue
		}

		matchedGUIDs[normalizeGUID(adEntry.ObjectGUID)] = true

		if u.Status == statusInactive {
			if !adEntry.Disabled {
				findings = append(findings, Finding{
					Kind:       KindShouldBeDisabled,
					MDMID:      u.ID,
					Email:      u.Email,
					ObjectGUID: adEntry.ObjectGUID,
					Detail:     "в MDM неактивен, AD-аккаунт всё ещё включён",
				})
			}
			continue
		}

		if !matchedViaGUID {
			findings = append(findings, Finding{
				Kind:       KindUnlinkedButExists,
				MDMID:      u.ID,
				Email:      u.Email,
				FirstName:  u.FirstName,
				LastName:   u.LastName,
				ObjectGUID: adEntry.ObjectGUID,
				Detail:     "найден в AD по email или sAMAccountName, связка в mdm (users.ad_object_id) отсутствует или устарела",
			})
			continue
		}

		if diff := fieldDiff(u, adEntry); diff != "" {
			findings = append(findings, Finding{
				Kind:       KindDrift,
				MDMID:      u.ID,
				Email:      u.Email,
				ObjectGUID: adEntry.ObjectGUID,
				Detail:     diff,
			})
		}
	}

	for _, e := range adEntries {
		if !matchedGUIDs[normalizeGUID(e.ObjectGUID)] {
			findings = append(findings, Finding{
				Kind:       KindNotInMDM,
				Email:      e.Email,
				ObjectGUID: e.ObjectGUID,
				Detail:     "AD-запись не сопоставлена ни с одним пользователем MDM",
			})
		}
	}

	return Report{Findings: findings}
}

func fieldDiff(u mdmclient.User, e adldap.Entry) string {
	var diffs []string

	if normalizeEmail(u.Email) != normalizeEmail(e.Email) {
		diffs = append(diffs, "email: mdm="+u.Email+" ad="+e.Email)
	}

	mdmName := strings.TrimSpace(u.FirstName + " " + u.LastName)
	if !strings.EqualFold(mdmName, e.DisplayName) {
		diffs = append(diffs, "name: mdm=\""+mdmName+"\" ad=\""+e.DisplayName+"\"")
	}

	return strings.Join(diffs, "; ")
}

func normalizeEmail(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}

func normalizeGUID(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}

// SAMAccountNameFromEmail — логин из локальной части email (ivanov@fesmu.ru
// → ivanov). Используется и здесь для сопоставления, и в app.createMissing
// для реального создания в AD — важно, чтобы обе стороны считали его
// одинаково.
// maxSAMAccountNameLen — жёсткое ограничение AD на sAMAccountName (ещё с
// NT4, действует и сейчас). Живой инцидент: email-логин из 21 символа →
// "Invalid argument" при Create.
const maxSAMAccountNameLen = 20

func SAMAccountNameFromEmail(email string) string {
	local, _, ok := strings.Cut(normalizeEmail(email), "@")
	if !ok || local == "" {
		return ""
	}
	if len(local) > maxSAMAccountNameLen {
		local = local[:maxSAMAccountNameLen]
	}
	return local
}

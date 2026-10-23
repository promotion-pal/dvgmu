package app

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"golang.org/x/sync/errgroup"

	"dvgmu/sync/internal/adldap"
	"dvgmu/sync/internal/config"
	"dvgmu/sync/internal/mdmclient"
	"dvgmu/sync/internal/reconcile"
)

type App struct {
	log      *slog.Logger
	interval time.Duration

	mdm     *mdmclient.Client
	ad      *adldap.Client
	adWrite *adldap.WriteClient
}

func New(log *slog.Logger, cfg *config.Config) *App {
	return &App{
		log:      log,
		interval: cfg.Interval,
		mdm:      mdmclient.NewClient(cfg.MDM.ServiceURL, cfg.MDM.InternalToken),
		ad: adldap.NewClient(adldap.Config{
			URL:                cfg.LDAP.URL,
			StartTLS:           cfg.LDAP.StartTLS,
			InsecureSkipVerify: cfg.LDAP.InsecureSkipVerify,
			BindDN:             cfg.LDAP.BindDN,
			BindPassword:       cfg.LDAP.BindPassword,
			BaseDN:             cfg.LDAP.BaseDN,
			AllUsersFilter:     cfg.LDAP.AllUsersFilter,
		}),
		adWrite: adldap.NewWriteClient(adldap.WriteConfig{
			URL:                cfg.LDAPWrite.URL,
			InsecureSkipVerify: cfg.LDAPWrite.InsecureSkipVerify,
			BindDN:             cfg.LDAPWrite.BindDN,
			BindPassword:       cfg.LDAPWrite.BindPassword,
			TargetOU:           cfg.LDAPWrite.TargetOU,
			UPNSuffix:          cfg.LDAPWrite.UPNSuffix,
		}),
	}
}

// Run крутит read-only сверку раз в interval, пока ctx не отменят. Ничего не
// пишет ни в AD, ни в mdm — это обычный, безопасный режим по умолчанию.
// Если проход не уложился в один тик — следующий тик пропускается (не копим
// горутины).
func (a *App) Run(ctx context.Context) {
	a.log.Info("sync starting", "interval", a.interval)

	a.runOnce(ctx)

	ticker := time.NewTicker(a.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			a.log.Info("sync stopped")
			return
		case <-ticker.C:
			a.runOnce(ctx)
		}
	}
}

// RunOnce — один read-only проход и выход (без тикера). Ничего не пишет
// нигде — только чтобы посмотреть актуальные цифры прямо сейчас, не дожидаясь
// следующего тика и не оставляя контейнер висеть.
func (a *App) RunOnce(ctx context.Context) {
	a.runOnce(ctx)
}

func (a *App) runOnce(ctx context.Context) {
	start := time.Now()
	a.log.Info("sync: pass started")

	mdmUsers, adEntries, err := a.fetchAll(ctx)
	if err != nil {
		a.log.Error("sync: pass aborted, fetch failed", "error", err.Error())
		return
	}

	report := reconcile.Run(mdmUsers, adEntries)
	for _, f := range report.Findings {
		a.log.Info("sync: finding",
			"kind", string(f.Kind),
			"mdm_id", f.MDMID,
			"email", f.Email,
			"object_guid", f.ObjectGUID,
			"detail", f.Detail,
		)
	}

	a.log.Info("sync: pass finished",
		"duration", time.Since(start).String(),
		"mdm_users", len(mdmUsers),
		"ad_entries", len(adEntries),
		"findings", len(report.Findings),
		"counts", report.Counts(),
	)
}

func (a *App) fetchAll(ctx context.Context) ([]mdmclient.User, []adldap.Entry, error) {
	var mdmUsers []mdmclient.User
	var adEntries []adldap.Entry

	g, gctx := errgroup.WithContext(ctx)
	g.Go(func() error {
		var err error
		mdmUsers, err = a.mdm.FetchAll(gctx)
		return err
	})
	g.Go(func() error {
		var err error
		adEntries, err = a.ad.FetchAll()
		return err
	})

	if err := g.Wait(); err != nil {
		return nil, nil, err
	}
	return mdmUsers, adEntries, nil
}

// ApplyOnce — одноразовый режим записи (НЕ часть обычного тикера, вызывается
// явно флагами -link-unlinked/-create-missing из cmd/sync).
//
//   - linkUnlinked: для находок unlinked_but_exists (аккаунт уже есть в AD,
//     просто не привязан: пусто users.ad_object_id в mdm) — только сохранить
//     связку в mdm, никакой записи в AD не требуется, риска нет.
//   - createMissingLimit>0: для находок missing_in_ad создать AD-учётку
//     ВЫКЛЮЧЕННОЙ и БЕЗ ПАРОЛЯ (пароль/включение — вручную админом через
//     ADUC/PowerShell после проверки) и сразу привязать её к MDM. Ограничено
//     лимитом — осознанно маленькими партиями, не разом на все находки.
func (a *App) ApplyOnce(ctx context.Context, createMissingLimit int, linkUnlinked bool) error {
	mdmUsers, adEntries, err := a.fetchAll(ctx)
	if err != nil {
		return fmt.Errorf("fetch: %w", err)
	}
	report := reconcile.Run(mdmUsers, adEntries)

	if linkUnlinked {
		a.linkUnlinked(ctx, report)
	}

	if createMissingLimit > 0 {
		if err := a.createMissing(ctx, report, createMissingLimit); err != nil {
			return err
		}
	}

	return nil
}

// CheckMissing — сухая проверка предстоящего -create-missing: НИЧЕГО не
// пишет в AD, только считает те же DN/sAMAccountName, что реально
// использует createMissing, и ищет проблемы заранее, а не по одной через
// реальные попытки Create. Сейчас проверяет единственное, что мы уже
// поймали на практике и что не ловится на лету во время самого Create:
// коллизию sAMAccountName МЕЖДУ разными "отсутствующими" кандидатами после
// обрезки логина до 20 символов (два разных длинных email могут совпасть
// в первых 20 символах).
func (a *App) CheckMissing(ctx context.Context) error {
	mdmUsers, adEntries, err := a.fetchAll(ctx)
	if err != nil {
		return fmt.Errorf("fetch: %w", err)
	}
	report := reconcile.Run(mdmUsers, adEntries)

	byDisplayName := make(map[string][]adldap.Entry, len(adEntries))
	for _, e := range adEntries {
		key := normalizeName(e.DisplayName)
		if key == "" {
			continue
		}
		byDisplayName[key] = append(byDisplayName[key], e)
	}

	bySAM := make(map[string][]reconcile.Finding)
	total := 0
	nameMatches := 0
	for _, f := range report.Findings {
		if f.Kind != reconcile.KindMissingInAD {
			continue
		}
		total++
		sam := reconcile.SAMAccountNameFromEmail(f.Email)
		bySAM[sam] = append(bySAM[sam], f)

		// Возможный дубликат: человек уже есть где-то в AD под ДРУГИМ
		// логином/без email — по логину/email мы его не нашли (иначе он был
		// бы не missing_in_ad), но по ФИО может совпасть. Не блокирует,
		// только предупреждение — совпадение ФИО не 100% гарантия, что это
		// тот же человек (бывают тёзки), но и не факт, что это не он.
		nameKey := normalizeName(f.FirstName + " " + f.LastName)
		if nameKey == "" {
			continue
		}
		if existing, ok := byDisplayName[nameKey]; ok {
			nameMatches++
			dns := make([]string, 0, len(existing))
			for _, e := range existing {
				dns = append(dns, e.ObjectGUID)
			}
			a.log.Warn("check-missing: возможный дубликат по ФИО — уже есть похожая запись в AD",
				"mdm_id", f.MDMID, "email", f.Email, "name", f.FirstName+" "+f.LastName,
				"existing_object_guid", dns)
		}
	}

	problems := 0
	for sam, group := range bySAM {
		if len(group) < 2 {
			continue
		}
		problems++
		ids := make([]int64, 0, len(group))
		for _, f := range group {
			ids = append(ids, f.MDMID)
		}
		a.log.Error("check-missing: коллизия sAMAccountName между разными кандидатами",
			"sam_account_name", sam, "mdm_ids", ids)
	}

	a.log.Info("check-missing finished", "candidates", total, "collisions", problems, "possible_name_duplicates", nameMatches)
	if problems > 0 {
		return fmt.Errorf("найдено %d коллизий sAMAccountName — create-missing упадёт на них, чинить руками до запуска", problems)
	}
	return nil
}

// linkUnlinked записывает в mdm связки unlinked_but_exists одним пакетом.
// Учётку AD, на которую указывают несколько пользователей MDM (например,
// два длинных email совпали в первых 20 символах sAMAccountName), не
// привязывает никому — это решает человек.
func (a *App) linkUnlinked(ctx context.Context, report reconcile.Report) {
	byGUID := make(map[string][]reconcile.Finding)
	for _, f := range report.Findings {
		if f.Kind == reconcile.KindUnlinkedButExists {
			key := strings.ToLower(f.ObjectGUID)
			byGUID[key] = append(byGUID[key], f)
		}
	}

	var links []mdmclient.ADLink
	for guid, group := range byGUID {
		if len(group) > 1 {
			ids := make([]int64, 0, len(group))
			for _, f := range group {
				ids = append(ids, f.MDMID)
			}
			a.log.Warn("sync: одна учётка AD подходит нескольким пользователям MDM — не привязываю",
				"object_guid", guid, "mdm_ids", ids)
			continue
		}
		links = append(links, mdmclient.ADLink{MDMID: group[0].MDMID, ObjectGUID: group[0].ObjectGUID})
	}
	if len(links) == 0 {
		a.log.Info("sync: link-unlinked finished, nothing to link")
		return
	}

	linked, skipped, err := a.mdm.LinkAD(ctx, links)
	if err != nil {
		a.log.Error("sync: link-unlinked failed", "error", err.Error())
		return
	}
	for _, l := range skipped {
		a.log.Warn("sync: mdm не принял связку (у пользователя другой GUID или GUID занят)",
			"mdm_id", l.MDMID, "object_guid", l.ObjectGUID)
	}
	a.log.Info("sync: link-unlinked finished", "candidates", len(links), "linked", linked, "skipped", len(skipped))
}

func (a *App) createMissing(ctx context.Context, report reconcile.Report, limit int) error {
	if !a.adWrite.Enabled() {
		return fmt.Errorf("create-missing requested but AD write is not configured " +
			"(need SYNC_LDAP_WRITE_URL, SYNC_LDAP_WRITE_BIND_DN/PASSWORD, SYNC_LDAP_TARGET_OU)")
	}

	created := 0
	for _, f := range report.Findings {
		// Лимит считает СОЗДАННЫЕ в AD учётки — самое необратимое действие
		// здесь.
		if created >= limit {
			break
		}
		if f.Kind != reconcile.KindMissingInAD {
			continue
		}

		sam := reconcile.SAMAccountNameFromEmail(f.Email)
		if sam == "" {
			a.log.Warn("sync: skip create, cannot derive sAMAccountName from email",
				"mdm_id", f.MDMID, "email", f.Email)
			continue
		}

		result, err := a.adWrite.CreateUser(adldap.NewUser{
			FirstName:      f.FirstName,
			LastName:       f.LastName,
			Email:          f.Email,
			SAMAccountName: sam,
		})
		if err != nil {
			// Любая ошибка от AD — сразу останавливаем весь прогон, а не
			// пропускаем и идём дальше: живой пример — Constraint Violation
			// на userPrincipalName означает, что sAMAccountName/UPN уже
			// занят где-то в лесу AD (человек, скорее всего, уже реально
			// существует под другим OU без mail) — систематическая причина,
			// а не единичный сбой, разбираться нужно человеку, не молотить
			// дальше по всему списку.
			a.log.Error("sync: create in AD failed, stopping",
				"mdm_id", f.MDMID, "email", f.Email, "created_so_far", created, "error", err.Error())
			return fmt.Errorf("create user (mdm_id=%d, email=%s): %w", f.MDMID, f.Email, err)
		}
		created++

		a.log.Info("sync: created AD account (disabled, no password — admin must set password and enable)",
			"mdm_id", f.MDMID, "email", f.Email, "sam_account_name", sam, "object_guid", result.ObjectGUID)

		if _, skipped, err := a.mdm.LinkAD(ctx, []mdmclient.ADLink{{MDMID: f.MDMID, ObjectGUID: result.ObjectGUID}}); err != nil || len(skipped) > 0 {
			if err == nil {
				err = fmt.Errorf("mdm skipped the link")
			}
			a.log.Error("sync: created in AD but linking in mdm failed, stopping",
				"mdm_id", f.MDMID, "object_guid", result.ObjectGUID, "created_so_far", created, "error", err.Error())
			return fmt.Errorf("link mdm_id=%d to object_guid=%s (учётка в AD УЖЕ создана, привяжите вручную): %w",
				f.MDMID, result.ObjectGUID, err)
		}

		a.log.Info("sync: linked new AD account to MDM", "mdm_id", f.MDMID, "object_guid", result.ObjectGUID)
	}

	a.log.Info("sync: create-missing finished", "created", created, "limit", limit)
	return nil
}

// normalizeName — грубая нормализация ФИО для сравнения (регистр, пробелы).
// Не решает транслитерацию/опечатки/девичьи фамилии — только точное
// совпадение после очистки, поэтому это предупреждение, а не блокировка.
func normalizeName(s string) string {
	return strings.ToLower(strings.Join(strings.Fields(s), " "))
}

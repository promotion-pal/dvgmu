package service

import (
	"context"
	"errors"
	"log/slog"
	"strings"
	"sync"

	"dvgmu/auth/internal/domain/models"
	"dvgmu/auth/internal/utils"
)

const (
	identityDefaultPageSize = 50
	identityMaxPageSize     = 500
)

type IdentitySaver interface {
	IdentityUpsertLogin(ctx context.Context, objectGUID, login, email string) error
	IdentityLinkMDMBatch(ctx context.Context, links []models.MDMLink) error
}

type IdentityProvider interface {
	IdentityFetch(ctx context.Context, filter models.IdentityFilter) ([]*models.Identity, int64, error)
	IdentityByID(ctx context.Context, id int64) (*models.Identity, error)
	IdentityByGUID(ctx context.Context, guid string) (*models.Identity, error)
	IdentityByLogin(ctx context.Context, login string) (*models.Identity, error)
}

// MDMDirectory — где теперь живёт связка AD↔MDM (mdm users.ad_object_id).
// Колонку identities.mdm_id больше никто не пишет (sync связывает в mdm),
// поэтому журнал берёт mdm_id оттуда и запоминает найденное.
type MDMDirectory interface {
	MDMIDByADObjectID(ctx context.Context, objectGUID string) (int64, error)
}

// Одновременных запросов в mdm при заполнении страницы журнала.
const mdmLookupConcurrency = 8

type IdentityService struct {
	log      *slog.Logger
	saver    IdentitySaver
	provider IdentityProvider
	mdm      MDMDirectory // nil — mdm_id только из своей таблицы
}

func NewIdentityService(log *slog.Logger, saver IdentitySaver, provider IdentityProvider) *IdentityService {
	if log == nil {
		log = slog.Default()
	}
	return &IdentityService{log: log, saver: saver, provider: provider}
}

// WithMDM — брать mdm_id из mdm, когда в своей таблице его нет.
func (s *IdentityService) WithMDM(d MDMDirectory) *IdentityService {
	s.mdm = d
	return s
}

func (s *IdentityService) RecordLogin(ctx context.Context, guid, login, email string) error {
	return s.saver.IdentityUpsertLogin(ctx, guid, login, email)
}

func (s *IdentityService) LinkMDMBatch(ctx context.Context, links []models.MDMLink) error {
	if len(links) == 0 {
		return utils.ErrInvalidLink
	}
	for i := range links {
		links[i].ObjectGUID = strings.TrimSpace(links[i].ObjectGUID)
	}
	return s.saver.IdentityLinkMDMBatch(ctx, links)
}

// IdentityPageSize — фактический размер страницы, который применит Fetch.
func IdentityPageSize(n int) int {
	switch {
	case n <= 0:
		return identityDefaultPageSize
	case n > identityMaxPageSize:
		return identityMaxPageSize
	}
	return n
}

func (s *IdentityService) Fetch(ctx context.Context, filter models.IdentityFilter) ([]*models.Identity, int64, error) {
	if filter.Page < 1 {
		filter.Page = 1
	}
	filter.PageSize = IdentityPageSize(filter.PageSize)
	filter.ObjectGUID = strings.TrimSpace(filter.ObjectGUID)
	filter.Email = strings.TrimSpace(filter.Email)
	filter.Login = strings.TrimSpace(filter.Login)

	identities, total, err := s.provider.IdentityFetch(ctx, filter)
	if err != nil {
		return nil, 0, err
	}
	s.fillMDM(ctx, identities)
	return identities, total, nil
}

// fillMDM подставляет mdm_id из mdm тем, у кого его нет, и сохраняет
// найденные связки. Сбой mdm журнал не ломает — остаётся 0.
func (s *IdentityService) fillMDM(ctx context.Context, identities []*models.Identity) {
	if s.mdm == nil {
		return
	}
	var (
		mu    sync.Mutex
		links []models.MDMLink
		wg    sync.WaitGroup
		slots = make(chan struct{}, mdmLookupConcurrency)
	)
	for _, identity := range identities {
		if identity.MDMID > 0 || identity.ObjectGUID == "" {
			continue
		}
		wg.Add(1)
		slots <- struct{}{}
		go func(identity *models.Identity) {
			defer func() { <-slots; wg.Done() }()
			id, err := s.mdm.MDMIDByADObjectID(ctx, identity.ObjectGUID)
			if err != nil {
				s.log.Warn("identity: mdm lookup failed", "guid", identity.ObjectGUID, "error", err.Error())
				return
			}
			if id <= 0 {
				return
			}
			identity.MDMID = id
			mu.Lock()
			links = append(links, models.MDMLink{MDMID: id, ObjectGUID: identity.ObjectGUID})
			mu.Unlock()
		}(identity)
	}
	wg.Wait()

	if len(links) > 0 {
		if err := s.saver.IdentityLinkMDMBatch(ctx, links); err != nil {
			s.log.Warn("identity: saving mdm links failed", "error", err.Error())
		}
	}
}

func (s *IdentityService) ByID(ctx context.Context, id int64) (*models.Identity, error) {
	if id <= 0 {
		return nil, utils.ErrIdentityNotFound
	}
	identity, err := s.provider.IdentityByID(ctx, id)
	if err != nil {
		return nil, err
	}
	s.fillMDM(ctx, []*models.Identity{identity})
	return identity, nil
}

func (s *IdentityService) ByGUID(ctx context.Context, guid string) (*models.Identity, error) {
	return s.provider.IdentityByGUID(ctx, strings.TrimSpace(guid))
}

func (s *IdentityService) ByLogin(ctx context.Context, login string) (*models.Identity, error) {
	login = strings.TrimSpace(login)
	if login == "" {
		return nil, utils.ErrIdentityNotFound
	}
	return s.provider.IdentityByLogin(ctx, login)
}

func (s *IdentityService) MDMIDFor(ctx context.Context, guid string) (int64, error) {
	id, err := s.provider.IdentityByGUID(ctx, guid)
	if err != nil {
		if errors.Is(err, utils.ErrIdentityNotFound) {
			return 0, nil
		}
		return 0, err
	}
	return id.MDMID, nil
}

package purchase

import (
	"context"
	"errors"

	"connectrpc.com/connect"

	enum "dvgmu/api/contract/gen/go/enum/v2"
	"dvgmu/api/internal/auth"
)

// roleSection — раздел доступа каждой роли процесса: действовать в роли
// можно с правом на изменение её раздела (purchase_head.post и т. д.),
// администратор — в любой. Права раздаются в Администрирование → Доступы.
var roleSection = map[enum.PurchaseActorRole]auth.Section{
	roleEmployee:   auth.SectionPurchaseRequest,
	roleHead:       auth.SectionPurchaseHead,
	roleViceRector: auth.SectionPurchaseViceRector,
	roleEconomist:  auth.SectionPurchaseEconomist,
	roleCommission: auth.SectionPurchaseCommission,
}

// requireRole пускает действовать в role только с правом на её раздел.
// Через неё проходит каждое изменение: роль берётся из запроса (actorOf).
func requireRole(ctx context.Context, role enum.PurchaseActorRole) error {
	section, ok := roleSection[role]
	if !ok {
		return invalid("выберите роль, от лица которой действуете")
	}
	u, ok := auth.UserFromContext(ctx)
	if !ok {
		return connect.NewError(connect.CodeUnauthenticated, errors.New("войдите, чтобы работать с закупками"))
	}
	if !u.Can(section, auth.ActionPost) {
		return forbidden("нет права действовать в роли «%s» — нужен доступ %s, обратитесь к администратору",
			roleLabel[role], auth.Perm(section, auth.ActionPost))
	}
	return nil
}

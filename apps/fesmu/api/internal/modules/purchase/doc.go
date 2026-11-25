// Package purchase is a self-contained module: purchases v2, served over
// Connect RPC (contract.service.v2.PurchaseService) from purchase_db.
//
// The flow, in the order a request travels:
//
//	employee      — creates a request: item, quantity, description
//	dept head     — approves it, returns it for rework, rejects it, or edits it
//	vice-rector   — merges requests into purchases (lots), attaches
//	                commercial offers (КП) that price them, comments for the
//	                commission; may return a request to the head or reject it
//	economist     — checks the ОКПД2/КТРУ/ОКВЭД2 codes (pre-filled from the
//	                title, see codes.go) and the budget; approves or returns
//	commission    — approves a purchase into ПФХД as planned or unplanned,
//	                rejects it, or returns it to the economist
//
// Every change is written to the log, and each stage's sign-off is kept on
// the record so the next stage sees who approved it.
//
// The acting role comes from the request (the page's "view as" switch) and is
// checked against the user's rights: acting as a role takes the right to
// change its section (access.go — EMPLOYEE → purchase_request.post, and so
// on); ADMIN may act as any. Reading needs the right to view any purchase
// section, checked by the auth interceptor. The name in the log is the one
// typed on the page, else the signed-in user's login.
//
// Layers, from the inside out:
//
//	models.go  — tables and their protobuf form
//	flow.go    — which role may do what at which stage; pure, tested
//	access.go  — which access section lets a user act in each role
//	codes.go   — classifier codes guessed from a purchase's name
//	storage.go — gorm queries
//	service.go — use cases
//	handler.go — Connect RPC adapter, maps errors to status codes
//	module.go  — wiring, mounting on an http mux
package purchase

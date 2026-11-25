// Package purchasev3 is purchases v3, served over Connect RPC
// (contract.service.v3.PurchaseService) from purchase_db, tables purchase_v3_*.
// It follows the regulation (Регламент закупок) from an employee's request to
// the purchased goods being put into the inventory:
//
//	I.   employee → head of their department → vice-rector over it →
//	     implementing head merges requests into a purchase → assignee
//	     (characteristics, offers) → head checks, codes filled → vice-rector
//	     → economists (budget, НМЦК) → budget commission (protocol)
//	II.  implementing head → assignee (ТЗ) → head → vice-rector confirms →
//	     economists (final cost) → contract service (law, method) →
//	     procurement department
//	III. tendering → contract → delivery → acceptance → inventory → done
//
// Nobody picks a role, as v2's "view as" did. A call is let through when the
// signed-in user holds the right of the record's stage ("purchase.<name>",
// access.go) and the record is theirs: their MDM department, a vice-rector
// direction bound to them in the directory, a purchase given to them. Every
// stage may FORWARD a record, once its work is done, or RETURN it one stage
// back with a comment; every change goes to the log, every forward leaves a
// sign-off the later stages see.
//
// Layers, from the inside out:
//
//	models.go    — tables and their protobuf form
//	route.go     — the stages: who, where to, what must be done; pure, tested
//	access.go    — rights, whose records, what the user sees and may do
//	storage.go   — gorm queries
//	service.go, requests.go, lots.go, files.go, protocol.go, directories.go
//	             — use cases
//	handler.go   — Connect RPC adapter, maps errors to status codes
//	module.go    — wiring, mounting on an http mux
package purchasev3

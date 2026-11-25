// Package debtor is a self-contained module: students' tuition balances read
// live from 1C and served over Connect RPC (contract.service.v1.DebtorService).
//
// Nothing is stored or cached — every call reads 1C's current totals, so the
// admin page always shows what 1C has right now. Concurrent calls share one
// 1C round trip (singleflight) instead of each opening its own.
//
// The only internal dependency is internal/utils/1c (the 1C transport); moving
// the module into its own service means moving this directory, that package
// and the contract.
//
// Layers, from the inside out:
//
//	service.go — use case; reads 1C through a small interface
//	handler.go — Connect RPC adapter, maps errors to status codes
//	module.go  — wiring, mounting on an http mux
package debtor

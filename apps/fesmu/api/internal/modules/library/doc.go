// Package library is a self-contained module: the library catalog, study
// manuals by discipline and reading positions, served over Connect RPC
// (contract.service.v2.LibraryService) from library_db.
//
// Who does what:
//
//	anyone signed in — reads the catalog and published manuals, keeps their
//	                   own reading positions
//	library.post     — adds, edits and deletes catalog entries
//	manuals.post     — writes manuals: the draft, publishing, taking off
//
// The auth interceptor lets every signed-in user into the service; the
// changes check their right here (requireCan).
//
// A manual keeps two versions as protojson: the draft the editors work on
// and the published one students read. Publishing copies the draft over.
//
// Files (editions, figures, attachments) are stored by the files service —
// FILE_TYPE_LIBRARY_BOOK goes to library/books, FILE_TYPE_LIBRARY_MANUAL to
// library/manuals. library_files registers what the module stored, and
// LibraryFileFetch hands out only those, so the api never becomes a way to
// read other files of the files service.
//
// Layers, from the inside out:
//
//	models.go  — tables and their protobuf form
//	blocks.go  — manual content: checks, the files and items it points at
//	files.go   — the files service client
//	storage.go — library_db
//	service.go — use cases and rights
//	handler.go — Connect handler
package library

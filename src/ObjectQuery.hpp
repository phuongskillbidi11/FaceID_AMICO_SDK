#pragma once

// Internal, purpose-built `load_objects.fcgi` body builders.
//
// Deliberately NOT a generic `object`/`fields`/`where` builder that takes
// caller-supplied strings: this file's three functions are the entire
// internal query surface, each hardcoding a confirmed field list and
// filter shape. No parameter here can carry an arbitrary object name,
// field name, or `where.connector` string -- see docs/amico-protocol-map.md's
// security notes on why that matters for this specific device (the search
// box's raw text flows into a SQL LIKE pattern; `where.connector` looks
// like string-concatenated SQL). This header is not installed under
// include/ and is not part of the public API.
//
// Hard rule (Decision 4, corrected Phase 2 spec): every function here
// always emits a non-empty "fields" array. Omitting "fields" was
// confirmed live to return every column of an object, including
// `panic_password`/`panic_salt` on `users` -- there is no code path in
// this file that can produce a body without "fields".

#include <cstdint>
#include <optional>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

namespace amico::detail {

/// GET-listing body for the Users page's confirmed default filter
/// (`user_type_id = 0 OR user_type_id IS NULL`), ordered by name.
nlohmann::json buildUsersListBody(int limit, int offset);

/// Single-user lookup by id (LIVE_CONFIRMED shape: a single `where`
/// clause needs no `connector`).
nlohmann::json buildUserGetBody(int64_t id);

/// Access-logs listing, newest first. `to` (if set) becomes the one
/// server-side `where` clause (`time <= to`); there is no way to add a
/// second server-side clause through this function -- see the access-log
/// range-filtering design decision (from is applied client-side by the
/// caller, not here).
nlohmann::json buildAccessLogsListBody(std::optional<int64_t> to, int limit, int offset);

/// Field lists returned by each of the builders above, exposed so tests
/// can assert on them without re-deriving the literals.
extern const std::vector<std::string> kUserFields;
extern const std::vector<std::string> kAccessLogFields;

}  // namespace amico::detail

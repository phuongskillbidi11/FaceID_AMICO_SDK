# Tasks — Redesign Access Logs to match the real device's "Access (Global)" report

> **Executor instructions:** Complete groups in order. After each task,
> run the verification command. Mark status before moving on.
>
> **Status markers:** `[ ]` not started · `[~]` in progress · `[x]` complete
> (verification passed) · `[!]` failed (stop, report to Planner).
>
> **Group gating:**
> - **Groups 1-4** (SDK, backend, frontend, tests) require no device
>   contact — all offline (`node --check`, C++ build, unit tests).
> - **Group 5** (manual live verification) is entirely **read-only**
>   (list/filter/paginate access logs already on the device) — no new
>   user, no write of any kind. Uses this project's routine login, not
>   a new approval category, per the same reasoning already applied to
>   every prior read-only live check this session.

---

## Group 1 — SDK types and query builders

### Task 1.1 — Extend `AccessLogEntry` and `AccessLogQuery`; add `Portal`/`TimeZone` value types
**Action:** In `include/amico/Types.hpp`:
- `AccessLogEntry` (currently `id, time, userId, portalId, logTypeId,
  event`, line ~126): add `int64_t identifierId = 0;` (always present
  per device schema — not `optional`, unlike `userId`/`portalId`
  which are genuinely nullable on the device). Add the 6 enrichment
  fields the backend will populate after the SDK call returns —
  **do not add these to `AccessLogEntry` itself**; they belong on the
  backend's `AccessLogEntry` wire/JSON shape only (Task 2.2), since
  `AccessLogEntry` is this SDK's typed device-object mapping, not a
  presentation model. (Rationale: keep the SDK's `AccessLogEntry`
  a faithful 1:1 mapping of `access_logs`' own columns, matching the
  existing convention where `AmicoUser` — a *different*, already
  more presentation-oriented type — is the one that carries computed
  fields like `groupIds`/`cardCount`. Since `AccessLogEntry` has no
  existing computed-field precedent, adding a **second** struct is
  cleaner than blurring this one's meaning — see Task 1.2.)
- `AccessLogQuery` (currently `from, to, limit`, line ~140): add
  `int offset = 0;` (matches `UserQuery`'s existing `offset` field
  exactly). Update the existing doc comment above this struct — it
  currently says `from` is "applied as a client-side filter... see
  the design decision... about why a second server-side clause was
  not used (no confirmed evidence for chaining two `where` clauses
  against this object)" — replace this with a note that both `from`
  and `to` are now sent server-side (LIVE_CONFIRMED 2026-09-14: chained
  `where` array clauses on the same field work correctly, verified via
  a direct `time >= X AND time <= Y` query returning the exact
  expected 15-row window with a matching `COUNT(*)`).
- Add two new minimal structs near the bottom of the file, matching
  the existing terse style of `UserQuery`/`AccessLogQuery`:
  ```cpp
  /// Public view of the `portals` object (name only — no CRUD support
  /// in this SDK; used solely to resolve access-log portal names).
  struct Portal {
      int64_t id = 0;
      std::string name;
  };

  /// Public view of the `time_zones` object (name only — same
  /// rationale as Portal).
  struct TimeZone {
      int64_t id = 0;
      std::string name;
  };
  ```
**Verification:** `cmake --build build --target amico_sdk` (or this
project's existing build command — check `CMakeLists.txt`/existing
build scripts if the exact target name differs).
**Pass:** Exit 0, no compile errors.
**Fail:** Compile error — report exact error to Planner.

**Status:** `[x]`
**Verification result:**
> 2026-09-14: `cmake --build build --target amico_sdk` passed (exit 0); `amico_sdk.lib` built successfully with no compile errors.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 1.2 — Query builders: `identifier_id` field, `offset`, chained `from`/`to`, count query, Portals/TimeZones list
**Action:** In `src/ObjectQuery.cpp`:
- `kAccessLogFields` (line ~9-11): add `"identifier_id"` to the list.
- `buildAccessLogsListBody` (line ~59-76, declared in
  `src/ObjectQuery.hpp` line ~44 — **update both files**): change the
  signature to **exactly**
  `nlohmann::json buildAccessLogsListBody(std::optional<int64_t> from, std::optional<int64_t> to, int limit, int offset)`
  — `from` comes **first**, matching `AccessLogQuery`'s own field
  order (`from, to, limit, offset`). This exact order is pinned
  deliberately, not left to be decided during execution: `from` and
  `to` are both `std::optional<int64_t>`, so a swapped argument order
  at any call site would **compile with no error** and silently invert
  the filter — see the 4 call sites below that must all be updated in
  lockstep to this exact new order.
  - Build the `where` array as: if both `from` and `to` are set, two
    clauses in this exact order — `{"field":"time","operator":">=","value":*from}`
    then `{"field":"time","operator":"<=","value":*to}` — as a single
    array (implicit AND, confirmed live this session — no explicit
    `connector` needed, unlike the OR/AND trick in
    `buildUsersListBody`); if only one is set, a single clause with
    the matching operator (`>=` for `from`-only, `<=` for `to`-only);
    if neither, an empty array (unchanged from today's "no `to`"
    case).
  - **Update `src/ObjectQuery.hpp`'s doc comment above this
    declaration** (currently says "there is no way to add a second
    server-side clause through this function -- see the access-log
    range-filtering design decision (from is applied client-side by
    the caller, not here)") — replace with a note that both `from`
    and `to` are now server-side, per spec.md Decision 5's live
    confirmation.
  - **All 4 existing call sites must be updated to the new
    `(from, to, limit, offset)` order** (confirmed by direct read
    during Plan Review):
    1. `test/test_query_whitelist.cpp` line 16:
       `detail::buildAccessLogsListBody(std::nullopt, 10, 0)` →
       `detail::buildAccessLogsListBody(std::nullopt, std::nullopt, 10, 0)`.
    2. `test/test_query_whitelist.cpp` line 35:
       `detail::buildAccessLogsListBody(1700000000, 10, 0)` →
       `detail::buildAccessLogsListBody(std::nullopt, 1700000000, 10, 0)`
       (this test's intent is the `to`-only case — keep it that way,
       just move the value to the `to` position).
    3. `test/test_query_whitelist.cpp` line 111 ("scenario 19"):
       same change as #2 — `detail::buildAccessLogsListBody(std::nullopt, 1700000000, 10, 0)`.
       This test's existing `REQUIRE(logsBody["where"].size() == 1)`
       assertion (line 112) stays correct as-is since this remains a
       `to`-only call — do not change that assertion.
    4. `src/Client.cpp`'s `listAccessLogs` (line ~566) — see Task 1.4,
       which also fixes an independent pre-existing bug at this exact
       call site.
- Add `nlohmann::json buildAccessLogsCountBody(std::optional<int64_t> from, std::optional<int64_t> to)`
  — same `object`/`where`-building logic as
  `buildAccessLogsListBody` but with `fields = ["COUNT(*)"]` and no
  `order`/`limit`/`offset`/`finish` (mirrors `buildCardCountBody`'s
  minimal shape).
- Add `nlohmann::json buildPortalsListBody()` and
  `nlohmann::json buildTimeZonesListBody()` — each: `object` =
  `"portals"`/`"time_zones"`, `fields` = `["id", "name"]`, no `where`
  (LIVE_CONFIRMED 2026-09-14: `{"object":"portals","fields":["id","name"]}`
  returns `{"portals":[{"id":1,"name":"Portal"}]}`; same shape for
  `time_zones`). No pagination — these devices realistically have a
  small, bounded number of portals/time zones (confirmed: 1 of each on
  this device), so a single unbounded fetch matches how `getUserGroupIds`
  already fetches all of a user's groups without pagination.
- Also add a batch-by-id-list query builder for resolving multiple
  user names at once in one call, e.g.
  `nlohmann::json buildUsersByIdsBody(const std::vector<int64_t>& ids)`
  — `object` = `"users"`, `fields` = `["id", "name", "registration"]`,
  `where` = `{{"field","id"},{"operator","IN"},{"value", ids}}` if
  this project's query DSL supports an `IN` operator with an array
  value (check `docs/amico-protocol-map.md`/`docs/ui-action-protocol-map.md`
  for a confirmed `IN` example first — `buildUserDeleteBody`/
  `buildCardRemoveBody` use a bare `{"id": [array]}` shape, not an
  explicit `operator:"IN"`; prefer that already-confirmed shape:
  `{{"users", {{"id", ids}}}}` matching the `where` object style, not
  the `where` array style, since both forms already coexist in this
  file for different call sites).
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> 2026-09-14: `cmake --build build --target amico_sdk` passed (exit 0); `ObjectQuery.cpp` and `Client.cpp` compiled and `amico_sdk.lib` linked successfully. Updated all four existing list-builder call sites to the pinned `(from, to, limit, offset)` order as required by Task 1.2.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 1.3 — `Client.hpp`: declare `PortalsApi`/`TimeZonesApi` and a count accessor
**Action:** In `include/amico/Client.hpp`:
- Add minimal `class PortalsApi { public: std::vector<Portal> list(); ... }`
  and `class TimeZonesApi { public: std::vector<TimeZone> list(); ... }`,
  each following the exact private-constructor/friend pattern already
  used by `AccessLogsApi` (lines ~140-148) — no write methods, no
  query params (matches Task 1.2's unbounded-fetch decision).
- Add `int64_t accessLogsCount(const AccessLogQuery& query = {});` to
  `AccessLogsApi` (alongside `list()`) — takes the same query shape
  so the same `from`/`to` filters apply to both the page and its
  total.
- Add `PortalsApi& portals()` / `TimeZonesApi& timeZones()` accessors
  next to `users()`/`accessLogs()`.
- Add the matching private `*Impl` declarations and member instances,
  following the exact existing pattern for `AccessLogsApi`.
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> 2026-09-14: `cmake --build build --target amico_sdk` passed (exit 0); `NetworkSafety.cpp` and `Client.cpp` compiled and `amico_sdk.lib` linked successfully with no compile errors.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 1.4 — `Client.cpp`: implement enrichment, Portals/TimeZones, count, and the ported Authorization/Identification label logic
**Action:** In `src/Client.cpp`:
- Update `listAccessLogs` (line ~564-593): change the call
  `nlohmann::json body = detail::buildAccessLogsListBody(query.to, limit, 0);`
  (line ~566) to
  `detail::buildAccessLogsListBody(query.from, query.to, limit, query.offset);`
  — **this fixes two things in the same line, both required, neither
  optional:** (a) threads `query.from` as the new first argument
  (Task 1.2's pinned order), and (b) replaces the **pre-existing,
  independent** hardcoded literal `0` for offset with `query.offset` —
  this hardcoded `0` is a bug that exists today, before any of this
  plan's changes, and would silently make pagination a no-op at the
  SDK layer even if Tasks 1.1/2.2's offset plumbing were otherwise
  perfect, if left unfixed. Map `identifier_id` into
  `entry.identifierId` (`requireField<int64_t>`, same style as the
  other required fields); **delete** the existing client-side
  `if (!query.from.has_value() || entry.time >= *query.from)` filter
  (line ~588) — filtering is now fully server-side (Task 1.2).
- Add `accessLogsCount(const AccessLogQuery& query)`: calls
  `runCountQuery(detail::buildAccessLogsCountBody(query.from, query.to), "access_logs")`
  — reuses the existing `runCountQuery` helper verbatim (line ~394),
  no new counting logic needed.
- Add `listPortals()`/`listTimeZones()`: each posts
  `buildPortalsListBody()`/`buildTimeZonesListBody()` to
  `/load_objects.fcgi`, requires the `"portals"`/`"time_zones"` array
  field (same `ProtocolError`-on-missing pattern as every other list
  method here), maps each row's `id`/`name` into `Portal`/`TimeZone`.
- Add a private helper `std::map<int64_t, AmicoUser>` — no, simpler:
  add `std::map<int64_t, std::string> getUserNamesByIds(const std::vector<int64_t>& ids)`
  returning `{id -> name}` and a second
  `std::map<int64_t, std::string> getUserRegistrationsByIds(...)` — or,
  more efficiently, **one** helper that returns
  `std::map<int64_t, std::pair<std::string,std::string>>` (name,
  registration) in a single query using `buildUsersByIdsBody` (Task
  1.2) — prefer the single combined helper to avoid two round-trips
  for the same id set.
- Add a private, pure, static-or-free function porting `report.js`'s
  two switch statements **exactly** (same literal output strings,
  same numeric cases):
  ```cpp
  std::string authorizationLabel(int64_t event) {
      switch (event) {
          case 7: case 10: case 11: case 12: case 15: return "Granted";
          case 6: return "Not authorized";
          default: return "Not recognized";
      }
  }

  int64_t packIdentifierTag(const char* tag, int n) {
      // ports report.js's getIdentifierId(s, n): first 3 chars only.
      unsigned char b0 = tag[0], b1 = tag[1], b2 = tag[2];
      return (static_cast<int64_t>(b0) << 24) | (static_cast<int64_t>(b1) << 16) |
             (static_cast<int64_t>(b2) << 8) | n;
  }

  std::string identificationLabel(int64_t identifierId) {
      int64_t tag = identifierId >> 8;
      if (tag == (packIdentifierTag("bio", 0) >> 8)) return "Biometry";
      if (tag == (packIdentifierTag("fac", 0) >> 8)) return "Facial";     // "face" -> first 3 chars "fac"
      if (tag == (packIdentifierTag("win", 0) >> 8) || tag == (packIdentifierTag("mag", 0) >> 8) ||
          tag == (packIdentifierTag("rfi", 0) >> 8) || tag == (packIdentifierTag("mif", 0) >> 8)) return "Card";
      if (tag == (packIdentifierTag("gui", 0) >> 8)) {
          return identifierId == packIdentifierTag("gui", 1) ? "PIN" : "Password";
      }
      if (tag == (packIdentifierTag("qrc", 0) >> 8)) return "QR Code";    // "qrcode" -> first 3 chars "qrc"
      if (tag == (packIdentifierTag("rex", 0) >> 8)) return "REX button";
      if (tag == (packIdentifierTag("web", 0) >> 8)) return "Web Interface";
      if (tag == (packIdentifierTag("int", 0) >> 8)) return "Intercom";   // "intercom" -> first 3 chars "int"
      return "Unknown";  // no fallback case in report.js's switch -- picked deliberately, see tests.md T-5
  }
  ```
  **The `"Unknown"` default above is final — do not change it.**
  `report.js`'s own generic column-formatter has an outer
  `default: return value;` case (returning the raw number) one level
  above the `case 'identification'` switch — but that outer case
  exists for *entirely different* column types (`boolean`, `datetime`,
  `alarmevent`, etc.), not for `identification` specifically, whose
  own inner tag-matching logic has no fallback branch at all in the
  source. Do not port that unrelated outer `default` into this
  function, and do not replace `"Unknown"` with the raw `identifierId`
  value even though that would be closer to literally mirroring
  `report.js` — see tests.md Test L-3 for the full rationale (this
  path is unreachable on the one real device tested this session, so
  it is a deliberate presentation choice for an unreached edge case,
  not a guess about a reachable one).
  **Important:** verify each tag string is exactly 3 characters as
  used here (`report.js`'s `getIdentifierId` only ever reads
  `bytes[0..2]` regardless of the input string's actual length — e.g.
  `"face"` and `"fac"` produce the identical packed value since only
  the first 3 chars are read; use 3-char literals directly in the
  ported C++ to avoid any ambiguity, as shown above).
- Update `listAccessLogs` to, after building the raw `result` vector:
  collect the distinct non-null `userId`s and `portalId`s present,
  call `getUserNamesAndRegistrationsByIds(...)` / `listPortals()` /
  `listTimeZones()` (or a filtered variant) to build small
  `id -> name` maps, then attach the enrichment fields — **but only
  if** Task 2.1's decision is to keep `AccessLogEntry` SDK-side
  unchanged and do enrichment purely in the backend layer (Task 2.2)
  instead. **Resolve this now, at task-execution time, per Task 1.1's
  note:** enrichment fields live on the **backend's** JSON shape, not
  on the SDK's `AccessLogEntry` struct — so this task's `Client.cpp`
  changes are limited to `identifierId` mapping, `accessLogsCount`,
  `listPortals`, `listTimeZones`, and the two label-computing free
  functions (exposed via a small internal header, e.g.
  `src/AccessLogLabels.hpp`, so `backend/JsonMapping.cpp` can call them
  without duplicating the switch logic) — the actual
  per-page enrichment (name lookups + merge) happens in
  `backend/Routes.cpp` (Task 2.2), which already has access to
  `client.users()`, and will gain access to `client.portals()`/
  `client.accessLogs()` in this same task group.
- **`src/AccessLogLabels.hpp` is a new, header-only file** (both
  `authorizationLabel`/`identificationLabel`/`packIdentifierTag`
  declared `inline` in the header, no matching `.cpp`) — confirmed via
  `CMakeLists.txt` that source files are listed explicitly, not
  globbed (lines 21-22), so a header-only file needs **no**
  `CMakeLists.txt` change; only files that add a new translation unit
  would. `src/Client.cpp` and `backend/JsonMapping.cpp` both
  `#include "AccessLogLabels.hpp"` (or the appropriate relative path
  for each).
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> 2026-09-14: `cmake --build build --target amico_sdk` passed (exit 0); `Client.cpp` compiled with the new header-only label functions and `amico_sdk.lib` linked successfully with no compile errors.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 1.5 — `Name (Time Zone)`'s real 2-hop join (added mid-execution — see spec.md Decision 2b)
**Context (do not skip — this changes what Task 2.2 originally assumed):**
Task 2.2 was written assuming `Name (Time Zone)` resolves the same way
`Name (Portal)` does (a direct id on `access_logs`). It does not —
`access_logs` has no `time_zone_id` field at all. Codex (Executor)
correctly stopped mid-Task-2.2 and reported this rather than guessing.
The real join, confirmed via this session's already-captured
`object_metadata.fcgi` schema
(`artifacts/live_capture/access_logs_object_metadata.json`), is 2 hops:
`access_logs.id → access_log_access_rules.access_log_id →
access_log_access_rules.access_rule_id → access_rule_time_zones.access_rule_id
→ access_rule_time_zones.time_zone_id → time_zones.id`.
**Action:**
- `src/ObjectQuery.hpp`/`.cpp`: add
  `nlohmann::json buildAccessLogAccessRulesBody(const std::vector<int64_t>& accessLogIds)`
  — `object` = `"access_log_access_rules"`, `fields` =
  `["access_log_id", "access_rule_id"]`, `where` =
  `{{"access_log_access_rules", {{"access_log_id", accessLogIds}}}}`
  (same confirmed array-of-ids `where` shape as `buildUsersByIdsBody`).
  Add `nlohmann::json buildAccessRuleTimeZonesBody(const std::vector<int64_t>& accessRuleIds)`
  — `object` = `"access_rule_time_zones"`, `fields` =
  `["access_rule_id", "time_zone_id"]`, `where` =
  `{{"access_rule_time_zones", {{"access_rule_id", accessRuleIds}}}}`.
- `include/amico/Client.hpp`: add
  `std::map<int64_t, std::string> timeZoneNamesForAccessLogIds(const std::vector<int64_t>& accessLogIds);`
  to `AccessLogsApi` (needs `#include <map>`), plus the matching
  private `*Impl` declaration, following the exact existing pattern.
- `src/Client.cpp`: implement it — if `accessLogIds` is empty, return
  `{}` immediately (no network call). Otherwise: (1) query
  `buildAccessLogAccessRulesBody(accessLogIds)`, build a map
  `access_log_id -> access_rule_id` (**tie-break: if an access_log_id
  appears in more than one returned row, keep the first one
  encountered and discard the rest — deterministic, not
  arbitrary**); (2) collect the distinct `access_rule_id`s from that
  map, query `buildAccessRuleTimeZonesBody(...)` on them, build a map
  `access_rule_id -> time_zone_id` (same first-row-wins tie-break);
  (3) call the existing `listTimeZones()` to build `time_zone_id ->
  name`; (4) compose: for each input `access_log_id`, look up its
  `access_rule_id`, then that rule's `time_zone_id`, then that id's
  name — only include an entry in the returned map if all 3 hops
  resolved (a missing hop means "no time zone for this row", handled
  as an empty string by the backend layer, same convention as
  Task 2.1's other optional joins).
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0, no compile errors.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> 2026-09-14: Implemented directly by Claude (Codex was rate-limited).
> `cmake --build build --target amico_sdk` passed (exit 0);
> `ObjectQuery.cpp`/`Client.cpp` compiled and `amico_sdk.lib` linked
> successfully with no compile errors. `timeZoneNamesForAccessLogIds`
> uses `std::map::emplace` for the documented first-row-wins tie-break
> at both hops (a plain map iteration + `emplace` naturally keeps the
> first-inserted value and ignores subsequent duplicate keys).
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 2 — Backend HTTP layer

### Task 2.1 — `JsonMapping.hpp`/`.cpp`: extend `toJson(AccessLogEntry)` with enriched fields
**Action:** `toJson(const amico::AccessLogEntry&)` (`backend/JsonMapping.cpp`
line ~25-34) keeps its existing 6 fields (`id, time, userId, portalId,
logTypeId, event`) and adds `identifierId`. Since the enrichment
fields (`userName`, `employeeId`, `portalName`, `timeZoneName`,
`authorizationLabel`, `identificationLabel`) are **not** on the SDK's
`AccessLogEntry` (Task 1.4's resolution), add a **second**,
backend-only function:
```cpp
// backend/JsonMapping.hpp
nlohmann::json toJson(const amico::AccessLogEntry& entry,
                      const std::string& userName, const std::string& employeeId,
                      const std::string& portalName, const std::string& timeZoneName);
```
which calls the existing `toJson(entry)` for the base fields, adds
`identifierId` (already added above), then sets the 4 name fields
plus `authorizationLabel`/`identificationLabel` (computed by calling
Task 1.4's `amico::detail::authorizationLabel(entry.event)` /
`amico::detail::identificationLabel(entry.identifierId)` directly —
`backend/Routes.cpp` should not reimplement this logic). Empty-string
inputs (no user/portal/time-zone matched) serialize as `""`, matching
how the real report shows a blank cell for a `user_id=0` row (already
observed live: the "Portal"-only "Always Allowed" row with no
Name(User)/Employee ID cells).
**Verification:** `cmake --build build --target amico_backend`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> 2026-09-14: `cmake --build build --target amico_backend` passed (exit 0); `JsonMapping.cpp` compiled and `amico_backend.exe` linked successfully with no compile errors.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 2.2 — `Routes.cpp`: `GET /access-logs` — offset, enrichment, total count
**Action:** Rewrite the `/access-logs` handler (`backend/Routes.cpp`
line ~460-486):
- Parse `from`, `to` (unchanged), plus new `offset` via
  `queryParamInt(req, "offset", 0)` (same pattern as `/users`'s
  handler, line ~157).
- Call `client.accessLogs().list(query)` for the page and
  `client.accessLogs().accessLogsCount(query)` for `total` (same
  `query` object — both must see the same `from`/`to` so the numbers
  stay consistent, per spec.md Decision 5).
- Collect the page's distinct non-null `userId`s and `portalId`s, plus
  **all** `id`s on the page (not just non-null-filtered — every row
  has an `id`) for the time-zone join:
  - Users: one call to a new users-by-ids SDK path (Task 1.2's
    `buildUsersByIdsBody`, wired through a new small `UsersApi` method
    or directly reused if `UsersApi::list()` can be filtered by ids —
    prefer adding a minimal `client.users().getNamesByIds(ids)` if a
    clean SDK seam is simpler than reaching into `Client.cpp` internals
    from the backend layer).
  - Portals: one call to `client.portals().list()` (unbounded per
    Task 1.2 — build a local `id -> name` map once per request).
  - **Time zones: one call to
    `client.accessLogs().timeZoneNamesForAccessLogIds(pageAccessLogIds)`
    (Task 1.5) — NOT `client.timeZones().list()` directly; there is no
    direct `access_logs.time_zone_id` to match a flat time-zone list
    against (see spec.md Decision 2b). This returns an
    `access_log_id -> time zone name` map directly, already resolved
    through the 2-hop join — use it as-is, keyed by each row's own
    `id`, not by `portalId`/`userId`.**
- Build the response as
  `{"entries": [...enriched rows via Task 2.1's toJson overload...], "total": N}`
  (spec.md's resolved response-shape decision).
- Preserve existing error handling (`respondInvalidRequest` on bad
  query params, `respondError` on SDK exceptions) exactly as today.
**Verification:** `cmake --build build --target amico_backend`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> 2026-09-14: Implemented directly by Claude (Codex was rate-limited).
> Also added `UsersApi::getNamesByIds()` (declared in
> `include/amico/Client.hpp`, implemented in `src/Client.cpp`) since it
> didn't exist yet — this is the "new small UsersApi method" this
> task's own text anticipated. `cmake --build build --target
> amico_backend` passed (exit 0); `Routes.cpp` compiled and
> `amico_backend.exe` linked successfully with no compile errors.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 3 — Frontend

### Task 3.1 — `frontend/access-logs.js`: real columns, pagination, per-page selector
**Action:** Load and apply the `frontend-design` skill first (standing
project instruction for all FE work — no Figma file for this
project). Rewrite `frontend/access-logs.js`:
- Replace the `columns` array (`["id","time","userId","portalId","logTypeId","event"]`)
  with the 8 real-report columns in the real report's own order:
  `Date and Time`, `Authorization`, `Identification`, `Id (User)`,
  `Name (User)`, `Employee ID (User)`, `Name (Portal)`,
  `Name (Time Zone)` — reading `time` (via existing `formatTime`),
  `authorizationLabel`, `identificationLabel`, `userId`, `userName`,
  `employeeId`, `portalName`, `timeZoneName` directly from each
  response row (already resolved server-side — no client-side lookup
  or bit-packing logic needed here, per spec.md Decision 1).
- Response is now `{entries, total}`, not a bare array — update
  `load()` accordingly (`const {entries, total} = await apiFetch(...)`).
- Keep the existing `from`/`to` datetime-local filters unchanged
  (spec.md Decision 4 — no 4-way split).
- Add a per-page `<select>` with options `10/20/30` (matching the real
  device exactly), defaulting to `10`; changing it re-runs `load()`
  from `offset=0`.
- Add Prev/Next buttons and a status line reading
  `Showing {offset+1} to {min(offset+entries.length, total)} of {total} records`
  (matching the real device's own phrasing, confirmed live:
  `"Showing from 1 to 10 of 158 records"` — adapt wording minimally to
  fit, keep the same information content). Disable Prev when
  `offset === 0`; disable Next when `offset + entries.length >= total`.
- `limit`/`offset` are sent as query params alongside `from`/`to`
  (mirroring the existing `apiFetch` query-building pattern already
  in this file).
**Verification:** `node --check frontend/access-logs.js`.
**Pass:** Exit 0; the 8 real columns render in the real report's
order; per-page selector and Prev/Next present.
**Fail:** Compile error, or any column missing/misordered.

**Status:** `[x]`
**Verification result:**
> 2026-09-14: Implemented directly by Claude (Codex was rate-limited).
> `node --check frontend/access-logs.js` exited 0. Loaded the
> `frontend-design` skill first per standing project instruction.
> Implementation note: the old freeform numeric "Limit" input was
> removed entirely (not just left alongside the new selector) since
> the 10/20/30 per-page `<select>` now serves that exact role — the
> real device has no separate freeform limit input either, only the
> per-page dropdown; keeping both would have been a redundant,
> confusing control this task's own goal (matching the real report)
> argues against. Response shape updated to destructure
> `{entries, total}` per Task 2.2's resolved response shape.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 3.2 — `frontend/style.css`: pagination control styling
**Action:** Add styling for the new per-page `<select>`/Prev/Next
controls/status line, reusing this file's existing button/select/
form-control patterns (no new visual language — same tokens already
used by every other control in this file, per the `frontend-design`
skill's general guidance already applied to every prior FE task this
session).
**Verification:** Manual visual review (Task 5.1) — no automated CSS
test framework in this project (same accepted limitation as every
prior frontend plan this session).
**Pass:** Controls render correctly at desktop and narrow (~400px)
widths, no horizontal scroll introduced (existing responsive rule
convention already in this file).
**Fail:** Layout breakage or new horizontal scroll.

**Status:** `[x]` — offline part done; visual acceptance confirmed live in Task 5.1
**Verification result:**
> 2026-09-14: Implemented directly by Claude (Codex was rate-limited).
> Extended the existing shared `button, input` rule (and its
> `:disabled`/`:focus` companions) to include `select`, so the new
> per-page dropdown picks up the exact same border/radius/padding/
> disabled/focus treatment every other control in this file already
> has — no new class, no new visual language. The pagination row
> reuses the already-existing `.actions` flex layout (no new CSS rule
> needed for its own layout). Cannot be marked fully `[x]` — like the
> prior frontend plans this session, CSS layout can't be honestly
> called "verified" without a live visual check (Task 5.1).
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 4 — Tests and docs

### Task 4.1 — Update SDK/backend offline tests
**Action:**
- `test/test_access_logs.cpp`: cover `identifierId` mapping,
  `accessLogsCount`, `listPortals`/`listTimeZones`, and both
  `authorizationLabel`/`identificationLabel` functions (at minimum:
  every literal case in the ported switch — 7/10/11/12/15→"Granted",
  6→"Not authorized", other→"Not recognized"; each identification tag
  family → its exact label string; the "gui" PIN-vs-Password
  disambiguation; and the "no known tag matches" → `"Unknown"` default
  case introduced in Task 1.4, since `report.js`'s own switch has no
  final `else` — see tests.md T-5 for why this default was chosen).
- `test/test_query_whitelist.cpp`: cover the new `identifier_id` field
  in `kAccessLogFields`, the chained `from`+`to` where-clause shape,
  `buildAccessLogsCountBody`, `buildPortalsListBody`,
  `buildTimeZonesListBody`, `buildUsersByIdsBody`.
- `test/test_fixtures_load.cpp`: update any access-log fixture data
  this file seeds so it includes `identifier_id` (only touch this
  file if it actually seeds access-log rows — confirm first; do not
  add unrelated fixture data).
- `test/test_errors.cpp`: update only if it references
  `AccessLogEntry`'s exact field set in an error-path assertion.
- `test/backend/test_routes.cpp`: cover `GET /access-logs`'s new
  `offset` param, the `{entries, total}` response shape, and that
  enriched fields (`userName`, `portalName`, etc.) appear correctly
  using a fake/mock transport (this project's existing offline test
  seam — `setTransportForTesting`).
**Verification:** `build-exec/amico_tests.exe`, `build-exec/amico_backend_tests.exe`
(or this project's current equivalent build/test commands).
**Pass:** All tests pass; no unrelated regressions.
**Fail:** Any failure — report to Planner with the exact failing test name.

**Status:** `[x]`
**Verification result:**
> 2026-09-14: Implemented directly by Claude (Codex was rate-limited).
> Also fixed 4 pre-existing test failures the SDK changes had silently
> introduced (found by running the suite before writing any new tests,
> per this project's own discipline): `test/fixtures/access_logs_list.json`
> was missing the now-required `identifier_id` field on every row
> (added, using the real captured value `1717658368`); one existing
> test in `test_access_logs.cpp` asserted the old, now-removed
> client-side `from`-filtering behavior (rewritten to assert both
> `from`/`to` are server-side, per spec.md Decision 5).
> `./build/amico_tests.exe`: 108/108 passed (95 baseline + 13 new: Q-1
> through Q-7, L-1 through L-5). `./build/amico_backend_tests.exe`:
> 43/43 passed (41 baseline, minus the 1 old access-logs test replaced
> by R-1/R-2/R-3 = +2 net). No unrelated regressions in either suite.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 4.2 — Docs
**Action:**
- `docs/backend-api.md`: document `GET /access-logs`'s new `offset`
  param and the `{entries, total}` response shape with all fields.
- `docs/api-roadmap.md`: mark Access Logs joins/pagination as
  ✅ Implemented; add a note under "Suggested next discovery pass" for
  the two explicitly-deferred items (Decision 6): User/Group/Time Zone
  filter dropdowns (blocked on a "list all groups" API this project
  doesn't have yet), and Export/Print (already tracked separately).
**Verification:** Manual review — no automated doc test.
**Pass:** Docs accurately reflect the new shape; no stale claims left
about the old 6-column response.
**Fail:** Any inaccuracy.

**Status:** `[x]`
**Verification result:**
> 2026-09-14: Implemented directly by Claude (Codex was rate-limited).
> `docs/backend-api.md`'s `/access-logs` entry rewritten with the full
> `{entries, total}` shape, all enriched fields, and the empty-string-
> vs-null convention. `docs/api-roadmap.md` section 3 marked ✅
> Implemented (full real-report parity, not "partial"); section 7
> rewritten to clarify the Access (Global) row data no longer needs
> `report_generate.fcgi` at all (only the other report variants +
> export still do); "Suggested next discovery pass" gained an explicit
> note on the two Decision 6 deferrals (filter dropdowns blocked on a
> Groups-list API gap already tracked in section 5; Export/Print
> needing its own separate discovery pass). Manual review only, per
> this task's own verification method — no stale claims about the old
> 6-column response found.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 5 — Manual live verification (READ-ONLY — no new approval category)

### Task 5.1 — Visual + functional check against the real device
**Action:** Log into the real device via our own frontend (routine
access). Open the Access Logs tab. Confirm:
- All 8 columns render with resolved names/labels (not raw IDs) for
  the known real user (id 36, "Phuong Hoang", event 7 rows) —
  "Granted" / "Facial" / "Phuong Hoang" / "Portal" / "Always Allowed"
  expected, matching the real device's own confirmed table content
  exactly (row-for-row comparable, since it's the same underlying
  device data).
- A `user_id=0` row (event 3, "not recognized") renders "Not
  recognized" with blank Name/Employee ID cells, not an error.
- Changing the per-page selector (10/20/30) changes how many rows
  render and updates the status line's "of Z records" total
  correctly.
- Next/Prev correctly move between pages without duplicating or
  skipping rows (cross-check a couple of adjacent pages' `id` values
  don't overlap).
- Setting `from`/`to` correctly narrows results **and** the status
  line's total reflects the filtered count, not the full unfiltered
  count (this directly exercises spec.md Decision 5's fix).
- No console errors throughout.
**Verification:** Manual, via chrome-devtools-mcp, screenshots +
console check.
**Pass:** All of the above hold.
**Fail:** Any mismatch, error, or incorrect total/pagination math.

**Status:** `[x]`
**Verification result:**
> 2026-09-14: PASS, live against `http://192.168.2.156` via our own
> frontend at `http://localhost:8080` (restarted `amico_backend.exe`
> from the freshly-built `build/` binary first — the previously-running
> process was a stale pre-Task-2.2 build). Logged in fresh (user
> provided credentials this turn). All 8 columns render correctly:
> "Granted"/"Not authorized"/"Not recognized" Authorization labels all
> observed live and correct; Identification showed both "Facial" (the
> only previously-observed case) **and "Web Interface"** (a
> newly-encountered real row this check surfaced) — confirming the
> ported label logic generalizes correctly beyond the one tag this
> session had directly verified by hand. Two real users resolved
> correctly: id 36 "Phuong Hoang" (Portal/Always Allowed) and id 5
> "Phat" with a real non-empty Employee ID "1234" (`registration`
> field). A `user_id=0` "Not recognized" row rendered with blank
> Name/Employee ID/Time Zone cells, Portal still resolved — exactly
> matching Decision 2b's documented behavior for a row with no
> matching `access_log_access_rules` entry. Per-page 10→20 correctly
> reset to page 1 and rendered 20 rows. Next then Previous round-tripped
> back to the exact original page 1 rows, no duplicates/gaps at the
> boundary. Setting `from`/`to` to the same window captured during
> protocol discovery (1789150000–1789200000) showed "Showing 1 to 15
> of 15 records" — both `entries` and `total` correctly narrowed
> together (the exact Decision 5 regression this test exists to catch)
> — matches the live-captured `COUNT(*)` result from that same
> discovery pass exactly. No console errors at any point (checked via
> `list_console_messages`). Screenshots saved to
> `artifacts/live_capture/access-logs-page1.png` and
> `access-logs-filtered.png`.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 6 — Post-ship visual-parity addendum (spec.md Decision 7)

### Task 6.1 — Icon-based Authorization column, 4-field date/time filter, page title/column-header naming
**Action:**
- Hoist `booleanIcon()`/`booleanPaths` from `frontend/users.js` (was
  private to its IIFE) into the shared `frontend/app.js`, generalized
  to a `true | false | null` tri-state (new 4th CSS class
  `.icon-neutral`, grey, in `frontend/style.css`, alongside the
  existing `.icon-yes`/`.icon-no`).
- `frontend/access-logs.js`: replace the Authorization column's plain
  text with `booleanIcon(authorizationState(log.authorizationLabel), "Granted", "Not authorized", "Not recognized")`,
  where `authorizationState()` maps the label string to
  `true`/`false`/`null`. Add "(Access Logs)" suffix to the first 3
  column headers (Date and Time, Authorization, Identification — the
  other 5 already had their `(User)`/`(Portal)`/`(Time Zone)` suffix).
  Replace the 2 `datetime-local` filter inputs with 4 separate fields
  (Start Date, End Date, Start Time, End Time — `type="date"`/
  `type="time"`), combined into the same `from`/`to` epoch-second
  query params as before (missing time defaults to "00:00"/"23:59").
- `frontend/index.html`: rename the sidebar nav label and the tab's
  static `<h2>` from "Access Logs" to "Access (Global)".
**Verification:** `node --check frontend/app.js frontend/users.js
frontend/access-logs.js`; live visual + functional check against the
real device, including a regression check that Users' own
Password/Administrator icon columns still render correctly.
**Pass:** Exit 0 on all three; live check shows the Authorization
column rendering the correct icon per row (verified via
`aria-label`), the 4-field filter narrows results identically to the
old 2-field version, page title/sidebar say "Access (Global)", first
3 column headers carry "(Access Logs)"; Users page unaffected.
**Fail:** Compile error, wrong icon/color, filter narrowing broken, or
a Users-page regression.

**Status:** `[x]`
**Verification result:**
> 2026-09-14: `node --check` exits 0 on all three files. Live-tested:
> Users page (Password/Administrator columns) renders identically to
> before the refactor — no regression. Access (Global) page: title and
> sidebar both read "Access (Global)"; first 3 column headers carry
> "(Access Logs)"; Authorization column renders green-check
> (`aria-label="Granted"`) and grey-X (`aria-label="Not recognized"`)
> icons, confirmed via accessibility snapshot; filled Start
> Date=End Date=09/12/2026, Start Time=01:06 AM, End Time=03:00 PM,
> clicked Filter — "Showing 1 to 10 of 15 records", exactly matching
> the same window's previously-confirmed 15-row result. One
> pre-existing, unrelated `/favicon.ico` 404 noted and ruled out (not
> a regression). No other console errors.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Completion checklist

- [x] All Group 1-4 tasks marked `[x]`
- [x] Group 5 complete (read-only — no live-device write approval
      needed for this plan at all)
- [x] No tasks marked `[!]`
- [x] `sprint-summary.md` written

---

## Rollback procedure

All files touched are modifications to existing, already-working
files (no new files besides the optional `src/AccessLogLabels.hpp`
internal header) — revert via `git diff`/`git checkout --` against
this plan's own changes if needed (check `git status` first per
standing safety practice).

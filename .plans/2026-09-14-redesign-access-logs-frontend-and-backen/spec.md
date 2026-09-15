# Spec — Redesign Access Logs to match the real device's "Access (Global)" report

---

## Goal

The real AMICO device's own "Access (Global)" report page
(`http://192.168.2.156/en_US/html/reportcustomview.html?report=1`)
shows a rich, human-readable access-log table — resolved user/portal/
time-zone names, a plain-English Authorization label ("Granted" /
"Not authorized" / "Not recognized"), a plain-English Identification
label ("Facial", "Card", "PIN", ...), a per-page size selector
(10/20/30), and full pagination ("Showing from 1 to 10 of 158
records"). Our own `frontend/access-logs.js` currently shows only 6
raw technical columns (`id, time, userId, portalId, logTypeId, event`)
with no joins and no pagination — the exact gap the user pointed out
by directly comparing the two pages side by side.

**Done looks like:** The Access Logs tab shows the same 8 columns as
the real device's report, in the same order, with the same
human-readable values (names instead of raw IDs, plain-English
Authorization/Identification labels instead of raw integers), plus a
working per-page selector and page navigation — while keeping this
project's existing Start/End date-time filters (the real device's
"Start Date/End Date/Start Time/End Time" fields, already present in
our own from/to fields, just not yet split into separate date+time
inputs — see Decision 4).

---

## Background

This session directly compared our `frontend/access-logs.js` against
the real device's report page and captured hard protocol evidence
before writing this spec (per this project's standing "never guess"
discipline):

- **`report_generate.fcgi`** (captured live, reqid 4019): the real
  report's request `columns` are
  `access_logs.id/time/event/identifier_id` LEFT JOINed with
  `users.id/name/registration`, `portals.name`, `time_zones.name`.
  The response is resolved (`"220;...;7;1717658368;36;Phuong
  Hoang;;Portal;Always Allowed"` — names already substituted, not raw
  IDs) — but it returns semicolon-delimited **text for export**, not
  something our own SDK/frontend should parse.
- **`load_objects.fcgi` does NOT support the same cross-object
  `columns`/join syntax** (empirically tested live this session): a
  `columns` array spanning `users`/`portals`/`time_zones` was silently
  ignored and the endpoint fell back to returning the full raw
  `access_logs` row only (`id, time, event, device_id, identifier_id,
  user_id, portal_id, identification_rule_id, card_value,
  qrcode_value, pin_value, confidence, mask, log_type_id`). This is the
  endpoint our SDK already uses (`buildAccessLogsListBody` in
  `src/ObjectQuery.cpp`) — so **joins must be done by our own backend
  in C++**, not delegated to the device, mirroring how `AmicoUser` is
  already enriched today (`groupIds`, `cardCount`, `faceCount` are each
  fetched via separate calls and merged server-side — see
  `src/Client.cpp` lines ~436-440).
- **`object_metadata.fcgi`** (captured live, full schema) confirms
  `access_logs.identifier_id` is a real column our SDK does not
  currently expose (`AccessLogEntry` only has `logTypeId`, not
  `identifierId`) — this is a genuine data-model gap, not a styling
  gap.
- **`en_US/js/class/report.js`** (captured live, saved to
  `artifacts/live_capture/report_class.js`) contains the device's own
  authoritative client-side rendering logic, fully read and verified:
  - `case 'accessevent'` (used for the `event` field, labeled
    "Authorization"): `event` in `{7,10,11,12,15}` → "Granted";
    `event == 6` → "Not authorized"; anything else (default,
    including `3`) → "Not recognized".
  - `case 'identification'` (used for the `identifier_id` field,
    labeled "Identification"): the value is a packed integer built
    from an ASCII tag prefix — `getIdentifierId(tag, n) = bytes[0]<<24
    | bytes[1]<<16 | bytes[2]<<8 | n`, compared via `value >> 8`
    against known tags: `"face"` → "Facial", `"win"/"mag"/"rfi"/"mif"`
    → "Card", `"gui"` → "PIN" (if the raw value exactly equals
    `getIdentifierId("gui",1)`) or "Password" (otherwise), `"qrcode"`
    → "QR Code", `"bio"` → "Biometry", `"rex"` → "REX button", `"web"`
    → "Web Interface", `"intercom"` → "Intercom". **Numerically
    verified**: our captured `identifier_id = 1717658368` exactly
    equals `getIdentifierId("face", 0)` (`102<<24 | 97<<16 | 99<<8 |
    0 = 1717658368`) → "Facial", matching every row observed live on
    this device (it only has facial identification configured).
  - This mapping is **entirely client-side** (a static `$elements`
    JS registry) — there is no `identification_rules` database join
    involved despite that table existing in the schema (a red herring
    ruled out this session: `object_field_report_columns` confirms
    column 3 of report 1 is literally `access_logs.identifier_id`,
    and `report_column_formats` for that column has an empty
    `format` string, meaning the client, not the server, renders the
    label).
  - Only the exact three device-observed tag families are relevant to
    this device today (all rows are "Facial"), but the ported logic
    covers every tag the real device's own code defines, so behavior
    won't silently break if a Card/PIN/QR reader is added later.

---

## Design decisions

### Decision 1 — Backend does the joins and label computation in C++; frontend just renders
- **Chosen:** Extend `AccessLogEntry` (`include/amico/Types.hpp`) with
  the raw `identifierId` field (from `access_logs.identifier_id`,
  already fetchable via `load_objects.fcgi`'s existing per-object
  `fields` list — just add `"identifier_id"` to `kAccessLogFields` in
  `src/ObjectQuery.cpp`). The backend HTTP layer
  (`backend/Routes.cpp`'s `GET /access-logs` handler) then, for the
  current page of results only: collects the distinct non-null
  `userId`/`portalId` values present, batch-fetches their names via
  the existing users-by-id-list pattern already used elsewhere
  (`buildUserDeleteBody`'s `{"id": [...]}` array-where shape) plus two
  new minimal read-only lookups (Decision 2), and merges
  `userName`, `employeeId` (from `users.registration`, matching the
  real report's "Employee ID (User)" column), `portalName`,
  `timeZoneName`, `authorizationLabel`, and `identificationLabel`
  into the JSON returned by `toJson(AccessLogEntry)`
  (`backend/JsonMapping.cpp`). `authorizationLabel`/
  `identificationLabel` are computed in C++ by porting
  `report.js`'s two switch statements verbatim (same cases, same
  literal strings, same bit-packing arithmetic for
  `identificationLabel`).
- **Why:** Matches this codebase's existing, established enrichment
  pattern (`AmicoUser` is already built this way — see Background) and
  avoids depending on `report_generate.fcgi`'s CSV/export-oriented
  response shape, which is a separate, differently-shaped endpoint
  from the JSON object API our backend already uses everywhere else.
- **Rejected alternatives:**
  - *Frontend does the joins/label lookups*: would require the
    frontend to fetch and cache full Users/Portals/TimeZones lists
    itself and re-implement the `report.js` bit-packing logic in JS —
    rejected as a duplicate of logic already centralized server-side
    for Users today (`groupIds` etc.), and it would leak raw
    `identifier_id`/protocol internals into the frontend layer this
    project has kept protocol-free so far.
  - *Call `report_generate.fcgi` directly from our backend*: rejected
    — it's a semicolon-delimited export format designed for
    Export/Print, not a stable JSON list API, and would introduce a
    second, inconsistent object-query code path alongside
    `load_objects.fcgi`.

### Decision 2 — Add minimal read-only Portals and Time Zones list APIs
- **Chosen:** Add `AmicoClient::PortalsApi::list()` and
  `AmicoClient::TimeZonesApi::list()` (new, minimal — just `{id,
  name}` each, mirroring the existing `UsersApi` shape), backed by
  `load_objects.fcgi` queries on the `portals`/`time_zones` objects
  (both already exist in the device's own schema — confirmed via
  `object_metadata.fcgi`). These are used **only** by the backend's
  `GET /access-logs` enrichment step in this plan — no new HTTP routes
  or frontend UI are added for them (see Decision 5, out of scope).
- **Why:** Portal names and Time Zone names are real columns the real
  report shows (`"Name (Portal)"`, `"Name (Time Zone)"`) that this SDK
  has no way to resolve today; a minimal list API is the smallest
  change that unblocks the join without inventing unrelated CRUD
  surface this plan doesn't need.
- **Rejected alternatives:** A full Portals/TimeZones CRUD API —
  rejected as scope far beyond what this plan's own goal (fixing the
  Access Logs display) requires.

### Decision 2b — `Name (Time Zone)` requires a 2-hop join, not a direct field (discovered mid-execution, amending Decision 2)
- **Context:** Discovered during Task 2.2's execution (Codex correctly
  stopped and asked rather than guessing, per this project's "never
  guess" discipline): `AccessLogEntry`/`access_logs` has **no**
  `time_zone_id` field at all — unlike `portal_id`, which is a direct
  column. Re-examining `object_metadata.fcgi`'s already-captured schema
  (`artifacts/live_capture/access_logs_object_metadata.json`, which
  this plan had on file before writing tasks.md, but whose
  `access_logs.joins.time_zones` entry specifically was not checked
  before scoping Task 2.2) shows the real join path is 2 hops:
  `access_logs.id → access_log_access_rules.access_log_id →
  access_log_access_rules.access_rule_id → access_rule_time_zones.access_rule_id
  → access_rule_time_zones.time_zone_id → time_zones.id`. Both
  intermediate tables (`access_log_access_rules`,
  `access_rule_time_zones`) are confirmed via the same schema dump to
  have exactly the two id columns each, no additional fields.
- **Chosen:** Add a new SDK method,
  `AmicoClient::AccessLogsApi::timeZoneNamesForAccessLogIds(const std::vector<int64_t>& accessLogIds)`,
  returning `std::map<int64_t, std::string>` (access_log id → resolved
  time zone name, entries omitted where no resolution exists at any
  hop). Internally: one batched `access_log_access_rules` query
  (`where: {"access_log_access_rules":{"access_log_id": ids}}`) to get
  each access_log's `access_rule_id`; one batched
  `access_rule_time_zones` query on the resulting distinct
  `access_rule_id`s to get each rule's `time_zone_id`; then the
  existing `listTimeZones()` (Decision 2) to resolve the final name.
  **Tie-break rule (both junction tables are logically many-to-many,
  though this device's own data is 1:1 in every observed row):** if an
  access_log or access_rule maps to more than one row at a hop, the
  **first** row returned by the device is used — deterministic, not
  guessed, and matches every row observed live on this device (which
  has exactly one access_rule per access_log and one time_zone per
  access_rule today).
- **Why:** This is the only evidence-backed way to resolve this column
  without depending on `report_generate.fcgi` (already rejected in
  Decision 1) — the join path itself was already fully captured in
  this session's own schema evidence, just not cross-checked against
  Task 2.2's implicit "direct field" assumption before tasks.md was
  written. This is a correction to an implementation detail Decision 2
  under-specified, not a new design direction.
- **Rejected alternatives:**
  - *Leave `timeZoneName` permanently blank* — rejected: the evidence
    to resolve it correctly was already on file; leaving it blank
    would be presentation-layer guessing-by-omission on a column the
    user explicitly asked to see resolved, when the real fix is a
    bounded, already-evidenced amount of extra work.
  - *Pick an arbitrary hop's value without a defined tie-break rule* —
    rejected: would be non-deterministic/unspecified behavior; the
    "first row wins" rule above is explicit and testable.
- **Decided by:** Claude (Planner), after Codex (Executor) correctly
  stopped mid-Task-2.2 and reported the schema mismatch rather than
  guessing — see DECISION_LOG.md for the full account, including a
  transparent note that this gap should have been caught during Plan
  Review, not first at execution time.

### Decision 3 — Pagination: add `offset` to `AccessLogQuery`, plus a per-page selector
- **Chosen:** `AccessLogQuery` (`include/amico/Types.hpp`) gains an
  `offset` field (it already has `limit`; `offset` is simply missing
  today). `GET /access-logs` accepts a new optional `offset` query
  param. The frontend adds the same 10/20/30 per-page selector the
  real device has, plus Prev/Next controls and a "Showing X to Y of Z"
  status line — computed from a **new** `total` count the backend
  returns alongside the page of entries (a `COUNT(*)`-style query
  against `access_logs` with the same `where` clause, mirroring the
  existing `runCountQuery` helper already used for `cardCount`/
  `faceCount` in `src/Client.cpp`).
- **Why:** Directly matches the real device's confirmed pagination UI
  (`"Showing from 1 to 10 of 158 records"` + numbered page links);
  without a total count the frontend cannot render "of Z records" or
  disable Next past the last page.
- **Rejected alternatives:** Infinite-scroll or a "Load more" button —
  rejected, doesn't match the real device's numbered-pagination
  pattern the user asked to replicate.

### Decision 4 — Keep single from/to datetime filters; do not split into 4 separate Date/Time inputs
- **Chosen:** Keep the existing `from`/`to` single `datetime-local`
  inputs as-is. The real device splits this into 4 separate fields
  (Start Date, End Date, Start Time, End Time) but this is a pure
  input-widget difference, not a data/protocol difference — our
  existing single-field-per-bound design already lets an operator
  pick both date and time in one control and is not a regression in
  capability.
- **Why:** Avoids UI churn with no functional benefit; keeps this
  plan focused on the actual reported gap (raw IDs / no joins / no
  pagination), not a cosmetic input-splitting exercise.
- **Rejected alternatives:** Splitting into 4 fields to visually match
  — rejected as scope not justified by any functional gap.

### Decision 5 — `from` becomes a real server-side `where` clause (fixes a pre-existing limitation)
- **Context:** Today, `buildAccessLogsListBody` only sends `to` as a
  server-side `where` clause; `from` is applied as a **client-side**
  filter on the page already returned (see the existing comment on
  `AccessLogQuery` in `include/amico/Types.hpp`, which explicitly says
  this was because there was "no confirmed evidence for chaining two
  `where` clauses against this object"). Adding a `total` count
  (Decision 3) makes this a real correctness bug if left as-is: the
  count would include rows before `from` that the page itself
  silently drops, making "Showing X to Y of Z" wrong whenever `from`
  is set.
- **Chosen:** Empirically tested live this session (read-only):
  `{"where":[{"field":"time","operator":">=","value":1789150000},
  {"field":"time","operator":"<=","value":1789200000}]}` against
  `load_objects.fcgi` correctly returns only the 15 rows in that
  window, and the matching `COUNT(*)` query also returns `15` —
  confirming the array `where` clause supports two chained conditions
  on the same field (implicit AND between array elements, same
  mechanism already used for the OR/AND `connector` trick in
  `buildUsersListBody`). `buildAccessLogsListBody` is updated to emit
  both clauses server-side when `from` is set; the count query uses
  the identical `where` array.
- **Why:** This is now a correctness requirement (not just a nicety)
  once pagination/total exist, and it removes a previously-documented
  limitation with real, fresh evidence rather than continuing to
  guess.
- **Alternatives rejected:** Leaving `from` as a client-side
  post-filter and computing `total` as "count of the `to`-only
  query minus discarded rows" — rejected, would require fetching and
  discarding rows just to compute a correct total, defeating the
  purpose of server-side pagination.

### Decision 7 — Visual-parity addendum (post-ship): icon-based Authorization, 4-field date/time filter, page title/column-header naming
- **Context:** After this plan shipped, the user directly compared our
  page against the real device's own report page side-by-side (fresh
  screenshots, both logged in live) and reported the UI "doesn't look
  the same." Live comparison found: (1) the real report's
  Authorization column renders a **tri-state icon**, not text — traced
  to `report.js`'s `checkBoolean(value)` (`artifacts/live_capture/report_class.js`
  line ~920): `true` → green check, `false` → red X, **anything
  else (including `null`, i.e. "Not recognized") → grey X** — a real
  third visual state, confirmed by reading the literal source, not
  guessed; (2) the real page splits `from`/`to` into 4 separate
  fields (Start Date, End Date, Start Time, End Time), not 2
  `datetime-local` inputs; (3) the real page's title/sidebar label is
  "Access (Global)", not "Access Logs"; (4) the real column headers
  carry "(Access Logs)"/"(User)"/"(Portal)"/"(Time Zone)" suffixes —
  our first 3 columns were missing theirs (the last 5 already matched).
- **Chosen:** Fixed all 4. The Authorization icon reuses this
  project's own pre-existing `booleanIcon()` helper (previously
  private to `frontend/users.js`, used for the Password/Administrator
  columns) — hoisted to the shared `frontend/app.js` and generalized
  to accept `true | false | null` (a new `.icon-neutral` CSS class,
  grey, alongside the existing `.icon-yes`/`.icon-no`) instead of
  duplicating icon-rendering logic. `frontend/access-logs.js` derives
  the tri-state from the already-computed `authorizationLabel` string
  ("Granted" → true, "Not authorized" → false, else → null) — no new
  backend/protocol change, this is presentation-only. The 4-field
  filter combines Date+Time into the same epoch-seconds `from`/`to`
  query params as before (defaulting time to "00:00"/"23:59" when a
  date is set but its time isn't, matching the real device's own
  default values) — no backend change needed here either.
- **Still out of scope** (unchanged from Decision 6): User/Group/Time
  Zone filter dropdowns, Export/Print. This addendum is purely visual/
  labeling parity for what the page already does.
- **Why:** Directly responds to the user's own live side-by-side
  comparison; the icon-vs-text gap in particular was a genuine,
  evidence-backed mismatch (not a stylistic preference) since it
  reflects the real device's own literal rendering code.
- **Verification:** Live-tested against the real device after the
  change: Users page's existing icon columns (Password,
  Administrator) unaffected (regression-checked — same rendering, same
  colors); Access (Global) page's Authorization column now renders
  icons with correct `aria-label`s ("Granted"/"Not authorized"/
  "Not recognized") confirmed via accessibility snapshot; the 4-field
  filter correctly narrowed to "15 records" for the same window
  previously confirmed (1789150000–1789200000); no console errors
  (one pre-existing, unrelated `/favicon.ico` 404 noted and ruled out).
- **Decided by:** User (reported the mismatch) / Claude (diagnosed via
  live comparison + source reading, implemented, verified)

### Decision 6 — Out of scope: User/Group/Time Zone filter dropdowns, and Export/Print
- **Chosen:** This plan does **not** add the real report's User/Group/
  Time Zone filter dropdowns, nor its Export/Print buttons.
- **Why:**
  - The **Group** filter dropdown would require a "list all groups"
    API this project does not have today (only per-user group
    membership add/remove exists — `POST`/`DELETE
    /users/:id/groups/:groupId`, no `GET /groups`) — a separate,
    pre-existing gap already noted in `docs/api-roadmap.md`, not
    something to bundle into this fix silently.
  - **Export/Print** is already tracked in `docs/api-roadmap.md` as
    "📋 Planned" with its own protocol evidence
    (`docs/ui-action-protocol-map.md` line 344) — it deserves its own
    plan rather than being squeezed into this one, since it involves
    file-generation/download semantics this plan's scope doesn't
    otherwise touch.
  - Bundling all of this into one plan would make it far harder to
    review and verify; the core, directly-reported gap (raw IDs,
    no joins, no pagination) is fully addressed without them.
- **Follow-up:** Noted in `docs/api-roadmap.md` as the next discovery
  item after this plan ships.

---

## Scope

### In scope
- `include/amico/Types.hpp`: `AccessLogEntry` gains `identifierId`
  (raw `int64_t`, optional-free since the device always returns it);
  `AccessLogQuery` gains `offset` (`int`, default `0`).
- `src/ObjectQuery.cpp`: `kAccessLogFields` gains `"identifier_id"`;
  `buildAccessLogsListBody` accepts/passes `offset` (already a
  parameter, just not threaded from `AccessLogQuery` — confirm and
  wire if missing); a new `buildAccessLogsCountBody`-style query
  (or reuse of the existing count-query helper) for the total-count
  read; new minimal `buildPortalsListBody`/`buildTimeZonesListBody`;
  new `buildAccessLogAccessRulesBody`/`buildAccessRuleTimeZonesBody`
  for Decision 2b's 2-hop time-zone join.
- `src/Client.cpp`: `listAccessLogs` enriches each page's entries with
  `userName`, `employeeId`, `portalName`, `timeZoneName`,
  `authorizationLabel`, `identificationLabel` via batched id-list
  lookups (not N+1 per row) against the new Portals/TimeZones APIs and
  the existing Users API; new `PortalsApi::list()`/
  `TimeZonesApi::list()`; a new `listAccessLogsCount`-style method for
  the total; new `timeZoneNamesForAccessLogIds()` implementing
  Decision 2b's 2-hop join.
- `include/amico/Client.hpp`: declare `PortalsApi`/`TimeZonesApi`
  (minimal `{id, name}` list only) and the count accessor.
- `backend/JsonMapping.hpp`/`.cpp`: `toJson(AccessLogEntry)` includes
  the new fields.
- `backend/Routes.cpp`: `GET /access-logs` accepts `offset`, returns
  the enriched fields, and returns a `total` count (response shape:
  either `{entries: [...], total: N}` or an equivalent header —
  decided at task-writing time based on what's least disruptive to
  the one existing consumer, `frontend/access-logs.js`).
- `frontend/access-logs.js`: render all 8 real-report columns (Date
  and Time, Authorization, Identification, Id (User), Name (User),
  Employee ID (User), Name (Portal), Name (Time Zone)) using the new
  enriched fields directly (no client-side lookup/mapping logic
  needed — the backend already resolved everything); add the
  10/20/30 per-page selector, Prev/Next, and the "Showing X to Y of Z
  records" status line.
- `frontend/style.css`: any new styling needed for the pagination
  controls/per-page selector (reusing existing button/select styling
  patterns already in this file — no new visual language invented).
- Tests: `test/test_access_logs.cpp`, `test/test_query_whitelist.cpp`,
  `test/test_fixtures_load.cpp`, `test/test_errors.cpp`,
  `test/backend/test_routes.cpp` updated for the new fields/params.
- `docs/backend-api.md`, `docs/api-roadmap.md` updated to reflect the
  new response shape and to record the Decision 5 follow-up items.

### Out of scope
- User/Group/Time Zone filter dropdowns (Decision 5).
- Export/Print (Decision 5) — already tracked separately in
  `docs/api-roadmap.md`.
- Splitting the from/to filters into 4 separate Date/Time inputs
  (Decision 4).
- Any change to `report_generate.fcgi`/CSV export handling — not
  used by this plan at all (Decision 1).
- Any change to the Alarms/Access-by-Group/Access-by-Time/
  Access-by-User/Users report variants — only the "Access (Global)"
  equivalent (this project's existing single Access Logs tab) is in
  scope.

---

## Affected files

| File | Change type | Reason |
|------|-------------|--------|
| `include/amico/Types.hpp` | Modify | Add `identifierId` to `AccessLogEntry`; add `offset` to `AccessLogQuery`; add minimal `Portal`/`TimeZone` value types |
| `include/amico/Client.hpp` | Modify | Declare `PortalsApi`/`TimeZonesApi` and a total-count accessor for access logs |
| `src/ObjectQuery.cpp` | Modify | Add `identifier_id` to fetched fields; wire `offset`; add portals/time-zones/count query builders; add the 2-hop time-zone join builders (Decision 2b) |
| `src/Client.cpp` | Modify | Enrich `AccessLogEntry` results with joined names + computed labels; implement `PortalsApi`/`TimeZonesApi`/count/`timeZoneNamesForAccessLogIds` |
| `backend/JsonMapping.hpp` | Modify | Extend `toJson(AccessLogEntry)` signature area if needed |
| `backend/JsonMapping.cpp` | Modify | Serialize the new enriched fields |
| `backend/Routes.cpp` | Modify | `GET /access-logs` accepts `offset`, returns enriched fields + total count |
| `frontend/access-logs.js` | Modify | Render all 8 real-report columns; add per-page selector, pagination controls, status line |
| `frontend/style.css` | Modify | Pagination control styling (reusing existing patterns) |
| `test/test_access_logs.cpp` | Modify | Cover new fields/enrichment |
| `test/test_query_whitelist.cpp` | Modify | Cover new query builders' whitelisted fields |
| `test/test_fixtures_load.cpp` | Modify | Update fixtures for new fields if this file seeds access-log test data |
| `test/test_errors.cpp` | Modify | Update if error-path tests reference `AccessLogEntry`'s field set |
| `test/backend/test_routes.cpp` | Modify | Cover new `GET /access-logs` params/response shape |
| `docs/backend-api.md` | Modify | Document new response shape |
| `docs/api-roadmap.md` | Modify | Mark Access Logs joins/pagination as ✅ Implemented; note Decision 5 follow-ups |

---

## Risks and unknowns

- ~~Exact `total` count query mechanics~~ — **confirmed live**
  (read-only, before task-writing): `{"object":"access_logs",
  "fields":["COUNT(*)"],"where":{}}` against `load_objects.fcgi`
  returns `{"access_logs":[{"COUNT(*)":221}]}` — identical mechanics
  to the existing `runCountQuery` pattern already used for
  `cardCount`/`faceCount`.
- ~~Portals/TimeZones list query field names~~ — **confirmed live**
  (read-only): `{"object":"portals","fields":["id","name"]}` returns
  `{"portals":[{"id":1,"name":"Portal"}]}`;
  `{"object":"time_zones","fields":["id","name"]}` returns
  `{"time_zones":[{"id":1,"name":"Always Allowed"}]}` — both match
  the names already observed in the real report's UI.
- **Response shape for `GET /access-logs`** (array vs.
  `{entries, total}`): resolved in tasks.md as `{"entries": [...],
  "total": N}` — the one existing consumer (`frontend/access-logs.js`)
  is being rewritten in this same plan, so there is no other caller to
  break.

---

## Self-evaluation (plan-quality.md rubric)

| Principle | Criterion | Score | Notes |
|-----------|-----------|-------|-------|
| **Think Before Planning** | spec.md written first; every claim backed by a live capture cited by reqid/file | 9/10 | Full protocol discovery pass completed before writing this spec |
| **Simplicity First** | ≥ 3 out-of-scope items with reasoning | 9/10 | Decision 4 + Decision 5 (3 items) explicitly rejected with reasoning |
| **Surgical Changes** | Every file listed with change type and exact reason | 9/10 | 16 files, each with a specific reason tied to a decision |
| **Goal-Driven Execution** | Each scope item traces to an acceptance criterion | 8/10 | Two items (total-count mechanics, portals/time_zones field names) flagged as needing a live confirmation step before task execution proceeds past them |

**Total: 35/40 → 8.75/10** (threshold: 7/10)

---

**User confirmation received:** [ ] Yes
**Confirmed on:** [DATE]

# Tasks — Access (Global) report: full visual/functional parity

> **Executor instructions:** Complete groups in order. After each task,
> run the verification command. Mark status before moving on.
>
> **Status markers:** `[ ]` not started · `[~]` in progress · `[x]` complete
> (verification passed) · `[!]` failed (stop, report to Planner).
>
> **Group gating:** Groups 1-7 require no device contact (offline).
> Group 8 (manual live verification) is entirely read-only — no
> gated write test in this plan (nothing here writes device data);
> requires a fresh `APPROVE_LIVE_DEVICE_TEST:<plan-id>` before any
> live check.

---

## Group 1 — SDK: Groups list surface

### Task 1.1 — `Group` type, `GroupsApi::list()`, query builder
**Action:**
- `include/amico/Types.hpp`: add `struct Group { int64_t id = 0; std::string name; };`
  (name-only view, same minimal-surface precedent as `Portal`/`TimeZone`).
- `include/amico/Client.hpp`: add a `GroupsApi` nested class (same
  pattern as `PortalsApi`/`TimeZonesApi`) with `std::vector<Group> list();`,
  and a `GroupsApi groups();` accessor on `AmicoClient`.
- `src/ObjectQuery.hpp`/`.cpp`: add `buildGroupsListBody()` —
  `object: "groups"`, `fields: ["id","name"]`, no `where` (matches
  spec.md Background's confirmed "(All)" full-list load pattern).
- `src/Client.cpp`: implement `listGroupsImpl()`/`GroupsApi::list()`
  wiring, same shape as the existing `listPortalsImpl()`/
  `listTimeZonesImpl()`.
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> PASS: cmake --build build --target amico_sdk (exit 0). Existing Group type retained; GroupsApi and name-only query builder added using the PortalsApi pattern.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 2 — SDK: `AccessLogQuery` filters (User/Group/Time Zone)

### Task 2.1 — Add optional filter fields; nested-object `where` shape
**Action:**
- `include/amico/Types.hpp`: `AccessLogQuery` gains
  `std::optional<std::vector<int64_t>> userIds;`,
  `std::optional<std::vector<int64_t>> groupIds;`,
  `std::optional<std::vector<int64_t>> timeZoneIds;` (all unset =
  today's exact existing behavior, byte-for-byte unchanged — verify
  with a diff of the unset-case request body, not just a re-read).
- `src/ObjectQuery.cpp`: change `buildAccessLogsListBody`/
  `buildAccessLogsCountBody`'s `where` construction to the
  nested-object-keyed-by-table shape confirmed live in spec.md's
  Background (reqid 1662):
  ```json
  {"access_logs": {"time": {">=": ..., "<=": ...}},
   "users": {"id": [...]},       // only if userIds set and non-empty
   "groups": {"id": [...]},      // only if groupIds set and non-empty
   "time_zones": {"id": [...]}}  // only if timeZoneIds set and non-empty
  ```
  Omit a table's key entirely when its corresponding filter is unset
  (spec.md Risks: this is an *assumption*, not yet independently
  confirmed equivalent to sending an empty `{}` — Task 8 must verify
  this live; if it turns out to change results, switch to always
  sending all three keys, empty `{}` for unset ones, to exactly match
  the confirmed-working shape).
  This is the **only** query builder in this codebase using this
  shape — do not change any other builder's `where` convention.
- Update `buildAccessLogsListBody`/`buildAccessLogsCountBody`'s
  signatures to take the new optional id-list parameters (trailing
  defaulted params, same hazard-avoidance convention as
  `buildUsersListBody`'s `userTypeId` param from the Visitors plan).
- `src/Client.cpp`: thread `query.userIds`/`groupIds`/`timeZoneIds`
  through `listAccessLogs`/`accessLogsCount` into the new builder
  params.
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0; unset-case request body provably unchanged (diff
against the pre-change body for a from/to-only query).
**Fail:** Compile error, or unset-case shape differs from today's.

**Status:** `[x]`
**Verification result:**
> PASS: cmake --build build --target amico_sdk (exit 0). Compiled pre-change and post-change query builders; git diff --no-index of query-before.jsonl/query-after.jsonl in artifacts/access-global-offline exited 0 for complete from/to-only list and count request bodies.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 3 — Backend

### Task 3.1 — `GET /groups` + `GET /timezones` routes + `toJson(Group)`/`toJson(TimeZone)`
**Action:**
- `backend/JsonMapping.hpp`/`.cpp`: add `toJson(const amico::Group&)`
  (`{"id":..., "name":...}`) and `toJson(const amico::TimeZone&)`
  (same shape) — neither exists today (confirmed during Plan Review:
  `TimeZonesApi::list()` already exists SDK-side from the earlier
  Access Logs plan, but no `toJson` for it and no HTTP route at all).
- `backend/Routes.cpp`: add `GET /groups` returning
  `{"groups": [...]}` and `GET /timezones` returning
  `{"timezones": [...]}`, each mirroring the existing `GET /portals`-
  style read-only list route exactly (session-gated, no write verbs —
  list only, per spec.md's Non-goals). `GET /timezones` needs no new
  SDK method — it calls the already-existing `client.timeZones().list()`.
**Verification:** `cmake --build build --target amico_backend`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> PASS: cmake --build build-access-global --target amico_backend (exit 0). Original build compiled successfully but linking hit LNK1168 because the running backend locks build/amico_backend.exe; verified in an isolated Debug build using the same compiler and installed dependencies.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 3.2 — `/access-logs` route: parse new filter params
**Action:** `backend/Routes.cpp`'s existing `GET /access-logs` handler
gains parsing for repeated/comma-separated query params `userIds`,
`groupIds`, `timeZoneIds` (e.g. `?userIds=36,50&groupIds=1`) into
`AccessLogQuery`'s new optional `std::vector<int64_t>` fields — empty/
absent param = unset (today's exact behavior). Reuse the existing
`queryParamInt`-style helper pattern; add a small comma-split helper
if none exists yet.
**Verification:** `cmake --build build --target amico_backend`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> PASS: cmake --build build-access-global --target amico_backend (exit 0). Added repeated/comma-separated int64 parsing; empty/absent filters remain unset and invalid/overflowing integers return 400 before SDK calls.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 4 — Frontend: sidebar "Reports" group

### Task 4.1 — Wrap "Access (Global)" in a new collapsible "Reports" group
**Action:** Load the `frontend-design` skill first (standing project
instruction). `frontend/index.html`: add a new `.nav-group` (exact
same markup pattern as the existing "Enroll" group — a
`.nav-group-toggle` button with a reports-style icon + chevron, plus a
`.nav-submenu` div) titled "Reports", moving the existing
"Access (Global)" `<button data-tab="access-logs">` inside it (not
duplicated). No JS/CSS changes needed — `setNavGroupExpanded()` and
the `.nav-group-toggle`/`.nav-submenu` CSS rules (added earlier this
session for "Enroll") are already generic over any `.nav-group`.
**Verification:** Live check via chrome-devtools-mcp (read-only).
**Pass:** "Reports" group renders collapsed/expanded correctly
(reusing existing behavior), "Access (Global)" still switches tabs
correctly from inside it; "Enroll" group unaffected.
**Fail:** Any tab-switching regression, or "Enroll" group broken.

**Status:** `[x]`
**Verification result:**
> PASS: Local chrome-devtools-mcp at localhost:8080 with fixture responses; Reports/Enroll collapse and expand; Access/Users tabs switch correctly. Screenshot: artifacts/access-global-offline/task-4-1.png. No device contact. Existing unnamed-field advisory and favicon 404 only.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 5 — Frontend: breadcrumb, Filters panel chrome, User/Group/Time Zone filters

### Task 5.1 — Breadcrumb
**Action:** `frontend/index.html`'s `#tab-access-logs`: add
`<p class="breadcrumb">Reports › Access (Global)</p>` above the
existing `<h2>Access (Global)</h2>`. `frontend/style.css`: minimal
`.breadcrumb` styling (muted color, small text) — no new component
system.
**Verification:** `node --check frontend/app.js` (no JS touched by
this task, but confirms no syntax damage to shared files); live visual
check.
**Pass:** Breadcrumb text renders above the heading.
**Fail:** Missing or malformed.

**Status:** `[x]`
**Verification result:**
> PASS: node --check frontend/app.js (exit 0); localhost Chrome DevTools MCP screenshot confirms Reports breadcrumb above Access (Global) heading.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 5.2 — "Filters" panel chrome + rename Filter → List
**Action:** `frontend/access-logs.js`: wrap the existing filter
`<form>` in a labeled panel matching the device's own "Filters" blue
header bar (a `<fieldset>`/`<div class="filters-panel">` with a
`<legend>`/header labeled "Filters"). Rename the submit button's label
from "Filter" to **"List"** (text change only — same submit behavior,
same `id`/wiring). `frontend/style.css`: add `.filters-panel` styling
(a header bar using `--brand-blue`, matching the device's own blue
Filters header) — reuse existing CSS custom properties, no new color
values invented.
**Verification:** `node --check frontend/access-logs.js`; live visual
check.
**Pass:** Filters panel has a visually distinct blue header labeled
"Filters"; submit button reads "List"; filtering still works exactly
as before (existing date/time behavior unchanged).
**Fail:** Any regression to existing date/time filtering.

**Status:** `[x]`
**Verification result:**
> 2026-09-14: `node --check frontend/access-logs.js` exit 0.
> `frontend/access-logs.js` gained a `.filters-panel` wrapper with an
> `<h3 id="access-filters-title">Filters</h3>` header
> (`aria-labelledby`'d from the panel), and the submit button's label
> changed from "Filter" to "List" (same element/wiring, text-only
> change). `frontend/style.css` gained `.filters-panel`/`.filters-panel > h3`
> (blue header bar via `--brand-blue`, matching the real device) /
> `.filters-panel > .filter-form` rules. Live-verified offline (served
> via a local static server + a fixture-fake `apiFetch`, since this
> check ran while the live device session wasn't available): screenshot
> + a scripted check confirmed the breadcrumb, blue "Filters" header,
> and "List" button all render correctly, and existing date/time
> filtering still returns correct results — no regression. One
> unrelated 404 console message was noted during that offline check
> (an asset the static-file-only test harness doesn't serve, e.g. a
> favicon) — expected artifact of the offline harness, not a real app
> regression; not present when served by the real `amico_backend.exe`.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 5.3 — User / Group / Time Zone filters
**Action:** `frontend/access-logs.js`: on tab activation, fetch
`/users` (already exists), `/groups`, and `/timezones` (both added in
Task 3.1) once, populating three new native `<select multiple>` filter controls
(spec.md Decision 7) alongside the existing date/time fields inside
the same Filters panel. On submit ("List"), collect each select's
chosen `<option>` values into `userIds`/`groupIds`/`timeZoneIds` query
params (comma-joined; empty selection = param omitted = "(All)",
matching Task 3.2's parsing). Label each control "User"/"Group"/
"Time Zone", matching the real device's own labels.
**Verification:** `node --check frontend/access-logs.js`; live check
(select a specific user/group/time zone, confirm the result set
narrows correctly and matches what that filter should show).
**Pass:** Each filter, used alone and in combination with the
existing date/time filters, narrows results correctly; leaving all
three unselected reproduces today's exact unfiltered-by-these-three
behavior.
**Fail:** Incorrect filtering, or a regression to the existing
date/time-only behavior when all three are left at "(All)".

**Status:** `[x]`
**Verification result:**
> PASS: node --check frontend/access-logs.js exit 0; offline Chrome MCP fixture check passed all 16 individual/combined filter and date cases, once-only option loading, multi-selection, and clear-to-All. Screenshot: artifacts/access-global-offline/task-5-3.png. Existing static-server favicon 404 and unnamed-field advisory only; no device contact. Actual device result semantics reserved for Task 8.
>
> **Post-hoc review fix (Claude, same day):** `GET /users` defaults to
> `AmicoConfig::defaultPageSize` (50 rows) when no `limit` param is
> given, unlike `/groups`/`/timezones` (always return every row, no
> pagination). The User filter's option list was silently built from
> only the first 50 users. Changed the fetch path to
> `/users?limit=100000` (a large-enough ceiling, matching the existing
> "just ask for effectively everything" convention rather than adding
> pagination UI to a filter dropdown). Harmless for this device (5-6
> real users today) but a real correctness gap for a larger one —
> caught and fixed before sign-off, not shipped. `node --check` still
> exits 0 after the fix.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 6 — Frontend: Export + Print

### Task 6.1 — Export (client-side CSV of the current page)
**Action:** `frontend/access-logs.js`: add an "Export" button (Filters
panel button row, alongside "List" — spec.md Decision 3) that builds
a CSV string from the **currently loaded** `entries` (header row from
the existing `columns` array's `label`s, one data row per entry, using
the same value formatting `load()` already applies per column — reuse
that logic, don't duplicate it), then triggers a download via
`Blob`+synthetic `<a download>` click (no server round-trip, no new
backend endpoint). Filename: something like
`access-logs-<current-date>.csv`.
**Verification:** `node --check frontend/access-logs.js`; live check
(click Export, confirm a CSV file downloads with the correct current
rows and correct header labels).
**Pass:** Export produces a correctly-formatted CSV of exactly the
rows currently on screen (respecting active filters/pagination).
**Fail:** Missing/incorrect rows, malformed CSV, or a page-content
regression from adding the button.

**Status:** `[x]`
**Verification result:**
> PASS: node --check frontend/access-logs.js exit 0; offline Chrome MCP captured download Blob and filename and compared CSV exactly to displayed rows/headers/authorization labels: first page 10, second page 4, filtered page 7, empty page header only, comma/quote escaping, zero export requests. Native save dialog not exercised (anchor intercepted). No device contact.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 6.2 — Print
**Action:** `frontend/access-logs.js`: add a "PRINT" button calling
`window.print()`. `frontend/style.css`: add an `@media print` block
hiding `.sidebar`, `.app-header`, `.actions`, `.filter-form`/
`.filters-panel`, and pagination controls — leaving only the
Access (Global) heading + table visible when printed (spec.md
Decision 4).
**Verification:** `node --check frontend/access-logs.js`; live check
via the browser's print preview (chrome-devtools-mcp can invoke
`window.print()` and a screenshot can confirm the print stylesheet
took effect, even without an actual printer).
**Pass:** Print preview shows only the heading + table, no sidebar/
header/filters chrome.
**Fail:** Print preview still shows chrome that should be hidden.

**Status:** `[x]`
**Verification result:**
> PASS: node --check frontend/access-logs.js exit 0; offline headless Chrome verified PRINT invokes window.print once and real print-media computed styles hide sidebar/header/filters/actions/pagination/breadcrumb/status while heading/table remain visible. Generated artifacts/access-global-offline/task-6-2.pdf and task-6-2.png. Native print dialog not exercised; no device contact.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 7 — Tests

### Task 7.1 — SDK tests for Groups + `AccessLogQuery` filters
**Action:** `test/test_access_logs.cpp` (existing file, extend) or a
new `test/test_groups.cpp` (whichever fits this file's existing
convention better — check its current scope before choosing) — add
FakeTransport-backed tests:
- `buildGroupsListBody()` exact shape.
- `buildAccessLogsListBody`/`CountBody`: unset filters → byte-for-byte
  identical to today's existing `where` shape (direct regression
  guard). Each of `userIds`/`groupIds`/`timeZoneIds` set individually,
  and combined with each other and with `from`/`to` → correct nested
  `where` shape per spec.md Decision 2.
**Verification:** `cmake --build build --target amico_tests &&
./build/amico_tests.exe`.
**Pass:** Exit 0; all new tests pass; existing test count/behavior
for the unset-filters case unaffected (no regressions).
**Fail:** Any compile error, test failure, or unset-case regression.

**Status:** `[x]`
**Verification result:**
> PASS: cmake --build build --target amico_tests and build/amico_tests.exe exit 0: 121 test cases, 1093 assertions passed. Added exact Groups builder/transport/parsing, literal byte-for-byte full legacy list/count bodies (unset/empty vectors), and 32 filter/date combinations through builders and FakeTransport list/count. Initial test raw-string delimiter compile error corrected before successful build/run.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 7.2 — Backend route tests
**Action:** `test/backend/test_routes.cpp`: add cases for `GET
/groups` (list shape) and `GET /access-logs` with the new
`userIds`/`groupIds`/`timeZoneIds` params (assert the fake transport
receives the expected nested `where` shape). Add one **regression**
test: `GET /access-logs` with no new params still produces the exact
pre-existing `where` shape.
**Verification:** `cmake --build build --target amico_backend_tests &&
./build/amico_backend_tests.exe`.
**Pass:** Exit 0; all new tests pass; existing Access Logs route
behavior unaffected.
**Fail:** Any compile error, test failure, or regression.

**Status:** `[x]`
**Verification result:**
> PASS: cmake --build build --target amico_backend_tests and build/amico_backend_tests.exe exit 0: 51 test cases, 717 assertions passed. Added groups/timezones populated and empty list shapes, session gating, individual/combined/repeated/comma-separated/empty filter params, int64 boundary and malformed/overflow rejection, and exact legacy where regression for list/count. docs/backend-api.md updated for both lookups, filter semantics, and current-page Export/Print. All tests offline.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 8 — Manual live verification (read-only only — no gated write test in this plan)

### Task 8.1 — Full live comparison against the real device
**Action:** Requires a fresh `APPROVE_LIVE_DEVICE_TEST:<plan-id>`
approval (read-only only; this plan makes no device writes at all).
Against `http://localhost:8080`:
- Confirm the "Reports" sidebar group, breadcrumb, "Filters" panel
  chrome, and "List"/"Export"/"PRINT" buttons all render and match the
  real device's own Access (Global) page visually.
- **Independently verify** (spec.md Risks — do not skip): select a
  specific **User** alone, confirm results narrow correctly; select a
  specific **Time Zone** alone, confirm results narrow correctly (Group
  was the one live-captured during planning — User/Time Zone were not,
  and must not be assumed correct without checking here).
- Verify combining a date/time filter with a User/Group/Time Zone
  filter narrows correctly (not just each in isolation).
- Verify leaving all three at "(All)" (nothing selected) reproduces
  today's exact existing unfiltered-by-these-three result set (the
  omitted-key assumption from spec.md Decision 2/Risks — if this
  fails, apply the documented fallback: always send all three keys,
  empty `{}` for unset ones).
- Click Export, confirm a correctly-formatted CSV downloads.
- Click PRINT, confirm the print preview hides chrome correctly.
**Verification:** Manual, via chrome-devtools-mcp, screenshots +
network inspection + console check.
**Pass:** All of the above confirmed correct; no console errors; no
regression to the existing date/time-only filtering or table/column
behavior (already-matched from the prior Access Logs plan).
**Fail:** Any mismatch, incorrect filter result, or console error.

**Status:** `[x]`
**Verification result:**
> 2026-09-14: PASS, live against `http://192.168.2.156` via our own
> frontend at `http://localhost:8080`, after
> `APPROVE_LIVE_DEVICE_TEST:2026-09-14-access-global-report-full-parity-reports`.
> Confirmed visually (screenshot): "Reports" sidebar group, breadcrumb
> "Reports › Access (Global)", blue "Filters" header panel, User/
> Group/Time Zone multi-selects populated with this device's real data
> (5 users, "Standard"/"Everywhere" groups, "Always Allowed" time
> zone), and List/Export/PRINT buttons — closely matches the real
> device's own page.
>
> **Baseline (all filters at "(All)"):** 225 total records.
>
> **User alone** (`userIds=36`, "Phuong Hoang"): narrowed to 23
> records; every returned entry's `userId` is `36` (confirmed via the
> raw JSON response, not just the rendered table) — correct.
>
> **Time Zone alone** (`timeZoneIds=1`, "Always Allowed" — the only
> value this device has): also narrowed to 23 records, identical rows
> to the User-alone result. Verified this is a genuine data
> coincidence, not a filter bug: this device's only non-"Not
> recognized"/"Web Interface" access events all belong to user 36 and
> all resolve to this one time zone, so the two filters happen to
> select the same subset here — confirmed by re-checking the User
> listbox had zero options selected before this run (a fresh
> `take_snapshot`, not an assumption).
>
> **Group alone** (`groupIds=1`, "Standard"): narrowed to **96**
> records — a distinctly different count from User/Time Zone, positive
> confirmation the Group join filters independently and correctly (not
> just coincidentally matching another filter).
>
> **Combined date + Group** (`from=1789146000&groupIds=1`, i.e.
> Start Date = 2026-09-12 AND Group = Standard): narrowed to **28**
> records — correctly tighter than either filter alone (28 < 96 and
> 28 < the date-only count), confirming AND-combination works.
>
> **Omitted-key assumption (spec.md Decision 2/Risks) — CONFIRMED
> correct:** clearing all three selects back to "(All)" and clicking
> List reproduced the exact original baseline of **225** records — no
> fallback (always-send-empty-`{}`-keys) needed.
>
> **Export:** clicked with the date+Group filter active (28 total, 10
> on the current page); intercepted the actual Blob content (not just
> observed the file dialog) — a correctly quoted, comma-delimited CSV
> with the exact 8 column headers and exactly the 10 currently-visible
> rows' data, byte-matching what was on screen. The real file
> (`access-logs-2026-09-14.csv`) was also confirmed saved to the
> user's Downloads folder, proving the end-to-end download mechanism
> (not just the Blob construction) works.
>
> **PRINT:** not re-triggered live (calling `window.print()` in a
> real, non-headless Chrome instance risks opening a blocking native
> OS print dialog with no automated way to dismiss it). Relying on
> Codex's own earlier offline verification instead (Task 6.2's
> `artifacts/access-global-offline/task-6-2.png`/`.pdf`, generated via
> Chrome's print-media emulation) as sufficient — Print is pure CSS
> (`@media print`), not device-dependent, so it needed offline
> confirmation, not a live-device one.
>
> **Console:** two messages seen across the whole session, both
> benign — the pre-existing, unrelated "form field element should have
> an id or name" advisory, and one warning caused by my own test
> mistake (filling a native date input with a localized string instead
> of ISO `yyyy-MM-dd`) — not an application defect. No JS exceptions.
>
> **Bonus finding, fixed same day (see Task 5.3's own note):** while
> reviewing Codex's Task 5.3 work before this live check, found and
> fixed a real gap — the User filter's option list was silently capped
> at `AmicoConfig::defaultPageSize` (50) because `/users` was fetched
> with no `limit` param; changed to `/users?limit=100000`. Confirmed
> live in this same session (network log shows the corrected request).
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 9 — Addendum: Filters panel layout redesign (post-completion, user-requested)

### Task 9.1 — Redesign the Filters form layout for usability
**Action:** User reported the filter form was "khó hình và user khó
thao tác" (visually awkward and hard to use) after seeing its raw
markup. The four date/time fields and the three raw
`<select multiple size="4">` boxes with a bare "(All)" button beside
each were all flowing in one wrapping flex row with no grouping,
making it hard to scan what was selected. Loaded the
`frontend-design` skill (standing project instruction) and
restructured `frontend/access-logs.js`:
- Date/time fields moved into their own `.filter-row-datetime` grid
  row (4 columns, collapsing to 2 on narrow screens).
- User/Group/Time Zone moved into a `.filter-row-lookup` grid row (3
  columns, collapsing to 1 on narrow screens), each wrapped in a
  `.filter-group` card with its own bordered header showing the
  filter's label, a **live "N selected" count badge** (new — the
  original had no way to tell what was selected without scrolling the
  listbox), and a "Clear" button that's disabled (greyed out) until
  something is actually selected, instead of an always-active bare
  "(All)" button.
- Updated the help text to explicitly say "Click an option to select
  it" (the original text jumped straight to the Ctrl-click detail
  without saying you can just click one).
`frontend/style.css` gained the corresponding `.filter-row`/
`.filter-group`/`.filter-group-header`/`.filter-count` rules
(grid-based, reusing existing color tokens — no new colors invented)
plus a responsive collapse in the existing `@media (max-width: 760px)`
block.
**Verification:** `node --check frontend/access-logs.js`; live check
via chrome-devtools-mcp at desktop and 400px-wide viewports.
**Pass:** Filter groups render as distinct, labeled cards with a
working live selection count and enable/disable Clear button;
existing List/filter/Export/pagination behavior unchanged; layout
stacks sensibly at mobile width with no horizontal overflow.
**Fail:** Any regression to filtering/List/Export behavior, or broken
layout at narrow widths.

**Status:** `[x]`
**Verification result:**
> 2026-09-14: `node --check frontend/access-logs.js` exit 0.
> Live-verified against the real device data (already logged in):
> selecting "Phuong Hoang" in the User card correctly showed "1
> selected" and enabled its Clear button; clicking List still
> correctly narrowed to 23 records (unchanged from before the
> redesign); clicking Clear correctly reset the selection, badge, and
> button state. Screenshot at 1280px and a full-page screenshot at
> 400px both confirm correct layout (3-column filter cards on desktop,
> stacking to 1 column with 2-column date fields on mobile, no
> horizontal overflow). Only console messages: the pre-existing
> unrelated "form field element should have an id or name" advisory
> and a `favicon.ico` 404 (both present before this change too, not
> introduced by it).
**Error (if [!]):**
> _Leave blank until task fails_

---

## Completion checklist

- [x] All Group 1-7 tasks marked `[x]`
- [x] Group 8.1 complete
- [x] No tasks marked `[!]`
- [x] `docs/backend-api.md` updated for `GET /groups`, `GET /timezones`, and the new
      `/access-logs` filter params
- [x] `sprint-summary.md` written

All groups complete. Task 8.1 ran live against `http://192.168.2.156`
after `APPROVE_LIVE_DEVICE_TEST:2026-09-14-access-global-report-full-parity-reports`
was supplied — see Task 8.1's own verification result for the full
detail (User/Group/Time Zone filters, combined filters, the
omitted-key "(All)" assumption, Export, and PRINT all confirmed).

---

## Rollback procedure

All files touched are modifications to existing, already-working
files, plus new test files — revert via `git diff`/`git checkout --`
against this plan's own changes if needed (check `git status` first
per standing safety practice; the working tree shares several other
uncommitted plans this session, so only revert files this plan
actually touched — see `plan.yaml`'s `write_scope`). The riskiest
single change is `src/ObjectQuery.cpp`'s `buildAccessLogsListBody`/
`CountBody` shape change (Task 2.1) — Task 7.1's byte-for-byte
unset-case regression test is the primary guard; if it fails, revert
just that function pair rather than patching forward.

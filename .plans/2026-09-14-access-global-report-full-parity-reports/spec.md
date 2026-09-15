# Spec — Access (Global) report: full visual/functional parity with the real device

---

## Goal

The user pointed out our "Access (Global)" page is "hoàn toàn custom,
không giống thiết bị thật" (completely custom, doesn't look like the
real device). Live comparison (screenshot + snapshot, this session)
confirms five concrete gaps, and the user explicitly chose the
**full-parity** scope (all five) over smaller cuts:

1. Sidebar: our "Access (Global)" is a flat top-level button; the
   real device nests it under a collapsible **"Reports"** group
   (siblings: Access by Group, Access by Time, Access by User, Alarms
   (Global), Users, Report designer — none of which this plan
   implements; only the grouping/pattern matters here).
2. No breadcrumb ("Reports › Access (Global)").
3. No "Filters" panel chrome (blue header bar) and no separate
   **List**/**Export** buttons — we have one plain "Filter" button.
4. Missing three filters entirely: **User**, **Group**, **Time Zone**
   (real device: multi-select "chosen" widgets, default "(All)").
5. Missing **Export** (downloads the filtered report as a text file)
   and **PRINT** buttons.

**Done looks like:** our "Access (Global)" page visually and
functionally matches the real device's own page for all five items
above — same sidebar grouping, breadcrumb, filter panel chrome
(including working User/Group/Time Zone filters), Export, and Print —
while keeping our own existing date/time filters and table columns
(already confirmed at 100% parity in the prior Access Logs plan)
unchanged.

**Supersedes an earlier deferral:** the prior
`2026-09-14-redesign-access-logs-frontend-and-backen` plan's own
visual-parity addendum explicitly deferred the User/Group/Time Zone
filters and Export, at the user's own direction at that time (recorded
in that plan's `DECISION_LOG.md`/`spec.md`). This plan implements
exactly those deferred items, per the user's fresh, explicit "làm hết
tất cả (1-5)" decision made this session (`AskUserQuestion` — see this
plan's own `DECISION_LOG.md`) — not an unexplained reversal.

**Explicitly out of scope:** the other Reports pages (Access by Group/
Time/User, Alarms (Global), Users report, Report designer) — this plan
only touches Access (Global) (report=1) and the sidebar grouping
pattern those other pages would eventually sit under.

---

## Background — live evidence (this session)

All of the following was captured live against `http://192.168.2.156`
this session (screenshot + accessibility snapshot + direct
`fetch()`/DOM introspection + one live-captured `load_objects.fcgi`
request), under `APPROVE_LIVE_DEVICE_TEST:2026-09-14-redesign-access-logs-frontend-and-backen`
(read-only; no device writes were made).

### Sidebar / breadcrumb structure

The real device's sidebar accessibility tree shows a **"Reports"**
group (same collapsible pattern as our own "Enroll" group, added
earlier this session) containing: Access (Global), Access by Group,
Access by Time, Access by User, Alarms (Global), Users, Report
designer. The page heading shows `Reports > Access (Global)` as a
breadcrumb (`#BREADCRUMB .breadcrumb`), built by
`en_US/js/pages/reportcustomview.js`'s `initReportAccessHistoryPage()`
(downloaded and read this session, saved to
`artifacts/live_capture/reportcustomview.js`):
```js
$('#BREADCRUMB .page-title').html($('#MasterPage_menu #rel #' + queryString.report + ' a').html());
$('#MasterPage_menu #rel #' + queryString.report).addClass('active');
$('#BREADCRUMB .breadcrumb').append('<li> <i class="icon-angle-right"></i></li><li>' + $('#BREADCRUMB .page-title').html() +'</li>');
```

### Filters panel chrome

Screenshot confirms a "Filters" panel with a blue header bar,
containing Start Date / End Date / Start Time / End Time (already
matched — same 4-field convention we built in the earlier Access Logs
plan) plus three more fields: User, Group, Time Zone. Below the panel:
two buttons, **"Export"** and **"List"** (not "Filter"). Below that,
in the table's own toolbar: a **"PRINT"** link/button and the existing
"per page" dropdown (already matched).

### User / Group / Time Zone filters — client-side "chosen" multi-selects

DOM introspection (`document.getElementById('filter_users_id')` etc.)
confirms these are NOT live-search/autocomplete widgets — they are
fully pre-populated at page load with every user/group/time-zone
already embedded as hidden `<li>` choices (all client-side):
```html
<div id="filter_users_id" class="... chzn-container-multi ...">
  <ul class="chzn-choices">
    <li class="all search-choice"><span><b>(All)</b></span></li>
    <li class="search-choice" id="51"><span>hinh sai</span>...</li>
    <li class="search-choice" id="50"><span>Man City</span>...</li>
    ... (one per real user)
  </ul>
</div>
```
Same structure for `filter_groups_id` (this device's real groups:
id=2 "Everywhere", id=1 "Standard") and `filter_time_zones_id` (id=1
"Always Allowed").

`reportcustomview.js`'s `addFilter(obj, field)` builds each of these
generically: for `obj` = `users`/`groups`/`time_zones` (a device
config-driven "Report" system — same *reports are data-driven, not
fixed* pattern already documented for `user_types`/`custom_tables` in
the Visitors plan), it does one `load_objects.fcgi` call
(`{"object": obj.object, "order": [...]}`, no `where`, i.e. "give me
every row") to populate the widget's full option list, once, at page
load — not per-keystroke.

**Filter query shape (LIVE-CAPTURED this session, reqid 1662, `POST
/load_objects.fcgi`, count query for the equivalent "Access by Time"
report with Group "Standard" (id 1) selected and User/Time Zone left
at "(All)"):**
```json
{"where":{"access_logs":{"time":{"<=":1789430399,">=":1786838400}},
          "users":{},"groups":{"id":[1]},"time_zones":{}},
 "order":["descending","time"],"object":"access_logs",
 "fields":["COUNT(*)"],"join":"LEFT"}
```
This confirms the *shape*: `where.where` is an **object keyed by
table name** (`access_logs`, `users`, `groups`, `time_zones`), each
holding its own field→value(s) map — a different convention from this
codebase's own existing flat `[{field,operator/value,...}]` array
style used everywhere else (`buildUsersListBody`, our own
`buildAccessLogsListBody`, etc.). Both conventions are evidently valid
device query-language dialects; this plan adopts the **nested-object**
shape specifically for the filtered `/access-logs` query (Task group
2), since that is the one directly, live-confirmed to work for this
exact multi-table join. Selecting a value populates
`<table>.id = [selected ids...]`; leaving "(All)" selected keeps that
table's entry present but empty (`{}`), which the device evidently
treats as "no constraint on this table" rather than an error.

**Not independently re-confirmed per-filter:** the capture above only
exercised the **Group** filter (the **User** and **Time Zone** fields
were left at "(All)" in that capture). The generic `addFilter()` code
path is identical for all three (same function, differing only in
`obj`/`field` strings — `filter_users_id`/`filter_groups_id`/
`filter_time_zones_id`, all with `field = "id"`), so the same
`<table>.id = [...]` shape is expected to apply uniformly. Task 8
(manual live verification) must independently confirm the **User**
and **Time Zone** filters specifically before this plan is considered
done — do not assume the extrapolation is correct without checking.

### Export — fully client-side, no new device/backend protocol needed

`reportcustomview.js`'s `$('#btExport').click(...)` handler (read in
full this session) does **not** call any special export endpoint. It:
1. Re-queries the **already-loaded** report data via the same
   `Report`/`makeWhere()` machinery as the on-screen table (respecting
   whatever filters are currently active) — `exportReport.getData(null, makeWhere(), true, true)`.
2. Formats it into a delimited text blob locally (semicolon-delimited,
   per `trimText`/`removeDuplicates` helpers — deduplicates by
   leading id column).
3. Triggers a client-side download via `Blob` + a synthetic
   `<a download>` click (`saveTextAsFile`) — no server round-trip
   beyond the same data the table already has.

**Implication:** our own Export can be implemented **entirely in
`frontend/access-logs.js`**, using the same rows our own
`/access-logs` endpoint already returns (respecting the current
filters) — no new backend/SDK endpoint required. (Design Decision 3.)

### PRINT

The link (`<a href="reportcustomview.html?report=1#">`) is a same-page
anchor — its click handler was not located in
`reportcustomview.js` (likely a shared `table.js`/`print.js` plugin
not yet downloaded). Given Export's confirmed client-side nature and
this being a simple, standard pattern, this plan implements PRINT as a
plain `window.print()` call gated behind a print stylesheet that hides
the sidebar/header/filters and shows only the table — a reasonable,
low-risk approximation rather than reverse-engineering the device's
exact plugin. (Design Decision 4.)

### What already matches (not touched by this plan)

Confirmed via screenshot comparison: date/time filter fields (4
separate Start/End Date/Time inputs), table column set + header label
suffixes (`(Access Logs)`/`(User)`/`(Portal)`/`(Time Zone)`), the
tri-state Authorization icon, and Previous/Next-style pagination
already match the real device exactly (all from the earlier Access
Logs plan's own visual-parity addendum). This plan does not re-touch
any of that.

---

## Design Decisions

### Decision 1 — Groups: new minimal read-only SDK/backend surface

No `GroupsApi` exists in this SDK today (only per-user
add-to-group/remove-from-group by numeric id, from the Users CRUD
work). The Group filter needs a `{id, name}` list to populate its
dropdown. Add:
- `include/amico/Types.hpp`: new `struct Group { int64_t id; std::string name; };`
  (name-only view, same minimal-surface precedent as `Portal`/`TimeZone`).
- `include/amico/Client.hpp` / `src/Client.cpp`: new `GroupsApi::list()`
  returning `std::vector<Group>`, querying the confirmed `groups`
  object (`fields: ["id","name"]`, no `where` — matches the device's
  own "(All)" full-list load).
- `backend/Routes.cpp`: new `GET /groups` route (list only — no
  create/update/remove; out of scope, nothing in this plan needs
  writing groups).
- `backend/JsonMapping.cpp`: `toJson(Group)`.

**Correction (found during Plan Review):** `TimeZonesApi::list()`
already exists at the SDK level (from the earlier Access Logs plan),
but no `GET /timezones` HTTP route exists yet -- verified directly
against `backend/Routes.cpp`; the only existing server-side use of
`TimeZonesApi` is the specialized `timeZoneNamesForAccessLogIds()`
per-access-log lookup, not a general list endpoint, and
`backend/JsonMapping.cpp` has no `toJson(amico::TimeZone)` either. This
plan therefore also adds `GET /timezones` (`{"timezones": [...]}`,
same read-only-list pattern as `GET /groups`) and
`toJson(const amico::TimeZone&)` -- no SDK-level change needed for
time zones, only the missing backend route + JSON mapping.

**Alternatives rejected:** Piggybacking Group names onto the existing
per-user `groupIds` mechanism — rejected, that's a different concern
(a user's own memberships) and doesn't give us the full groups list
needed for a filter dropdown.

### Decision 2 — `AccessLogQuery` gains multi-select filters; nested-object `where` shape for this one query only

`AccessLogQuery` (`include/amico/Types.hpp`) gains three new optional
fields:
```cpp
std::optional<std::vector<int64_t>> userIds;
std::optional<std::vector<int64_t>> groupIds;
std::optional<std::vector<int64_t>> timeZoneIds;
```
Unset (all three) = today's exact existing behavior, byte-for-byte
unchanged. `buildAccessLogsListBody`/`buildAccessLogsCountBody`
(`src/ObjectQuery.cpp`) change their `where` construction to the
**nested-object-keyed-by-table** shape confirmed live above:
```json
{"access_logs": {"time": {">=": ..., "<=": ...}},
 "users": {"id": [...]},        // only present/populated if userIds set
 "groups": {"id": [...]},       // only present/populated if groupIds set
 "time_zones": {"id": [...]}}   // only present/populated if timeZoneIds set
```
When a given filter is unset, this plan omits that table's key
entirely (simpler and equally valid per the capture, which showed an
*empty* `{}` for "(All)" — an omitted key should behave identically
for a `LEFT JOIN`-based query; Task 6 must verify this assumption
live, since the capture always included all three keys and we have no
direct evidence an *omitted* key differs from an *empty-object* key).
This is the **only** query builder in this codebase using this
nested-object `where` shape — every other builder keeps the existing
flat-array convention unchanged (no other builder is touched).

**Alternatives rejected:** Trying to force the new filters into the
existing flat-array `where` convention (e.g. `{"field":"id","object":"groups","value":[1,2]}`)
— rejected: unconfirmed whether the flat-array dialect even supports
array `value`s for an `IN`-style match (every existing flat-array use
in this codebase uses scalar values only), whereas the nested-object
shape is directly, live-confirmed correct for exactly this multi-table
filter combination.

### Decision 3 — Export: frontend-only, using already-loaded/filtered rows

No new backend/SDK work. `frontend/access-logs.js` gains an "Export"
button that takes the **currently loaded page's** `entries` (already
fetched via the existing `/access-logs` call, respecting whatever
filters are active) and constructs a CSV client-side (comma-delimited,
one row per entry, header row from the existing `columns` array's
labels), triggered via a `Blob` + synthetic `<a download>` click —
mirroring the real device's own client-side approach (Background,
above), simplified to CSV (a standard, broadly-openable format) rather
than exactly replicating the device's own semicolon-delimited/
dedup-by-id format, since nothing in this plan's scope requires
byte-identical export file contents — only the same user-facing
capability ("click Export, get a file of the current report").

**Scope boundary:** Export uses only the rows already on the current
page (matching what the user currently sees), not a re-fetch of
*every* filtered row across all pages — the device's own Export does
re-fetch everything matching the filter (with a "5000+ rows, are you
sure" confirmation for large exports). Exporting the *complete*
filtered set (not just the current page) is deferred — flag this
explicitly to the user as a known, smaller scope cut before Task 8's
sign-off, since it's a real behavioral difference worth a conscious
yes/no rather than a silent one.

### Decision 4 — PRINT: `window.print()` + print stylesheet

`frontend/access-logs.js` gains a "PRINT" button calling
`window.print()`. `frontend/style.css` gains an `@media print` block
hiding `.sidebar`, `.app-header`, `.actions`, `.filter-form`, and the
pagination controls, leaving only the report heading + table visible
when printed — a standard, low-risk pattern requiring no new backend
work (Background: the device's own PRINT handler wasn't located, but
this is a reasonable UX-equivalent, not a byte-exact replication).

### Decision 5 — Sidebar: "Reports" group wraps only "Access (Global)"

`frontend/index.html`'s sidebar gains a new collapsible `.nav-group`
(exact same markup/JS/CSS pattern as the existing "Enroll" group,
added earlier this session for Users/Visitors — reuse
`setNavGroupExpanded()`/`.nav-group-toggle`/`.nav-submenu` unchanged,
no new JS needed) titled **"Reports"**, containing only the existing
"Access (Global)" button (moved inside the new submenu, not
duplicated). "System Information" stays a flat top-level item (it
isn't part of the device's own Reports section either). No other
Reports-family pages (Access by Group/Time/User, Alarms (Global),
Users report, Report designer) are added — out of scope (Goal) — but
the grouping now gives them an obvious future home, same rationale as
the Enroll-group addendum.

### Decision 6 — Breadcrumb: static, not a generic multi-report system

`frontend/index.html`'s `#tab-access-logs` gains a simple static
breadcrumb `<p class="breadcrumb">Reports › Access (Global)</p>` above
the `<h2>`. Not building a generic multi-report breadcrumb system
(this project has exactly one report page) — matches this plan's own
stated scope boundary (Goal: only Access (Global), not a generic
Reports framework).

---

### Decision 7 — User/Group/Time Zone filter UI: native `<select multiple>`, not a cloned "chosen" widget

The real device uses a third-party "chosen"-style JS plugin
(pre-populated hidden `<li>` tag list, custom dropdown). This plan
uses a plain native HTML `<select multiple>` per filter instead —
same functional capability (pick zero-or-more specific rows, "(All)"
= nothing selected), populated the same way (one `GET /users` /
`GET /groups` / `GET /timezones`-equivalent call on tab activation),
consistent with this project's existing frontend style (no
third-party JS widget dependencies anywhere in `frontend/*.js` today).
Matches the Goal's "functionally matches" framing — not a demand to
vendor a chosen.js clone. `frontend-design` skill loaded before this
UI work, per standing project instruction.

**Alternatives rejected:** Building a custom tag/chip multi-select
widget to visually mirror the device's own chosen-style boxes —
rejected as unnecessary UI complexity for a project that otherwise
uses plain native form controls throughout; the native multi-select
achieves the same filtering capability with far less code.

---

## Risks

- **Group/Time Zone filter shape not independently re-confirmed** —
  only Group was live-captured; User and Time Zone are assumed
  identical by code-path symmetry. Must be verified live in Task 8,
  not assumed correct at sign-off.
- **Omitted-key vs. empty-object-key equivalence unconfirmed** — the
  live capture always sent all three table keys (some empty); this
  plan omits unset ones instead. Must be verified live (Task 6/8) that
  omitting a key behaves identically to sending it empty for this
  `LEFT JOIN`-based query — if it does not, fall back to always
  sending all three keys (empty `{}` for unset ones) to exactly match
  the confirmed-working shape.
- **Export scope cut** (current page only, not full filtered set) is
  a real, user-facing behavioral gap vs. the real device — flagged in
  Decision 3, must be explicitly surfaced to the user at sign-off, not
  silently shipped as if it were full parity.
- **New Groups list surface** (`GroupsApi::list()`, `GET /groups`) is
  read-only and additive — no risk to any existing functionality.

---

## Non-goals

- Access by Group / Access by Time / Access by User / Alarms (Global)
  / Users report / Report designer — not implemented.
- Group/User/Time Zone CRUD (create/edit/remove) — filters are
  read-only selectors against existing device data.
- Exporting more than the currently-loaded page's rows (Decision 3).
- Byte-exact replication of the device's own export file format
  (delimiter, dedup-by-id logic) — CSV of the current page is enough.

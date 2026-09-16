# Spec — Reports (browse definitions + generic CSV export)

---

## Goal

Add read + CSV export support for the device's 11 report definitions
(Access Global/by User/by Time/by Group, Users, Alarms (Global), Calls
(Global), Register Status Global/by User/by Time/by Group), closing
`docs/api-roadmap.md` section 7. Unlike every prior plan this session,
**this feature is read-only** — nothing here creates, updates, or
deletes any device row; `report_generate.fcgi` is a query/export
mechanism, not a mutation. There is no gated-write step in this plan's
own Group 8 as a result (see Scope).

**Done looks like:** A new "Reports" tab (under the existing Reports
sidebar group, alongside "Access (Global)") listing all 11 report
definitions; picking one shows its filter widgets (pre-filled with the
device's own defaults) and an Export button that downloads a CSV file
built from the live device data.

---

## Background — live evidence (2026-09-16)

`LIVE_CONFIRMED` via a gated read-only discovery pass
(`APPROVE_LIVE_DEVICE_TEST:2026-09-16-reports-discovery`, user-approved
verbatim), building on already-existing evidence from the Giai đoạn 1b
pass (2026-09-12, `docs/ui-action-protocol-map.md`). Full narrative
recorded in `docs/api-roadmap.md` section 7 — summarized here for the
implementation's own reference.

- **`object:"reports"`** (plain list, no `where` needed) — 11 rows,
  each `{id, name, file_name, object, header, delimiter, line_break}`.
  `object` is the report's backing table (`access_logs` for 8 of the
  11 reports, `users` for 1, `alarm_logs`/`call_logs` — two
  newly-discovered objects — for 1 each). `header` is a
  `delimiter`-joined string of display column labels (the CSV file's
  own header line); `delimiter` is `";"`; `line_break` is `"\r\n"` on
  this device.
- **`object:"report_filters"`** (nested-where shape,
  `{"report_filters":{"report_id":<id>}}`) — self-describing filter
  widgets: `{id, report_id, object, field, value, visible, editable}`.
  `value` is a plain string, empty by default for id-type filters
  (`users.id`, `portals.id`, `groups.id`, `time_zones.id`,
  `log_types.id`), or a JSON-encoded object string for the `time`
  filter (`"{\"type\":\"day\",\"interval\":29,\"finish\":0}"` —
  "last 29 days"). Confirmed structurally identical for reports 6
  (Alarms), 7 (Calls), and 8 (Register Status Global) — different
  `object` values referenced (`alarm_logs`/`call_logs`/`access_logs`+
  `log_types`), same row shape.
- **The export column mechanism is fully generic** (the key new
  finding this pass): `object:"report_columns"` (nested-where by
  `report_id`) lists each exported column in `sequence` order, each
  with a `type` (device-observed: **always `3`**, "object-field";
  the two other column-type tables the schema implies —
  `fixed_report_columns`, `counter_report_columns` — are both empty
  on this device, so those column kinds are **not evidenced** and out
  of scope). `object:"object_field_report_columns"` (plain list, no
  effective `where` filter confirmed to work by `report_column_id` —
  fetched in full, 88 rows total on this device, joined client-side by
  matching `report_column_id`) gives the actual `{object, field}` pair
  each column resolves to. Confirmed for report 1
  (`access_logs.time/event/identifier_id`,
  `users.id/name/registration`, `portals.name`, `time_zones.name` —
  matching the already-captured `report_generate.fcgi` request
  verbatim) and structurally spot-checked across all 88 rows spanning
  all 11 reports, including the new `alarm_logs`/`call_logs` objects.
- **`object:"report_column_formats"`** (plain list): CSV
  text-formatting hints per column (`adjustment`/`width`/`fill`/
  `format`, e.g. `"%d/%m/%Y %H:%M:%S"` for a date/time column) — used
  by the device's own native export to render byte-exact CSV text.
  **Not used by this plan** — this project's own established
  convention returns clean values (e.g. epoch seconds), not
  device-formatted display strings; the CSV's cell values are the raw
  field values, not this format-string's rendering.
- **`report_generate.fcgi` two-step export flow** (Giai đoạn 1b,
  2026-09-12): an id-only query (`columns:[{"field":"id","object":<report.object>,"type":"object_field"}]`)
  followed by a full-row query with the same `where`/`order` plus the
  full `columns` array (now known to be exactly what
  `object_field_report_columns` describes, in `report_columns.sequence`
  order) — returns `text/plain`, `delimiter`-separated,
  `line_break`-terminated rows. Captured example (single `time` filter
  active, Access Global):
  ```json
  {"offset":0,"limit":10,
   "where":{"access_logs":{"time":{"type":"day","interval":29,"finish":0}}},
   "order":["descending","time"],"object":"access_logs",
   "delimiter":";","line_break":"\r\n","header":"","file_name":"",
   "join":"LEFT",
   "columns":[{"field":"id","object":"access_logs","type":"object_field"}]}
  ```
  The second (full-row) call is the same shape with `where.access_logs.id`
  set to the matched id list and the full `columns` array (8 entries
  for report 1). Per `docs/security-sanitization-policy.md`, only
  request/response **shapes** are recorded in any tracked file — no
  real row data (user names, alarm causes, call metadata) has been or
  will be persisted.
- **`log_types`** — referenced by report 8's own filters
  (`object:"log_types", field:"id"`) but its own schema was not
  independently read this pass (out of scope; treated as an opaque
  id-filter target, same as `users`/`portals`/`groups`/`time_zones`).

**Not captured / not independently confirmed (flagged as Risks):**
- The **id-only query's own response shape** — never directly
  observed (the Giai đoạn 1b capture recorded the *request* shape for
  both steps but not response bodies). Inferred to also be `text/plain`
  (a single column of ids, `line_break`-separated), matching the
  full-row query's own confirmed response type. Confirmed/corrected
  during this plan's own Group 8.
- **How multiple simultaneous active filters combine in the `where`
  clause** — only ever captured with exactly one active filter
  (`time`). Whether two filters on *different* objects nest as two
  top-level keys (`{"access_logs":{...}, "users":{...}}`) or something
  else entirely is inferred, not captured. Confirmed/corrected during
  Group 8.
- The exact numeric/array shape expected for id-type filter values
  (a bare scalar id vs. an array of ids for multi-select) — not
  captured (only the empty-default case was observed for those
  filters). This plan's own implementation treats a filter override
  value as a JSON fragment (parsed if it parses, else a raw string),
  matching `report_filters.value`'s own convention exactly — a
  caller supplying `"5"` gets a bare number 5, `"[5,6]"` gets an array,
  a JSON object string gets an embedded object, anything else is
  passed through as a literal string. This needs no schema-specific
  knowledge and is confirmed/adjusted live if wrong.

---

## Design decisions

### Decision 1 — Read + export only; no gated-write step in Group 8
- **Chosen:** `ReportsApi` exposes only `list()`, `filters(reportId)`,
  and `exportCsv(reportId, filterOverrides)`. Nothing in this plan
  ever calls `create_objects.fcgi`/`modify_objects.fcgi`/
  `destroy_objects.fcgi`/any object-mutation endpoint. This plan's own
  Group 8 live verification therefore only ever needs
  `APPROVE_LIVE_DEVICE_TEST:2026-09-16-reports-read-export` (the read
  token) — there is no `APPROVE_LIVE_DEVICE_WRITE_TEST` step at all,
  unlike every prior write-side plan this session.
- **Why:** `report_generate.fcgi` is a query/export mechanism by its
  own design (matching its role as the CSV "Export" button's backing
  call) — it does not mutate device state. Requiring a write-approval
  token for a pure read/export operation would misapply this
  project's own risk-tiering discipline
  (`feedback_write_api_risk_tiers.md`), which exists specifically to
  gate operations that change device state.
- **Rejected alternatives:** Treating export as equivalent-risk to a
  write (requiring the write token anyway, "just in case") — rejected
  as inconsistent with the established tiering rationale; a read is a
  read regardless of how much data it returns.

### Decision 2 — Generic export via `report_columns`/`object_field_report_columns`, no per-report-type hardcoding
- **Chosen:** `exportCsv()` always resolves a report's export columns
  dynamically (`report_columns` ordered by `sequence`, joined to
  `object_field_report_columns`), rather than hardcoding a `columns`
  array per report type. This works uniformly for all 11 reports on
  this device, including the two newly-discovered `alarm_logs`/
  `call_logs` objects, without the SDK needing any report-type-
  specific knowledge at all.
- **Why:** This is what the live discovery pass actually found: every
  column on this device is `type:3` ("object-field"), fully described
  by server-side metadata. Hardcoding per-report-type column lists
  (as originally guessed in `docs/api-roadmap.md` section 7 before
  this pass) would have required 11 separate hardcoded lists and
  broken the moment the device's own report configuration changed;
  the generic approach costs nothing extra to implement and is
  strictly more correct.
- **Rejected alternatives:** Hardcoding Access Global's own
  already-fully-known 8-column list and treating the other 10 reports
  as future work — rejected once the generic mechanism was confirmed
  to exist; there is no reason to under-scope when the server already
  describes everything needed.
- **Accepted gap:** `fixed_report_columns`/`counter_report_columns`
  (the two other column "types" the schema implies) are not supported,
  since both are empty on this device and their shape is entirely
  unevidenced. If a report ever uses a non-`type:3` column,
  `exportCsv()` throws `UnsupportedOperationError` naming the
  unsupported column type — a safe, explicit failure rather than
  silently producing a wrong/incomplete CSV.

### Decision 3 — Filter overrides keyed by `report_filters.id`, not by `object.field`
- **Chosen:** `exportCsv(reportId, filterOverrides)` takes
  `std::map<int64_t, std::string>`, keyed by each filter's own `id`
  (as returned by `filters(reportId)`), not by a composite
  `"<object>.<field>"` string.
- **Why:** A report's filter list already has stable, unique `id`s;
  reusing them avoids any ambiguity if a report ever had two filters
  referencing the same `object`/`field` (not observed, but not
  precluded by the schema either), and lets the frontend build its
  filter form directly from the already-fetched `filters()` response
  without constructing its own composite keys.
- **Why the value stays a plain `std::string`, not `nlohmann::json`:**
  This project's established convention keeps `nlohmann::json`
  entirely out of the public SDK surface (`include/amico/*.hpp`) —
  every existing public type uses only plain C++ types. `exportCsv()`
  follows this by accepting each override as a string in the exact
  same convention `report_filters.value` itself already uses (a plain
  scalar string for simple filters, a JSON-object-shaped string for
  range filters like `time`); the SDK's own internal implementation
  attempts to JSON-parse each value (falling back to a literal string
  if parsing fails) before embedding it into the `where` clause,
  matching what the device itself expects (embedded/unwrapped JSON,
  not a double-encoded string).
- **Rejected alternatives:** Exposing `nlohmann::json` in the public
  `ReportsApi::exportCsv()` signature — rejected as breaking this
  project's own consistent internal/public boundary.

### Decision 4 — Backend returns raw CSV text, not JSON-wrapped rows
- **Chosen:** `POST /reports/:id/export` (a POST, not GET, since the
  filter-override map is a JSON body, not cleanly expressible as query
  parameters) returns `200` with `Content-Type: text/csv` and a
  `Content-Disposition: attachment; filename="<report name>.csv"`
  header — the raw CSV bytes (header line + device's own row data),
  ready for the frontend to trigger a direct file download.
- **Why:** This mirrors the feature's own real-world purpose (a
  downloadable CSV export, matching the device's own native "Export"
  button) rather than inventing a JSON row shape nothing else in this
  project needs. `GET /reports` and `GET /reports/:id/filters` remain
  ordinary JSON reads, matching every other list endpoint.
- **Rejected alternatives:** JSON-wrapped rows (`{"rows": [...]}`) —
  rejected as unnecessary translation work for a feature whose entire
  purpose is producing a file, not a paginated in-app table (the
  in-app tables for `access_logs`/`users`/etc. already exist as
  their own dedicated endpoints).

---

## Scope

### In scope
- SDK: `ReportDefinition`/`ReportFilter` types; `ReportsApi` with
  `list()`/`filters(reportId)`/`exportCsv(reportId, filterOverrides)`;
  new query builders for all 5 confirmed report-metadata objects
  (`reports`, `report_filters`, `report_columns`,
  `object_field_report_columns`) plus the two `report_generate.fcgi`
  step builders.
- Backend: `GET /reports`, `GET /reports/:id/filters`,
  `POST /reports/:id/export`.
- Frontend: new "Reports" tab (sidebar, under the existing Reports
  group) — list of 11 report definitions, a filter form built
  dynamically from `GET /reports/:id/filters`, and an Export button
  that downloads the resulting CSV via a `Blob`/temporary `<a>`
  element (the browser fetch API does not return response headers
  usable for a plain `<a href>` download of an authenticated
  same-origin POST, so a Blob-based download is required).
- Tests: query-builder tests (byte-for-byte against the live-captured
  payloads), `ReportsApi` behavior tests using synthetic
  (`ZZ_`-style, never real) fixture data, backend route tests.
- Docs: `docs/backend-api.md` new `/reports` section;
  `docs/api-roadmap.md` section 7 updated to reflect shipped status.
- Live verification (Group 8, read-only only — see Decision 1): export
  at least 2 different report types (Access Global with an active
  `time` filter override, and one report using a different backing
  `object`, e.g. Users) to confirm the id-query response shape and
  multi-object `where` combination (spec.md Risks) for real, fixing
  anything found wrong before closing.

### Out of scope
- **Report Designer** (`reportcustomconfig.html`) — a write-shaped
  report-authoring UI (would create new `reports`/`report_columns`/
  `report_filters` rows); genuinely out of scope, matching
  `docs/api-roadmap.md`'s own existing note.
- **`fixed_report_columns`/`counter_report_columns` column types** —
  unevidenced on this device (both empty); `exportCsv()` fails loudly
  rather than guessing if ever encountered (Decision 2).
- **`report_column_formats`-driven CSV formatting** (date format
  strings, column width/fill) — this project's own established
  "return clean values, not device-formatted display strings"
  convention applies here too (Decision 4's own background).
- **`log_types` object's own CRUD** — out of scope; treated as an
  opaque id-filter target only, same as every other id-type filter
  object this plan touches.

---

## Affected files

| File | Change type | Reason |
|------|-------------|--------|
| `include/amico/Types.hpp` | Modify | `ReportDefinition`/`ReportFilter` structs |
| `include/amico/Client.hpp` | Modify | New `ReportsApi` class |
| `src/ObjectQuery.hpp` / `.cpp` | Modify | New query builders for `reports`/`report_filters`/`report_columns`/`object_field_report_columns` + the two `report_generate.fcgi` step builders |
| `src/Client.cpp` | Modify | `ReportsApi` implementation: column/filter resolution, `where`-clause merging, CSV assembly |
| `backend/JsonMapping.cpp` | Modify | `toJson(ReportDefinition)`, `toJson(ReportFilter)` |
| `backend/Routes.cpp` | Modify | `GET /reports`, `GET /reports/:id/filters`, `POST /reports/:id/export` |
| `frontend/reports.js` | New | Report list + filter form + Export/download button |
| `frontend/index.html` | Modify | Sidebar entry, tab div, script tag |
| `test/test_reports.cpp` | New | Query builder + `ReportsApi` tests |
| `test/test_query_whitelist.cpp` | Modify | New builders' whitelist coverage |
| `test/backend/test_routes.cpp` | Modify | New route tests |
| `CMakeLists.txt` | Modify | Register `test/test_reports.cpp` |
| `docs/backend-api.md` | Modify | New `/reports` section |
| `docs/api-roadmap.md` | Modify | Section 7 updated to reflect shipped status |

---

## Risks and unknowns

- **The id-only query's response shape is inferred, not captured** —
  confirm/adjust during this plan's own Group 8 (spec.md Background).
- **Multi-filter `where` combination is inferred, not captured** —
  only a single active filter was ever directly observed; confirm
  during Group 8 using a report with 2+ simultaneously-active filter
  overrides.
- **`fixed_report_columns`/`counter_report_columns` are entirely
  unevidenced** — accepted gap (Decision 2), fails loudly rather than
  guessing if ever hit.
- **Larger surface than any prior plan this session** (11 report
  types, 4 distinct backing objects, one entirely generic resolution
  path) — mitigated by Decision 2's genuinely generic design (no
  per-report special-casing to get wrong) and by testing 2
  structurally different report types in Group 8, not just one.

---

## Self-evaluation (plan-quality.md rubric)

| Principle | Criterion | Score | Notes |
|-----------|-----------|-------|-------|
| **Think Before Planning** | spec.md first; every claim evidence-backed | 9/10 | The generic column-resolution mechanism is directly device-confirmed (not guessed); the id-query response shape and multi-filter `where` combination are clearly flagged as inferred, to be confirmed in Group 8 |
| **Simplicity First** | ≥ 3 out-of-scope items with reasoning | 9/10 | 4 items listed, each with a clear reason; explicitly rejects hardcoding 11 separate column lists in favor of the one generic mechanism the evidence actually supports |
| **Surgical Changes** | Every file listed with change type and exact reason | 9/10 | 14 files/changes, each tied to a decision |
| **Goal-Driven Execution** | Each scope item traces to an acceptance criterion | 8/10 | Two real risks (id-query response shape, multi-filter combination) deferred to Group 8 — larger than a typical single deferred risk, but proportionate to this plan's larger, more novel surface, and called out honestly |

**Total: 35/40 → 8.75/10** (threshold: 7/10)

---

**User confirmation received:** [x] Yes — user explicitly asked
("Commit finding, rồi viết plan Reports đầy đủ") to write this plan
immediately after the discovery findings were committed.
**Confirmed on:** 2026-09-16

# Sprint Summary — Reports (browse definitions + generic CSV export)

**Plan:** `2026-09-16-reports-read-export`
**Status:** Complete — all 8 groups done, all tasks `[x]`, no `[!]`.

## What shipped

- **SDK** (`include/amico/Types.hpp`, `include/amico/Client.hpp`,
  `src/ObjectQuery.hpp/.cpp`, `src/Client.cpp`): new
  `ReportDefinition`/`ReportFilter` types; `ReportsApi` with
  `list()`/`filters(reportId)`/`exportCsv(reportId, filterOverrides)`.
  Entirely read-only — no create/update/delete anywhere in this plan
  (`report_generate.fcgi` is a query/export mechanism, never a
  mutation). Export columns are resolved **fully generically** via
  `report_columns`/`object_field_report_columns` — no per-report-type
  hardcoding, working identically for all 11 report types on this
  device (8 backed by `access_logs`, 1 by `users`, and the two
  newly-discovered `alarm_logs`/`call_logs` objects). New
  `postAuthenticatedText()` helper added alongside the existing
  `postAuthenticatedJson()`, since `report_generate.fcgi` returns
  `text/plain`, not JSON.
- **Backend** (`backend/JsonMapping.cpp`, `backend/Routes.cpp`):
  `toJson(ReportDefinition)`/`toJson(ReportFilter)`; new `GET /reports`,
  `GET /reports/:id/filters`, `POST /reports/:id/export` (POST, not
  GET, since filter overrides are a JSON body) — the export route
  returns raw `text/csv` with a `Content-Disposition: attachment`
  header for direct browser download.
- **Frontend**: new `frontend/reports.js` — a list of all 11 report
  definitions with an Export action per row; clicking Export opens a
  filter form built dynamically from `GET /reports/:id/filters` (a
  "last N days" number input for the `time` filter, plain text inputs
  for every other filter), downloading the resulting CSV via a
  `Blob`/temporary `<a>` element on submit. New sidebar entry under
  the existing Reports group, alongside "Access (Global)".
- **Tests**: new `test/test_reports.cpp` (RP-1..RP-11 plus RP-8b/RP-10b
  added during Group 8 to lock in two of the live-found bugs): all 6
  new query builders byte-for-byte matched against live-captured
  payloads; `ReportsApi::list/filters/exportCsv` full behavior
  including the generic column-resolution/where-merging orchestration,
  the non-`type:3`-column failure path, both order branches, the
  time-descriptor-to-epoch-range conversion, and the duplicate-id-
  column fix — all using synthetic (`ZZ_`-style) fixture data, never
  real device row data. 2 new `test_query_whitelist.cpp` cases
  (Q-24/Q-25); 3 new `test/backend/test_routes.cpp` route cases
  (Z-1..Z-3, including the CSV `Content-Type`/`Content-Disposition`
  headers). Final counts: SDK 252/252 (up from 237), backend 90/90
  (up from 87) — both clean, zero regressions.
- **Docs**: `docs/backend-api.md` gained a new `/reports` section;
  `docs/api-roadmap.md` section 7 updated from "discovery complete,
  ready to plan" to "✅ implemented", with the full corrected
  `where`/`order`/descriptor-unescaping mechanics and the Group 8
  bug-fix narrative recorded.

## Live verification (Group 8) — 5 real bugs found and fixed, then zero bugs on re-run

This was the most bug-dense live verification pass this session, since
two of spec.md's own flagged Risks (the id-only query's response
shape, and the multi-filter `where` combination) were genuinely
unconfirmed going in, and the export path is the largest, most novel
piece of orchestration logic implemented so far.

- **8.1 (read-only):** Reports tab correctly lists all 11 report
  definitions; other tabs unaffected.
- **8.2 (the 3-scenario export test, still entirely read-only — no
  write-approval token exists in this plan, per Decision 1)**:
  1. **Bug 1 (frontend)**: optional id-type filter inputs were
     incorrectly marked `required`, blocking submission when correctly
     left empty. Fixed in `frontend/reports.js`.
  2. **Bug 2 (`where` shape)**: the `time` filter's JSON descriptor
     can't be embedded raw (`400 "Invalid operator: type"`). Root-
     caused by direct device probing and cross-referencing this
     project's own already-shipped `buildAccessLogsListBody()`. Fixed
     by converting to a `>=`/`<=` operator-object.
  3. **Bug 3 (`order` shape)**: `[field, direction]`, not
     `[direction, field]` as originally transcribed from the
     discovery capture. Fixed in both order branches.
  4. **Bug 4 (`line_break`/`delimiter` unescaping)**: the device's own
     `line_break` value is a literal 4-character descriptor string,
     not real CR/LF bytes — confirmed via `charCodeAt()`. Fixed with a
     new `unescapeCStyle()` helper.
  5. **Bug 5 (duplicate id column)**: some reports (e.g. "Users")
     already include their own `id` field among their resolved
     columns; unconditionally prepending one produced a duplicate.
     Fixed by only prepending when not already present.

  After all 5 fixes (each re-verified against the full test suite
  before returning to live testing), all 3 planned export scenarios
  succeeded with correctly-shaped CSV: Access (Global) with its
  default filter, Access (Global) with 2 simultaneous filter
  overrides, and the Users report (a non-`access_logs`-backed report)
  with no overrides — independently confirming both of spec.md's own
  flagged Risks were correct as originally inferred (the id-query
  response shape, and the multi-filter `where` combination), once the
  5 unrelated bugs above were fixed.

Per `docs/security-sanitization-policy.md`, only row/column counts and
structural CSV shape were inspected during verification — no real row
content (user names, timestamps, alarm/call data) was pasted into any
tracked file.

## Design question resolved

The design question raised in `docs/api-roadmap.md` section 7 (whether
export support could realistically cover all 11 report types
generically, or would need per-type work) is resolved: the generic
`report_columns`/`object_field_report_columns` mechanism, once its
several real bugs were found and fixed, works identically for every
report type on this device with zero per-type special-casing.

## Not committed

Per this project's established "để commit sau" (commit later)
convention, this plan's changes have not yet been committed.

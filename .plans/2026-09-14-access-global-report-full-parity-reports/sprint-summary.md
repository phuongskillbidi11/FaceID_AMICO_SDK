# Access (Global) report — full parity, complete

Completed 2026-09-14. All tasks (1.1–8.1) are `[x]`, no `[!]`.
`spec.md` and `review.md` were not edited during execution.

## Delivered

- Read-only SDK Groups list and backend `GET /groups` / `GET /timezones`.
- Access-log User/Group/Time Zone ID filters, shared by list and count;
  unchanged serialized requests when all new filters are empty or unset.
- Reports navigation, breadcrumb, blue Filters panel and List action.
- Native multiple-select controls populated once from `/users`, `/groups`,
  and `/timezones`. Empty selection means (All); each selector has a clear
  button. Failed lookup loading can be retried on tab activation.
- Export of the current page as CSV using the table's value formatting,
  quoted fields, escaped quotes, and CRLF records, with no extra request.
- PRINT via `window.print()` and print CSS retaining the heading and table.
- Extended SDK and backend tests and updated `docs/backend-api.md`.

## Verification

- `node --check frontend/access-logs.js`: exit 0.
- `cmake --build build --target amico_tests`: exit 0.
- `build/amico_tests.exe`: 121 cases, 1,093 assertions passed; zero failures.
- `cmake --build build --target amico_backend_tests`: exit 0.
- `build/amico_backend_tests.exe`: 51 cases, 717 assertions passed; zero failures.
- SDK tests cover the exact Groups request, literal pre-change full
  list/count bodies, empty vectors, and 32 ID-filter/date-bound combinations.
- Route tests cover populated/empty groups and time zones, session gating,
  repeated/comma-separated/combined/empty filters, the int64 boundary,
  invalid/overflowing IDs, and legacy list/count `where` regression.
- Offline Chrome fixture checks cover 16 selector/date combinations,
  once-only lookup loading, multiple selections, and clearing to (All).
- CSV Blob and filename captured in Chrome; contents compared exactly to
  table headers and displayed values for 10-row, 4-row, 7-row filtered, and
  empty pages. Quote escaping and absence of export requests verified.
  The native download anchor was intercepted for this content check.
- Chrome print-media emulation verified hidden chrome and visible report;
  a PDF and screenshot were generated. PRINT's call to `window.print()`
  was verified separately; the native print dialog was not exercised.
- `git diff --check`: exit 0. No backend executable lock encountered in
  these builds, so no existing backend process needed to be killed.

Evidence and reusable offline checks are in `artifacts/access-global-offline/`:
`task-5-3.png`, `task-6-2.png`, `task-6-2.pdf`, `filters-check.js`,
`export-check.js`, and `print-check.cjs`. The static-server checks reported
the existing favicon 404 and unnamed-field advisory; no application JS
exceptions occurred. An initial SDK test raw-string delimiter compile
error and a browser harness import-path error were corrected before the
successful checks above.

## Task 8 — live verification (complete)

Ran live against `http://192.168.2.156` via our own frontend, after
`APPROVE_LIVE_DEVICE_TEST:2026-09-14-access-global-report-full-parity-reports`.
Full detail in `tasks.md`'s Task 8.1; summary:

- Visual match confirmed: Reports sidebar group, breadcrumb, blue
  Filters panel, populated User/Group/Time Zone selects, List/Export/
  PRINT buttons.
- Baseline (all filters "(All)"): 225 records.
- User alone (id 36): 23 records, all confirmed `userId: 36` in the
  raw JSON.
- Time Zone alone (the device's only value): also 23 records —
  confirmed via a fresh snapshot this was a genuine data coincidence
  (User selection was actually empty), not a stuck filter.
- Group alone ("Standard", id 1): 96 records — a distinctly different
  count, positively confirming the Group join filters independently.
- Combined date + Group: 28 records — correctly tighter than either
  filter alone.
- Omitted-key "(All)" assumption (spec.md Decision 2/Risks):
  **confirmed correct** — clearing all three selects reproduced the
  exact 225-record baseline; the documented fallback was not needed.
- Export: intercepted the actual Blob content — correct CSV, exact
  headers, exact 10 current-page rows; also confirmed the real file
  landed in the user's Downloads folder (full mechanism, not just
  construction).
- PRINT: not re-triggered live (risk of a blocking native OS dialog in
  a real browser); relying on Task 6.2's own offline print-media
  verification, since Print is pure CSS and not device-dependent.
- Console: only pre-existing/benign messages; no JS exceptions.

**Bonus fix found during pre-live-check review (not by Codex):** the
User filter's option list was silently capped at 50 rows
(`AmicoConfig::defaultPageSize`) because `/users` was fetched with no
`limit`. Fixed to `/users?limit=100000`; confirmed live via the
network log showing the corrected request.

Export intentionally includes only the current page, not all matching
records across pages; this remains a documented difference from the
device (spec.md Decision 3).

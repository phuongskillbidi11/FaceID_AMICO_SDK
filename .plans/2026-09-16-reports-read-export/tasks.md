# Tasks — Reports (browse definitions + generic CSV export)

> **Executor instructions:** Complete groups in order. After each task,
> run the verification command. Mark status before moving on.
>
> **Status markers:** `[ ]` not started · `[~]` in progress · `[x]` complete
> (verification passed) · `[!]` failed (stop, report to Planner).
>
> **Group gating:**
> - **Groups 1-7** require no device contact — all offline.
> - **Group 8** (manual live verification) is **entirely read-only**
>   (spec.md Decision 1 — this feature never mutates device state),
>   requiring a fresh
>   `APPROVE_LIVE_DEVICE_TEST:2026-09-16-reports-read-export` approval.
>   **There is no write-approval step in this plan at all.**

---

## Group 1 — SDK types (`include/amico/Types.hpp`)

### Task 1.1 — Add `ReportDefinition`/`ReportFilter`
**Action:**
```cpp
/// Public view of the `reports` object (Reports read+export plan,
/// 2026-09-16). `object` is the report's backing table
/// (access_logs/users/alarm_logs/call_logs on this device). `header`
/// is a `delimiter`-joined string of display column labels -- the
/// CSV file's own header line.
struct ReportDefinition {
    int64_t id = 0;
    std::string name;
    std::string object;
    std::string header;
    std::string delimiter;
    std::string lineBreak;
};

/// Public view of the `report_filters` object -- a self-describing
/// filter widget. `value` is the device's own default (empty for
/// id-type filters, a JSON-encoded object string for range filters
/// like "time"). See ReportsApi::exportCsv() for how overrides work.
struct ReportFilter {
    int64_t id = 0;
    int64_t reportId = 0;
    std::string object;
    std::string field;
    std::string value;
    bool visible = true;
    bool editable = true;
};
```
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> `cmake --build build --target amico_sdk` — exit 0, clean build.

---

## Group 2 — SDK query builders (`src/ObjectQuery.hpp` / `.cpp`)

### Task 2.1 — Field constants + read builders
**Action:** Add:
```cpp
const std::vector<std::string> kReportFields = {"id", "name", "file_name", "object", "header", "delimiter", "line_break"};
const std::vector<std::string> kReportFilterFields = {"id", "report_id", "object", "field", "value", "visible", "editable"};
const std::vector<std::string> kReportColumnFields = {"id", "report_id", "type", "sequence"};
const std::vector<std::string> kObjectFieldReportColumnFields = {"id", "report_column_id", "object", "field"};

/// Lists all 11 report definitions. LIVE_CONFIRMED plain-list shape
/// (no `where` needed to list all -- spec.md Background).
nlohmann::json buildReportsListBody();

/// Lists a report's filter widgets. LIVE_CONFIRMED nested-where shape
/// (same convention as `reports` itself, NOT the array-of-clauses
/// shape used by every other object in this codebase).
nlohmann::json buildReportFiltersListBody(int64_t reportId);

/// Lists a report's export columns in `sequence` order. LIVE_CONFIRMED
/// nested-where shape, same convention as buildReportFiltersListBody.
nlohmann::json buildReportColumnsListBody(int64_t reportId);

/// Lists every object-field column resolution on the device (no
/// working per-report_id filter confirmed for this object -- fetched
/// in full, joined client-side by `report_column_id`, spec.md
/// Background).
nlohmann::json buildObjectFieldReportColumnsListBody();
```
Implementations:
```cpp
nlohmann::json buildReportsListBody() {
    nlohmann::json body;
    body["object"] = "reports";
    body["fields"] = kReportFields;
    return body;
}

nlohmann::json buildReportFiltersListBody(int64_t reportId) {
    nlohmann::json body;
    body["object"] = "report_filters";
    body["fields"] = kReportFilterFields;
    body["where"] = {{"report_filters", {{"report_id", reportId}}}};
    return body;
}

nlohmann::json buildReportColumnsListBody(int64_t reportId) {
    nlohmann::json body;
    body["object"] = "report_columns";
    body["fields"] = kReportColumnFields;
    body["where"] = {{"report_columns", {{"report_id", reportId}}}};
    return body;
}

nlohmann::json buildObjectFieldReportColumnsListBody() {
    nlohmann::json body;
    body["object"] = "object_field_report_columns";
    body["fields"] = kObjectFieldReportColumnFields;
    return body;
}
```
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> `cmake --build build --target amico_sdk` — exit 0, clean build.

---

### Task 2.2 — `report_generate.fcgi` body builder
**Action:** Add:
```cpp
/// Builds one report_generate.fcgi request (used for both the
/// id-only step and the full-row step -- same envelope shape,
/// differing only in `where`/`columns`). LIVE_CONFIRMED verbatim
/// envelope shape (spec.md Background); `whereClause`/`order`/
/// `columns` are caller-supplied per call site.
nlohmann::json buildReportGenerateBody(const std::string& reportObject,
                                        const nlohmann::json& whereClause,
                                        const nlohmann::json& order,
                                        const std::string& delimiter,
                                        const std::string& lineBreak,
                                        const nlohmann::json& columns);
```
Implementation:
```cpp
nlohmann::json buildReportGenerateBody(const std::string& reportObject,
                                        const nlohmann::json& whereClause,
                                        const nlohmann::json& order,
                                        const std::string& delimiter,
                                        const std::string& lineBreak,
                                        const nlohmann::json& columns) {
    nlohmann::json body;
    body["offset"] = 0;
    // LIVE_CONFIRMED example used limit:10 (a UI preview-page size);
    // this SDK exports the full matched set, so a generous cap is
    // used instead. Exact device-side maximum not confirmed --
    // spec.md Risks.
    body["limit"] = 100000;
    body["where"] = whereClause;
    body["order"] = order;
    body["object"] = reportObject;
    body["delimiter"] = delimiter;
    body["line_break"] = lineBreak;
    body["header"] = "";
    body["file_name"] = "";
    body["join"] = "LEFT";
    body["columns"] = columns;
    return body;
}
```
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> `cmake --build build --target amico_sdk` — exit 0, clean build.

---

## Group 3 — SDK implementation (`include/amico/Client.hpp`, `src/Client.cpp`)

### Task 3.1 — `ReportsApi` class
**Action:** In `include/amico/Client.hpp`, add (alongside the existing
`CustomFieldsApi`):
```cpp
/// Typed read/export wrapper for the device's report definitions
/// (Reports read+export plan, 2026-09-16). Entirely read-only --
/// exportCsv() never mutates device state (spec.md Decision 1).
class ReportsApi {
public:
    std::vector<ReportDefinition> list();
    std::vector<ReportFilter> filters(int64_t reportId);

    /// Exports a report's matching rows as CSV text (header line +
    /// device rows, `report.delimiter`/`report.lineBreak` convention).
    /// `filterOverrides` is keyed by ReportFilter::id; a missing key
    /// uses that filter's own device-default `value`. Each override
    /// value is parsed as JSON if it parses (matching how
    /// ReportFilter::value itself is sometimes a JSON-object string),
    /// else embedded as a literal string (spec.md Decision 3). Throws
    /// UnsupportedOperationError if any resolved export column is not
    /// a `type:3` ("object-field") column (spec.md Decision 2).
    std::string exportCsv(int64_t reportId, const std::map<int64_t, std::string>& filterOverrides);

private:
    friend class AmicoClient;
    explicit ReportsApi(AmicoClient* owner) : owner_(owner) {}
    AmicoClient* owner_;
};
```
Add the `ReportsApi& reports()` accessor, `friend class ReportsApi;`,
and `ReportsApi reportsApi_{this};` member, matching the existing
`CustomFieldsApi` wiring exactly.
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> `cmake --build build --target amico_sdk` — exit 0, clean build.

---

### Task 3.2 — Implement in `src/Client.cpp`
**Action:**
1. Add a new private helper alongside `postAuthenticatedJson`:
   ```cpp
   /// Sends an authenticated JSON POST but returns the RAW response
   /// body as text, not JSON-parsed -- report_generate.fcgi returns
   /// text/plain, not JSON (spec.md Background). Mirrors
   /// postAuthenticatedJson's session/retry/status handling exactly,
   /// only differing in the final return statement.
   std::string postAuthenticatedText(const std::string& path, const nlohmann::json& body, bool isRetry = false);
   ```
   (Same body as `postAuthenticatedJson` up through the status-code
   check, `return res.body;` instead of `parseJsonOrThrow(...)`.)
2. `std::vector<ReportDefinition> AmicoClient::listReportsImpl()`:
   one read (`buildReportsListBody`), map every field 1:1.
3. `std::vector<ReportFilter> AmicoClient::listReportFiltersImpl(int64_t reportId)`:
   one read (`buildReportFiltersListBody`), map every field 1:1
   (`visible`/`editable` via `requireBoolLikeField`, matching the
   0/1-or-boolean convention already established for `hol1`/etc.).
4. `std::string AmicoClient::exportReportCsvImpl(int64_t reportId, const std::map<int64_t, std::string>& filterOverrides)`:
   - Fetch `listReportsImpl()`, find the row matching `reportId`
     (throw `ProtocolError` if not found -- no single-report GET shape
     was ever captured, only the full list).
   - Fetch `listReportFiltersImpl(reportId)`. For each filter, resolve
     its effective value (override if given, else `filter.value`);
     skip filters whose effective value is empty (no active filter).
     Attempt `nlohmann::json::parse()` on the effective value; on
     success embed the parsed value, on failure embed the literal
     string, under `whereClause[filter.object][filter.field]`
     (spec.md Decision 3).
   - Fetch `report_columns` (`buildReportColumnsListBody`, sorted by
     `sequence`) and `object_field_report_columns` (`buildObjectFieldReportColumnsListBody`,
     the full list, joined client-side by `report_column_id`). For
     each `report_column` in sequence order: if its `type` is not `3`,
     throw `UnsupportedOperationError` naming the unsupported column
     type (spec.md Decision 2); otherwise resolve its `{object,
     field}` pair and append `{"field":field,"object":object,"type":"object_field"}`
     to the `columns` array, prefixed by the always-first
     `{"field":"id","object":report.object,"type":"object_field"}`
     entry.
   - Determine `order`: `["descending","time"]` if the report's own
     `object` has a `time` field (all of `access_logs`/`alarm_logs`/
     `call_logs` do); otherwise `["ascending","id"]` (the `users`
     report has no `time` field) -- inferred, spec.md Risks, confirm
     during this plan's own Group 8.
   - **Id-only query**: `postAuthenticatedText("/report_generate.fcgi",
     buildReportGenerateBody(report.object, whereClause, order,
     report.delimiter, report.lineBreak, <id-only columns array>))`.
     Parse the returned text by splitting on `report.lineBreak`,
     trimming empty lines, parsing each remaining line as `int64_t`
     (inferred response shape, spec.md Risks -- if this turns out to
     be JSON instead, fix during Group 8).
   - **Full-row query**: build `fullWhere[report.object]["id"] = <the
     id list>` (replacing, not merging with, the original
     `whereClause` -- the ids already reflect the filter's effect);
     `postAuthenticatedText("/report_generate.fcgi",
     buildReportGenerateBody(report.object, fullWhere, order,
     report.delimiter, report.lineBreak, <full columns array>))`.
   - Return `report.header + report.lineBreak + <full-row response text>`.
5. Wire `ReportsApi::list/filters/exportCsv` forwarders, matching the
   existing `CustomFieldsApi` forwarder pattern exactly.
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> `cmake --build build --target amico_sdk` — exit 0, clean build.

---

## Group 4 — Backend (`backend/JsonMapping.cpp`, `backend/Routes.cpp`)

### Task 4.1 — `JsonMapping` additions
**Action:** In `backend/JsonMapping.cpp`:
- `toJson(const amico::ReportDefinition&)` -> `{"id", "name", "object", "header", "delimiter", "lineBreak"}`.
- `toJson(const amico::ReportFilter&)` -> `{"id", "reportId", "object", "field", "value", "visible", "editable"}`.
(No `fromJson*` needed -- this plan has no create/update body to parse,
only a raw `filters` override map handled directly in Routes.cpp.)
**Verification:** `cmake --build build --target amico_backend`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> `cmake --build build --target amico_backend` — exit 0, clean build.

---

### Task 4.2 — `/reports` routes
**Action:** In `backend/Routes.cpp`, add:
- `GET /reports` -> `200 {"reports": [ReportDefinition...]}`.
- `GET /reports/:id/filters` -> `200 {"filters": [ReportFilter...]}`.
- `POST /reports/:id/export` -> body `{"filters": {"<filterId>": "<value>", ...}}`
  (string-keyed JSON object; parse keys as `int64_t` filter ids). On
  success: `200`, `Content-Type: text/csv`, `Content-Disposition:
  attachment; filename="<report name>.csv"`, body = the CSV text from
  `ReportsApi::exportCsv()`. Errors map through the existing
  `respondError`/`mapException` path as usual.
**Verification:** `cmake --build build --target amico_backend`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> `cmake --build build --target amico_backend` — exit 0, clean build
> (required stopping/restarting the `amico_backend`/`nginx` services
> via the standing UAC-elevation procedure). Health check
> `curl http://127.0.0.1:8080/session` returned 200.

---

## Group 5 — Frontend

### Task 5.1 — New `frontend/reports.js` + `frontend/index.html` wiring
**Action:** Load the `frontend-design` skill first (standing project
instruction). Create `frontend/reports.js`: a list of the 11 report
definitions (Name + an Export action per row); clicking Export opens a
small modal built dynamically from `GET /reports/:id/filters` (one
input per filter -- a date-range-shaped control for `field:"time"`
filters showing/editing the `{"type":"day","interval":N,"finish":M}`
JSON directly as a simple "last N days" number input, a plain text
input for every other filter type, pre-filled with the filter's own
`value`), with an "Export" submit button. On submit, `fetch()`
`POST /reports/:id/export`, read the response as a `Blob`, and trigger
a download via a temporary `<a>` element (`URL.createObjectURL` +
`.click()` + revoke) -- `apiFetch`'s own JSON-only helper cannot be
reused here since the response is `text/csv`, not JSON. In
`frontend/index.html`, add the sidebar entry under the existing
Reports group (alongside "Access (Global)"), a `#tab-reports` div, and
the new script tag.
**Verification:** `node --check frontend/reports.js`.
**Pass:** Exit 0.
**Fail:** Syntax error.

**Status:** `[x]`
**Verification result:**
> `node --check frontend/reports.js` — exit 0.

---

## Group 6 — Tests

### Task 6.1 — `test/test_reports.cpp` (new)
**Action:** Register in `CMakeLists.txt` alongside the existing
`test/test_custom_fields.cpp` entry. Cover:
- All 5 new query builders, byte-for-byte matched against the
  live-captured payloads in spec.md Background (including
  `buildReportGenerateBody`'s full envelope shape).
- `ReportsApi::list()`/`filters()` — straightforward read-mapping
  tests using synthetic fixture data (`ZZ_`-style report/filter names,
  never real device row data, per `docs/security-sanitization-policy.md`).
- `ReportsApi::exportCsv()` — the full column-resolution +
  where-merging + two-step `report_generate.fcgi` orchestration,
  using a fake transport responding with synthetic `text/plain`
  bodies; cover: a filter override present vs. using the device
  default; a non-`type:3` report_column throwing
  `UnsupportedOperationError`; the `users`-report `order` branch
  (`["ascending","id"]`) vs. the `access_logs`-style branch
  (`["descending","time"]`).
**Verification:** `cmake --build build --target amico_tests &&
./build/amico_tests.exe`.
**Pass:** Exit 0; all new tests pass; no regressions.
**Fail:** Any compile error or test failure.

**Status:** `[x]`
**Verification result:**
> SDK suite: 248/248 passed (up from 237), 1616 assertions, 0 failed.
> 11 new RP-1..RP-11 cases. One self-caught test bug (RP-9's own fake
> responder didn't handle `object_field_report_columns`, which
> `exportCsv()` always queries before checking column types) fixed
> before the suite passed clean.

---

### Task 6.2 — `test/test_query_whitelist.cpp`, `test/backend/test_routes.cpp`
**Action:**
- `test_query_whitelist.cpp`: confirm the new builders never accept a
  caller-supplied object/field/connector string beyond the
  already-validated report/filter/column values.
- `test/backend/test_routes.cpp`: route cases for `GET /reports`,
  `GET /reports/:id/filters`, `POST /reports/:id/export` (including
  the `Content-Type`/`Content-Disposition` headers on a successful
  export).
**Verification:** `cmake --build build --target amico_backend_tests &&
./build/amico_backend_tests.exe`.
**Pass:** Exit 0; all new tests pass.
**Fail:** Any compile error or test failure.

**Status:** `[x]`
**Verification result:**
> SDK suite: 250/250 passed (up from 248, Q-24/Q-25 added). Backend
> suite: 90/90 passed (up from 87), 871 assertions, 0 failed. Added
> Z-1..Z-3 routes (including the CSV Content-Type/Content-Disposition
> headers) and `/reports` to the session-required-for-all-GET-routes
> test.

---

## Group 7 — Docs

### Task 7.1 — `docs/backend-api.md`, `docs/api-roadmap.md`
**Action:** Add a new `/reports` section to `docs/backend-api.md`
(the 3 routes, request/response shapes, the CSV content-type/
disposition convention). Update `docs/api-roadmap.md` section 7's
header from "ready to plan" to reflect this plan shipping, and
correct/confirm the "Not yet independently confirmed" callouts
(id-query response shape, multi-filter `where` combination) based on
this plan's own Group 8 findings.
**Verification:** Manual review (docs-only change, no build step).
**Pass:** Both files updated consistently with the shipped behavior.
**Fail:** N/A.

**Status:** `[x]`
**Verification result:**
> `docs/backend-api.md`: new `/reports` section added after
> `/custom-fields`. `docs/api-roadmap.md` section 7: header updated to
> "✅ implemented (2026-09-16)", route table statuses updated to ✅,
> Group 8's outcome left explicitly marked "pending" until this plan's
> own Group 8 runs.

---

## Group 8 — Manual live verification (read-only only)

### Task 8.1 — Read-only: Reports tab loads, other tabs unaffected
**Action:** **Before running:** obtain
`APPROVE_LIVE_DEVICE_TEST:2026-09-16-reports-read-export` (no write
token needed anywhere in this plan -- spec.md Decision 1). Log into
the real device via our own frontend. Confirm the Reports tab lists
all 11 report definitions correctly. Confirm other tabs unaffected.
**Verification:** Manual, via chrome-devtools-mcp.
**Pass:** List loads correctly with all 11 reports; no regressions
elsewhere.
**Fail:** Any regression, wrong data, or console error.

**Status:** `[x]`
**Verification result:**
> Logged into own frontend (http://127.0.0.1:8080, device
> http://192.168.2.156). Reports tab shows all 11 report definitions
> correctly (Access Global/by User/by Time/by Group, Users, Alarms
> (Global), Calls (Global), Register Status Global/by User/by Time/by
> Group). Console showed only the pre-existing, unrelated
> `/users/:id/image` 400s — no regression.

---

### Task 8.2 — Export at least 2 structurally different report types
**Action:** Using the same read-only approval as Task 8.1 (this step
never mutates device state):
1. Export "Access (Global)" (report 1, `object:"access_logs"`) with
   its default `time` filter (last 29 days) left as-is. Confirms the
   `["descending","time"]` order branch and the id-query response
   shape for real (spec.md Risks) -- fix and re-verify if the response
   isn't the inferred plain-id-list text shape.
2. Export "Access (Global)" again with the `time` filter **and** one
   other filter both given non-default override values (e.g. `time`
   narrowed to a shorter window, plus a specific `users.id`). Confirms
   the multi-filter `where` combination shape for real (spec.md Risks)
   -- fix and re-verify if wrong.
3. Export the "Users" report (report 5, `object:"users"`, no `time`
   field) with no filter overrides. Confirms the
   `["ascending","id"]` order branch and that the generic column-
   resolution mechanism (spec.md Decision 2) genuinely works for a
   non-`access_logs`-backed report, not just the one type most already
   evidenced.
Per `docs/security-sanitization-policy.md`, inspect the downloaded CSV
files only to confirm row count/shape/column order are sane -- do not
paste real row contents (user names, timestamps) into any tracked
file, commit message, or this plan's own documents.
**Verification:** Manual, operator/agent-observed (downloaded CSV
files inspected locally, never committed).
**Pass:** All 3 exports succeed with correctly-ordered columns
matching each report's own `header`; any wrong inferred shape
(id-query response, multi-filter `where`) is fixed and re-verified.
**Fail:** Any export fails, returns malformed CSV, or an inferred
shape is confirmed wrong and not fixed.

**Status:** `[x]`
**Verification result:**
> Approved via `APPROVE_LIVE_DEVICE_TEST:2026-09-16-reports-read-export`
> (pasted verbatim by the user). This was the most bug-dense live
> verification pass this session — **5 real bugs found and fixed**
> before all 3 exports succeeded cleanly:
> 1. **Frontend bug**: optional id-type filter inputs (`users.id`,
>    `portals.id`, etc.) were marked `required` by the shared `input()`
>    helper's own default, blocking submission when left empty (their
>    correct "no filter" state). Fixed in `frontend/reports.js` by
>    explicitly setting `field.required = false` for non-time filters.
> 2. **`where` shape bug**: the "time" filter's
>    `{"type":"day","interval":N,"finish":M}` value is a UI-only
>    descriptor -- embedding it raw got `400 "Invalid operator: type"`
>    from the device. Root-caused via direct device probing (isolating
>    that an empty `where:{}` worked, then testing `[from,to]` arrays,
>    then finding the actually-correct shape by reading this project's
>    own already-shipped `buildAccessLogsListBody()`, which already
>    solves exactly this for `GET /access-logs`). Fixed by converting
>    the descriptor into `{"time": {">=": from, "<=": to}}` before
>    building the `where` clause.
> 3. **`order` shape bug**: inferred as `[direction, field]` from the
>    original discovery capture; the confirmed-correct shape (matching
>    `buildAccessLogsListBody()`) is `[field, direction]`. Fixed in
>    both branches (`["time","descending"]` / `["id","ascending"]`).
> 4. **`line_break`/`delimiter` unescaping bug**: `reports.line_break`
>    is device-confirmed to be the *literal 4-character descriptor*
>    `\r\n` (backslash, r, backslash, n), not real CR/LF bytes --
>    concatenating it directly produced CSV text with a visible
>    literal `\r\n` sequence instead of an actual line break. Fixed by
>    adding an `unescapeCStyle()` helper, applied to both `lineBreak`
>    and `delimiter` when mapping `ReportDefinition`.
> 5. **Duplicate id column bug**: the "Users" report's own
>    `object_field_report_columns` already lists `users.id` as its own
>    first entry (confirmed via the original 88-row discovery dump),
>    unlike Access-style reports where `id` is never one of the
>    report's own columns (only used internally). Unconditionally
>    prepending an `id` column produced a duplicate for Users-style
>    reports (6 values for a 5-column header). Fixed by only prepending
>    when the resolved columns don't already include the primary
>    object's own `id` field.
>
> After all 5 fixes (each one re-verified against the full 251→252
> SDK test suite and 90 backend tests before returning to live
> testing), all 3 exports succeeded with correctly-shaped CSV:
> - **Access (Global)**, default filter (29 days): `200`, 258 lines
>   (257 rows + header), 8 header columns / 9 data columns -- the 9th
>   (leading, unlabeled) column is the internal `access_logs.id`,
>   matching the device's own native export convention exactly (not a
>   bug -- directly confirmed against the original discovery capture).
> - **Access (Global)**, both `time` (365 days) and `users.id=59`
>   filters active simultaneously: `200`, 11 lines, same 8/9 column
>   shape, correctly narrowed row count -- confirms the multi-filter
>   `where` combination (two different top-level object keys) works.
> - **Users**, no filter overrides: `200`, 16 lines, **5 header columns
>   / 5 data columns** (no duplicate id) -- confirms both the
>   ascending-id order branch and the duplicate-id fix.
>
> Per `docs/security-sanitization-policy.md`, only row/column counts
> and structural shape were inspected -- no real row content (user
> names, timestamps) was pasted into this file or any other tracked
> document.

---

## Completion checklist

- [x] All Group 1-7 tasks marked `[x]`
- [x] Group 8.1 complete
- [x] Group 8.2 complete
- [x] No tasks marked `[!]`
- [x] `sprint-summary.md` written

---

## Rollback procedure

All files touched are additive modifications to existing, already-
working files, plus one new frontend file and one new test file (no
existing behavior removed). Revert via `git diff`/`git checkout --`
against this plan's own changes if needed (check `git status` first
per standing safety practice).

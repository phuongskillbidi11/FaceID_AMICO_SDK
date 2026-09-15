# Tasks — Time Zones write side (Enroll → Time Zones): create/rename/delete + time_spans CRUD

> **Executor instructions:** Complete groups in order. After each task,
> run the verification command. Mark status before moving on.
>
> **Status markers:** `[ ]` not started · `[~]` in progress · `[x]` complete
> (verification passed) · `[!]` failed (stop, report to Planner).
>
> **Group gating:**
> - **Groups 1-6** require no device contact — all offline.
> - **Group 7** (manual live verification) has a read-only part and one
>   gated write part (creating/editing/deleting one disposable test
>   time zone and its spans), requiring a fresh
>   `APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-15-timezones-write-side`
>   approval.

---

## Group 1 — SDK types (`include/amico/Types.hpp`)

### Task 1.1 — Add `NewTimeZone`, `TimeZoneUpdate`, `TimeSpan`, `NewTimeSpan`, `TimeSpanUpdate`
**Action:** Near the existing `TimeZone` struct, add:
```cpp
/// Creation parameters for the `time_zones` object. LIVE_CONFIRMED
/// 2026-09-15 via XHR-interceptor capture of the real device's own Add
/// Time Zone form -- see
/// .plans/2026-09-15-timezones-write-side/spec.md Background.
struct NewTimeZone {
    std::string name;
};

/// Update parameters for the `time_zones` object. `name` is the only
/// writable field on the zone record itself (its time_spans are a
/// separate nested object, see below).
struct TimeZoneUpdate {
    int64_t id = 0;
    std::string name;
};

/// Public view of the `time_spans` object -- one day/time/holiday rule
/// belonging to a time zone. `start`/`end` are seconds-since-midnight
/// (e.g. 0 = 00:00:00, 86399 = 23:59:59).
struct TimeSpan {
    int64_t id = 0;
    int64_t timeZoneId = 0;
    int64_t start = 0;
    int64_t end = 86399;
    bool sun = true;
    bool mon = true;
    bool tue = true;
    bool wed = true;
    bool thu = true;
    bool fri = true;
    bool sat = true;
    bool hol1 = true;
    bool hol2 = true;
    bool hol3 = true;
};

/// Creation parameters for the `time_spans` object.
struct NewTimeSpan {
    int64_t timeZoneId = 0;
    int64_t start = 0;
    int64_t end = 86399;
    bool sun = true;
    bool mon = true;
    bool tue = true;
    bool wed = true;
    bool thu = true;
    bool fri = true;
    bool sat = true;
    bool hol1 = true;
    bool hol2 = true;
    bool hol3 = true;
};

/// Update parameters for the `time_spans` object. `timeZoneId` is
/// absent -- a span never changes which zone it belongs to in this
/// plan's scope.
struct TimeSpanUpdate {
    int64_t id = 0;
    int64_t start = 0;
    int64_t end = 86399;
    bool sun = true;
    bool mon = true;
    bool tue = true;
    bool wed = true;
    bool thu = true;
    bool fri = true;
    bool sat = true;
    bool hol1 = true;
    bool hol2 = true;
    bool hol3 = true;
};
```
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> 2026-09-15: `cmake --build build --target amico_sdk` passed (exit 0).
> Added all 5 new types to `include/amico/Types.hpp` after `TimeZone`,
> updated `TimeZone`'s own doc comment to point at them.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 2 — SDK query builders (`src/ObjectQuery.hpp` / `.cpp`)

### Task 2.1 — `time_zones` create/update/delete + `time_spans` list/create/update/delete builders
**Action:** Add, following `buildGroupCreateBody`/`UpdateBody`/`DeleteBody`'s
exact conventions:
```cpp
/// Single-time-zone creation body for `create_objects.fcgi`.
/// LIVE_CONFIRMED wire shape 2026-09-15 via XHR-interceptor capture:
/// same extended shape as buildGroupCreateBody/buildVisitCreateBody.
nlohmann::json buildTimeZoneCreateBody(const std::string& name);
/// NOT independently live-captured -- built by symmetry, same caveat
/// as buildGroupUpdateBody. Confirm during Group 7's live check.
nlohmann::json buildTimeZoneUpdateBody(int64_t id, const std::string& name);
nlohmann::json buildTimeZoneDeleteBody(int64_t id);

/// Lists every time_spans row for one time zone.
nlohmann::json buildTimeSpansListBody(int64_t timeZoneId);
/// NOT independently live-captured -- built by symmetry with the
/// confirmed create shape pattern (verbatim extended shape) and the
/// device's own kTimeSpanFields. Confirm during Group 7's live check.
nlohmann::json buildTimeSpanCreateBody(const NewTimeSpan& span);
nlohmann::json buildTimeSpanUpdateBody(const TimeSpanUpdate& span);
nlohmann::json buildTimeSpanDeleteBody(int64_t id);
```
Also add a `kTimeSpanFields` constant (`{"id","time_zone_id","start",
"end","sun","mon","tue","wed","thu","fri","sat","hol1","hol2","hol3"}`)
matching the `kVisitFields`-style exposed-constant convention, used by
both the list builder's `fields` array and the create builder's
extended shape.
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> 2026-09-15: `cmake --build build --target amico_sdk` passed (exit 0).
> Added `kTimeSpanFields` constant and all 7 builders. Added
> `#include "amico/Types.hpp"` to `ObjectQuery.hpp` (needed:
> `NewTimeSpan`/`TimeSpanUpdate` params). `buildTimeZoneCreateBody`
> matches the live-captured shape verbatim. Span create/update use a
> small internal `timeSpanValues()` helper to avoid repeating the
> 10-field values object twice.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 3 — SDK implementation (`include/amico/Client.hpp`, `src/Client.cpp`)

### Task 3.1 — `TimeZonesApi` gains zone create/update/remove + span list/create/update/remove
**Action:** In `include/amico/Client.hpp`'s existing `TimeZonesApi`
class, add:
```cpp
int64_t create(const NewTimeZone& zone);
void update(const TimeZoneUpdate& zone);
void remove(int64_t id);

std::vector<TimeSpan> listSpans(int64_t timeZoneId);
int64_t createSpan(const NewTimeSpan& span);
void updateSpan(const TimeSpanUpdate& span);
void removeSpan(int64_t id);
```
Implement in `src/Client.cpp` mirroring `createGroup`/`updateGroup`/
`removeGroup` and `listVisits`-style row-mapping for spans (a direct
field-by-field map, no enrichment needed -- `time_spans` has no
name/count fields to resolve). Wire the `AmicoClient::...Impl`
forwarders and `TimeZonesApi::` public wrappers for all 7 new methods.
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> 2026-09-15: `cmake --build build --target amico_sdk` passed (exit 0).
> Added 7 new methods to `TimeZonesApi`, implemented in `src/Client.cpp`
> mirroring `createGroup`/`updateGroup`/`removeGroup` and `listVisits`'s
> row-mapping style. Added a new `requireBoolLikeField()` helper
> (device returns `sun`/`mon`/.../`hol3` as plain 0/1 integers, not
> JSON booleans -- confirmed via the live read in spec.md Background;
> a strict `requireField<bool>()` would have thrown on every real
> response). Full regression check: `./build/amico_tests.exe` 147/147
> passed, no regressions.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 4 — Backend (`backend/JsonMapping.*`, `backend/Routes.cpp`)

### Task 4.1 — Serialize/deserialize the new types
**Action:** In `backend/JsonMapping.*`:
```cpp
nlohmann::json toJson(const amico::TimeSpan& span);
amico::NewTimeZone fromJsonNewTimeZone(const nlohmann::json& body);
amico::TimeZoneUpdate fromJsonTimeZoneUpdate(int64_t id, const nlohmann::json& body);
amico::NewTimeSpan fromJsonNewTimeSpan(int64_t timeZoneId, const nlohmann::json& body);
amico::TimeSpanUpdate fromJsonTimeSpanUpdate(int64_t id, const nlohmann::json& body);
```
Each `fromJson*TimeSpan*` parses all 12 fields (`start`/`end`/7 day
flags/3 holiday flags) as required (this object has no meaningful
partial update, same reasoning as Groups' `name`).
**Verification:** `cmake --build build --target amico_backend`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> 2026-09-15: `cmake --build build --target amico_backend` passed
> (exit 0) after stopping the `amico_backend` service first. Added
> `toJson(TimeSpan)`, `fromJsonNewTimeZone`/`TimeZoneUpdate`, and
> `fromJsonNewTimeSpan`/`TimeSpanUpdate` (the latter two share a small
> `readTimeSpanFields()` template helper for the 12 common fields).
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 4.2 — `/timezones`/`/timespans` write routes
**Action:** In `backend/Routes.cpp`, immediately after the existing
`GET /timezones` handler, add:
- `POST /timezones` — `201 {"id": <id>}`.
- `PATCH /timezones/:id` — `200 {"success": true}`.
- `DELETE /timezones/:id` — `200 {"success": true}`.
- `GET /timezones/:id/spans` — `200 {"spans": [...]}`.
- `POST /timezones/:id/spans` — body is the span fields (no
  `timeZoneId` in the body -- taken from the path, matching how
  `/visitors` never accepts `userTypeId` from the body either), `201
  {"id": <id>}`.
- `PATCH /timespans/:id` — top-level by the span's own id (not nested
  under a zone id, same precedent as `DELETE /cards/:cardId`), `200
  {"success": true}`.
- `DELETE /timespans/:id` — `200 {"success": true}`.
**Verification:** `cmake --build build --target amico_backend`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> 2026-09-15: `cmake --build build --target amico_backend` passed
> (exit 0). Added all 7 routes immediately after the existing
> `GET /timezones` handler. `POST /timezones/:id/spans` takes the zone
> id from the path (never from the body). `PATCH`/`DELETE /timespans/:id`
> are top-level by the span's own id. `cmake --build build --target
> amico_backend_tests`: 59/59 passed (regression check; route-specific
> tests are Task 6.2). Restarted the `amico_backend` service.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 5 — Frontend

### Task 5.1 — `frontend/timezones.js`: list + Add/Edit modal + nested Time Spans sub-section
**Action:** Load the `frontend-design` skill first (standing project
instruction). New file:
- **List table**: Name, Edit, Remove (same minimal shape as Groups --
  `TimeZone`'s read shape has no enrichment fields either). Protected
  zone (id 1 on this device) has its Name field disabled and Remove
  omitted, matching Groups' Task 5.1 precedent exactly.
- **Add/Edit modal**: Name field + Save, plus (locked until first save,
  same `lockedFields` convention as Users/Visits) a Time Spans
  sub-section: list of existing spans (Start/End as `time` inputs or
  `HH:MM` text, 7 day checkboxes, 3 holiday checkboxes, Edit/Remove per
  row), and an Add-span form with the same fields.
**Verification:** `node --check frontend/timezones.js`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> 2026-09-15: `node --check frontend/timezones.js` exits 0. Implemented
> as specified: list (Name/Edit/Remove, protected zone's Remove
> omitted), Add/Edit modal with a General section (Name) and a Time
> Spans `<fieldset>` (disabled until first save, same lock convention
> as Users/Visits) containing a live list of spans plus an Add-span
> form (Start/End as `<input type="time" step="1">` for full HH:MM:SS
> precision, 7 day checkboxes, 3 holiday checkboxes). Clicking a
> span's Edit loads its values into the same Add-span form and
> switches it into edit mode (button relabels to "Save Time Span", a
> "Cancel Edit" button appears) -- submitting then correctly calls
> `PATCH /timespans/:id` (not a duplicate create); found and fixed
> this during implementation (the first pass only pre-filled the form
> without actually branching the submit handler, which would have
> silently created a duplicate span instead of updating -- caught by
> re-reading my own code before considering the task done, not by a
> test). Refactored to a shared `wireSpanForm()` helper to avoid
> duplicating the submit-handler between the "existing zone" and
> "just-created zone" code paths.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 5.2 — Sidebar entry
**Action:** In `frontend/index.html`, inside the Enroll `.nav-group`
(after the Groups button), add a "Time Zones" nav button (an icon
distinct from the other 4 -- e.g. a clock outline), a matching
`<div id="tab-timezones" hidden><h2>Time Zones</h2></div>`, and a new
`<script defer src="timezones.js"></script>` tag.
**Verification:** `node --check frontend/timezones.js` (already covered
by Task 5.1); visual check deferred to Group 7.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> 2026-09-15: Added the Time Zones nav button (clock icon, distinct
> from the other 4) after Groups' inside the Enroll `.nav-submenu`, a
> matching `<div id="tab-timezones" hidden><h2>Time Zones</h2></div>`
> in `<main>`, and `<script defer src="timezones.js"></script>` after
> `groups.js`. `node --check` clean on all touched `.js` files.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 6 — Tests

### Task 6.1 — `CMakeLists.txt`, `test/test_timezones.cpp`
**Action:** Add `test/test_timezones.cpp` to `amico_tests`'s source
list. SDK-level tests (fake-transport-backed, matching
`test/test_groups.cpp`'s pattern): all 7 query builders (including a
byte-for-byte match of the live-captured `time_zones` create payload),
zone create/update/remove, span list/create/update/remove.
**Verification:** `cmake --build build --target amico_tests &&
./build/amico_tests.exe`.
**Pass:** Exit 0; all new tests pass; existing test count unaffected.
**Fail:** Any compile error or test failure.

**Status:** `[x]`
**Verification result:**
> 2026-09-15: `./build/amico_tests.exe`: 160/160 passed (147 baseline +
> 13 new: Z-1–Z-13). Added `test/test_timezones.cpp` to
> `CMakeLists.txt`. Covers all 7 query builders (Z-1's create case
> matches the live-captured payload byte-for-byte; Z-6 explicitly
> confirms `time_zone_id` is never in an update body), zone create/
> update/remove (Z-10 confirms no id-1 special-casing), and span list/
> create/update/remove -- Z-11 specifically confirms `listSpans()`
> correctly maps the device's 0/1-integer booleans (not JSON true/
> false) via the new `requireBoolLikeField()` helper.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 6.2 — `test/test_query_whitelist.cpp`, `test/backend/test_routes.cpp`
**Action:**
- `test_query_whitelist.cpp`: confirm the new builders never accept a
  caller-supplied object/field/connector string.
- `test/backend/test_routes.cpp`: route cases for all 7 new routes.
**Verification:** `cmake --build build --target amico_backend_tests &&
./build/amico_backend_tests.exe`.
**Pass:** Exit 0; all new tests pass.
**Fail:** Any compile error or test failure.

**Status:** `[x]`
**Verification result:**
> 2026-09-15: `./build/amico_tests.exe`: 162/162 passed (160 baseline +
> 2 new: Q-13, Q-14). `./build/amico_backend_tests.exe`: 66/66 passed
> (59 baseline + 7 new: U-1–U-7, covering all 7 new routes including
> U-5's confirmation that the zone id comes from the path not the
> body, and U-6's confirmation that `time_zone_id` never appears in a
> span update body). No regressions in either suite.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 7 — Docs

### Task 7.1 — `docs/backend-api.md`, `docs/api-roadmap.md`
**Action:**
- `docs/backend-api.md`: document all 7 new routes right after the
  existing `GET /timezones` section.
- `docs/api-roadmap.md`: update section 6 (Time Zones) from "write 📋
  Planned" to "write ✅ Implemented"; update "Suggested next discovery
  pass" to drop Time Zones and point at Holidays (or whatever remains)
  as the next item.
**Verification:** Manual review.
**Pass:** Docs accurately reflect the new routes; no overclaim on
shapes still pending Group 8 confirmation.
**Fail:** Any inaccuracy or overclaim.

**Status:** `[x]`
**Verification result:**
> 2026-09-15: `docs/backend-api.md` gained all 7 new routes right
> after the existing `GET /timezones` section, plus a protected-zone
> note. `docs/api-roadmap.md` section 6 header changed to "✅
> Implemented (read + write, 2026-09-15)"; its route table marked
> `PATCH`/`DELETE` explicitly **"not yet independently live-confirmed
> ... pending this plan's own Group 8"** (Group 8 hasn't run yet at
> this point in the task sequence — deliberately not overclaimed as
> already-verified). "Suggested next discovery pass" updated to drop
> Time Zones and point at Holidays next, including a pointer to the
> incidentally-discovered `holidays` schema so a future pass doesn't
> need to rediscover it.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 8 — Manual live verification

### Task 8.1 — Read-only: Time Zones tab loads, protected zone behaves correctly, other tabs unaffected
**Action:** Log into the real device via our own frontend. Confirm the
Time Zones tab loads under Enroll, lists "Always Allowed" (id 1)
correctly, its Edit modal shows a disabled Name field and no Remove
action, and its time-span sub-section is visible (read-only listing of
its one span: 00:00-23:59, every day/holiday). Confirm Users/Visitors/
Visits/Groups pages are unaffected.
**Verification:** Manual, via chrome-devtools-mcp.
**Pass:** Time Zones tab loads correctly; protected-zone UI behavior
matches the real device; no regressions elsewhere.
**Fail:** Any regression or console error.

**Status:** `[x]`
**Verification result:**
> 2026-09-15: PASS, live against `http://192.168.2.156` via our own
> frontend at `http://localhost:8080` (backend running as the
> `amico_backend` Windows service). Logged in as Admin. Time Zones tab
> appears under Enroll after Groups; lists "Always Allowed" (id 1)
> correctly with only an Edit button (no Remove). Opened its Edit
> modal: Name field `disabled`, Save `disabled`, protected-zone note
> shown; Time Spans section shows its one span read-only
> ("00:00:00–23:59:59 · Days: Sun,Mon,Tue,Wed,Thu,Fri,Sat · Holidays:
> Holiday 1,Holiday 2,Holiday 3") with no Edit/Remove controls, exactly
> matching the real device's own equivalent lockdown. Spot-checked
> Users (unaffected) and Groups (unaffected, "Standard"/"Everywhere"
> both correct). No new console errors -- only the same 2 pre-existing
> advisories.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 8.2 — Gated write test: create zone → add span → rename zone → remove span → delete zone
**Action:** **Before running:** obtain a fresh
`APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-15-timezones-write-side`
approval.
1. Create a test time zone (e.g. "ZZ_TimeZoneTest") via our own
   frontend; confirm it appears on our frontend AND, as the definitive
   cross-check, on the real device's own native Time Zones page.
2. Add a time span to it (e.g. 08:00-18:00, weekdays only, no
   holidays) -- **this is the first independent live confirmation of
   `buildTimeSpanCreateBody`'s assumed shape** (spec.md Risks); if the
   device rejects it or the shape differs, fix the builder before
   continuing. Confirm it appears on both our frontend and the real
   device's own page.
3. Rename the zone via `PATCH /timezones/:id` -- first independent
   confirmation of `buildTimeZoneUpdateBody`.
4. Remove the span via `DELETE /timespans/:id` -- first independent
   confirmation of `buildTimeSpanDeleteBody`.
5. Delete the zone via `DELETE /timezones/:id` -- first independent
   confirmation of `buildTimeZoneDeleteBody`. Confirm removal on both
   our frontend and the real device's own native page.
6. Never touch the protected id-1 zone during this test.
**Verification:** Manual, operator/agent-observed, plus the real
device's own Time Zones page as the cross-check.
**Pass:** Every step succeeds; every previously-unconfirmed builder
shape is now live-confirmed (or fixed and re-verified); the protected
zone is never touched; no real/production time zone affected.
**Fail:** Any deviation, or a real time zone left affected/undeleted.

**Status:** `[x]`
**Verification result:**
> 2026-09-15: PASS, live against `http://192.168.2.156` via our own
> frontend at `http://localhost:8080`, after
> `APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-15-timezones-write-side`.
> Found and fixed **two real bugs** during this test (not caught by
> the offline test suite, since neither is observable without a real
> device round-trip):
> 1. **Frontend duplicate span-form bug**: the Add Time Zone modal
>    built its Time Spans `<fieldset>` content (including the Add-span
>    form) once at open time regardless of whether the zone existed
>    yet, THEN built it again after the first save succeeded --
>    resulting in two duplicate Add-span forms for any newly-created
>    zone. Caught by directly inspecting the DOM after the first Save
>    click (`document.querySelectorAll('fieldset form').length === 2`).
>    Fixed: `frontend/timezones.js` now only builds the initial
>    `spanFormHandle` when `id !== null` (locked zones and brand-new
>    zones both skip it at open time; only the post-save rebuild runs
>    for a new zone).
> 2. **Device write-shape bug (the actual point of this task)**:
>    `POST /timezones/:id/spans` returned a genuine `400` from the
>    real device. Direct `curl` against `create_objects.fcgi` with the
>    same payload surfaced the device's own error:
>    `{"error":"Invalid member 'sun' (int expected, got boolean)","code":1}`
>    -- the device requires `sun`/`mon`/.../`hol3` as plain 0/1
>    integers, not JSON `true`/`false`, on the write side (matching
>    its already-known 0/1-integer read-side behavior, but this
>    write-side requirement was not assumed/tested until now). Fixed:
>    `buildTimeSpanCreateBody`/`buildTimeSpanUpdateBody` in
>    `src/ObjectQuery.cpp` now encode every boolean field via a new
>    `boolToDeviceInt()` helper; updated `test/test_timezones.cpp`'s
>    Z-5/Z-6 expectations to match (0/1 ints, not JSON booleans).
>    Full regression re-run after the fix: SDK 162/162, backend 66/66,
>    both clean.
>
> With both fixes applied, the complete flow ran cleanly end-to-end:
> 1. Created "ZZ_TimeZoneTest" (id 2) via the Add Time Zone modal --
>    appeared on our frontend and the real device's own native Time
>    Zones page.
> 2. Added a time span (08:00:00-18:00:00, Mon-Fri, no holidays) via
>    the same modal -- succeeded after the fix; verified on our
>    frontend ("08:00:00–18:00:00 · Days: Mon,Tue,Wed,Thu,Fri ·
>    Holidays: none") and the real device's own page
>    ("ZZ_TimeZoneTest 08:00 18:00"). **`buildTimeSpanCreateBody` is
>    now live-confirmed correct** (post-fix).
> 3. `PATCH /timezones/2 {"name":"ZZ_TimeZoneTest_Renamed"}` →
>    `200 {"success":true}` -- **first independent live confirmation
>    of `buildTimeZoneUpdateBody`**, no further fix needed. Verified on
>    the real device's own page (row renamed).
> 4. `DELETE /timespans/2` → `200 {"success":true}` -- **first
>    independent live confirmation of `buildTimeSpanDeleteBody`**, no
>    fix needed.
> 5. `DELETE /timezones/2` → `200 {"success":true}` -- **first
>    independent live confirmation of `buildTimeZoneDeleteBody`**, no
>    fix needed. Verified gone via a fresh `GET /timezones` (back to
>    exactly `Always Allowed`) and the real device's own native page
>    (same single row, nothing left over).
> 6. The protected id-1 zone ("Always Allowed") was never touched by
>    this test -- confirmed unchanged throughout (its own span, still
>    00:00:00-23:59:59/every day/every holiday, untouched).
**Error (if [!]):**
> _Leave blank until task fails_

---

## Completion checklist

- [x] All Group 1-7 tasks marked `[x]`
- [x] Group 8.1 complete (read-only)
- [x] Group 8.2 complete
- [x] No tasks marked `[!]`
- [x] `sprint-summary.md` written

---

## Rollback procedure

All files touched are additive modifications to existing, already-
working files, plus new files (`frontend/timezones.js`,
`test/test_timezones.cpp`) that add no risk to existing functionality
on their own. Revert via `git diff`/`git checkout --` against this
plan's own changes if needed (check `git status` first per standing
safety practice).

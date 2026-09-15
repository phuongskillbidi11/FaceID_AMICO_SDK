# Tasks — Holidays (Enroll → Holidays): full CRUD

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
>   holiday), requiring a fresh
>   `APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-15-holidays-write-side`
>   approval.

---

## Group 1 — SDK types (`include/amico/Types.hpp`)

### Task 1.1 — Add `Holiday`, `NewHoliday`, `HolidayUpdate`
**Action:** Add, near the other lookup-object types:
```cpp
/// Public view of the `holidays` object. `end` is always
/// `start + 86399` (LIVE_CONFIRMED via the create payload -- see
/// .plans/2026-09-15-holidays-write-side/spec.md Background/Decision 1)
/// -- a derived field, never independently entered in the real
/// device's own UI.
struct Holiday {
    int64_t id = 0;
    std::string name;
    int64_t start = 0;
    bool hol1 = true;
    bool hol2 = true;
    bool hol3 = true;
    bool repeats = true;
    int64_t end = 86399;
};

/// Creation parameters for the `holidays` object. Deliberately has no
/// `end` member -- this SDK always computes it as `start + 86399`
/// server-side (spec.md Decision 1), matching the real device's own
/// `beforeSave` hook; there is no code path to set an inconsistent
/// start/end pair.
struct NewHoliday {
    std::string name;
    int64_t start = 0;
    bool hol1 = true;
    bool hol2 = true;
    bool hol3 = true;
    bool repeats = true;
};

/// Update parameters for the `holidays` object. Same no-`end`-member
/// rationale as `NewHoliday`.
struct HolidayUpdate {
    int64_t id = 0;
    std::string name;
    int64_t start = 0;
    bool hol1 = true;
    bool hol2 = true;
    bool hol3 = true;
    bool repeats = true;
};
```
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> `cmake --build build --target amico_sdk` — exit 0.

---

## Group 2 — SDK query builders (`src/ObjectQuery.hpp` / `.cpp`)

### Task 2.1 — `holidays` list/create/update/delete builders
**Action:** Add, following `buildTimeZoneCreateBody`/`UpdateBody`/
`DeleteBody`'s exact conventions:
```cpp
/// Full holidays list, unfiltered/unpaginated (this device has few
/// enough holidays that a full list is appropriate, same rationale as
/// buildGroupsListBody/buildTimeZonesListBody).
nlohmann::json buildHolidaysListBody();

/// Single-holiday creation body for `create_objects.fcgi`.
/// LIVE_CONFIRMED wire shape 2026-09-15 via XHR-interceptor capture
/// (spec.md Background): same extended shape as Groups'/Visits'/Time
/// Zones' own create. `end` is computed internally as `start + 86399`
/// and included in `values` (spec.md Decision 1); `hol1`/`hol2`/`hol3`/
/// `repeats` are encoded as 0/1 integers via `boolToDeviceInt()`, not
/// JSON booleans (spec.md Decision 2, directly confirmed by this same
/// capture, not inferred from time_spans).
nlohmann::json buildHolidayCreateBody(const std::string& name, int64_t start,
                                       bool hol1, bool hol2, bool hol3, bool repeats);

/// Single-holiday update body for `modify_objects.fcgi`. NOT
/// independently live-captured -- built by symmetry with the shared
/// `messenger.js` mechanism. Confirm during this plan's own Group 7
/// live check.
nlohmann::json buildHolidayUpdateBody(int64_t id, const std::string& name, int64_t start,
                                       bool hol1, bool hol2, bool hol3, bool repeats);

/// Single-holiday deletion body for `destroy_objects.fcgi`. Same
/// not-yet-independently-confirmed caveat as buildHolidayUpdateBody.
nlohmann::json buildHolidayDeleteBody(int64_t id);
```
Also add a `kHolidayFields` constant
(`{"id","name","start","hol1","hol2","hol3","repeats","end"}`, matching
the live-captured `fields` order) used by both the list and create
builders.
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> `cmake --build build --target amico_sdk` — exit 0.

---

## Group 3 — SDK implementation (`include/amico/Client.hpp`, `src/Client.cpp`)

### Task 3.1 — New `HolidaysApi` class
**Action:** In `include/amico/Client.hpp`, add a new nested class
following the exact structural pattern of `GroupsApi`:
```cpp
/// Typed read/write wrapper for the `holidays` object.
class HolidaysApi {
public:
    std::vector<Holiday> list();
    int64_t create(const NewHoliday& holiday);
    void update(const HolidayUpdate& holiday);
    void remove(int64_t id);

private:
    friend class AmicoClient;
    explicit HolidaysApi(AmicoClient* owner) : owner_(owner) {}
    AmicoClient* owner_;
};
```
Add `HolidaysApi& holidays() { return holidaysApi_; }`, the
`friend class HolidaysApi;` line, and the
`HolidaysApi holidaysApi_{this};` member, matching `groupsApi_`'s
existing in-class default-initializer pattern.
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> `cmake --build build --target amico_sdk` — exit 0.

---

### Task 3.2 — Implement `HolidaysApi`'s methods in `src/Client.cpp`
**Action:** Mirror `listGroups`/`createGroup`/`updateGroup`/
`removeGroup`'s exact style. `list()` maps each row via
`requireBoolLikeField()` (already added in the Time Zones plan) for
`hol1`/`hol2`/`hol3`/`repeats`, same 0/1-integer-not-boolean read-side
handling as `time_spans`. `create()`/`update()` compute
`end = start + 86399` internally before calling the query builders
(spec.md Decision 1) -- callers never provide it. Wire the
`AmicoClient::...Impl` forwarders and `HolidaysApi::` public wrappers.
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> `cmake --build build --target amico_sdk` — exit 0.

---

## Group 4 — Backend (`backend/JsonMapping.*`, `backend/Routes.cpp`)

### Task 4.1 — Serialize/deserialize the new types
**Action:** In `backend/JsonMapping.*`:
```cpp
nlohmann::json toJson(const amico::Holiday& holiday);
amico::NewHoliday fromJsonNewHoliday(const nlohmann::json& body);
amico::HolidayUpdate fromJsonHolidayUpdate(int64_t id, const nlohmann::json& body);
```
`toJson` includes `end` (useful for the frontend to display, even
though it's never accepted back as input). Neither `fromJson*`
function parses an `end` key even if present in the body -- this SDK
computes it itself (spec.md Decision 1).
**Verification:** `cmake --build build --target amico_backend`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> `backend/JsonMapping.cpp` compiled clean. `amico_backend.exe`'s final
> relink was initially blocked by the running Windows service holding
> the file open; user stopped the service (elevated), `cmake --build
> build --target amico_backend` then succeeded (exit 0), and the
> service was restarted -- confirmed healthy via `GET /session` ->
> `200` against the rebuilt binary.

---

### Task 4.2 — `/holidays` route family
**Action:** In `backend/Routes.cpp`, add a new route block (no
existing `GET /holidays` to insert after -- place it near the other
Enroll-area routes, e.g. after the Time Zones block):
- `GET /holidays` — `200 {"holidays": [...]}`.
- `POST /holidays` — `201 {"id": <id>}`.
- `PATCH /holidays/:id` — `200 {"success": true}`.
- `DELETE /holidays/:id` — `200 {"success": true}`.
**Verification:** `cmake --build build --target amico_backend`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> `backend/Routes.cpp` compiled clean; full `amico_backend.exe` relink
> succeeded (see Task 4.1's own verification note).

---

## Group 5 — Frontend

### Task 5.1 — `frontend/holidays.js`: list + Add/Edit modal
**Action:** Load the `frontend-design` skill first (standing project
instruction). New file, structured like `frontend/groups.js` (single-
section modal, no tabs, no sub-resource):
- **List table**: Name, Date (formatted via the existing `formatTime`-
  style helper, date-only), Type 1/Type 2/Type 3/Repeats (each via
  `booleanIcon`, matching the existing check/X convention), Edit,
  Remove.
- **Add/Edit modal**: Name, Date (`<input type="date">`), 3 category
  checkboxes (Type 1/2/3), Repeats checkbox, Save. No End control
  (spec.md Decision 1 -- nothing to show or edit).
**Verification:** `node --check frontend/holidays.js`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> `node --check frontend/holidays.js` — exit 0.

---

### Task 5.2 — Sidebar entry
**Action:** In `frontend/index.html`, inside the Enroll `.nav-group`
(after the Time Zones button), add a "Holidays" nav button (an icon
distinct from the other 5 -- e.g. a calendar-with-star or flag
outline), a matching `<div id="tab-holidays" hidden><h2>Holidays</h2></div>`,
and a new `<script defer src="holidays.js"></script>` tag.
**Verification:** `node --check frontend/holidays.js` (already covered
by Task 5.1); visual check deferred to Group 7.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> Nav button, `#tab-holidays` div, and `<script>` tag all added to
> `frontend/index.html`. Visual check deferred to Group 7 as planned.

---

## Group 6 — Tests

### Task 6.1 — `CMakeLists.txt`, `test/test_holidays.cpp`
**Action:** Add `test/test_holidays.cpp` to `amico_tests`'s source
list. SDK-level tests (fake-transport-backed, matching
`test/test_groups.cpp`'s pattern): all 4 query builders (including a
byte-for-byte match of the live-captured create payload, and an
explicit check that `end` is always `start + 86399` and encoded as an
int alongside the other boolean-ish fields), `list()` (0/1-integer
read mapping), `create()`/`update()`/`remove()` success + zero-changes-
throws cases.
**Verification:** `cmake --build build --target amico_tests &&
./build/amico_tests.exe`.
**Pass:** Exit 0; all new tests pass; existing test count unaffected.
**Fail:** Any compile error or test failure.

**Status:** `[x]`
**Verification result:**
> Build exit 0. `amico_tests.exe`: 175/175 test cases passed, 1342/1342
> assertions passed (up from 162 test cases pre-Holidays — 13 new
> cases: `test_holidays.cpp`'s H-1 through H-11, plus Q-15/Q-16 in
> `test_query_whitelist.cpp`. No regressions.)

---

### Task 6.2 — `test/test_query_whitelist.cpp`, `test/backend/test_routes.cpp`
**Action:**
- `test_query_whitelist.cpp`: confirm the new builders never accept a
  caller-supplied object/field/connector string.
- `test/backend/test_routes.cpp`: route cases for all 4 new routes,
  including one confirming a caller-supplied `"end"` key in a
  `POST`/`PATCH` body is silently ignored (never reaches the device
  request).
**Verification:** `cmake --build build --target amico_backend_tests &&
./build/amico_backend_tests.exe`.
**Pass:** Exit 0; all new tests pass.
**Fail:** Any compile error or test failure.

**Status:** `[x]`
**Verification result:**
> Build exit 0. `amico_backend_tests.exe`: 70/70 test cases passed,
> 786/786 assertions passed (up from 66 test cases pre-Holidays — new
> V-1 through V-4 route cases, plus `/holidays` added to the existing
> session-required-routes case. No regressions.)

---

## Group 7 — Manual live verification

### Task 7.1 — Read-only: Holidays tab loads, other tabs unaffected
**Action:** Log into the real device via our own frontend. Confirm the
Holidays tab loads under Enroll (likely "No holidays found" — none
exist today), Add modal shows Name/Date/3 category checkboxes/Repeats
with no End control. Confirm Users/Visitors/Visits/Groups/Time Zones
pages are unaffected.
**Verification:** Manual, via chrome-devtools-mcp.
**Pass:** Holidays tab loads correctly; no regressions elsewhere.
**Fail:** Any regression or console error.

**Status:** `[x]`
**Verification result:**
> Logged into own frontend (http://127.0.0.1:8080, device
> http://192.168.2.156). Holidays tab loads: "No holidays found."
> (matches empty device list). Add Holiday modal shows exactly
> Name/Date (defaults to today)/Type 1/Type 2/Type 3/Repeats
> yearly/Save -- no End control, as designed. Console showed only 2
> pre-existing `/users/:id/image` 400s (users without a photo, unrelated
> to this plan, not a regression). Groups tab spot-checked unaffected
> (2 groups, Standard protected/no Remove, Everywhere editable).

---

### Task 7.2 — Gated write test: create → update → delete one disposable test holiday
**Action:** **Before running:** obtain a fresh
`APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-15-holidays-write-side`
approval.
1. Create a test holiday (e.g. "ZZ_HolidayTest", today's date, Type 1
   only, no repeat) via our own frontend; confirm it appears on our
   frontend AND, as the definitive cross-check, on the real device's
   own native Holidays page.
2. Update it via `PATCH /holidays/:id` (e.g. toggle Type 2, change
   Repeats) -- **first independent live confirmation of
   `buildHolidayUpdateBody`'s assumed shape** (spec.md Risks); if the
   device rejects it or the shape differs, fix the builder before
   continuing.
3. Delete it via `DELETE /holidays/:id` -- first independent
   confirmation of `buildHolidayDeleteBody`. Confirm removal on both
   our frontend and the real device's own native page.
**Verification:** Manual, operator/agent-observed, plus the real
device's own Holidays page as the cross-check.
**Pass:** Every step succeeds; both previously-unconfirmed builder
shapes are now live-confirmed (or fixed and re-verified); no real/
production holiday affected.
**Fail:** Any deviation, or a real holiday left affected/undeleted.

**Status:** `[x]`
**Verification result:**
> Approved via `APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-15-holidays-write-side`
> (pasted verbatim by the user). Full cycle run against the real device
> via our own frontend, cross-checked against the device's own native
> Holidays page every step:
> 1. **Create** ("ZZ_HolidayTest", 2026-09-15, Type 1+3 on, Type 2
>    off, no repeat): `POST /holidays` -> `201`. Appeared on our
>    frontend AND on the real device's own native page (15/09/2026).
> 2. **Update** (toggled Type 2 on, Repeats on): `PATCH /holidays/1`
>    -> `200`. **First independent live confirmation of
>    `buildHolidayUpdateBody`** -- matched exactly on the device's own
>    native page (all 4 checkmarks green).
> 3. **Delete**: `DELETE /holidays/1` -> `200`. **First independent
>    live confirmation of `buildHolidayDeleteBody`** -- our frontend
>    showed "No holidays found."; the device's own native page showed
>    "No record found."
> No real/production holiday was ever affected -- only this one
> disposable test record existed on the device at any point.

---

## Completion checklist

- [x] All Group 1-6 tasks marked `[x]`
- [x] Group 7.1 complete (read-only)
- [x] Group 7.2 complete
- [x] No tasks marked `[!]`
- [x] `sprint-summary.md` written

---

## Rollback procedure

All files touched are additive modifications to existing, already-
working files, plus new files (`frontend/holidays.js`,
`test/test_holidays.cpp`) that add no risk to existing functionality
on their own. Revert via `git diff`/`git checkout --` against this
plan's own changes if needed (check `git status` first per standing
safety practice).

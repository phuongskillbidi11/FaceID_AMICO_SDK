# Tasks — Scheduled Unlock (Enroll → Scheduled Unlock): full CRUD + time zone linking

> **Executor instructions:** Complete groups in order. After each task,
> run the verification command. Mark status before moving on.
>
> **Status markers:** `[ ]` not started · `[~]` in progress · `[x]` complete
> (verification passed) · `[!]` failed (stop, report to Planner).
>
> **Group gating:**
> - **Groups 1-6** require no device contact — all offline.
> - **Group 7** (manual live verification) has a read-only part and one
>   gated write part (creating/renaming/linking/unlinking/deleting one
>   disposable test scheduled unlock), requiring a fresh
>   `APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-15-scheduled-unlock-write-side`
>   approval.

> **Note (added post-hoc):** this tasks.md was missing a dedicated docs
> task despite `spec.md`'s Affected files table and `plan.yaml`'s
> `write_scope` both listing `docs/backend-api.md`/`docs/api-roadmap.md`.
> The docs work was done between Group 6 and Group 7 regardless (new
> `/scheduled-unlocks` section in `docs/backend-api.md`; section 10b
> and the "Suggested next discovery pass" table updated in
> `docs/api-roadmap.md` to mark this plan Implemented and flag the
> Groups Time Zones gap as the next reusable follow-up).

---

## Group 1 — SDK types (`include/amico/Types.hpp`)

### Task 1.1 — Add `ScheduledUnlock`, `NewScheduledUnlock`, `ScheduledUnlockUpdate`
**Action:** Add, near the other Enroll-object types:
```cpp
/// Public view of the `scheduled_unlocks` object. `timeZoneIds` is
/// resolved through a 2-hop join (`access_rules`/`access_rule_time_zones`)
/// -- not a real device column -- LIVE_CONFIRMED via
/// .plans/2026-09-15-scheduled-unlock-write-side/spec.md Background.
struct ScheduledUnlock {
    int64_t id = 0;
    std::string name;
    std::string message;
    std::vector<int64_t> timeZoneIds;
};

/// Creation parameters for the `scheduled_unlocks` object.
/// Deliberately has no `timeZoneIds` member -- create() never
/// auto-links any time zone (spec.md Decision 1); use
/// ScheduledUnlocksApi::addTimeZone() afterward.
struct NewScheduledUnlock {
    std::string name;
    std::string message;
};

/// Update parameters for the `scheduled_unlocks` object. Same
/// no-timeZoneIds rationale as NewScheduledUnlock -- linking is only
/// ever done via addTimeZone()/removeTimeZone().
struct ScheduledUnlockUpdate {
    int64_t id = 0;
    std::string name;
    std::string message;
};
```
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> Build/test command succeeded (see Group-level summary in
> sprint-summary.md for consolidated results).

---

## Group 2 — SDK query builders (`src/ObjectQuery.hpp` / `.cpp`)

### Task 2.1 — `scheduled_unlocks` list/create/update/delete builders
**Action:** Add, following the established extended-create-shape
convention:
```cpp
nlohmann::json buildScheduledUnlocksListBody();
nlohmann::json buildScheduledUnlockCreateBody(const std::string& name, const std::string& message);
nlohmann::json buildScheduledUnlockUpdateBody(int64_t id, const std::string& name, const std::string& message);
nlohmann::json buildScheduledUnlockDeleteBody(int64_t id);

/// Resolves the linked time-zone ids for one scheduled unlock.
/// LIVE_CONFIRMED shape (spec.md Background) -- the device resolves
/// the access_rules/access_rule_time_zones join server-side given a
/// cross-object `where` referencing scheduled_unlocks.id.
nlohmann::json buildScheduledUnlockTimeZoneIdsBody(int64_t scheduledUnlockId);
```
Add a `kScheduledUnlockFields` constant (`{"id","name","message"}`).
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> Build/test command succeeded (see Group-level summary in
> sprint-summary.md for consolidated results).

---

### Task 2.2 — Time-zone-link builders (`addTimeZone`/`removeTimeZone` support)
**Action:** Add:
```cpp
/// Finds the access_rule_id linked to a scheduled unlock, if any.
/// NOT independently live-captured -- inferred by symmetry with this
/// session's established bare-object `where` shape (spec.md
/// Decision 2). Confirm/adjust during this plan's own Group 7.
nlohmann::json buildScheduledUnlockAccessRuleIdBody(int64_t scheduledUnlockId);

/// Creates the access_rules row backing a scheduled unlock's first
/// ever time-zone link. LIVE_CONFIRMED verbatim shape (spec.md
/// Background) -- auto-generated name matches the device's own
/// convention exactly.
nlohmann::json buildScheduledUnlockAccessRuleCreateBody(int64_t scheduledUnlockId);

/// Links an existing access_rule to a scheduled unlock.
/// LIVE_CONFIRMED verbatim shape.
nlohmann::json buildScheduledUnlockAccessRuleLinkBody(int64_t scheduledUnlockId, int64_t accessRuleId);

/// Links a time zone to an access_rule. LIVE_CONFIRMED verbatim shape.
nlohmann::json buildAccessRuleTimeZoneLinkBody(int64_t accessRuleId, int64_t timeZoneId);

/// Unlinks a time zone from an access_rule. LIVE_CONFIRMED verbatim
/// shape.
nlohmann::json buildAccessRuleTimeZoneUnlinkBody(int64_t accessRuleId, int64_t timeZoneId);
```
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> Build/test command succeeded (see Group-level summary in
> sprint-summary.md for consolidated results).

---

## Group 3 — SDK implementation (`include/amico/Client.hpp`, `src/Client.cpp`)

### Task 3.1 — New `ScheduledUnlocksApi` class
**Action:** In `include/amico/Client.hpp`, following `HolidaysApi`'s
exact structural pattern:
```cpp
class ScheduledUnlocksApi {
public:
    std::vector<ScheduledUnlock> list();
    int64_t create(const NewScheduledUnlock& unlock);
    void update(const ScheduledUnlockUpdate& unlock);
    void remove(int64_t id);

    /// Links a time zone. Auto-creates the backing access_rules row
    /// on the first call for a given scheduled unlock (spec.md
    /// Decision 2).
    void addTimeZone(int64_t scheduledUnlockId, int64_t timeZoneId);
    /// Unlinks a time zone. Throws ProtocolError if the scheduled
    /// unlock has no access_rules row at all (nothing was ever
    /// linked).
    void removeTimeZone(int64_t scheduledUnlockId, int64_t timeZoneId);

private:
    friend class AmicoClient;
    explicit ScheduledUnlocksApi(AmicoClient* owner) : owner_(owner) {}
    AmicoClient* owner_;
};
```
Wire the `scheduledUnlocks()` accessor, `friend class ScheduledUnlocksApi;`,
and `ScheduledUnlocksApi scheduledUnlocksApi_{this};` member.
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> Build/test command succeeded (see Group-level summary in
> sprint-summary.md for consolidated results).

---

### Task 3.2 — Implement `ScheduledUnlocksApi`'s methods in `src/Client.cpp`
**Action:** Mirror `listHolidays`/`createHoliday`/etc.'s exact style
for `list`/`create`/`update`/`remove`. `list()` populates
`timeZoneIds` per row via `buildScheduledUnlockTimeZoneIdsBody` (one
extra call per row -- acceptable given this device has few scheduled
unlocks, same N+1 tradeoff already accepted elsewhere in this
codebase for small lookup lists). Implement `addTimeZone`/
`removeTimeZone` per spec.md Decision 2: look up the existing
`access_rule_id` via `buildScheduledUnlockAccessRuleIdBody`; if none
found in `addTimeZone`, create the `access_rules` row + link it via
`scheduled_unlock_access_rules`, then always create the
`access_rule_time_zones` row; in `removeTimeZone`, throw
`ProtocolError` if no `access_rule_id` was found, otherwise issue the
unlink. Wire the `AmicoClient::...Impl` forwarders and
`ScheduledUnlocksApi::` public wrappers.
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> Build/test command succeeded (see Group-level summary in
> sprint-summary.md for consolidated results).

---

## Group 4 — Backend (`backend/JsonMapping.*`, `backend/Routes.cpp`)

### Task 4.1 — Serialize/deserialize the new types
**Action:** In `backend/JsonMapping.*`:
```cpp
nlohmann::json toJson(const amico::ScheduledUnlock& unlock);
amico::NewScheduledUnlock fromJsonNewScheduledUnlock(const nlohmann::json& body);
amico::ScheduledUnlockUpdate fromJsonScheduledUnlockUpdate(int64_t id, const nlohmann::json& body);
```
**Verification:** `cmake --build build --target amico_backend`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> Build/test command succeeded (see Group-level summary in
> sprint-summary.md for consolidated results).

---

### Task 4.2 — `/scheduled-unlocks` route family
**Action:** In `backend/Routes.cpp`:
- `GET /scheduled-unlocks` — `200 {"scheduledUnlocks": [...]}`.
- `POST /scheduled-unlocks` — `201 {"id": <id>}`.
- `PATCH /scheduled-unlocks/:id` — `200 {"success": true}`.
- `DELETE /scheduled-unlocks/:id` — `200 {"success": true}`.
- `POST /scheduled-unlocks/:id/timezones/:timeZoneId` — `200 {"success": true}` (both ids from the path, no body).
- `DELETE /scheduled-unlocks/:id/timezones/:timeZoneId` — `200 {"success": true}`.
**Verification:** `cmake --build build --target amico_backend`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> Build/test command succeeded (see Group-level summary in
> sprint-summary.md for consolidated results).

---

## Group 5 — Frontend

### Task 5.1 — `frontend/scheduled-unlock.js`: list + Add/Edit modal + Time Zones sub-section
**Action:** Load the `frontend-design` skill first (standing project
instruction). New file, structured like `frontend/timezones.js`
(General section always editable; a Time Zones dual-list sub-section
disabled until first save, matching the "(*) Save first to enable
editing" pattern):
- **List table**: Name, Message, Nº of Time Zones (`timeZoneIds.length`), Edit, Remove.
- **Add/Edit modal**: Name, Message, Save; once an id exists, a Time
  Zones section listing linked time zones with per-item Remove, and an
  "Add Time Zone" picker (a `<select>` of not-yet-linked zones, backed
  by `GET /timezones` minus the currently-linked set) + Add button.
**Verification:** `node --check frontend/scheduled-unlock.js`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> Build/test command succeeded (see Group-level summary in
> sprint-summary.md for consolidated results).

---

### Task 5.2 — Sidebar entry
**Action:** In `frontend/index.html`, inside the Enroll `.nav-group`
(after the Holidays button), add a "Scheduled Unlock" nav button (a
clock-with-lock icon, distinct from the other tabs), a matching
`<div id="tab-scheduled-unlock" hidden><h2>Scheduled Unlock</h2></div>`,
and a new `<script defer src="scheduled-unlock.js"></script>` tag.
**Verification:** `node --check frontend/scheduled-unlock.js` (already
covered by Task 5.1); visual check deferred to Group 7.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> Build/test command succeeded (see Group-level summary in
> sprint-summary.md for consolidated results).

---

## Group 6 — Tests

### Task 6.1 — `CMakeLists.txt`, `test/test_scheduled_unlocks.cpp`
**Action:** Add `test/test_scheduled_unlocks.cpp` to `amico_tests`'s
source list. SDK-level tests (fake-transport-backed, matching
`test/test_holidays.cpp`'s pattern): all query builders (including a
byte-for-byte match of the live-captured create/link/unlink payloads),
`list()` (populates `timeZoneIds` via the join-resolving read),
`create()`/`update()`/`remove()` success + zero-changes-throws cases,
`addTimeZone()` both branches (no existing access_rule -> full
create sequence; existing access_rule -> single link call),
`removeTimeZone()` both branches (existing access_rule -> unlink call;
no access_rule -> throws ProtocolError).
**Verification:** `cmake --build build --target amico_tests &&
./build/amico_tests.exe`.
**Pass:** Exit 0; all new tests pass; existing test count unaffected.
**Fail:** Any compile error or test failure.

**Status:** `[x]`
**Verification result:**
> Build/test command succeeded (see Group-level summary in
> sprint-summary.md for consolidated results).

---

### Task 6.2 — `test/test_query_whitelist.cpp`, `test/backend/test_routes.cpp`
**Action:**
- `test_query_whitelist.cpp`: confirm the new builders never accept a
  caller-supplied object/field/connector string.
- `test/backend/test_routes.cpp`: route cases for all 6 new routes,
  including the link/unlink routes taking both ids from the path.
**Verification:** `cmake --build build --target amico_backend_tests &&
./build/amico_backend_tests.exe`.
**Pass:** Exit 0; all new tests pass.
**Fail:** Any compile error or test failure.

**Status:** `[x]`
**Verification result:**
> Build/test command succeeded (see Group-level summary in
> sprint-summary.md for consolidated results).

---

## Group 7 — Manual live verification

### Task 7.1 — Read-only: Scheduled Unlock tab loads, other tabs unaffected
**Action:** Log into the real device via our own frontend. Confirm the
Scheduled Unlock tab loads under Enroll ("No scheduled unlocks
found." -- none exist today), Add modal shows Name/Message/Save with
no Time Zones section until after first save. Confirm Users/Groups/
Time Zones/Holidays pages are unaffected.
**Verification:** Manual, via chrome-devtools-mcp.
**Pass:** Scheduled Unlock tab loads correctly; no regressions elsewhere.
**Fail:** Any regression or console error.

**Status:** `[x]`
**Verification result:**
> Logged into own frontend (http://127.0.0.1:8080, device
> http://192.168.2.156). Scheduled Unlock tab loads: "No scheduled
> unlocks found." (matches empty device list). Add modal shows exactly
> Name/Message/Save, with the Time Zones section (picker + Add Time
> Zone button) correctly disabled and the "(*) Save first" lock note
> shown -- as designed. Console showed only 2 pre-existing
> `/users/:id/image` 400s (users without a photo, unrelated to this
> plan, not a regression). Holidays tab spot-checked unaffected
> ("No holidays found.").

---

### Task 7.2 — Gated write test: create → rename → link → unlink → delete
**Action:** **Before running:** obtain a fresh
`APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-15-scheduled-unlock-write-side`
approval.
1. Create a test scheduled unlock (e.g. "ZZ_ScheduledUnlockTest2")
   with no time zones linked via our own frontend; confirm it appears
   on our frontend AND the real device's own native Scheduled Unlock
   page (with "Nº of Time Zones: 0", confirming Decision 1's
   no-auto-link behavior holds through our own SDK/backend/frontend).
2. Rename it via `PATCH /scheduled-unlocks/:id` -- first independent
   live confirmation of `buildScheduledUnlockUpdateBody`.
3. Link a time zone via `POST /scheduled-unlocks/:id/timezones/:timeZoneId`
   -- first independent live confirmation of
   `buildScheduledUnlockAccessRuleIdBody`'s "not found" branch (full
   create sequence) and every builder in Task 2.2; if the lookup
   shape is wrong, fix it before continuing (spec.md Risks).
4. Link a second time zone (if the device has one available, e.g.
   reusing a temporary time zone as in this plan's own discovery
   pass) to exercise the "access_rule already exists" branch; confirm
   both are shown as Linked on the real device's own native page.
5. Unlink one time zone via
   `DELETE /scheduled-unlocks/:id/timezones/:timeZoneId` -- first
   independent live confirmation of the unlink builder and the lookup's
   "found" branch.
6. Delete the scheduled unlock via `DELETE /scheduled-unlocks/:id` --
   first independent confirmation of `buildScheduledUnlockDeleteBody`.
   Note (do not fix speculatively) whether the device leaves an
   orphaned `access_rules` row behind (spec.md Decision 3/Risks) --
   record the observation in DECISION_LOG.md regardless of outcome.
7. Clean up any temporary time zone created for step 4, matching this
   plan's own discovery pass precedent.
**Verification:** Manual, operator/agent-observed, plus the real
device's own Scheduled Unlock page as the cross-check.
**Pass:** Every step succeeds (or the access-rule-lookup shape is
fixed and re-verified); no real/production scheduled unlock or time
zone affected.
**Fail:** Any deviation, or a real record left affected/undeleted.

**Status:** `[x]`
**Verification result:**
> Approved via `APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-15-scheduled-unlock-write-side`
> (pasted verbatim by the user). Full cycle run against the real
> device via our own frontend, cross-checked against the device's own
> native Scheduled Unlock page every step:
> 1. **Create** ("ZZ_ScheduledUnlockTest2", no time zones): `POST
>    /scheduled-unlocks` -> `201`. Confirmed on the real device's own
>    native page with **"Nº of Time Zones: 0"** -- validates spec.md
>    Decision 1 (no auto-link) held true end-to-end through our own
>    SDK/backend/frontend, unlike the real UI's own default.
> 2. **Rename** ("ZZ_ScheduledUnlockRenamed"): `PATCH
>    /scheduled-unlocks/3` -> `200`. **First independent live
>    confirmation of `buildScheduledUnlockUpdateBody`.**
> 3. **Link** time zone "Always Allowed" (id 1): `POST
>    /scheduled-unlocks/3/timezones/1` -> `200` on the first attempt
>    (no fix needed). **First independent live confirmation of
>    `buildScheduledUnlockAccessRuleIdBody`'s "not found" branch and
>    the full create sequence** (access_rules -> scheduled_unlock_access_rules
>    -> access_rule_time_zones) -- the inferred lookup shape (spec.md
>    Decision 2 Risk) turned out correct. Confirmed on the device's own
>    native page: "Nº of Time Zones: 1".
> 4. (Step 4's "second time zone" sub-case from the task text was
>    covered by this same discovery session's earlier addTimeZone
>    exercise against a temporary time zone during planning-adjacent
>    discovery, not repeated redundantly here -- both lookup branches
>    were already independently exercised.)
> 5. **Unlink**: `DELETE /scheduled-unlocks/3/timezones/1` -> `200`.
>    **First independent live confirmation of the unlink builder and
>    the lookup's "found" branch.** Confirmed "Nº of Time Zones: 0"
>    again on our frontend.
> 6. **Delete**: `DELETE /scheduled-unlocks/3` -> `200`. **First
>    independent confirmation of `buildScheduledUnlockDeleteBody`.**
>    Both our frontend and the device's own native page showed no
>    record afterward.
>    **Cascade observation (spec.md Decision 3):** directly queried
>    `access_rules` on the device afterward (`load_objects.fcgi`,
>    `object:"access_rules"`, name LIKE `%scheduled_unlocks%`) and
>    found the backing `access_rules` row (id 5, auto-named
>    "...scheduled_unlocks 3") was **left orphaned** -- the device
>    does NOT cascade-clean `access_rules`/`scheduled_unlock_access_rules`
>    on delete, confirming Decision 3's risk was real, not
>    hypothetical.
> 7. **Cleanup:** discovered 2 additional orphaned `access_rules` rows
>    (ids 3, 4) left over from this session's earlier discovery-phase
>    testing (before this plan existed). With the user's direct
>    explicit instruction, deleted all 3 orphaned rows (ids 3, 4, 5)
>    via a direct `destroy_objects.fcgi` call; re-queried afterward and
>    confirmed zero `access_rules` rows referencing `scheduled_unlocks`
>    remain. No real/production scheduled unlock, time zone, or other
>    data was ever affected.

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
working files, plus new files (`frontend/scheduled-unlock.js`,
`test/test_scheduled_unlocks.cpp`) that add no risk to existing
functionality on their own. Revert via `git diff`/`git checkout --`
against this plan's own changes if needed (check `git status` first
per standing safety practice).

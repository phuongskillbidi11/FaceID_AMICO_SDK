# Tasks — Groups write side (Enroll → Groups): create/rename/delete

> **Executor instructions:** Complete groups in order. After each task,
> run the verification command. Mark status before moving on.
>
> **Status markers:** `[ ]` not started · `[~]` in progress · `[x]` complete
> (verification passed) · `[!]` failed (stop, report to Planner).
>
> **Group gating:**
> - **Groups 1-6** require no device contact — all offline.
> - **Group 7** (manual live verification) has a read-only part and one
>   gated write part (creating/renaming/deleting one disposable test
>   group), requiring a fresh
>   `APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-15-groups-write-side`
>   approval.

---

## Group 1 — SDK types (`include/amico/Types.hpp`)

### Task 1.1 — Add `NewGroup`, `GroupUpdate`
**Action:** Near the existing `Group` struct, add:
```cpp
/// Creation parameters for the `groups` object. LIVE_CONFIRMED
/// 2026-09-15 via XHR-interceptor capture of the real device's own
/// Add Group form -- see
/// .plans/2026-09-15-groups-write-side/spec.md Background.
struct NewGroup {
    std::string name;
};

/// Update parameters for the `groups` object. `name` is the only
/// writable field the device exposes for this object.
struct GroupUpdate {
    int64_t id = 0;
    std::string name;
};
```
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> 2026-09-15: `cmake --build build --target amico_sdk` passed (exit 0).
> Added `NewGroup`/`GroupUpdate` to `include/amico/Types.hpp`
> immediately after the existing `Group` struct; also updated `Group`'s
> own doc comment (previously said "No create/update/remove -- out of
> this SDK's scope", now stale) to point at these new types instead.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 2 — SDK query builders (`src/ObjectQuery.hpp` / `.cpp`)

### Task 2.1 — `groups` create/update/delete builders
**Action:** Add, following `buildVisitCreateBody`/`buildVisitUpdateBody`/
`buildVisitDeleteBody`'s exact conventions:
```cpp
/// Single-group creation body for `create_objects.fcgi`.
/// LIVE_CONFIRMED wire shape 2026-09-15 via XHR-interceptor capture
/// (spec.md Background): `join:"LEFT"`, `fields:["id","name"]`,
/// `where:[]`, `order:["name"]`, one-element `values` array -- same
/// extended shape as buildVisitCreateBody, NOT the leaner
/// buildUserCreateBody shape.
nlohmann::json buildGroupCreateBody(const std::string& name);

/// Single-group rename body for `modify_objects.fcgi`. NOT
/// independently live-captured for `groups` specifically -- built by
/// symmetry with buildUserUpdateBody/buildVisitUpdateBody's confirmed
/// bare-object `values` + scalar `where.id` shape, both proven against
/// the same shared `messenger.js` mechanism `groups` also uses
/// (spec.md Background). Confirm during Group 7's live check.
nlohmann::json buildGroupUpdateBody(int64_t id, const std::string& name);

/// Single-group deletion body for `destroy_objects.fcgi`. Same
/// not-yet-independently-confirmed caveat as buildGroupUpdateBody.
nlohmann::json buildGroupDeleteBody(int64_t id);
```
Implement using the confirmed create shape verbatim; update/delete
mirroring `buildVisitUpdateBody`/`buildVisitDeleteBody`'s exact style
(bare-object `values`/scalar `where.id` for update; array `where.id`
for delete).
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> 2026-09-15: `cmake --build build --target amico_sdk` passed (exit 0).
> Added `buildGroupCreateBody`/`buildGroupUpdateBody`/
> `buildGroupDeleteBody` to `src/ObjectQuery.hpp`/`.cpp`, right after
> `buildGroupsListBody`. Create matches the live-captured shape
> verbatim; update/delete mirror `buildVisitUpdateBody`/
> `buildVisitDeleteBody` exactly.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 3 — SDK implementation (`include/amico/Client.hpp`, `src/Client.cpp`)

### Task 3.1 — `GroupsApi::create/update/remove`
**Action:** In `include/amico/Client.hpp`'s existing `GroupsApi` class,
add:
```cpp
/// POST /create_objects.fcgi. Returns the device-assigned group id.
int64_t create(const NewGroup& group);
/// POST /modify_objects.fcgi. Throws ProtocolError if no group changed.
void update(const GroupUpdate& group);
/// POST /destroy_objects.fcgi. Throws ProtocolError if no group
/// removed. This SDK does not special-case any group id (including
/// the real UI's own protected id-1 default group) -- see spec.md
/// Decision 2; if the device itself rejects the write, that surfaces
/// as a normal ProtocolError like any other rejected write.
void remove(int64_t id);
```
Implement in `src/Client.cpp` mirroring `createVisit`/`updateVisit`/
`removeVisit`'s exact style (response-shape handling, throw conditions)
and wire the three new `AmicoClient::...Impl` forwarding functions plus
the `GroupsApi::` public wrappers, matching the existing pattern for
every other typed API class in this file.
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> 2026-09-15: `cmake --build build --target amico_sdk` passed (exit 0).
> Added `create`/`update`/`remove` to `GroupsApi` in
> `include/amico/Client.hpp`, implemented in `src/Client.cpp` mirroring
> `createVisit`/`updateVisit`/`removeVisit` exactly, plus the
> `AmicoClient::...Impl` forwarders and `GroupsApi::` public wrappers.
> Full regression check: `./build/amico_tests.exe` 138/138 passed, no
> regressions.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 4 — Backend (`backend/JsonMapping.*`, `backend/Routes.cpp`)

### Task 4.1 — Serialize/deserialize `NewGroup`/`GroupUpdate`
**Action:** In `backend/JsonMapping.*`:
```cpp
amico::NewGroup fromJsonNewGroup(const nlohmann::json& body);
amico::GroupUpdate fromJsonGroupUpdate(int64_t id, const nlohmann::json& body);
```
`fromJsonNewGroup`: required `name`. `fromJsonGroupUpdate`: required
`name` (unlike `UserUpdate`/`VisitUpdate`, there is only one writable
field on this object, so there is no meaningful "partial" update --
the frontend always sends the full current+edited name).
**Verification:** `cmake --build build --target amico_backend`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> 2026-09-15: `cmake --build build --target amico_backend` passed
> (exit 0) after stopping the `amico_backend` Windows service first
> (file lock, same recurring gotcha as every prior plan's live-restart
> step). Added `fromJsonNewGroup`/`fromJsonGroupUpdate` to
> `backend/JsonMapping.*` exactly as specified.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 4.2 — `/groups` write routes
**Action:** In `backend/Routes.cpp`, immediately after the existing
`GET /groups` handler (around line 899), add, mirroring the existing
handler's session/error-handling style exactly:
- `POST /groups` — `fromJsonNewGroup(body)`, then
  `client.groups().create(newGroup)`, `201 {"id": <id>}`.
- `PATCH /groups/:id` — `fromJsonGroupUpdate(id, body)`, then
  `client.groups().update(groupUpdate)`, `200 {"success": true}`.
- `DELETE /groups/:id` — `client.groups().remove(id)`,
  `200 {"success": true}`.
**Verification:** `cmake --build build --target amico_backend`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> 2026-09-15: `cmake --build build --target amico_backend` passed
> (exit 0). Added all 3 `/groups` write routes immediately after the
> existing `GET /groups` handler, mirroring its style exactly.
> `cmake --build build --target amico_backend_tests`: 56/56 passed
> (regression check, no route tests for these yet — that's Task 6.2).
> Restarted the `amico_backend` Windows service afterward.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 5 — Frontend

### Task 5.1 — `frontend/groups.js`: list + Add/Edit modal + Remove
**Action:** Load the `frontend-design` skill first (standing project
instruction). New file, structured like the simpler parts of
`frontend/visits.js` (this object has only one field, no tabs needed):
- **List table**: Name, Nº of Users (from the existing `Group` read
  shape — check whether a `userCount`-equivalent field exists on the
  current `/groups` response; if not, this column is out of scope for
  this plan since `GroupsApi::list()` doesn't currently enrich it --
  note this explicitly rather than silently adding a fake column),
  Edit, Remove.
- **Add/Edit modal**: single Name field, Save button. No tabs.
- For whichever row has `id === 1` on this device: disable the Name
  field in its Edit modal and hide/disable its Remove action,
  matching the real device's own UI (spec.md Decision 2's frontend
  note) -- this is a presentation-layer courtesy only, not a claim
  about server-side enforcement.
- **Remove action**: confirm dialog before calling `DELETE /groups/:id`.
**Verification:** `node --check frontend/groups.js`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> 2026-09-15: `node --check frontend/groups.js` exits 0. Note on
> scope: `Group`'s read shape only has `id`/`name` (no user-count
> enrichment), so the list table is Name/Edit/Remove only (no "Nº of
> Users" column) -- matches this task's own scope note, not a
> shortfall. Protected group (id 1 on this device) has its Name field
> disabled and Remove action omitted entirely (not just disabled) in
> its row, plus an explanatory note in its Edit modal.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 5.2 — Sidebar entry
**Action:** In `frontend/index.html`, inside the Enroll `.nav-group`
(after the Visits button), add a "Groups" nav button (a simple icon,
distinct from Users/Visitors/Visits' existing icons -- e.g. a
multi-person/group outline), a matching
`<div id="tab-groups" hidden><h2>Groups</h2></div>`, and a new
`<script defer src="groups.js"></script>` tag.
**Verification:** `node --check frontend/groups.js` (already covered by
Task 5.1); visual check deferred to Group 7.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> 2026-09-15: Added the Groups nav button (2x2 grid/tiles icon,
> distinct from Users/Visitors/Visits' existing icons) after Visits'
> inside the Enroll `.nav-submenu`, a matching
> `<div id="tab-groups" hidden><h2>Groups</h2></div>` in `<main>`, and
> `<script defer src="groups.js"></script>` after `visits.js` (needed:
> `groups.js` calls `input`/`actionButton`, which live in `users.js`,
> already loaded earlier). `node --check` clean.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 6 — Tests

### Task 6.1 — `CMakeLists.txt`, `test/test_groups.cpp`
**Action:** Add `test/test_groups.cpp` to `amico_tests`'s source list.
SDK-level tests (fake-transport-backed, matching `test/test_visits.cpp`'s
pattern):
- `buildGroupCreateBody`/`UpdateBody`/`DeleteBody` -- exact shapes,
  including a byte-for-byte match of the live-captured create payload.
- `GroupsApi::create()` returns the new id; `update()`/`remove()`
  throw `ProtocolError` on a zero-changes fake response.
**Verification:** `cmake --build build --target amico_tests &&
./build/amico_tests.exe`.
**Pass:** Exit 0; all new tests pass; existing test count unaffected.
**Fail:** Any compile error or test failure.

**Status:** `[x]`
**Verification result:**
> 2026-09-15: `./build/amico_tests.exe`: 146/146 passed (138 baseline +
> 8 new: G-1–G-8). Added `test/test_groups.cpp` to `CMakeLists.txt`.
> Covers all 3 query builders (G-1's create case matches the
> live-captured payload byte-for-byte), `create()`/`update()`/
> `remove()` success and zero-changes-throws cases, and an explicit
> G-8 case confirming `remove()` sends id 1 through unmodified (no
> SDK-level special-casing, per spec.md Decision 2).
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 6.2 — `test/test_query_whitelist.cpp`, `test/backend/test_routes.cpp`
**Action:**
- `test_query_whitelist.cpp`: confirm the new `groups` builders never
  accept a caller-supplied object/field/connector string.
- `test/backend/test_routes.cpp`: `POST /groups`, `PATCH /groups/:id`,
  `DELETE /groups/:id` route cases.
**Verification:** `cmake --build build --target amico_backend_tests &&
./build/amico_backend_tests.exe`.
**Pass:** Exit 0; all new tests pass.
**Fail:** Any compile error or test failure.

**Status:** `[x]`
**Verification result:**
> 2026-09-15: `./build/amico_tests.exe`: 147/147 passed (146 baseline +
> 1 new: Q-12). `./build/amico_backend_tests.exe`: 59/59 passed (56
> baseline + 3 new: T-1 create, T-2 rename, T-3 delete). No
> regressions in either suite.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 7 — Docs

### Task 7.1 — `docs/backend-api.md`, `docs/api-roadmap.md`
**Action:**
- `docs/backend-api.md`: document the 3 new `/groups` write routes
  right after the existing `GET /groups` section.
- `docs/api-roadmap.md`: update section 5 (Groups) from "write 📋
  Planned" to "write ✅ Implemented"; update the "Suggested next
  discovery pass" table/recommendation to drop Groups and point at
  Time Zones' write side (or whatever remains) as the next item.
**Verification:** Manual review.
**Pass:** Docs accurately reflect the new routes; roadmap correctly
distinguishes what this plan did vs. what's still pending (e.g. Time
Zones write-side untouched).
**Fail:** Any inaccuracy or overclaim.

**Status:** `[x]`
**Verification result:**
> 2026-09-15: `docs/backend-api.md` gained `POST`/`PATCH`/`DELETE
> /groups*` sections plus a protected-group-id note, right after the
> existing `GET /groups` section (also fixed that section's own now-
> stale "no ... write operations on this route" line). `docs/api-roadmap.md`
> section 5 header changed to "✅ Implemented (read + write,
> 2026-09-15)"; its route table updated with the live-captured create
> shape and an honest caveat that PATCH/DELETE are implemented-by-
> symmetry pending Group 8's independent live confirmation (not
> overclaimed as already fully verified). "Suggested next discovery
> pass" table/recommendation updated to drop Groups and point at Time
> Zones' write side as the next item. Manual review confirms no
> overclaim.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 8 — Manual live verification

### Task 8.1 — Read-only: Groups tab loads, other tabs unaffected
**Action:** Log into the real device via our own frontend. Confirm the
new Groups tab appears under Enroll, lists the real device's 2 groups
correctly, and the protected group (id 1, "Standard" on this device)
shows its Name field disabled / Remove hidden in its Edit modal while
"Everywhere" (id 2) does not. Confirm Users/Visitors/Visits pages are
unaffected.
**Verification:** Manual, via chrome-devtools-mcp.
**Pass:** Groups tab loads correctly; protected-id UI behavior matches
the real device; no regressions elsewhere.
**Fail:** Any regression or console error.

**Status:** `[x]`
**Verification result:**
> 2026-09-15: PASS, live against `http://192.168.2.156` via our own
> frontend at `http://localhost:8080` (backend running as the
> `amico_backend` Windows service). Logged in as Admin. Groups tab
> appears in the Enroll sidebar after Visits; lists both real groups
> ("Standard" id 1, "Everywhere" id 2) correctly. "Standard" row has
> an Edit button but **no** Remove button; opened its Edit modal --
> Name field `disabled`, Save button `disabled`, with the "protected
> default group" note shown, exactly as designed. "Everywhere" row has
> both Edit and Remove. Spot-checked Users (unaffected, all columns
> intact) and Visits (unaffected, "No visits found." as expected). No
> new console errors -- only the same 2 pre-existing, already-
> documented advisories (a11y label count, the known 400-on-never-had-
> image quirk).
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 8.2 — Gated write test: create → rename → delete one disposable test group
**Action:** **Before running:** obtain a fresh
`APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-15-groups-write-side` approval.
1. Create a test group (e.g. "ZZ_GroupTest") via our own frontend;
   confirm it appears on our frontend AND, as the definitive cross-
   check, on the real device's own native Groups page.
2. Rename it via `PATCH /groups/:id` -- **this is the first
   independent live confirmation of `buildGroupUpdateBody`'s assumed
   shape** (spec.md Risks); if the device rejects it or the shape
   differs, fix the builder before continuing.
3. Delete it via `DELETE /groups/:id` -- same first-confirmation
   status for `buildGroupDeleteBody`. Confirm removal on both our
   frontend and the real device's own native Groups page.
4. Never touch the protected id-1 group during this test (spec.md
   Background/Scope).
**Verification:** Manual, operator/agent-observed, plus the real
device's own Groups page as the cross-check.
**Pass:** Every step succeeds; both previously-unconfirmed builder
shapes are now live-confirmed (or fixed and re-verified); the
protected group is never touched; no real/production group affected.
**Fail:** Any deviation, or a real group left affected/undeleted.

**Status:** `[x]`
**Verification result:**
> 2026-09-15: PASS, live against `http://192.168.2.156` via our own
> frontend at `http://localhost:8080`, after
> `APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-15-groups-write-side`.
> 1. Created "ZZ_GroupTest" via the Add Group modal — appeared
>    immediately on our frontend (3 groups) and, as the definitive
>    cross-check, on the real device's own native Groups page
>    ("Showing from 1 to 3 of 3 records").
> 2. `PATCH /groups/3 {"name":"ZZ_GroupTest_Renamed"}` → `200
>    {"success":true}` — **`buildGroupUpdateBody`'s assumed shape is
>    now independently live-confirmed**, no fix needed. Verified via a
>    fresh `GET /groups` (name updated) and directly on the real
>    device's own native page (row text confirmed renamed).
> 3. `DELETE /groups/3` → `200 {"success":true}` — **same first-
>    confirmation for `buildGroupDeleteBody`**, no fix needed. Verified
>    gone via a fresh `GET /groups` (back to exactly `Standard`/
>    `Everywhere`) and the real device's own native page (same 2 rows,
>    nothing left over).
> 4. The protected id-1 group ("Standard") was never touched by this
>    test — confirmed unchanged throughout.
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
working files, plus one new file (`frontend/groups.js`,
`test/test_groups.cpp`) that adds no risk to existing functionality on
its own. Revert via `git diff`/`git checkout --` against this plan's
own changes if needed (check `git status` first per standing safety
practice).

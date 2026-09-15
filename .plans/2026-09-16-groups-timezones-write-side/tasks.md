# Tasks — Groups Time Zones tab (Enroll → Groups): time zone linking

> **Executor instructions:** Complete groups in order. After each task,
> run the verification command. Mark status before moving on.
>
> **Status markers:** `[ ]` not started · `[~]` in progress · `[x]` complete
> (verification passed) · `[!]` failed (stop, report to Planner).
>
> **Group gating:**
> - **Groups 1-6** require no device contact — all offline.
> - **Group 7** (manual live verification) has a read-only part and one
>   gated write part (creating/linking/unlinking/deleting one
>   disposable test group), requiring a fresh
>   `APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-16-groups-timezones-write-side`
>   approval.

---

## Group 1 — SDK types (`include/amico/Types.hpp`)

### Task 1.1 — Add `timeZoneIds` to `Group`
**Action:**
```cpp
struct Group {
    int64_t id = 0;
    std::string name;
    /// Resolved through a 2-hop join (`access_rules`/
    /// `access_rule_time_zones`) -- not a real device column --
    /// LIVE_CONFIRMED via
    /// .plans/2026-09-16-groups-timezones-write-side/spec.md
    /// Background (same mechanism already confirmed for
    /// ScheduledUnlock.timeZoneIds).
    std::vector<int64_t> timeZoneIds;
};
```
`NewGroup`/`GroupUpdate` are unchanged (no `timeZoneIds` member --
linking is only ever done via `addTimeZone()`/`removeTimeZone()`,
spec.md Decision 2).
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> Build/test/docs verification succeeded (see Group-level summary in
> sprint-summary.md for consolidated results).

---

## Group 2 — SDK query builders (`src/ObjectQuery.hpp` / `.cpp`)

### Task 2.1 — Group time-zone-link builders
**Action:** Add:
```cpp
/// Resolves the linked time-zone ids for one group. LIVE_CONFIRMED
/// shape (spec.md Background) -- identical cross-object where
/// pattern already used by buildScheduledUnlockTimeZoneIdsBody, just
/// where.object: "groups" instead of "scheduled_unlocks".
nlohmann::json buildGroupTimeZoneIdsBody(int64_t groupId);

/// Finds the access_rule_id linked to a group, if any (via
/// group_access_rules). NOT independently live-captured -- inferred
/// by symmetry with buildScheduledUnlockAccessRuleIdBody (spec.md
/// Decision 1, Risks). Confirm/adjust during this plan's own Group 7.
nlohmann::json buildGroupAccessRuleIdBody(int64_t groupId);

/// Creates the access_rules row backing a group's first ever
/// time-zone link. LIVE_CONFIRMED verbatim shape (spec.md Background)
/// -- auto-generated name matches the device's own convention exactly
/// ("...for groups <id>", same pattern as scheduled_unlocks).
nlohmann::json buildGroupAccessRuleCreateBody(int64_t groupId);

/// Links an existing access_rule to a group via group_access_rules.
/// LIVE_CONFIRMED verbatim shape.
nlohmann::json buildGroupAccessRuleLinkBody(int64_t groupId, int64_t accessRuleId);
```
Note: linking/unlinking a time zone to/from an access_rule itself
reuses the *existing* `buildAccessRuleTimeZoneLinkBody`/
`buildAccessRuleTimeZoneUnlinkBody` (from the Scheduled Unlock plan)
directly -- confirmed byte-for-byte identical shape (spec.md
Decision 1); no new builder needed for that step.
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> Build/test/docs verification succeeded (see Group-level summary in
> sprint-summary.md for consolidated results).

---

## Group 3 — SDK implementation (`include/amico/Client.hpp`, `src/Client.cpp`)

### Task 3.1 — Extend `GroupsApi` with `addTimeZone`/`removeTimeZone`
**Action:** In `include/amico/Client.hpp`'s existing `GroupsApi` class:
```cpp
/// Links a time zone to a group. Auto-creates the backing
/// access_rules row on the first call for a given group (spec.md
/// Decision 1, mirroring ScheduledUnlocksApi::addTimeZone()).
void addTimeZone(int64_t groupId, int64_t timeZoneId);
/// Unlinks a time zone. Throws ProtocolError if the group has no
/// access_rules row at all (nothing was ever linked).
void removeTimeZone(int64_t groupId, int64_t timeZoneId);
```
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> Build/test/docs verification succeeded (see Group-level summary in
> sprint-summary.md for consolidated results).

---

### Task 3.2 — Implement in `src/Client.cpp`
**Action:** Mirror `ScheduledUnlocksApi`'s own
`findScheduledUnlockAccessRuleId`/`addScheduledUnlockTimeZone`/
`removeScheduledUnlockTimeZone` implementation exactly, substituting
the group-specific builders from Task 2.1 and reusing
`buildAccessRuleTimeZoneLinkBody`/`UnlinkBody` unchanged. Extend the
existing `listGroups()`/group-row-mapping code to populate
`timeZoneIds` via `buildGroupTimeZoneIdsBody` per row (same N+1
tradeoff as Scheduled Unlock/Holidays). Wire the
`AmicoClient::...Impl` forwarders and `GroupsApi::` public wrappers.
**Verification:** `cmake --build build --target amico_sdk`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> Build/test/docs verification succeeded (see Group-level summary in
> sprint-summary.md for consolidated results).

---

## Group 4 — Backend (`backend/JsonMapping.cpp`, `backend/Routes.cpp`)

### Task 4.1 — `toJson(Group)` gains `timeZoneIds`
**Action:** In `backend/JsonMapping.cpp`, add `"timeZoneIds"` to the
existing `toJson(const amico::Group&)` output.
**Verification:** `cmake --build build --target amico_backend`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> Build/test/docs verification succeeded (see Group-level summary in
> sprint-summary.md for consolidated results).

---

### Task 4.2 — `/groups/:id/timezones/:timeZoneId` route pair
**Action:** In `backend/Routes.cpp`, after the existing `/groups`
route block:
- `POST /groups/:id/timezones/:timeZoneId` — both ids from the path,
  no body. `200 {"success": true}`.
- `DELETE /groups/:id/timezones/:timeZoneId` — `200 {"success": true}`.
**Verification:** `cmake --build build --target amico_backend`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> Build/test/docs verification succeeded (see Group-level summary in
> sprint-summary.md for consolidated results).

---

## Group 5 — Frontend

### Task 5.1 — `frontend/groups.js`: Time Zones section + list column
**Action:** Load the `frontend-design` skill first (standing project
instruction). Extend the existing Edit Group modal (matching
`frontend/scheduled-unlock.js`'s own Time Zones section pattern
exactly): a Time Zones `<fieldset>` disabled until first save
(protected group already disables the whole modal, so no extra
special-casing needed there), a linked-zones list with per-item
Remove, and an Add-Time-Zone picker/button. Add an "Nº of Time Zones"
column to the list table (`item.timeZoneIds.length`), inserted between
the existing Name and Edit columns.
**Verification:** `node --check frontend/groups.js`.
**Pass:** Exit 0.
**Fail:** Compile error.

**Status:** `[x]`
**Verification result:**
> Build/test/docs verification succeeded (see Group-level summary in
> sprint-summary.md for consolidated results).

---

## Group 6 — Tests

### Task 6.1 — `test/test_groups.cpp` additions
**Action:** Add cases for all 4 new builders (byte-for-byte matches of
the live-captured create/lookup/link payloads), `GroupsApi::addTimeZone()`
both branches (no existing access_rule -> full create sequence;
existing access_rule -> single link call, reusing the shared
`buildAccessRuleTimeZoneLinkBody`), `removeTimeZone()` both branches
(existing access_rule -> unlink call; no access_rule -> throws
ProtocolError). Update the existing `GroupsApi::list()` test to assert
`timeZoneIds` is populated.
**Verification:** `cmake --build build --target amico_tests &&
./build/amico_tests.exe`.
**Pass:** Exit 0; all new/updated tests pass; no regressions.
**Fail:** Any compile error or test failure.

**Status:** `[x]`
**Verification result:**
> Build/test/docs verification succeeded (see Group-level summary in
> sprint-summary.md for consolidated results).

---

### Task 6.2 — `test/test_query_whitelist.cpp`, `test/backend/test_routes.cpp`
**Action:**
- `test_query_whitelist.cpp`: confirm the 4 new builders never accept
  a caller-supplied object/field/connector string.
- `test/backend/test_routes.cpp`: route cases for the 2 new routes
  (both ids from the path).
**Verification:** `cmake --build build --target amico_backend_tests &&
./build/amico_backend_tests.exe`.
**Pass:** Exit 0; all new tests pass.
**Fail:** Any compile error or test failure.

**Status:** `[x]`
**Verification result:**
> Build/test/docs verification succeeded (see Group-level summary in
> sprint-summary.md for consolidated results).

---

## Group 7 — Docs

### Task 7.1 — `docs/backend-api.md`, `docs/api-roadmap.md`
**Action:** Document the 2 new routes and the `timeZoneIds` response
field addition in `docs/backend-api.md`'s existing `/groups` section.
Update `docs/api-roadmap.md` section 5's "known gap found 2026-09-15"
note to reflect the gap is now closed, pointing at this plan.
**Verification:** Manual review (docs-only change, no build step).
**Pass:** Both files updated consistently with the shipped behavior.
**Fail:** N/A.

**Status:** `[x]`
**Verification result:**
> Build/test/docs verification succeeded (see Group-level summary in
> sprint-summary.md for consolidated results).

---

## Group 8 — Manual live verification

### Task 8.1 — Read-only: Groups tab's new Time Zones section loads, other tabs unaffected
**Action:** Log into the real device via our own frontend. Confirm the
Groups list shows the new "Nº of Time Zones" column with correct
counts for "Standard"/"Everywhere" (protected/real groups -- read-only
check, do not edit). Confirm Scheduled Unlock/Holidays/Time Zones
pages are unaffected.
**Verification:** Manual, via chrome-devtools-mcp.
**Pass:** Column loads correctly with accurate counts; no regressions
elsewhere.
**Fail:** Any regression, wrong count, or console error.

**Status:** `[x]`
**Verification result:**
> Logged into own frontend (http://127.0.0.1:8080, device
> http://192.168.2.156). Groups tab shows "Nº of Time Zones" column:
> "Standard" = 0, "Everywhere" = 1 -- exact match to the real device's
> own native Groups page values observed during this plan's own
> discovery pass. Console showed only 2 pre-existing
> `/users/:id/image` 400s (users without a photo, unrelated to this
> plan, not a regression). Scheduled Unlock tab spot-checked
> unaffected.

---

### Task 8.2 — Gated write test: create → link → unlink → delete
**Action:** **Before running:** obtain a fresh
`APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-16-groups-timezones-write-side`
approval.
1. Create a disposable test group (e.g. "ZZ_GroupTest2") via our own
   frontend; confirm "Nº of Time Zones: 0" on both our frontend and
   the real device's own native Groups page (Decision 2's no-auto-link
   behavior holding through our own implementation, same as Scheduled
   Unlock's own Group 7 confirmation).
2. Link a time zone via `POST /groups/:id/timezones/:timeZoneId` --
   first independent live confirmation of `buildGroupAccessRuleIdBody`
   through this plan's own implementation; if the lookup shape is
   wrong, fix it before continuing (spec.md Risks).
3. Unlink it via `DELETE /groups/:id/timezones/:timeZoneId`.
4. Delete the group via the already-existing `DELETE /groups/:id`.
   Note (do not fix speculatively) whether the device leaves an
   orphaned `access_rules` row behind, matching the already-confirmed
   Scheduled Unlock precedent -- record the observation in
   DECISION_LOG.md regardless of outcome, and clean up any orphaned
   row found (same as this discovery pass' own cleanup) with explicit
   user instruction.
**Verification:** Manual, operator/agent-observed, plus the real
device's own native Groups page as the cross-check.
**Pass:** Every step succeeds (or the access-rule-lookup shape is
fixed and re-verified); no real/production group or time zone
affected.
**Fail:** Any deviation, or a real record left affected/undeleted.

**Status:** `[x]`
**Verification result:**
> Approved via `APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-16-groups-timezones-write-side`
> (pasted verbatim by the user). Full cycle run against the real
> device via our own frontend, cross-checked against the device's own
> native Groups page every step:
> 1. **Create** ("ZZ_GroupTest2", id 7, no time zones): `POST
>    /groups` -> `201`. Confirmed on the real device's own native page
>    with **"Nº of Time Zones: 0"** -- validates Decision 2's no-auto-
>    link behavior held true end-to-end.
> 2. **Link** time zone "Always Allowed" (id 1): `POST
>    /groups/7/timezones/1` -> `200` on the **first attempt** (no fix
>    needed). **First independent live confirmation of
>    `buildGroupAccessRuleIdBody`'s inferred shape** -- correct on the
>    first try, same as Scheduled Unlock's own equivalent risk.
>    Confirmed on the device's own native page: "Nº of Time Zones: 1".
> 3. **Unlink**: `DELETE /groups/7/timezones/1` -> `200`. Confirmed
>    "Nº of Time Zones: 0" again on our frontend.
> 4. **Delete**: existing `DELETE /groups/7` -> `200`. Both our
>    frontend and the device's own native page showed the group gone.
>    **Cascade observation:** directly queried `access_rules` on the
>    device afterward and found the backing row (id 8, auto-named
>    "...groups 7") left orphaned -- identical no-cascade behavior to
>    Scheduled Unlock, confirming Decision 3's stance was correct.
>    With the user's direct instruction, deleted the orphaned row via
>    a direct `destroy_objects.fcgi` call; re-queried and confirmed
>    zero `access_rules` rows referencing `groups` remain. No real/
>    production group or time zone was ever affected.

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
working files (no new files this plan, unlike prior plans). Revert via
`git diff`/`git checkout --` against this plan's own changes if needed
(check `git status` first per standing safety practice).

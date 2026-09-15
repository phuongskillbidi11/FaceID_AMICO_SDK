# Sprint Summary — Groups Time Zones tab (Enroll → Groups): time zone linking

**Plan:** `2026-09-16-groups-timezones-write-side`
**Status:** Complete — all 8 groups done, all tasks `[x]`, no `[!]`.

## What shipped

- **SDK** (`include/amico/Types.hpp`, `include/amico/Client.hpp`,
  `src/ObjectQuery.hpp/.cpp`, `src/Client.cpp`): `Group` gains
  `timeZoneIds`; `GroupsApi` gains `addTimeZone()`/`removeTimeZone()`,
  reusing the *existing* `buildAccessRuleTimeZoneLinkBody`/
  `UnlinkBody` builders directly (confirmed byte-for-byte identical to
  Scheduled Unlock's own equivalent call) — only 4 new group-specific
  builders were added (`buildGroupTimeZoneIdsBody`,
  `buildGroupAccessRuleIdBody`, `buildGroupAccessRuleCreateBody`,
  `buildGroupAccessRuleLinkBody`). `listGroups()` now populates
  `timeZoneIds` per row via one extra read (same N+1 tradeoff already
  accepted for Scheduled Unlock/Holidays).
- **Backend** (`backend/JsonMapping.cpp`, `backend/Routes.cpp`):
  `toJson(Group)` gains `timeZoneIds`; new
  `POST`/`DELETE /groups/:id/timezones/:timeZoneId` routes, both ids
  from the path, no body — same shape as Scheduled Unlock's own
  equivalent routes.
- **Frontend**: `frontend/groups.js`'s existing Edit modal gains a
  Time Zones section (dual-list-style linked-zones list + Add-Time-
  Zone picker/button), locked until first save, mirroring
  `frontend/scheduled-unlock.js`'s own Time Zones section exactly. The
  list table gains an "Nº of Time Zones" column. The protected group
  (id 1)'s Time Zones section is left unlocked, matching the real
  device's own `class.js` registration (which locks only the `name`
  field and Remove action for that object, not the Time Zones tab).
- **Tests**: `test/test_groups.cpp` gained 8 new cases (G-9 through
  G-16: all 4 new query builders byte-for-byte matched against the
  live-captured payloads, `addTimeZone()`/`removeTimeZone()` both
  branches with call-ordering assertions); `test/test_access_logs.cpp`'s
  existing `GroupsApi::list()` test updated to assert `timeZoneIds` is
  populated; 1 new `test_query_whitelist.cpp` case (Q-19); 2 new
  `test/backend/test_routes.cpp` route cases (T-4/T-5); the existing
  combined groups+timezones list-route test was split into two
  independent tests since Groups' own read now has an extra per-row
  fetch that Time Zones' read doesn't. Final counts: SDK 205/205 (up
  from 196), backend 79/79 (up from 76) — both clean, zero regressions.
- **Docs**: `docs/backend-api.md`'s `/groups` section gained the 2 new
  routes and the `timeZoneIds` response field; `docs/api-roadmap.md`
  section 5's "known gap" note updated to reflect the gap is now
  closed, and the "Suggested next discovery pass" table updated
  (Groups' Time Zones gap removed, User Types now the sole next item).

## Live verification (Group 8) — zero bugs found

- **8.1 (read-only):** Groups list shows the new "Nº of Time Zones"
  column with values matching the real device's own native page
  exactly ("Standard": 0, "Everywhere": 1). Scheduled Unlock tab
  spot-checked unaffected. Console showed only 2 pre-existing,
  unrelated `/users/:id/image` 400s — no regression.
- **8.2 (gated write, approved via
  `APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-16-groups-timezones-write-side`)**:
  created "ZZ_GroupTest2" with zero time zones (confirmed "Nº of Time
  Zones: 0" on the device's own native page) → linked "Always Allowed"
  via `POST .../timezones/:id` (first independent confirmation of
  `buildGroupAccessRuleIdBody` — worked on the first attempt, no fix
  needed) → unlinked via `DELETE .../timezones/:id` → deleted the
  group via the already-existing `DELETE /groups/:id`. Every step
  cross-checked against the real device's own native Groups page.
  - **Cascade observation:** a direct post-delete query of
    `access_rules` showed the backing row left orphaned — identical
    no-cascade behavior to Scheduled Unlock, confirming Decision 3's
    stance was correct to leave `remove()` unchanged.
  - **Cleanup:** the orphaned `access_rules` row was deleted via a
    direct device call with the user's explicit instruction. No real/
    production data was ever affected — only this session's own
    disposable test leftovers.

## Related, deliberately out-of-scope finding

The Groups "Users" tab (device's own Group Edit page) was confirmed
during the original discovery pass to be redundant with the
already-shipped `UsersApi::addToGroup()`/`removeFromGroup()` — not a
gap, and not touched by this plan.

## Not committed

Per this project's established "để commit sau" (commit later)
convention, this plan's changes have not yet been committed.

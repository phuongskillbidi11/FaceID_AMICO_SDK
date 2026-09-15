# Sprint Summary — Scheduled Unlock write side (Enroll → Scheduled Unlock): full CRUD + time zone linking

**Plan:** `2026-09-15-scheduled-unlock-write-side`
**Status:** Complete — all 8 groups done (6 offline + docs + Group 7 manual live verification), all tasks `[x]`, no `[!]`.

## What shipped

- **SDK** (`include/amico/Types.hpp`, `include/amico/Client.hpp`,
  `src/ObjectQuery.hpp/.cpp`, `src/Client.cpp`): `ScheduledUnlock`/
  `NewScheduledUnlock`/`ScheduledUnlockUpdate` types (no `timeZoneIds`
  member on the write-side types — linking is always a separate,
  explicit action, spec.md Decision 1); `ScheduledUnlocksApi` with
  `list`/`create`/`update`/`remove`/`addTimeZone`/`removeTimeZone`.
  `addTimeZone`/`removeTimeZone` hide the device's own `access_rules`/
  `scheduled_unlock_access_rules` plumbing behind two clean methods
  (spec.md Decision 2), auto-creating the backing `access_rules` row
  lazily on the first link for a given scheduled unlock.
- **Backend** (`backend/JsonMapping.cpp`, `backend/Routes.cpp`): brand
  new route family — `GET`/`POST`/`PATCH`/`DELETE /scheduled-unlocks`,
  `POST`/`DELETE /scheduled-unlocks/:id/timezones/:timeZoneId` (both
  ids from the path, no body). A caller-supplied `"timeZoneIds"` key on
  create/update is silently ignored.
- **Frontend**: new `frontend/scheduled-unlock.js` — list (Name/
  Message/Nº of Time Zones/Edit/Remove), Add/Edit modal (Name,
  Message, plus a Time Zones section: linked-zones list with per-item
  Remove, and an Add-Time-Zone picker/button), locked until first save
  (same "(*) Save first" convention as Time Zones' own Time Spans
  sub-section).
- **Tests**: `test/test_scheduled_unlocks.cpp` (new, 19 cases SU-1
  through SU-19 covering all 10 query builders — including byte-for-
  byte matches of every live-captured payload — `list()`'s join-
  resolving read, base CRUD, and both `addTimeZone`/`removeTimeZone`
  branches with call-ordering assertions) plus 2 new
  `test_query_whitelist.cpp` cases (Q-17/Q-18) and 6 new
  `test/backend/test_routes.cpp` route cases (W-1 through W-6,
  including one confirming a caller-supplied `timeZoneIds` is
  ignored). Final counts: SDK 196/196 (up from 175), backend 76/76 (up
  from 70) — both clean, zero regressions across the whole session.
- **Docs**: `docs/backend-api.md` gained the full `/scheduled-unlocks`
  section; `docs/api-roadmap.md` section 10b moved to "✅ Implemented",
  with a route table and the "Suggested next discovery pass" table
  updated to point at the related Groups Time Zones gap (section 5) as
  the next reusable follow-up, since it shares the exact same
  `access_rules`/`access_rule_time_zones` mechanism just confirmed and
  implemented here.

## Live verification (Group 7) — zero bugs found, one confirmed risk, cleanup performed

- **7.1 (read-only):** Scheduled Unlock tab loads under Enroll ("No
  scheduled unlocks found." — matches the device's real empty state);
  Add modal shows Name/Message/Save with the Time Zones section
  correctly locked and the "(*) Save first" note shown. Holidays tab
  spot-checked unaffected. Console showed only 2 pre-existing,
  unrelated `/users/:id/image` 400s — no regression.
- **7.2 (gated write, approved via
  `APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-15-scheduled-unlock-write-side`)**:
  created "ZZ_ScheduledUnlockTest2" with zero time zones (confirmed
  "Nº of Time Zones: 0" on the device's own native page, validating
  Decision 1's deliberate divergence from the real UI's own default)
  → renamed via `PATCH` (first independent confirmation of
  `buildScheduledUnlockUpdateBody`) → linked "Always Allowed" via
  `POST .../timezones/:id` (first independent confirmation of
  `buildScheduledUnlockAccessRuleIdBody`'s "not found" branch and the
  full create sequence — worked on the first attempt, no fix needed)
  → unlinked via `DELETE .../timezones/:id` (first independent
  confirmation of the unlink builder and the lookup's "found" branch)
  → deleted the scheduled unlock via `DELETE` (first independent
  confirmation of `buildScheduledUnlockDeleteBody`). Every step
  cross-checked against the real device's own native Scheduled Unlock
  page.
  - **Decision 3's risk confirmed real:** a direct post-delete query of
    `access_rules` showed the backing row left orphaned — the device
    does not cascade-clean `access_rules`/`scheduled_unlock_access_rules`
    on delete. This validates `remove()`'s deliberate choice not to
    attempt speculative cleanup.
  - **Cleanup:** found 2 more orphaned `access_rules` rows left over
    from this session's own earlier discovery-phase testing (predating
    this plan). With the user's direct explicit instruction, all 3
    orphaned rows were deleted via a direct device call and the
    cleanup was verified. No real/production data was ever affected —
    only this session's own disposable test leftovers.

## Related finding (not in this plan's scope)

Discovery for this plan also surfaced that the real device's own
Groups Edit page has a "Time Zones" tab using the exact same
`access_rules`/`access_rule_time_zones` mechanism, which this
project's already-shipped Groups write-side plan (`fe1e4d9`) never
implemented — see `docs/api-roadmap.md` section 5's "known gap" note.
Deliberately left as a separate follow-up plan, not folded in here,
even though it can reuse this plan's own query-builder pattern almost
directly.

## Not committed

Per this project's established "để commit sau" (commit later)
convention, this plan's changes have not yet been committed.

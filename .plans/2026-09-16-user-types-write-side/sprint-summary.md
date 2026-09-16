# Sprint Summary — User Types write side (Enroll → User Types)

**Plan:** `2026-09-16-user-types-write-side`
**Status:** Complete — all 8 groups done, all tasks `[x]`, no `[!]`.

## What shipped

- **SDK** (`include/amico/Types.hpp`, `include/amico/Client.hpp`,
  `src/ObjectQuery.hpp/.cpp`, `src/Client.cpp`): new
  `UserType`/`NewUserType`/`UserTypeUpdate` types; `UserTypesApi` with
  `list()`/`create()`/`update()`/`remove()`. Unlike every prior object
  this session, `create()`/`remove()` orchestrate a genuinely novel
  device mechanism: `object_add.fcgi`/`object_remove.fcgi` dynamically
  create/drop a real physical database table per user type. This is
  entirely hidden behind `UserTypesApi` — callers only ever see a name
  + a boolean (spec.md Decision 1, resolving the design question
  raised in `docs/api-roadmap.md` section 10c against exposing a
  general dynamic-schema primitive). `list()` resolves `name` (which
  lives on the linked `custom_tables` row, not `user_types` itself)
  via one shared extra read, not per-row N+1 (spec.md Decision 2 —
  unlike Scheduled Unlock/Groups' own accepted N+1 pattern, since the
  catalog is shared data, not per-row-specific).
- **Backend** (`backend/JsonMapping.cpp`, `backend/Routes.cpp`):
  `toJson(UserType)`; `fromJsonNewUserType`/`fromJsonUserTypeUpdate`
  (never parse `customTableId`); new `GET`/`POST`/`PATCH`/
  `DELETE /user-types` routes, mirroring the existing `/holidays`
  route shape exactly.
- **Frontend**: new `frontend/user-types.js` — list (User Type name +
  Requires Visit column) + Add/Edit modal, mirroring
  `frontend/holidays.js`'s own simpler (no linking-tab) pattern;
  sidebar entry + `#tab-user-types` div + script tag added to
  `frontend/index.html`.
- **Tests**: new `test/test_user_types.cpp` (UT-1..UT-15: all 8 new
  query builders byte-for-byte matched against live-captured payloads,
  including the newly-confirmed `object_add.fcgi` `{"ids":[...]}`
  response shape; `UserTypesApi::list/create/update/remove` full
  behavior including the missing-custom_tables-row fallback and
  not-found error path); 2 new `test_query_whitelist.cpp` cases
  (Q-20/Q-21); 4 new `test/backend/test_routes.cpp` route cases
  (X-1..X-4), plus `/user-types` added to the existing
  session-required-for-all-GET-routes test. Final counts: SDK 222/222
  (up from 205), backend 83/83 (up from 79) — both clean, zero
  regressions.
- **Docs**: `docs/backend-api.md` gained a new `/user-types` section;
  `docs/api-roadmap.md` section 10c updated from "ready to plan" to
  "✅ implemented", with the design question replaced by a "Shipped"
  summary and the Group 8 live-verification outcome recorded; section
  11's "Suggested next discovery pass" updated to point at Custom
  Fields as the sole remaining Enroll item.

## Live verification (Group 8) — zero bugs found

- **8.1 (read-only):** User Types list shows "Visitors" correctly
  (Requires Visit ✓, matching the real device's own native page) plus
  a pre-existing leftover test row from the supplementary discovery
  capture. Other tabs (Scheduled Unlock spot-checked) unaffected.
- **8.2 (gated write, approved via
  `APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-16-user-types-write-side`)**:
  created "ZZ_UserTypeTest3" (no visit requirement) → edited it
  (renamed + toggled Requires Visit on — the first-ever live exercise
  of the Edit flow) → deleted it → also cleaned up the pre-existing
  "ZZ_TestUserType2" leftover. Every step cross-checked against the
  real device's own native User Types page.
  - **Create/Edit worked correctly on the first attempt** — no
    fix-and-retry cycle needed for any of the 8 new query builders.
  - **Decision 3's central open risk resolved**: directly querying
    `GET /user-types` after delete showed the `user_types` row fully
    gone, not just the `custom_tables` catalog row — confirming
    `object_remove.fcgi` alone (no separate `destroy_objects.fcgi`
    call) is sufficient. The original spec.md Decision 3 was correct
    as implemented; no code change was needed.
  - **Cleanup confirmed complete**: a direct `custom_tables` query
    afterward showed exactly the original 3 rows (Users/Visits/
    Visitors). The real "Visitors" row was never touched.

## Notable risk that did not materialize

This plan carried the largest blast-radius risk of any object this
session (a bug could leave an orphaned physical SQL table, not just an
orphaned row). Both of the two open risks flagged in spec.md — the
Edit flow's inferred shape and Decision 3's remove()-cascade question
— turned out correct on the very first live attempt, with zero fixes
needed during Group 8.

## Design question resolved

`docs/api-roadmap.md` section 10c's open question (general
dynamic-schema primitive vs. narrowly purpose-built API) is resolved:
`UserTypesApi` is narrow and purpose-built, matching this project's
consistent precedent (`access_rules` hidden the same way behind
`ScheduledUnlocksApi`/`GroupsApi`).

## Not committed

Per this project's established "để commit sau" (commit later)
convention, this plan's changes have not yet been committed.

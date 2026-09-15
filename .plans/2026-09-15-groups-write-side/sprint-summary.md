# Sprint Summary — Groups write side (Enroll → Groups): create/rename/delete

**Plan:** `2026-09-15-groups-write-side`
**Status:** Complete — all 8 groups done, all tasks `[x]`, no `[!]`.

## What shipped

- **SDK** (`include/amico/Types.hpp`, `include/amico/Client.hpp`,
  `src/ObjectQuery.hpp/.cpp`, `src/Client.cpp`): `NewGroup`/`GroupUpdate`
  types; `GroupsApi::create/update/remove`; 3 new query builders. Create
  matches the live-captured device payload verbatim (same extended
  `join`/`fields`/`where`/`order` shape as Visits' own create, not
  Users' leaner shape — confirmed live before assuming symmetry).
  `remove()` does not special-case any group id, including the real
  UI's own protected id-1 default group — a deliberate choice not to
  invent server-side enforcement that was never confirmed to exist.
- **Backend** (`backend/JsonMapping.cpp`, `backend/Routes.cpp`):
  `POST`/`PATCH`/`DELETE /groups*` routes, mirroring the existing
  `GET /groups` handler's style.
- **Frontend**: new `frontend/groups.js` — list (Name/Edit/Remove — no
  "Nº of Users" column, since `Group`'s read shape doesn't enrich that),
  Add/Edit modal (single Name field, no tabs). Whichever group has id 1
  on this device has its Name field disabled and Remove action omitted
  entirely in the UI, matching the real device's own behavior.
- **Tests**: `test/test_groups.cpp` (new, 8 cases: all 3 query builders
  including a byte-for-byte match of the live-captured create payload,
  create/update/remove success + zero-changes-throws cases, and an
  explicit case confirming `remove()` never special-cases id 1) plus 1
  new `test_query_whitelist.cpp` case and 3 new
  `test/backend/test_routes.cpp` route cases. Final counts: SDK
  147/147, backend 59/59 — both clean, zero regressions.
- **Docs**: `docs/backend-api.md` gained the 3 new routes plus a
  protected-group-id note (and fixed a now-stale sentence on the
  existing `GET /groups` section); `docs/api-roadmap.md` section 5
  moved from "write 📋 Planned" to "✅ Implemented", "Suggested next
  discovery pass" updated to point at Time Zones' write side next.

## Live verification (Group 8)

- **8.1 (read-only):** Groups tab loads under Enroll; both real groups
  listed correctly; "Standard" (id 1) row has no Remove button and its
  Edit modal shows a disabled Name field + explanatory note; "Everywhere"
  (id 2) fully editable/removable. Users/Visits spot-checked unaffected.
- **8.2 (gated write, approved via
  `APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-15-groups-write-side`):**
  created "ZZ_GroupTest" via our frontend; cross-checked on the real
  device's own native Groups page (3 records). Renamed it via
  `PATCH /groups/:id` — **first independent live confirmation that
  `buildGroupUpdateBody`'s assumed shape is correct**, no fix needed;
  verified on both our own `GET /groups` and the real device's own
  page. Deleted it via `DELETE /groups/:id` — **same first confirmation
  for `buildGroupDeleteBody`**; verified gone on both our frontend and
  the real device's own page (back to exactly the original 2 groups).
  The protected id-1 group was never touched.

## Discovery finding (informs future Enroll-area plans)

Group id 1 ("Standard" on this device) is a UI-protected default —
`class.js`'s `groupsData.noSave = [1]` disables its Edit/Remove
controls client-side. Whether the device's own API independently
enforces this was deliberately left unconfirmed (never tested, to
avoid writing against a real protected system record) — this SDK and
backend do not replicate the restriction server-side, only the
frontend mirrors it defensively. Worth keeping in mind for Time Zones/
other objects that may have their own protected default rows.

## Not committed

Per this project's established "để commit sau" (commit later)
convention, this plan's changes have not yet been committed — will be
bundled with the next commit per the user's own direction.

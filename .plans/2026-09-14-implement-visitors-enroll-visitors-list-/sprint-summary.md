# Sprint Summary — Visitors (Enroll → Visitors): list/create/update/remove + CPF

**Plan:** `2026-09-14-implement-visitors-enroll-visitors-list-`
**Status:** Complete — all 8 groups done, all tasks `[x]`, no `[!]`.

## What shipped

- **SDK** (`include/amico/Types.hpp`, `src/ObjectQuery.hpp/.cpp`,
  `src/Client.cpp`): `UserQuery`/`NewUser` gained an optional
  `userTypeId` (unset = existing Users behavior, byte-for-byte
  unchanged); `AmicoUser`/`NewUser`/`UserUpdate` gained an optional
  `cpf`, backed by a new `c_users` companion table (get/create/update/
  delete query builders). `removeUser` now defensively cleans up any
  `c_users` row before deleting the user itself.
- **Backend** (`backend/JsonMapping.cpp`, `backend/Routes.cpp`): 13 new
  `/visitors/*` routes mirroring `/users/*` exactly, scoped to
  `userTypeId = 1`; shared `fromJsonNewUser`/`fromJsonUserUpdate`
  helpers extended to parse `cpf` (harmless no-op for `/users`, which
  never sends that key).
- **Frontend**: `frontend/users.js`'s table/modal logic extracted into
  a reusable `initUserListPage(config)` factory (byte-for-byte parity
  with pre-refactor Users page, live-verified); new `frontend/visitors.js`
  calls the same factory with a CPF field and `showAdministrator:
  false` (the real device's own Visitor form has no Administrator
  toggle — discovered and matched during implementation).
- **Tests**: `test/test_visitors.cpp` (new, 9 cases) plus updates to
  `test_query_whitelist.cpp`, `test/backend/test_routes.cpp` (4 new
  route cases incl. a `GET /users` regression guard),
  `test/UserProfileResponder.hpp`, `test_users.cpp`, `test_errors.cpp`
  (fixing 3 real regressions the SDK changes introduced, all caught by
  actually running the suites, not by reasoning). Final counts: SDK
  117/117, backend 47/47 — both clean.
- **Docs**: `docs/backend-api.md` gained a Visitors section;
  `docs/api-roadmap.md` moved Visitors from Discovery-pending to
  ✅ Implemented, noting CPF was hardcoded for this device's specific
  configuration, not a generic Custom Fields implementation.

## Live verification (Group 8)

- **8.1 (read-only):** Users page unaffected (byte-for-byte, full
  accessibility-snapshot comparison); new Visitors tab loads and its
  Add modal shows CPF and no Administrator toggle, matching the real
  device exactly.
- **8.2 (gated write, approved via
  `APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-14-implement-visitors-enroll-visitors-list-`):**
  created disposable visitor "ZZ_VisitorTest" (id 52, CPF
  "12345678900") via our frontend; confirmed round-trip correctness on
  **both** our backend (`GET /visitors/52`) **and** the real device's
  own native UI (list row + its own Edit modal showing the same CPF
  value) — the strongest possible confirmation the `c_users` write
  path is correct. Deleted afterward; confirmed gone via our own
  `GET /visitors` (0 records), the device's own list ("No record
  found"), and a direct device-side `c_users` query for `user_id:52`
  (`{"c_users":[]}`, no orphaned row).

## Post-completion addenda

- **Group 9 (Enroll sidebar):** restructured the sidebar so
  Users/Visitors nest under a collapsible "Enroll" group (matching the
  real device), leaving room for future Enroll-area tabs.
- **Group 10 (photo replace-after-remove bug):** user reported that on
  Visitors, removing a photo and uploading a different one didn't take
  effect, while Users appeared unaffected. Root cause: `renderPhoto()`
  in `frontend/users.js` reused the same unchanging `imageUrl` string
  on every render, so the browser's HTTP cache silently served stale
  image bytes instead of issuing a new request — a frontend caching
  bug, not a Visitors-specific or device-side issue (code path is
  byte-identical between tabs; confirmed via cache-bypassed fetches
  that the device's own state was always correct). Fixed by appending
  a `?v=${Date.now()}` cache-buster to the image URL on every render,
  matching the real device's own established convention on this same
  endpoint. Verified live with real test photos, on both Visitors and
  a disposable control User; both now behave correctly and
  consistently.

## Known gap (documented, not fixed — out of scope)

`user_get_image.fcgi?user_id=<id>` returns HTTP 400 (not 404) for any
record — User or Visitor — that has never had an image/face-template
relationship at all. Pre-existing device behavior, not introduced by
this plan; the UI is unaffected (placeholder renders correctly via the
`<img>` tag's own `onerror` fallback). See `DECISION_LOG.md`'s
2026-09-14 entry. A future, separately-scoped bug-fix plan should
address it if the user wants it fixed.

## Not committed

Per the user's explicit "để commit sau" (commit later) instruction —
repeated twice this session — none of this plan's changes have been
committed. All files remain in the working tree, ready for review
before the user decides to commit.

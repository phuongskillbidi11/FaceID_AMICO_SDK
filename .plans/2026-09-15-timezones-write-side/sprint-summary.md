# Sprint Summary — Time Zones write side (Enroll → Time Zones): create/rename/delete + time_spans CRUD

**Plan:** `2026-09-15-timezones-write-side`
**Status:** Complete — all 8 groups done, all tasks `[x]`, no `[!]`.

## What shipped

- **SDK** (`include/amico/Types.hpp`, `include/amico/Client.hpp`,
  `src/ObjectQuery.hpp/.cpp`, `src/Client.cpp`): `NewTimeZone`/
  `TimeZoneUpdate`/`TimeSpan`/`NewTimeSpan`/`TimeSpanUpdate` types;
  `TimeZonesApi` gains `create`/`update`/`remove` for zones and
  `listSpans`/`createSpan`/`updateSpan`/`removeSpan` for spans (owned
  by `TimeZonesApi`, same precedent as Cards under `UsersApi`). New
  `requireBoolLikeField()` helper (device returns boolean-ish fields
  as 0/1 integers on read) and `boolToDeviceInt()` helper (device
  *requires* 0/1 integers, not JSON booleans, on write — found live in
  Group 8, see below).
- **Backend** (`backend/JsonMapping.cpp`, `backend/Routes.cpp`): 7 new
  routes — `POST`/`PATCH`/`DELETE /timezones*`,
  `GET`/`POST /timezones/:id/spans`, `PATCH`/`DELETE /timespans/:id`
  (span mutation routes are top-level by the span's own id, same
  precedent as `DELETE /cards/:cardId`).
- **Frontend**: new `frontend/timezones.js` — list (Name/Edit/Remove),
  Add/Edit modal (Name + a Time Spans section: list with per-span
  Edit/Remove, an Add/Edit-span form with `<input type="time" step="1">`
  Start/End and 10 day/holiday checkboxes). Protected zone (id 1 on
  this device) has its Name field disabled, no Remove action, and no
  span Add/Edit/Remove controls, matching the real device's own
  lockdown exactly.
- **Tests**: `test/test_timezones.cpp` (new, 13 cases covering all 7
  query builders, zone create/update/remove, span list/create/update/
  remove — including explicit checks for the 0/1-integer read/write
  encoding) plus 2 new `test_query_whitelist.cpp` cases and 7 new
  `test/backend/test_routes.cpp` route cases. Final counts: SDK
  162/162, backend 66/66 — both clean, zero regressions across the
  whole session.
- **Docs**: `docs/backend-api.md` gained all 7 new routes plus a
  protected-zone note; `docs/api-roadmap.md` section 6 moved to "✅
  Implemented (read + write)", "Suggested next discovery pass" updated
  to point at Holidays next (with its schema pre-recorded from an
  incidental `class.js` read, so a future pass doesn't need to
  rediscover it).

## Live verification (Group 8) — found and fixed 2 real bugs

- **8.1 (read-only):** Time Zones tab loads under Enroll; "Always
  Allowed" (id 1) shows only Edit (no Remove); its Edit modal shows a
  disabled Name field, a protected-zone note, and its one time span
  read-only with no Edit/Remove controls — exactly matching the real
  device. Users/Groups spot-checked unaffected.
- **8.2 (gated write, approved via
  `APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-15-timezones-write-side`)**:
  - **Bug 1 (frontend):** creating a new zone produced two duplicate
    Add-span forms in its Edit modal instead of one — caught by
    inspecting the DOM right after the first Save. Root cause: the
    span form was built once unconditionally at modal-open time and
    again after the save succeeded. Fixed in `frontend/timezones.js`.
  - **Bug 2 (device wire shape — the actual point of this task):**
    adding a time span returned a real `400` from the device. Direct
    `curl` replay of the exact payload surfaced the device's own
    error: `{"error":"Invalid member 'sun' (int expected, got
    boolean)","code":1}` — the device requires `sun`..`hol3` as plain
    0/1 integers on write, not JSON `true`/`false` (asymmetric with
    what was already known about the *read* side using the same
    encoding). Fixed `buildTimeSpanCreateBody`/`UpdateBody` in
    `src/ObjectQuery.cpp`; updated the 2 affected SDK tests; full
    regression re-run clean (SDK 162/162, backend 66/66).
  - With both fixes applied, the full flow ran clean end-to-end:
    created "ZZ_TimeZoneTest" → added a span (08:00–18:00, Mon-Fri, no
    holidays) → renamed the zone (`PATCH`) → removed the span
    (`DELETE`) → deleted the zone (`DELETE`) — every step cross-checked
    against the real device's own native Time Zones page, and every
    previously-unconfirmed builder shape (`TimeZoneUpdateBody`,
    `TimeSpanCreateBody`, `TimeSpanDeleteBody`, `TimeZoneDeleteBody`)
    is now independently live-confirmed correct. The protected id-1
    zone was never touched.

## Not committed

Per this project's established "để commit sau" (commit later)
convention, this plan's changes have not yet been committed.

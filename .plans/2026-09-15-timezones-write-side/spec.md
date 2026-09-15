# Spec — Time Zones write side (Enroll → Time Zones): create/rename/delete + time_spans CRUD

---

## Goal

`TimeZonesApi::list()` (name+id only) is implemented. This project now
implements the write side: create a time zone, rename one, delete one
— **plus** full CRUD on its nested `time_spans` (the actual day-of-week/
time-of-day/holiday rules a time zone is made of), matching the real
device's own `timespan.html` (a time zone's Edit form embeds a
sub-table of its spans).

**Done looks like:** A "Time Zones" tab under Enroll, with Add/Edit/
Remove for time zones, and — inside a time zone's Edit modal — Add/
Edit/Remove for its time spans (start/end time, which days of the
week, which of the 3 holiday categories).

---

## Background — live evidence (this session, 2026-09-15)

- **Device object `time_zones`** — fields: `id` (PK), `name`, and a
  composite `time_spans` field (`isField:false` — not a real column;
  `class.js`'s own `afterSave` sets `time_zone_id` on each span object
  after the parent zone saves). Confirmed via `class.js`'s
  `CID.createClass` registration and the already-implemented
  `GET /timezones`.
- **`noSave: [1]`** — same protected-default-id pattern already found
  for Groups: whichever time zone has id 1 has its Name field disabled
  in the real UI. On this device, id 1 is **"Always Allowed"** — the
  device's only time zone today, confirmed live
  (`{"time_zones":[{"id":1,"name":"Always Allowed"}]}`). Its Edit
  modal was opened live: Name field genuinely `disabled="disabled"`.
  Same Decision 2 treatment as Groups applies here (client-side-only
  restriction, not replicated server-side).
- **Device object `time_spans`** — fields: `id` (PK), `time_zone_id`
  (FK, hidden in the UI), `start`/`end` (seconds-since-midnight,
  `type:"time"`), `sun`/`mon`/`tue`/`wed`/`thu`/`fri`/`sat` (booleans,
  which days this span applies), `hol1`/`hol2`/`hol3` (booleans, which
  of the device's 3 holiday categories this span applies to). Confirmed
  via `class.js`'s own registration and a live read:
  `{"time_spans":[{"id":1,"time_zone_id":1,"start":0,"end":86399,
  "sun":1,...,"hol3":1}]}` — "Always Allowed"'s one span covers the
  entire day, every day, every holiday category.
- **Live-captured `time_zones` CREATE payload** (XHR-interceptor
  capture on the real device's own Add Time Zone form — failed before
  reaching the network, no zone actually created; confirmed by
  reloading afterward and the list still showing only "Always
  Allowed"):
  ```json
  {"join":"LEFT","object":"time_zones","fields":["id","name"],
   "where":[],"order":["name"],
   "values":[{"name":"ZZ_TimeZoneTest"}]}
  ```
  Same extended shape already confirmed for Groups'/Visits' own create
  — a pattern now seen across 3 independent objects.
- **`time_spans`' own create/update/delete payloads were NOT
  independently live-captured this session** — the only existing time
  zone (id 1) is the protected default, and its Edit form's time-span
  sub-table showed no Add/Remove controls for it (consistent with the
  whole record being locked, not just its Name field) — so there was
  no non-destructive way to test span creation without first creating
  a real, disposable time zone (a genuine write, requiring the gated
  Group 8 approval, not a discovery-phase interception test). Deferred
  to this plan's own Group 8, same discipline already used for Visits'
  initially-uncaptured `PATCH` and Groups' initially-uncaptured
  `PATCH`/`DELETE`.
- **`time_zones`' own `modify_objects.fcgi`/`destroy_objects.fcgi`
  shapes** are inferred from the same shared `messenger.js` mechanism
  now independently live-confirmed 3 times (Users, Visits, Groups) —
  high confidence, but still to be independently confirmed for this
  object specifically in Group 8, matching precedent.

---

## Design decisions

### Decision 1 — `TimeZonesApi` gains `create`/`update`/`remove` for zones, plus `listSpans`/`createSpan`/`updateSpan`/`removeSpan` for spans
- **Chosen:** Time spans live under the same `TimeZonesApi` class
  (not a separate `TimeSpansApi`), mirroring how `UsersApi` already
  owns card management for its own users (`addCard`/`removeCard`) — a
  time span only ever exists in the context of a time zone.
- **Why:** Matches this SDK's existing precedent for a genuinely
  owned sub-resource (Cards under Users) rather than introducing a new
  top-level API class for something that's never addressed
  independently of its parent.
- **Rejected alternatives:** A separate `TimeSpansApi` — rejected as
  unnecessary indirection; nothing in this SDK ever needs to list all
  time spans across every zone at once.

### Decision 2 — `NewTimeSpan`/`TimeSpanUpdate` use explicit named boolean fields, not a bitmask or array
- **Chosen:** `sun`..`sat`, `hol1`..`hol3` as 10 named `bool` members,
  matching the device's own field names exactly (same convention this
  codebase already uses for `AmicoUser`'s named boolean flags rather
  than a generic flags integer).
- **Why:** Self-documenting or a caller reading the struct definition;
  matches this SDK's established style of mapping device fields
  directly rather than introducing an internal encoding the device
  itself doesn't use.
- **Rejected alternatives:** A `std::array<bool, 7>` for days /
  `std::array<bool, 3>` for holidays — rejected, less self-documenting
  than named fields for a fixed, non-generic set of 10 flags.

### Decision 3 — Protected time zone id 1 handled identically to Groups' Decision 2
- **Chosen:** No SDK/backend-level special-casing of any time zone id;
  the frontend defensively disables the Name field and omits Remove
  for whichever zone has id 1 on this device, exactly matching Groups'
  own precedent and reasoning.
- **Why:** Consistency with an already-established, already-reasoned
  decision for the exact same `noSave:[1]` pattern — no need to
  re-litigate it.
- **Rejected alternatives:** (see Groups plan's own Decision 2 — same
  reasoning applies verbatim.)

---

## Scope

### In scope
- SDK: `NewTimeZone`/`TimeZoneUpdate`/`TimeSpan`/`NewTimeSpan`/
  `TimeSpanUpdate` types; `TimeZonesApi::create/update/remove` (zones)
  and `listSpans/createSpan/updateSpan/removeSpan` (spans); 7 new query
  builders.
- Backend: `POST /timezones`, `PATCH /timezones/:id`,
  `DELETE /timezones/:id`, `GET /timezones/:id/spans`,
  `POST /timezones/:id/spans`, `PATCH /timespans/:id`,
  `DELETE /timespans/:id` (span PATCH/DELETE are top-level by the
  span's own id, not nested under a zone id — same precedent as
  `DELETE /cards/:cardId`, a span's id is already globally unique and
  its `time_zone_id` never changes after creation in this plan's
  scope).
- Frontend: a new "Time Zones" tab — list (Name, Edit, Remove),
  Add/Edit modal (Name field + a Time Spans sub-section: list, Add
  span form — Start/End time inputs, 7 day checkboxes, 3 holiday
  checkboxes — Edit/Remove per span).
- Tests: SDK query-builder + `TimeZonesApi` tests (zones and spans),
  backend route tests.
- Docs: `docs/backend-api.md`, `docs/api-roadmap.md` (mark Time Zones
  write-side + `time_spans` detail ✅ Implemented).
- Live verification (Group 8): create a disposable test time zone,
  add a time span to it, rename the zone, delete the span, delete the
  zone — the first independent live confirmation of every
  not-yet-captured shape above.

### Out of scope
- **Time zone ↔ Group/AccessRule linkage** (the commented-out `groups`/
  `users` fields on `time_zones` in `class.js`, and the whole
  `access_rules`/`access_rule_time_zones` join layer Groups' own
  `save()` touches when `Main.isOnline() === false`) — this device is
  in online mode (every prior discovery pass in this project found no
  server-mode-only UI), and those fields are explicitly commented out
  in the live-captured source — not a real, currently-active feature
  to implement against. This plan only implements a time zone's own
  record and its directly-owned `time_spans`.
- **Testing a write against the protected id-1 time zone** — never
  done, by design (same reasoning as Groups).
- **Holidays** (`holiday.html`) — a related but genuinely separate
  device object (`holidays`, schema already incidentally discovered
  this session while reading `class.js`: `id`/`name`/`start`/
  `hol1..hol3`/`repeats`/`end` — see this plan's own DECISION_LOG) —
  tracked as its own, separate roadmap item, not folded into this plan.

---

## Affected files

| File | Change type | Reason |
|------|-------------|--------|
| `include/amico/Types.hpp` | Modify | `NewTimeZone`/`TimeZoneUpdate`/`TimeSpan`/`NewTimeSpan`/`TimeSpanUpdate` types |
| `include/amico/Client.hpp` | Modify | `TimeZonesApi` gains create/update/remove + 4 span methods |
| `src/ObjectQuery.hpp` / `.cpp` | Modify | 7 new query builders |
| `src/Client.cpp` | Modify | Implement the new `TimeZonesApi` methods |
| `backend/JsonMapping.hpp` / `.cpp` | Modify | `toJson(TimeSpan)`, `fromJsonNewTimeZone`/`TimeZoneUpdate`/`NewTimeSpan`/`TimeSpanUpdate` |
| `backend/Routes.cpp` | Modify | 7 new routes |
| `frontend/timezones.js` | New | Time Zones tab: list, Add/Edit modal with nested Time Spans sub-section |
| `frontend/index.html` | Modify | New "Time Zones" sidebar entry under Enroll; new `<div id="tab-timezones">`; new `<script>` tag |
| `frontend/style.css` | Modify | Only if the day/holiday checkbox row needs anything beyond existing shared styling |
| `CMakeLists.txt` | Modify | Add `test/test_timezones.cpp` |
| `test/test_timezones.cpp` | New | SDK-level tests (zones + spans) |
| `test/test_query_whitelist.cpp` | Modify | New builders' whitelist coverage |
| `test/backend/test_routes.cpp` | Modify | New route tests |
| `docs/backend-api.md` | Modify | Document the new routes |
| `docs/api-roadmap.md` | Modify | Mark Time Zones write-side ✅ Implemented |

---

## Risks and unknowns

- **`time_spans`' create/update/delete payloads are not yet
  independently live-captured** — built by symmetry with the confirmed
  `time_zones` create shape and the shared generic `messenger.js`
  mechanism. To be confirmed in this plan's own Group 8 live test.
- **`time_zones`' own `modify_objects.fcgi`/`destroy_objects.fcgi`
  shapes** — same not-yet-independently-confirmed status, same Group 8
  resolution plan.
- **Whether the device enforces the id-1 protection server-side** —
  same deliberately-unconfirmed status as Groups' own equivalent risk.

---

## Self-evaluation (plan-quality.md rubric)

| Principle | Criterion | Score | Notes |
|-----------|-----------|-------|-------|
| **Think Before Planning** | spec.md first; every claim evidence-backed | 9/10 | time_spans write shapes explicitly deferred to Group 8, not assumed |
| **Simplicity First** | ≥ 3 out-of-scope items with reasoning | 9/10 | 3 items listed |
| **Surgical Changes** | Every file listed with change type and exact reason | 9/10 | 14 files/changes, each tied to a decision |
| **Goal-Driven Execution** | Each scope item traces to an acceptance criterion | 8/10 | Several shapes deferred to a live task rather than assumed final |

**Total: 35/40 → 8.75/10** (threshold: 7/10)

---

**User confirmation received:** [x] Yes — user explicitly asked to
continue with Time Zones next, right after Groups shipped and was
committed.
**Confirmed on:** 2026-09-15

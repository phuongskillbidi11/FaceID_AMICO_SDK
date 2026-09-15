# Spec — Holidays (Enroll → Holidays): full CRUD

---

## Goal

Unlike Groups/Time Zones, `holidays` has **no existing read route at
all** in this project — this plan implements full CRUD (list/create/
update/delete) from scratch, matching the real device's own
`holiday.html`.

**Done looks like:** A "Holidays" tab under Enroll, with list/Add/Edit/
Remove for holiday dates, each tagged with which of the device's 3
holiday categories it belongs to and whether it repeats yearly.

---

## Background — live evidence (this session, 2026-09-15)

- **Device object `holidays`** — fields: `id` (PK), `name`, `start`
  (date, epoch seconds — defaults to "today" for a new record),
  `hol1`/`hol2`/`hol3` (which of the device's 3 holiday categories
  this date belongs to — the same 3 categories `time_spans`'
  `hol1..hol3` fields reference), `repeats` (yearly recurrence),
  `end` (a **derived, not independently settable** field —
  `class.js`'s own `afterGet`/`beforeSave` hooks always compute it as
  `start + 86399`; the real Add/Edit form has no End control at all).
  Confirmed via `class.js`'s `CID.createClass` registration (read
  during the Time Zones plan, see that plan's own DECISION_LOG) and a
  live read (`{"holidays":[]}` — no holidays exist on this device
  today).
- **No `noSave` on `holidays`** — unlike Groups/Time Zones, there is no
  protected-default-id pattern here (confirmed via `class.js` and the
  empty live list — nothing pre-seeded to protect).
- **Live-captured CREATE payload** (XHR-interceptor capture on the
  real device's own Add Holiday form — failed before reaching the
  network, no holiday actually created; confirmed by reloading
  afterward and the list still showing "No record found"):
  ```json
  {"join":"LEFT","object":"holidays",
   "fields":["id","name","start","hol1","hol2","hol3","repeats","end"],
   "where":[],"order":["start"],
   "values":[{"name":"ZZ_HolidayTest","start":1789430400,
              "hol1":1,"hol2":1,"hol3":1,"repeats":1,
              "end":1789516799}]}
  ```
  Two things confirmed here that were **not** safe to assume:
  1. Same extended shape (`join`/`fields`/`where`/`order` + `values`)
     already seen for Groups/Visits/Time Zones.
  2. **`hol1`/`hol2`/`hol3`/`repeats` are sent as plain `1`/`0`
     integers, not JSON booleans** — same requirement already found
     the hard way for `time_spans` in the Time Zones plan's own
     Group 8. Applying that same fix proactively here (see Decision 2)
     rather than waiting to hit the identical `400` again.
  3. `end` is computed **client-side** and sent explicitly as
     `start + 86399` — even though it's a derived/read-only field in
     the UI. This SDK's own builders replicate that computation
     server-side rather than exposing `end` as a caller-settable field
     at all (see Decision 1).
- **`modify_objects.fcgi`/`destroy_objects.fcgi` for `holidays` were
  NOT independently live-captured** — inferred from the same shared
  `messenger.js` mechanism already proven 4 times this session (Users,
  Visits, Groups, Time Zones). To be confirmed in this plan's own
  Group 8 before final sign-off, same discipline as every prior plan.

---

## Design decisions

### Decision 1 — `end` is never a caller-settable field; this SDK always computes it as `start + 86399`
- **Chosen:** `NewHoliday`/`HolidayUpdate` have no `end` member at all.
  The query builders compute `end = start + 86399` internally, matching
  the real device's own `class.js` `beforeSave` hook exactly, and
  include it in the outgoing `values` (per the live-captured payload,
  which does send it explicitly despite it being derived).
- **Why:** The real Add/Edit form has no End control — `end` is
  presentation-only derived data in the UI, never independently
  entered. Exposing it as a settable SDK field would let a caller send
  an inconsistent `start`/`end` pair the real device's own UI could
  never produce.
- **Rejected alternatives:** Exposing `end` as an optional override —
  rejected as unevidenced; nothing about this object's real UI
  behavior suggests the device accepts (or even validates) an
  independent `end` value.

### Decision 2 — Boolean-ish fields (`hol1`/`hol2`/`hol3`/`repeats`) are proactively encoded as 0/1 integers, not JSON booleans
- **Chosen:** Apply the same `boolToDeviceInt()` helper already added
  in the Time Zones plan (`src/ObjectQuery.cpp`) to this object's own
  create/update builders, rather than waiting to hit the identical
  `400 "int expected, got boolean"` error live again.
- **Why:** The live-captured create payload for `holidays` itself
  already shows `"hol1":1` (an integer), not `"hol1":true` — this is
  independently confirmed for `holidays`, not just inferred from
  `time_spans`' own earlier finding. Both objects now agree: this
  device's generic object-write layer expects boolean-ish fields as
  0/1 integers uniformly, not JSON booleans.
- **Rejected alternatives:** Waiting for Group 8 to hit the same error
  again before fixing it — rejected; the create payload capture in
  this plan's own Background already shows the integer encoding
  directly, so there's no need to rediscover it the hard way twice.

---

## Scope

### In scope
- SDK: new `Holiday`/`NewHoliday`/`HolidayUpdate` types; new
  `HolidaysApi` (`list`/`create`/`update`/`remove`); 4 new query
  builders.
- Backend: `GET /holidays`, `POST /holidays`, `PATCH /holidays/:id`,
  `DELETE /holidays/:id` — all new (no prior read route existed).
- Frontend: a new "Holidays" tab — list (Name, Date, Type 1/2/3 as
  check/X icons, Repeats as check/X, Edit, Remove), Add/Edit modal
  (Name, Date, 3 category checkboxes, Repeats checkbox — no End
  control, matching the real device's own form).
- Tests: SDK query-builder + `HolidaysApi` tests, backend route tests.
- Docs: `docs/backend-api.md` (new `/holidays` section),
  `docs/api-roadmap.md` (mark Holidays ✅ Implemented, replacing its
  current 🔍 discovery-pending entry).
- Live verification (Group 8): create a disposable test holiday,
  update it, delete it — the first independent live confirmation of
  the `modify_objects.fcgi`/`destroy_objects.fcgi` shapes.

### Out of scope
- **Which `time_spans` actually reference `hol1`/`hol2`/`hol3`** — this
  plan only manages the `holidays` calendar entries themselves; linking
  a specific time span to "observe holiday category 2" is already
  fully implemented (Time Zones plan's `time_spans` CRUD) and not
  touched here.
- **Testing `end`'s independent settability** — deliberately never
  attempted, since Decision 1 already establishes this SDK never
  exposes it as settable; nothing to test.
- **Scheduled Unlock / User Types / Custom Fields** — separate,
  still-undiscovered roadmap items, not folded into this plan.

---

## Affected files

| File | Change type | Reason |
|------|-------------|--------|
| `include/amico/Types.hpp` | Modify | `Holiday`/`NewHoliday`/`HolidayUpdate` types |
| `include/amico/Client.hpp` | Modify | New `HolidaysApi` class + `holidays()` accessor |
| `src/ObjectQuery.hpp` / `.cpp` | Modify | 4 new query builders |
| `src/Client.cpp` | Modify | Implement `HolidaysApi`'s methods |
| `backend/JsonMapping.hpp` / `.cpp` | Modify | `toJson(Holiday)`, `fromJsonNewHoliday`/`HolidayUpdate` |
| `backend/Routes.cpp` | Modify | New `/holidays` route family (4 routes) |
| `frontend/holidays.js` | New | Holidays tab: list, Add/Edit modal |
| `frontend/index.html` | Modify | New "Holidays" sidebar entry under Enroll; new `<div id="tab-holidays">`; new `<script>` tag |
| `CMakeLists.txt` | Modify | Add `test/test_holidays.cpp` |
| `test/test_holidays.cpp` | New | SDK-level tests |
| `test/test_query_whitelist.cpp` | Modify | New builders' whitelist coverage |
| `test/backend/test_routes.cpp` | Modify | New route tests |
| `docs/backend-api.md` | Modify | Document the new routes |
| `docs/api-roadmap.md` | Modify | Mark Holidays ✅ Implemented |

---

## Risks and unknowns

- **`modify_objects.fcgi`/`destroy_objects.fcgi` for `holidays` are not
  yet independently live-captured** — same not-yet-confirmed status as
  every other object's update/delete shape this session before its own
  Group 8 ran. To be confirmed live in this plan's own Group 8.
- **Whether the boolean-as-integer encoding (Decision 2) is exactly
  right for `holidays` specifically** — the create payload evidence is
  direct (not inferred from a different object), so confidence is
  high, but Group 8's real write will be the first end-to-end
  confirmation including the backend/frontend wiring, not just the
  raw builder shape.

---

## Self-evaluation (plan-quality.md rubric)

| Principle | Criterion | Score | Notes |
|-----------|-----------|-------|-------|
| **Think Before Planning** | spec.md first; every claim evidence-backed | 9/10 | Boolean-encoding fix applied proactively based on direct evidence, not guessed |
| **Simplicity First** | ≥ 3 out-of-scope items with reasoning | 9/10 | 3 items listed |
| **Surgical Changes** | Every file listed with change type and exact reason | 9/10 | 14 files/changes, each tied to a decision |
| **Goal-Driven Execution** | Each scope item traces to an acceptance criterion | 8/10 | update/delete shapes deferred to Group 8, not assumed final |

**Total: 35/40 → 8.75/10** (threshold: 7/10)

---

**User confirmation received:** [x] Yes — user explicitly asked to
continue with Holidays next, right after Time Zones shipped and was
committed.
**Confirmed on:** 2026-09-15

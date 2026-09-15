# Spec — Scheduled Unlock (Enroll → Scheduled Unlock): full CRUD + time zone linking

---

## Goal

No existing route for `scheduled_unlocks` exists at all — this plan
implements full CRUD (list/create/update/delete) for the base record
plus the ability to link/unlink time zones, matching the real
device's own `scheduledunlock.html` two-tab (General / Time Zones)
form.

**Done looks like:** A "Scheduled Unlock" tab under Enroll, with
list/Add/Edit/Remove for name+message, and an Edit-modal Time Zones
sub-section (Available/Linked dual list, same interaction pattern as
this project's own `frontend/timezones.js` span sub-form) to add/
remove which time zones this scheduled unlock applies to.

---

## Background — live evidence (this session, 2026-09-15)

All of the following is `LIVE_CONFIRMED` via `class.js`'s static
`CID.createClass` read plus two full gated write/read/delete cycles
against the real device (`APPROVE_LIVE_DEVICE_TEST:2026-09-15-scheduled-unlock`
+ `APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-15-scheduled-unlock`, both
pasted verbatim by the user; see `docs/api-roadmap.md` section 10b for
the full narrative). Two disposable records were created, fully
exercised, then deleted — no lasting device change.

- **Device object `scheduled_unlocks`** has only 3 real fields: `id`,
  `name`, `message`. There is **no `noSave`** on this object (no
  protected-id record, same as Holidays).
- **`fields` used in the confirmed create/list shape:** `id`, `name`,
  `message`.
- **Confirmed create payload** (same extended shape as every other
  object this session):
  ```json
  {"join":"LEFT","object":"scheduled_unlocks","fields":["id","name","message"],
   "where":[],"order":["name"],
   "values":[{"name":"ZZ_ScheduledUnlockTest","message":"Test message"}]}
  ```
- **Time zone linking is not a plain field** — it's resolved through a
  2-hop join chain declared in `class.js`:
  `scheduled_unlocks` ↔ `access_rules` (via `scheduled_unlock_access_rules`)
  ↔ `time_zones` (via `access_rule_time_zones`). A third hop to
  `portals` (via `portal_access_rules`) also exists in the same
  `intermediateTableBy` chain, but was never observed to fire any
  write on this single-portal device (see Risks).
- **Confirmed read shape for a scheduled unlock's linked time zones**
  (the device resolves the multi-hop join server-side in one call —
  the first time this session `where.object` differs from the
  query's own top-level `object`):
  ```json
  {"join":"LEFT","object":"time_zones","fields":["id","name"],
   "where":[{"object":"scheduled_unlocks","field":"id","value":<id>,"connector":") AND ("}],
   "order":["name"],"limit":1000,"offset":0}
  ```
- **Confirmed full sequence when saving a brand-new scheduled unlock
  with time zone(s) selected** (all `create_objects.fcgi`, fired
  sequentially, each gated on the previous succeeding):
  1. Create the base `scheduled_unlocks` row.
  2. Create one `access_rules` row (`fields:["id","name","type","priority"]`,
     `values:[{"name":"(access_rules automatically created for scheduled_unlocks <id>)","type":1,"priority":0}]`)
     — **one access_rule per scheduled_unlock (1:1)**, not one per
     time zone or per portal.
  3. Create one `scheduled_unlock_access_rules` row
     (`values:[{"scheduled_unlock_id":<id>,"access_rule_id":<newId>}]`).
  4. Create one `access_rule_time_zones` row per selected time zone
     (`values:[{"access_rule_id":<newId>,"time_zone_id":<tzId>}]`).
- **Confirmed unlink (remove one time zone) payload** against an
  *existing* scheduled unlock that already has an `access_rules` row:
  ```json
  {"object":"access_rule_time_zones",
   "where":[{"object":"access_rule_time_zones","field":"access_rule_id","value":<accessRuleId>},
            {"object":"access_rule_time_zones","field":"time_zone_id","value":[<tzId>]}]}
  ```
  Only the specific `access_rule_time_zones` row is removed; the
  `access_rules`/`scheduled_unlock_access_rules` rows are left intact.
- **Not captured / not independently confirmed:**
  - The exact shape of a lookup query to find an *existing*
    `access_rules` row for a given `scheduled_unlock_id` (needed so
    `addTimeZone()` doesn't create a duplicate `access_rules` row on a
    second call). Inferred by symmetry with this session's own
    established bare-object `where` shape (e.g.
    `buildTimeSpansListBody`'s `where: {"time_spans": {"time_zone_id": id}}}`)
    — see Decision 2. To be confirmed/corrected during this plan's own
    Group 8.
  - `modify_objects.fcgi` for `scheduled_unlocks` itself (rename) —
    inferred by symmetry with every other object's confirmed
    bare-object `values` + scalar `where.id` shape (Groups, Time
    Zones, Holidays all independently confirmed this exact shape).
  - `destroy_objects.fcgi` for `scheduled_unlocks` itself, and whether
    it cascades to `access_rules`/`scheduled_unlock_access_rules`/
    `access_rule_time_zones` or leaves them orphaned. Not tested this
    pass (see Risks).
  - Any `portal_access_rules` write — this device has only one portal,
    so a write may be silently skipped/auto-included, or portal
    selection may live behind UI not exposed on a single-portal device.
    Cannot be tested further without a second portal, which is
    physical hardware, not something this API can create.

---

## Design decisions

### Decision 1 — `create()` does NOT auto-link time zone id 1 by default
- **Chosen:** `NewScheduledUnlock` has no `timeZoneIds` member at all;
  `create()` only ever sends the base `scheduled_unlocks` row. Callers
  who want time zones linked call `addTimeZone()` afterward (possibly
  right away, using the returned id).
- **Why:** The real UI's own "start with time zone 1 already Linked"
  behavior is a **client-side form default** (`class.js`'s
  `'time_zones': {'value': [1], ...}`), not a device-enforced rule —
  confirmed by the fact that the full access_rules/link sequence never
  fires unless the *client* explicitly issues it. Silently replicating
  a UI convenience as hidden SDK behavior would surprise a caller who
  didn't ask for any time zone to be linked (Simplicity First: don't
  invent behavior beyond what's evidenced as a real device
  requirement).
- **Rejected alternatives:** Defaulting `NewScheduledUnlock` to link
  time zone 1 automatically, matching the UI pixel-for-pixel — rejected
  as inventing hidden side effects a caller didn't ask for.

### Decision 2 — `addTimeZone()`/`removeTimeZone()` look up the scheduled unlock's `access_rules` row by a bare-object `where` query, auto-creating it on first link
- **Chosen:** A new internal lookup,
  `buildScheduledUnlockAccessRuleIdBody(scheduledUnlockId)`, queries
  `scheduled_unlock_access_rules` filtered by `scheduled_unlock_id` to
  find an existing `access_rule_id` (if any). `addTimeZone()`: if none
  exists, create the `access_rules` row (verbatim confirmed shape,
  auto-generated name matching the device's own convention) +
  `scheduled_unlock_access_rules` link, then always create the
  `access_rule_time_zones` row. `removeTimeZone()`: look up the
  `access_rule_id` the same way, then issue the confirmed
  `destroy_objects.fcgi`; if no `access_rules` row exists at all
  (nothing was ever linked), throw `ProtocolError` — there is nothing
  to remove.
- **Why:** This mirrors the real device's own lazy-creation behavior
  (an `access_rules` row only exists once at least one time zone has
  ever been linked) as closely as evidence allows, without requiring a
  caller to manage the `access_rules`/`scheduled_unlock_access_rules`
  plumbing objects directly — same "hide device-internal plumbing
  behind a clean method" precedent as `VisitsApi::finish()`.
- **Rejected alternatives:** Exposing `access_rules`/
  `scheduled_unlock_access_rules` as first-class public SDK types —
  rejected as exposing internal plumbing objects no real caller needs
  to know about; the real UI itself never surfaces them as their own
  concept either (no "Access Rules" page exists in the device menu).
- **Risk:** the lookup query's own shape (`buildScheduledUnlockAccessRuleIdBody`)
  is inferred by symmetry, not independently live-captured (spec.md
  Background). Confirm/adjust during this plan's own Group 8 — if the
  shape is wrong, `addTimeZone()`/`removeTimeZone()` will surface that
  as a normal `ProtocolError`/`HttpError`, not silently misbehave.

### Decision 3 — `remove()` (delete a scheduled unlock) does not attempt to clean up `access_rules`/`scheduled_unlock_access_rules`/`access_rule_time_zones`
- **Chosen:** `remove(id)` only issues `destroy_objects.fcgi` against
  `scheduled_unlocks` itself.
- **Why:** Whether the device cascades this cleanup server-side is
  unconfirmed (spec.md Background/Risks) — same "don't assume cascade
  delete without evidence" stance as `buildCUsersDeleteBody`/
  `buildFaceTemplatesDeleteBody`'s own doc comments elsewhere in this
  codebase. Inventing extra destructive cleanup calls without evidence
  risks deleting rows the device itself still needs (e.g. if another
  scheduled unlock somehow shared the same access_rule, though no
  evidence suggests that's possible given the 1:1 naming convention
  observed).
- **Risk:** if the device does NOT cascade, deleting many scheduled
  unlocks over time could accumulate orphaned `access_rules` rows.
  Flagged as a known risk, not fixed speculatively — confirm actual
  device behavior during this plan's own Group 8 and revisit only if
  evidence shows it's a real problem.

---

## Scope

### In scope
- SDK: new `ScheduledUnlock`/`NewScheduledUnlock`/
  `ScheduledUnlockUpdate` types; new `ScheduledUnlocksApi`
  (`list`/`create`/`update`/`remove`/`addTimeZone`/`removeTimeZone`);
  5 new query builders (list, create, update, delete, plus the
  access-rule lookup) and reuse of the existing extended-create-shape
  convention.
- Backend: `GET`/`POST`/`PATCH`/`DELETE /scheduled-unlocks`,
  `POST /scheduled-unlocks/:id/timezones/:timeZoneId`,
  `DELETE /scheduled-unlocks/:id/timezones/:timeZoneId` — all new.
- Frontend: a new "Scheduled Unlock" tab — list (Name, Message, Nº of
  Time Zones, Edit, Remove), Add/Edit modal (Name, Message, plus a
  Time Zones dual-list sub-section once the record has been saved at
  least once — same "(*) Save first to enable editing" pattern already
  used for Time Zones' own `time_spans` sub-form).
- Tests: SDK query-builder + `ScheduledUnlocksApi` tests, backend
  route tests.
- Docs: `docs/backend-api.md` (new `/scheduled-unlocks` section),
  `docs/api-roadmap.md` (mark Scheduled Unlock ✅ Implemented).
- Live verification (Group 8): create a disposable test scheduled
  unlock, rename it, link a time zone, unlink it, delete it — the
  first independent live confirmation of `buildScheduledUnlockUpdateBody`,
  `buildScheduledUnlockDeleteBody`, and
  `buildScheduledUnlockAccessRuleIdBody` (spec.md Risks).

### Out of scope
- **Portal linking** — `portal_access_rules` was never observed to
  fire any write on this single-portal device; not implemented, not
  guessed at (spec.md Background). If a future device/discovery pass
  reveals a multi-portal write shape, that's a separate follow-up.
- **The Groups "Time Zones" tab gap** (`docs/api-roadmap.md` section
  5) — a related but separate finding from this same discovery
  session; deliberately a separate future plan, not folded in here,
  even though it reuses the same underlying `access_rules`/
  `access_rule_time_zones` mechanism.
- **Access Rules as a first-class concept** — never exposed as its
  own SDK type or route (Decision 2).

---

## Affected files

| File | Change type | Reason |
|------|-------------|--------|
| `include/amico/Types.hpp` | Modify | `ScheduledUnlock`/`NewScheduledUnlock`/`ScheduledUnlockUpdate` types |
| `include/amico/Client.hpp` | Modify | New `ScheduledUnlocksApi` class + `scheduledUnlocks()` accessor |
| `src/ObjectQuery.hpp` / `.cpp` | Modify | 5 new query builders |
| `src/Client.cpp` | Modify | Implement `ScheduledUnlocksApi`'s methods |
| `backend/JsonMapping.hpp` / `.cpp` | Modify | `toJson(ScheduledUnlock)`, `fromJsonNewScheduledUnlock`/`ScheduledUnlockUpdate` |
| `backend/Routes.cpp` | Modify | New `/scheduled-unlocks` route family (6 routes) |
| `frontend/scheduled-unlock.js` | New | Scheduled Unlock tab: list, Add/Edit modal, Time Zones sub-section |
| `frontend/index.html` | Modify | New "Scheduled Unlock" sidebar entry under Enroll; new `<div id="tab-scheduled-unlock">`; new `<script>` tag |
| `CMakeLists.txt` | Modify | Add `test/test_scheduled_unlocks.cpp` |
| `test/test_scheduled_unlocks.cpp` | New | SDK-level tests |
| `test/test_query_whitelist.cpp` | Modify | New builders' whitelist coverage |
| `test/backend/test_routes.cpp` | Modify | New route tests |
| `docs/backend-api.md` | Modify | Document the new routes |
| `docs/api-roadmap.md` | Modify | Mark Scheduled Unlock ✅ Implemented |

---

## Risks and unknowns

- **`buildScheduledUnlockAccessRuleIdBody`'s shape is inferred, not
  captured** (Decision 2) — the single biggest risk in this plan. If
  wrong, `addTimeZone()`/`removeTimeZone()` will fail with a
  `ProtocolError`/`HttpError` rather than silently doing the wrong
  thing (this codebase's write builders never swallow device errors),
  but it means Group 8 may need an extra fix-and-retry cycle, same as
  Time Zones' own Group 8 boolean-encoding bug.
- **`modify_objects.fcgi`/`destroy_objects.fcgi` for `scheduled_unlocks`
  itself are not independently captured** — same not-yet-confirmed
  status as every other object's update/delete shape before its own
  Group 8, this session.
- **Delete-cascade behavior for `access_rules`/etc. is unknown**
  (Decision 3) — accepted as a documented risk, not solved
  speculatively.
- **Portal linking is entirely unexplored** — explicitly out of scope
  (Scope: Out of scope), not a gap in this plan's own execution.

---

## Self-evaluation (plan-quality.md rubric)

| Principle | Criterion | Score | Notes |
|-----------|-----------|-------|-------|
| **Think Before Planning** | spec.md first; every claim evidence-backed | 8/10 | One builder shape (access-rule lookup) is inferred, clearly flagged, not silently assumed |
| **Simplicity First** | ≥ 3 out-of-scope items with reasoning | 9/10 | 3 items listed, each with a clear reason |
| **Surgical Changes** | Every file listed with change type and exact reason | 9/10 | 13 files/changes, each tied to a decision |
| **Goal-Driven Execution** | Each scope item traces to an acceptance criterion | 8/10 | Update/delete shapes and the access-rule lookup deferred to Group 8, not assumed final |

**Total: 34/40 → 8.5/10** (threshold: 7/10)

---

**User confirmation received:** [x] Yes — user explicitly asked to
continue with Scheduled Unlock's own plan right after this session's
discovery pass confirmed the full link/unlink mechanism.
**Confirmed on:** 2026-09-15

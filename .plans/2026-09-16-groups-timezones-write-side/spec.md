# Spec — Groups Time Zones tab (Enroll → Groups): time zone linking

---

## Goal

Close the known gap recorded in `docs/api-roadmap.md` section 5
(found 2026-09-15 during Scheduled Unlock discovery): the real
device's own Group Edit page has a "Time Zones" tab that this
project's already-shipped Groups write-side plan (`fe1e4d9`) never
implemented. This plan adds `addTimeZone`/`removeTimeZone` to the
existing `GroupsApi`, reusing the exact `access_rules`/
`access_rule_time_zones` mechanism already confirmed and implemented
for Scheduled Unlock (`.plans/2026-09-15-scheduled-unlock-write-side/`),
swapping `group_access_rules` in place of
`scheduled_unlock_access_rules` as the other half of the join.

**Done looks like:** The existing Groups tab's Edit modal gains a Time
Zones section (Available/Linked dual list, plus an Nº of Time Zones
list column) — the exact same pattern already shipped for Scheduled
Unlock's own frontend.

---

## Background — live evidence (2026-09-16)

All of the following is `LIVE_CONFIRMED` via a full gated write/read
cycle against the real device (`APPROVE_LIVE_DEVICE_TEST:2026-09-16-groups-timezones-gap`
+ `APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-16-groups-timezones-gap`,
both pasted verbatim by the user). One disposable group
("ZZ_GroupTZTest") and one disposable time zone ("ZZ_GroupTZTemp")
were created, fully exercised, then deleted — no lasting device
change beyond one now-cleaned-up orphaned `access_rules` row (see
Risks).

- **`class.js`'s own `groupsData.fields.time_zones`** (client-side-only
  registration) confirms the exact same composite-field shape already
  documented for Scheduled Unlock: `intermediateTable:
  access_rule_time_zones` (pk: `access_rule_id`, fk: `time_zone_id`),
  `listBy: 'access_rules'`, `intermediateTableBy: [portal_access_rules,
  group_access_rules]` (pk: `group_id`, fk: `access_rule_id`). Default
  `value: [1]` (same client-side-only "start with time zone 1
  selected" form convenience already found for Scheduled Unlock — not
  a device requirement).
- **Confirmed create sequence** (creating a new group with the default
  time zone selection left untouched), all `create_objects.fcgi`,
  fired sequentially:
  1. `{"object":"groups","fields":["id","name"],...,"values":[{"name":"ZZ_GroupTZTest"}]}` → base row (id 6).
  2. `{"object":"access_rules","fields":["id","name","type","priority"],...,"values":[{"name":"(access_rules automatically created for groups 6)","type":1,"priority":0}]}` → **identical auto-naming convention** to Scheduled Unlock, just `"groups"` instead of `"scheduled_unlocks"` in the generated name string.
  3. `{"object":"group_access_rules","values":[{"group_id":6,"access_rule_id":7}]}`.
  4. `{"object":"access_rule_time_zones","values":[{"access_rule_id":7,"time_zone_id":1}]}`.
- **Confirmed "existing access_rule" branch** (adding a second time
  zone to a group that already has one): a single additional
  `{"object":"access_rule_time_zones","values":[{"access_rule_id":7,"time_zone_id":5}]}`
  — no new `access_rules`/`group_access_rules` row, exactly mirroring
  Scheduled Unlock's own confirmed second-link behavior.
- **Confirmed read shape for a group's linked time zones** — identical
  cross-object `where` pattern already documented for Scheduled Unlock,
  just `where.object: "groups"` instead of `"scheduled_unlocks"`:
  ```json
  {"join":"LEFT","object":"time_zones","fields":["id","name"],
   "where":[{"object":"groups","field":"id","value":<id>,"connector":") AND ("}],
   "order":["name"],"limit":1000,"offset":0}
  ```
- **Confirmed unlink payload** — byte-for-byte identical shape to
  Scheduled Unlock's own confirmed unlink (the underlying table,
  `access_rule_time_zones`, and its own two `where` fields
  `access_rule_id`/`time_zone_id`, are shared by both objects; nothing
  group-specific about this call at all):
  ```json
  {"object":"access_rule_time_zones",
   "where":[{"object":"access_rule_time_zones","field":"access_rule_id","value":7},
            {"object":"access_rule_time_zones","field":"time_zone_id","value":[5]}]}
  ```
  This means `buildAccessRuleTimeZoneLinkBody`/`buildAccessRuleTimeZoneUnlinkBody`
  (already implemented, generic, not Scheduled-Unlock-specific despite
  their current location) are **directly reusable as-is** for Groups —
  no new builder needed for the link/unlink step itself, only for the
  group-specific access_rule lookup/creation.
- **Cascade behavior confirmed identical to Scheduled Unlock:** deleting
  the disposable group left its `access_rules` row (id 7) orphaned —
  directly queried and confirmed via `load_objects.fcgi`. Manually
  cleaned up (deleted the orphaned row) as part of this discovery pass'
  own cleanup, with the user's direct instruction, same as the
  Scheduled Unlock precedent.
- **Not captured / not independently confirmed** (identical caveat to
  Scheduled Unlock's own spec.md Decision 2): the exact shape of a
  lookup query to find an *existing* `access_rules` row for a given
  `group_id` (needed so `addTimeZone()` doesn't create a duplicate
  `access_rules` row on a second call). Inferred by symmetry with
  Scheduled Unlock's own `buildScheduledUnlockAccessRuleIdBody`,
  swapping `group_access_rules`/`group_id` for
  `scheduled_unlock_access_rules`/`scheduled_unlock_id`. To be
  confirmed/corrected during this plan's own Group 7 (mirroring how
  Scheduled Unlock's own equivalent risk turned out correct on the
  first live attempt).

---

## Design decisions

### Decision 1 — Reuse Scheduled Unlock's generic link/unlink builders directly; add only group-specific lookup/create builders
- **Chosen:** `buildAccessRuleTimeZoneLinkBody`/`buildAccessRuleTimeZoneUnlinkBody`
  (already in `src/ObjectQuery.cpp` from the Scheduled Unlock plan) are
  called as-is from `GroupsApi::addTimeZone()`/`removeTimeZone()`. Only
  two new builders are added: `buildGroupAccessRuleIdBody(groupId)`
  (lookup via `group_access_rules`) and
  `buildGroupAccessRuleCreateBody(groupId)` (auto-named access_rules
  row, `"...for groups <id>"`), plus `buildGroupAccessRuleLinkBody(groupId, accessRuleId)`
  (the `group_access_rules` link itself — structurally identical to
  `buildScheduledUnlockAccessRuleLinkBody` but a different table/field
  name, so a separate function, not a reused one) and
  `buildGroupTimeZoneIdsBody(groupId)` (the cross-object read).
- **Why:** The live evidence directly confirms the `access_rule_time_zones`
  step is byte-for-byte identical between Groups and Scheduled Unlock
  — reusing the same builder is both correct (this is genuinely the
  same table/shape, not a coincidental similarity) and avoids
  duplicating logic (Simplicity First / DRY, matching this project's
  own precedent of sharing code across objects only when the underlying
  device behavior is actually shared, e.g. `boolToDeviceInt()` reused
  across `time_spans` and `holidays`).
- **Rejected alternatives:** Writing a parallel, near-identical
  `buildGroupAccessRuleTimeZoneLinkBody`/`UnlinkBody` pair — rejected
  as needless duplication of code proven identical by live evidence.

### Decision 2 — `Group`'s own `timeZoneIds` field, added the same way `ScheduledUnlock.timeZoneIds` was added
- **Chosen:** `Group` (the existing public type) gains a `timeZoneIds`
  member, populated by `GroupsApi::list()` via one extra
  `buildGroupTimeZoneIdsBody` call per row (same N+1 tradeoff already
  accepted for Scheduled Unlock/Holidays, given this device has few
  groups). `NewGroup`/`GroupUpdate` remain unchanged — no
  `timeZoneIds` member, consistent with Scheduled Unlock's own
  Decision 1 (linking is only ever done via `addTimeZone()`, `create()`
  never auto-links).
- **Why:** Direct parity with the already-shipped, already-reviewed
  Scheduled Unlock design; no reason to design this differently just
  because it's a different object with the same underlying mechanism.
- **Rejected alternatives:** none seriously considered — this mirrors
  proven, already-accepted design.

### Decision 3 — Same no-cascade stance for `removeGroup()`
- **Chosen:** `GroupsApi::remove()` (already implemented) is
  **unchanged** — it still only issues `destroy_objects.fcgi` against
  `groups` itself, same as before this plan. No new cleanup logic
  added for `access_rules`/`group_access_rules`.
- **Why:** Confirmed live (this plan's own Background) that the device
  does not cascade-clean these rows on group delete, identical to
  Scheduled Unlock. Adding speculative cleanup now would be
  inconsistent with the already-accepted Scheduled Unlock precedent
  and the project's own "don't assume cascade without evidence, and
  don't invent cleanup beyond what's evidenced" stance.
- **Risk (accepted, not solved):** deleting groups with linked time
  zones over time will accumulate orphaned `access_rules`/
  `group_access_rules` rows, exactly like Scheduled Unlock. Not fixed
  speculatively here either — a future cross-cutting cleanup pass
  (if ever needed) belongs to both objects equally, out of scope for
  this narrow plan.

---

## Scope

### In scope
- SDK: `Group` gains `timeZoneIds`; `GroupsApi` gains `addTimeZone(groupId, timeZoneId)`/
  `removeTimeZone(groupId, timeZoneId)`; 4 new query builders
  (`buildGroupTimeZoneIdsBody`, `buildGroupAccessRuleIdBody`,
  `buildGroupAccessRuleCreateBody`, `buildGroupAccessRuleLinkBody`) plus
  reuse of the 2 existing generic `access_rule_time_zones` builders.
- Backend: `POST /groups/:id/timezones/:timeZoneId`,
  `DELETE /groups/:id/timezones/:timeZoneId` — new routes, plus
  `GET /groups`'s own response gains `timeZoneIds` per row (existing
  route, extended response shape only).
- Frontend: `frontend/groups.js`'s existing Edit modal gains a Time
  Zones section (dual-list picker + Add Time Zone control), same UI
  pattern as `frontend/scheduled-unlock.js`'s own Time Zones section;
  the list table gains an "Nº of Time Zones" column.
- Tests: new query-builder + `GroupsApi::addTimeZone`/`removeTimeZone`
  tests, new backend route tests, updated existing `GroupsApi::list()`
  test(s) to also assert `timeZoneIds`.
- Docs: `docs/backend-api.md` (`/groups` section gains the 2 new
  routes + response shape note), `docs/api-roadmap.md` (section 5's
  "known gap" note updated to reflect the gap is closed).
- Live verification (Group 7): create a disposable test group, link a
  time zone, unlink it, delete it — the first independent live
  confirmation of `buildGroupAccessRuleIdBody` (spec.md Risks) through
  this plan's own implementation (not just the raw discovery capture
  above).

### Out of scope
- **The Groups "Users" tab** (`docs/api-roadmap.md` section 5's own
  note) — already confirmed not a gap; the existing
  `UsersApi::addToGroup()`/`removeFromGroup()` already covers this
  relationship fully. Not touched by this plan.
- **Portal linking** — same as Scheduled Unlock's own out-of-scope
  item; `portal_access_rules` was never observed to fire any write on
  this single-portal device.
- **Cross-cutting `access_rules` cleanup/cascade fix** — a potential
  future improvement affecting both Scheduled Unlock and Groups
  equally; deliberately not attempted here (Decision 3).

---

## Affected files

| File | Change type | Reason |
|------|-------------|--------|
| `include/amico/Types.hpp` | Modify | `Group` gains `timeZoneIds` |
| `include/amico/Client.hpp` | Modify | `GroupsApi` gains `addTimeZone`/`removeTimeZone` |
| `src/ObjectQuery.hpp` / `.cpp` | Modify | 4 new query builders; reuse of 2 existing ones |
| `src/Client.cpp` | Modify | Implement `GroupsApi::addTimeZone`/`removeTimeZone`; extend `listGroups()`/`mapGroup` |
| `backend/JsonMapping.cpp` | Modify | `toJson(Group)` gains `timeZoneIds` |
| `backend/Routes.cpp` | Modify | New `/groups/:id/timezones/:timeZoneId` route pair |
| `frontend/groups.js` | Modify | Time Zones section in the Edit modal; Nº of Time Zones list column |
| `test/test_groups.cpp` | Modify | New builder + `addTimeZone`/`removeTimeZone` tests; update `list()` test |
| `test/test_query_whitelist.cpp` | Modify | New builders' whitelist coverage |
| `test/backend/test_routes.cpp` | Modify | New route tests |
| `docs/backend-api.md` | Modify | Document the new routes + response shape |
| `docs/api-roadmap.md` | Modify | Close out section 5's known-gap note |

---

## Risks and unknowns

- **`buildGroupAccessRuleIdBody`'s shape is inferred, not captured**
  (Decision 1) — same category of risk as Scheduled Unlock's own
  equivalent, which turned out correct on the first live attempt;
  confirm/adjust during this plan's own Group 7.
- **Orphaned `access_rules`/`group_access_rules` accumulation** —
  accepted, not solved (Decision 3), consistent with the already-
  accepted Scheduled Unlock precedent.

---

## Self-evaluation (plan-quality.md rubric)

| Principle | Criterion | Score | Notes |
|-----------|-----------|-------|-------|
| **Think Before Planning** | spec.md first; every claim evidence-backed | 9/10 | Every shape directly live-captured this pass except the access-rule lookup, clearly flagged |
| **Simplicity First** | ≥ 3 out-of-scope items with reasoning | 9/10 | 3 items listed, each with a clear reason |
| **Surgical Changes** | Every file listed with change type and exact reason | 9/10 | 12 files/changes, each tied to a decision; reuses existing generic builders rather than duplicating |
| **Goal-Driven Execution** | Each scope item traces to an acceptance criterion | 9/10 | Only the access-rule lookup shape deferred to Group 7, everything else already live-confirmed this pass |

**Total: 36/40 → 9.0/10** (threshold: 7/10)

---

**User confirmation received:** [x] Yes — user explicitly asked to
patch this known gap right after the Scheduled Unlock plan shipped and
was pushed.
**Confirmed on:** 2026-09-16

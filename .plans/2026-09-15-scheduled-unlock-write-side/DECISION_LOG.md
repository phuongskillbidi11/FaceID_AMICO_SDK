# Decision Log — Scheduled Unlock write side

---

## 2026-09-15 — Plan created

**Context:** User asked to continue with Scheduled Unlock right after
this session's own discovery pass (see `docs/api-roadmap.md` section
10b) fully confirmed the object's base schema, create shape, and the
complete time-zone link/unlink mechanism (including the auto-created
`access_rules`/`scheduled_unlock_access_rules` plumbing rows) via two
full gated write/read/delete cycles against the real device.

**Decision:** Write a full new plan
(`2026-09-15-scheduled-unlock-write-side`) following the same
discovery → spec → tasks structure as Groups/Time Zones/Holidays, but
scoped to include time-zone linking (not deferred to a follow-up),
since the discovery pass already captured every write shape needed.

**Decided by:** User request ("Làm tiếp Scheduled Unlock" answered via
AskUserQuestion after the discovery pass and its own commit).
**Status:** Done.

---

## 2026-09-15 — `create()` does not auto-link time zone id 1

**Context:** The real device's own Add Scheduled Unlock form starts
with time zone id 1 ("Always Allowed") already in its "Linked" list by
default, and saving a brand-new form with that default untouched
produces a full 5-step write sequence (base record, `access_rules`,
`scheduled_unlock_access_rules`, `access_rule_time_zones`).

**Decision:** This SDK's own `create()` never auto-links any time
zone. `NewScheduledUnlock` has no `timeZoneIds` member. Callers who
want a time zone linked call `ScheduledUnlocksApi::addTimeZone()`
explicitly, possibly immediately after `create()` returns the new id.

**Reasoning:** The "starts with time zone 1 already selected" behavior
is confirmed to be a pure client-side JS form-state default
(`class.js`'s own `'value': [1]`), not something the device itself
enforces or defaults to server-side — the full write sequence only
fires because the client (the real UI's own JS) issues it, matching
this session's `APPROVE_LIVE_DEVICE_TEST`-gated discovery evidence.
Silently replicating a UI form-state convenience as hidden SDK
behavior would surprise API callers with an unrequested side effect.

**Alternatives rejected:** Defaulting `NewScheduledUnlock` to link
time zone id 1 automatically, matching the real UI's own form default
pixel-for-pixel — rejected as inventing an unrequested side effect
with no device-side justification, only a UI-convenience one.

**Decided by:** Live-captured create sequence evidence (spec.md
Background).
**Status:** Applied in spec.md Decision 1; to be implemented in Group
1 (types) and Group 3 (SDK implementation).

---

## 2026-09-15 — Time-zone linking hides `access_rules`/`scheduled_unlock_access_rules` plumbing behind `addTimeZone()`/`removeTimeZone()`

**Context:** Linking a time zone to a scheduled unlock actually
requires writing to 2-3 separate device tables
(`access_rules`, `scheduled_unlock_access_rules`,
`access_rule_time_zones`), only the first of which needs to happen
once per scheduled unlock (lazily, on the first ever link).

**Decision:** Expose only `addTimeZone(scheduledUnlockId, timeZoneId)`/
`removeTimeZone(scheduledUnlockId, timeZoneId)` publicly.
Internally, both methods first look up whether an `access_rules` row
already exists for the given scheduled unlock (via a new
`buildScheduledUnlockAccessRuleIdBody` query); `addTimeZone()` creates
the `access_rules` + `scheduled_unlock_access_rules` rows on the first
call only, then always creates the `access_rule_time_zones` link;
`removeTimeZone()` throws `ProtocolError` if no `access_rules` row is
found (nothing was ever linked), otherwise issues the confirmed
unlink call.

**Reasoning:** No real page in the device's own menu ever exposes
`access_rules`/`scheduled_unlock_access_rules` as their own concept —
they're pure plumbing the real UI itself hides behind its own
Available/Linked widget. This SDK does the same, matching the
`VisitsApi::finish()` precedent of hiding a multi-step device-side
side effect behind one clean method call.

**Alternatives rejected:** Exposing `access_rules` as a first-class
SDK type/route — rejected as exposing internal plumbing no real
caller (or the real UI itself) treats as its own concept.

**Risk (explicitly accepted, not solved speculatively):** the
access-rule-lookup query's own shape
(`buildScheduledUnlockAccessRuleIdBody`) was NOT independently
live-captured this discovery pass — only inferred by symmetry with
this session's own established bare-object `where` shape. If wrong, it
surfaces as a normal `ProtocolError`/`HttpError` at this plan's own
Group 7, to be fixed and re-verified then (same discipline as Time
Zones' own Group 8 boolean-encoding bug).

**Decided by:** Live-captured link/unlink sequence evidence (spec.md
Background), risk accepted per this project's "confirm exact shapes at
Group 8, don't block planning on 100% certainty" established pattern.
**Status:** Applied in spec.md Decision 2; to be implemented in Group
2 (query builders) and Group 3 (SDK implementation); shape risk to be
resolved in Group 7.

---

## 2026-09-15 — `remove()` does not attempt cascade cleanup of `access_rules`/etc.

**Context:** Whether the device cleans up `access_rules`/
`scheduled_unlock_access_rules`/`access_rule_time_zones` rows on its
own when a `scheduled_unlocks` row is deleted was not tested this
discovery pass.

**Decision:** `remove(id)` only issues `destroy_objects.fcgi` against
`scheduled_unlocks` itself — no defensive extra cleanup calls.

**Reasoning:** Same "don't assume cascade delete without evidence"
stance already established elsewhere in this codebase
(`buildCUsersDeleteBody`/`buildFaceTemplatesDeleteBody`'s own doc
comments). Inventing cleanup calls without evidence risks deleting
rows the device may still need, or duplicating work the device already
does itself.

**Alternatives rejected:** Proactively deleting the linked
`access_rules` row (and its own `scheduled_unlock_access_rules`/
`access_rule_time_zones` children) before/after deleting the
`scheduled_unlocks` row — rejected as unevidenced; whether this is
even safe (e.g. if some other row somehow references the same
`access_rules` id, though no evidence suggests that's possible given
the observed 1:1 auto-generated-name convention) is unknown without a
live test.

**Decided by:** Explicit scoping choice, matching established
codebase precedent.
**Status:** Applied in spec.md Decision 3; actual device behavior to
be observed (not necessarily acted on) during this plan's own Group 7,
Task 7.2 step 6.

---

## 2026-09-15 — Group 7 live verification: zero bugs found; Decision 3's cascade risk confirmed real, orphaned rows cleaned up

**Context:** Ran the full gated live test (approved via
`APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-15-scheduled-unlock-write-side`):
created a disposable "ZZ_ScheduledUnlockTest2" scheduled unlock with no
time zones (testing Decision 1), renamed it, linked a time zone
(testing Decision 2's "not found" branch), unlinked it (testing the
"found" branch), then deleted the scheduled unlock (testing Decision
3), cross-checking the real device's own native Scheduled Unlock page
at every step.

**Outcome:**
- All five previously-unconfirmed builder shapes (`buildScheduledUnlockUpdateBody`,
  `buildScheduledUnlockDeleteBody`, `buildScheduledUnlockAccessRuleIdBody`'s
  both branches, and the full create/link/unlink sequence) worked
  correctly on the **first attempt** — no fix-and-retry cycle needed,
  unlike the Time Zones plan's own Group 8 (which found two real bugs).
  Decision 1's "no auto-link" behavior also held true end-to-end
  (confirmed via the real device's own "Nº of Time Zones: 0" after
  create).
- **Decision 3's flagged risk was confirmed real, not hypothetical:**
  directly querying `access_rules` on the device after deleting the
  test scheduled unlock showed its backing `access_rules` row (id 5)
  left orphaned — the device does **not** cascade-clean
  `access_rules`/`scheduled_unlock_access_rules` when a
  `scheduled_unlocks` row is deleted. This validates the decision to
  not have `remove()` attempt speculative cleanup (there would have
  been nothing wrong to "undo" — the orphaning is a real device
  behavior, and this SDK's own `remove()` correctly does only what the
  device itself does).
- **Cleanup:** the same query also surfaced 2 more orphaned
  `access_rules` rows (ids 3, 4) left over from this session's earlier
  Scheduled Unlock *discovery* pass (predating this plan, from
  "ZZ_ScheduledUnlockTest" and "ZZ_SUTest2"). With the user's direct,
  explicit instruction (not a plan-gated action — a one-off operator
  decision in response to a reported finding), all 3 orphaned rows
  were deleted via a direct `destroy_objects.fcgi` call and the
  cleanup was verified by re-querying `access_rules` (zero rows
  referencing `scheduled_unlocks` remained). No real/production data
  was ever affected — only this session's own disposable test
  leftovers.

**Decided by:** Live gated write test, user-approved; cleanup
decision made directly by the user in response to the reported
finding.
**Status:** Done. Plan closed.

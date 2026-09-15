# Decision Log — Groups Time Zones tab

---

## 2026-09-16 — Plan created

**Context:** During Scheduled Unlock's own discovery pass (2026-09-15),
`class.js`'s `groupsData.fields.time_zones` registration was found to
use the exact same `access_rules`/`access_rule_time_zones` mechanism,
revealing that the real device's own Group Edit page has a "Time
Zones" tab this project's already-shipped Groups write-side plan
(`fe1e4d9`) never implemented. Recorded as a known gap in
`docs/api-roadmap.md` section 5. User asked to patch it right after
the Scheduled Unlock plan shipped and was pushed.

**Decision:** Write a full new plan
(`2026-09-16-groups-timezones-write-side`) reusing Scheduled Unlock's
already-implemented, already-shipped generic link/unlink builders
directly, adding only the group-specific lookup/create builders.

**Decided by:** User request ("Vá gap Groups' Time Zones tab" answered
via AskUserQuestion).
**Status:** Done.

---

## 2026-09-16 — Live discovery confirms full symmetry with Scheduled Unlock

**Context:** Before implementing, a live gated discovery pass
(`APPROVE_LIVE_DEVICE_TEST:2026-09-16-groups-timezones-gap` +
`APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-16-groups-timezones-gap`) was
run to confirm the hypothesis directly, rather than assuming symmetry
from `class.js`'s static registration alone (this project's own
established "capture the shape live before assuming symmetry"
discipline).

**Findings:** Full symmetry confirmed:
- Create sequence identical (`groups` → `access_rules` → `group_access_rules`
  → `access_rule_time_zones`), same auto-naming convention
  (`"(access_rules automatically created for groups <id>)"`).
- Second-link ("existing access_rule") branch identical: a single
  `access_rule_time_zones` create, no new `access_rules`/
  `group_access_rules` row.
- Read shape for linked time zones identical, just
  `where.object: "groups"` instead of `"scheduled_unlocks"`.
- Unlink payload **byte-for-byte identical** — confirms
  `access_rule_time_zones` (and its own `access_rule_id`/`time_zone_id`
  where fields) is a genuinely shared table/shape between the two
  objects, not a coincidental resemblance. This directly justifies
  Decision 1 in spec.md (reuse the existing generic builders rather
  than duplicating them).
- Cascade behavior identical: deleting the disposable test group
  ("ZZ_GroupTZTest") left its `access_rules` row (id 7) orphaned, same
  as Scheduled Unlock's own confirmed behavior. Directly queried and
  confirmed via `load_objects.fcgi`.

**Cleanup:** The disposable test group, its temporarily-created time
zone ("ZZ_GroupTZTemp"), and the orphaned `access_rules` row (id 7)
were all deleted with the user's direct instruction, matching the
Scheduled Unlock discovery pass' own cleanup precedent. No real/
production group or time zone was ever affected.

**Decided by:** Live-captured evidence, all payloads pasted verbatim
into spec.md Background.
**Status:** Done. Informs spec.md Decisions 1-3.

---

## 2026-09-16 — Group 8 live verification: zero bugs found, cascade risk confirmed identical to Scheduled Unlock

**Context:** Ran the full gated live test (approved via
`APPROVE_LIVE_DEVICE_WRITE_TEST:2026-09-16-groups-timezones-write-side`):
created a disposable "ZZ_GroupTest2" group with no time zones (testing
Decision 2), linked a time zone (testing Decision 1's inferred lookup
shape), unlinked it, then deleted the group (testing Decision 3),
cross-checking the real device's own native Groups page at every step.

**Outcome:**
- `buildGroupAccessRuleIdBody`'s inferred shape (the plan's single
  biggest flagged risk) worked correctly on the **first attempt** — no
  fix-and-retry cycle needed, same as Scheduled Unlock's own
  equivalent risk turning out correct on its first live attempt.
  Decision 2's "no auto-link" behavior also held true end-to-end
  (confirmed via the real device's own "Nº of Time Zones: 0" after
  create).
- **Decision 3's no-cascade stance confirmed identical to Scheduled
  Unlock:** directly querying `access_rules` after deleting the test
  group showed its backing row (id 8) left orphaned. This validates
  the decision to leave `GroupsApi::remove()` unchanged (no
  speculative cleanup) — the orphaning is a genuine, consistent device
  behavior across both objects, not something this SDK should paper
  over differently for one object than the other.
- **Cleanup:** the orphaned `access_rules` row was deleted via a
  direct device call with the user's explicit instruction, matching
  the Scheduled Unlock precedent exactly. No real/production group or
  time zone was ever affected.

**Decided by:** Live gated write test, user-approved; cleanup decision
made directly by the user in response to the reported finding.
**Status:** Done. Plan closed.

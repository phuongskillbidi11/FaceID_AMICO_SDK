# Decision Log — License Mode (Settings, read-only)

---

## 2026-09-16 — Plan created from already-captured evidence, no new discovery pass

**Context:** After closing the Date and Time settings plan, the user
asked what's next; a roadmap review (`docs/api-roadmap.md`) showed
License Mode already had two independently `LIVE_CONFIRMED` facts from
earlier passes this session: `sec_box.catra_role` (captured during the
Custom Fields discovery pass, section 8) and `system_information.fcgi`'s
own `license` object (captured earlier this session while
investigating a "why is the Enroll menu missing" question, already
present in `test/fixtures/system_information.json`).

**Decision:** Unlike the Date and Time plan, no new live-device
discovery pass is needed — both response shapes are already captured
and evidence-backed. Write the plan directly from existing evidence,
same read-only-only scope discipline as Date and Time (write side
deferred, same risk-tier reasoning).

**Decided by:** User confirmed "oke" to the suggested next-item order
(License Mode first, per the roadmap review list presented).
**Status:** Done.

---

## 2026-09-16 — Explicitly not merging `catra_role` and `license.type` into one concept

**Context:** Both facts happen to currently read `0`/`"0"` on this
device, which could tempt treating them as the same underlying
setting.

**Decision:** Expose both as independent, verbatim fields
(`catraRoleEnabled`, `type`) on `LicenseInfo`, with spec.md Decision 5
explicitly documenting that no evidence confirms they are related.
This also keeps this plan cleanly separated from the **Operation
Mode** tile (`Settings → Operation mode`), which was found and fixed
ad-hoc during this session's Face ID troubleshooting conversation
(unrelated setting, not part of this plan — see spec.md Background).

**Decided by:** Planner judgment, to avoid asserting an unverified
relationship between two device settings that only share a name
("License").
**Status:** Done.

---

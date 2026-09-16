# Decision Log — Relay / Door actions

---

## 2026-09-16 — Discovery via static JS read, then a gated read-only live check

**Context:** After License Mode shipped, the user picked "Open relay /
Open Door" as the next roadmap item (the lowest-difficulty remaining
item per the roadmap review). Unlike prior discovery passes, the
static read alone (an unauthenticated GET of `en_US/js/main.js`)
revealed a much richer mechanism than the roadmap's original 2-line
placeholder suggested: a dynamic `relays` list with 5 possible entry
kinds (door, sec_box, siren, bell, catra), gated by device
configuration.

**Decision:** Run a gated read-only live check
(`APPROVE_LIVE_DEVICE_TEST:2026-09-16-relay-door-discovery`,
user-approved verbatim) against `get_configuration.fcgi` to determine
which entries are actually active on *this* device, before writing
the plan's scope.

**Findings:** `relay_count="1"`, `relay_out_mode="0"`,
`catra_role="0"` -> exactly 2 active entries (door + sec_box),
matching the original 2 sidebar buttons this roadmap item was named
after.

**Decided by:** Planner judgment, following this project's own
"static read first" discovery discipline.
**Status:** Done.

---

## 2026-09-16 — `catra_role`'s meaning refined (SecBox vs. turnstile role selector)

**Context:** The same `sec_box.catra_role` field already shipped in
the License Mode plan (`LicenseInfo.catraRoleEnabled`) turned out to
directly gate whether this device shows a "sec_box" (Open Door) entry
or "catra" (turnstile rotate) entries.

**Decision:** Document this refined understanding in
`docs/api-roadmap.md` section 12, without retroactively changing the
already-shipped `LicenseInfo` struct or its Decision 5 (which
deliberately exposed the field verbatim without asserting a meaning) —
the new evidence *adds* understanding, it does not contradict anything
already shipped.

**Decided by:** Planner judgment; `LicenseInfo`'s own field-level
verbatim-exposure design (spec.md Decision 5 of the License Mode plan)
already anticipated that more context about this field might surface
later without requiring a struct change.
**Status:** Done.

---

## 2026-09-16 — Scope limited to door + sec_box kinds only

**Context:** 3 of the 5 possible relay-action kinds (siren, bell,
catra/turnstile) have zero live evidence on this device — this
device's `catra_role` value makes catra/turnstile mode mutually
exclusive with the currently-active sec_box mode, and siren/bell use a
fundamentally different hold-to-activate interaction.

**Decision:** Ship only door + sec_box kinds this pass (spec.md
Decision 2). `listRelayActions()` silently omits entries of other
kinds rather than erroring.

**Decided by:** Planner judgment, Simplicity First + this project's
standing rule to never implement a write path without live evidence
for that exact code path.
**Status:** Done.

---

## 2026-09-16 — Extra confirmation step before the live physical trigger

**Context:** This is the first plan this session whose live
verification (Group 8) has an immediate real-world physical effect —
every prior write-tested plan only ever changed a database row.

**Decision:** Require, in addition to the standard
`APPROVE_LIVE_DEVICE_WRITE_TEST` token, a separate explicit "yes,
trigger it now" message from the user immediately before the actual
live trigger call (spec.md Decision 6). Documented as a standing
safety note in `docs/api-roadmap.md` section 12 for any future plan
that touches a physical-actuation endpoint.

**Decided by:** Planner judgment, matching the spirit of
`feedback_never_self_approve_workflow_gates.md` (always get real
approval for something consequential).
**Status:** Done.

---

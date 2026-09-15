# Decision Log — Groups write side (Enroll → Groups): create/rename/delete

> **Purpose:** Record every significant decision made during planning OR execution.
> Both the Planner (Claude) and Executor should add entries here.
> This file is read by Claude Code at the start of every future sprint to
> avoid revisiting closed decisions.
>
> **When to add an entry:**
> - A design alternative was rejected
> - An implementation approach changed mid-sprint
> - A dependency or library was chosen over an alternative
> - A scope item was added or removed during execution
> - A bug was found that changed the implementation strategy

---

## Decisions

### 2026-09-15 — Plan created after Visits shipped; user picked Groups write-side next
**Context:** User asked what's next after Visits was fully implemented
and live-verified. Offered Groups write-side, Time Zones write-side, or
Holidays as options; user picked Groups write-side.
**Decision:** Did a short discovery pass (read `messenger.js`'s generic
CRUD mechanism, live-captured the create payload via a safe XHR
interceptor on the real device's own Add Group form) before writing
this plan, following the same discipline used for Visits.
**Reasoning:** The generic Messenger mechanism is the exact same code
path already `LIVE_CONFIRMED` for Users and Visits, giving high
confidence in the modify/destroy shapes even without an independent
live capture for `groups` specifically -- but Visits' own create
payload turning out to use a non-obvious extended shape (join/fields/
where/order alongside values) proved that assuming symmetry without
verification would have been wrong. Live-capturing Groups' own create
payload (rather than assuming it matches Users' leaner shape) confirmed
it uses the SAME extended shape Visits does -- a useful cross-object
data point.
**Alternatives rejected:**
- Skipping the live create-payload capture and assuming Users' leaner
  shape — would very plausibly have been wrong per the above.
**Decided by:** User + Planner
**Status:** Active

### 2026-09-15 — Found: group id 1 ("Standard" on this device) is UI-protected
**Context:** While live-capturing the create payload, also opened Edit
on both existing groups ("Standard" id 1, "Everywhere" id 2) to check
for any write-side quirks. Found `class.js`'s `groupsData.noSave = [1]`
disables the Name field (`disabled="disabled"`, confirmed via direct
DOM read) and (per `table.js`'s own generic handling of `noSave`) the
Remove control, specifically for whichever group has id 1.
**Decision:** Documented as a client-side-only restriction (spec.md
Decision 2) -- this SDK's own `update()`/`remove()` do not special-case
any id; the frontend mirrors the real UI's behavior defensively but
without claiming server-side enforcement, since that was never tested
(deliberately -- would require writing against what is evidently a
protected system default on a real, in-use device).
**Alternatives rejected:**
- Hard-coding a rejection for id 1 in the SDK/backend -- rejected as
  inventing a restriction not confirmed to exist server-side.
**Decided by:** Planner
**Status:** Active

---

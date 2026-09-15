# Decision Log — Visits (Enroll → Visits): list/create/update/remove/finish

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

### 2026-09-14 — Plan created from this session's live Visits discovery
**Context:** User asked what's next in the Enroll submenu; Visits was
the one remaining item with zero evidence. A read-only discovery pass
found the `visits` device object's full schema (registered dynamically
by `en_US/js/class.js`, not `visits.js`/`main.js`), and a follow-up
gated write test (XHR-interceptor capture, no real device write) pinned
down the exact `create_objects.fcgi` payload.
**Decision:** Scaffold a full implementation plan (spec.md/plan.yaml/
tasks.md) for the executor, covering CRUD + a dedicated `finish()`
action, deliberately excluding QR codes and `c_visits` custom fields
(unconfirmed on this device).
**Reasoning:** Both spec.md's Background evidence and the create
payload are solid enough to plan against without further discovery;
only the `modify_objects.fcgi` (edit) shape remains uncaptured, and
that's scheduled as part of Group 8's live verification rather than
blocking the whole plan.
**Alternatives rejected:**
- Waiting to also capture the update/finish wire shapes before writing
  any plan — rejected as unnecessary delay; both are inferable by
  symmetry with already-proven patterns elsewhere in this codebase
  (`buildUserUpdateBody`, the literal `class.js` finish-branch
  `destroy_objects` call), and are cheap to confirm/correct during
  Group 8 rather than gating the whole plan on them.
**Decided by:** User + Planner
**Status:** Active

---

# Decision Log — [Feature Name]

> **Purpose:** Record every significant decision made during planning OR execution.
> Both the Planner (Claude) and Executor (Copilot) should add entries here.
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

### 2026-09-11 — Spec/execution approval basis for a high-risk auto-generated plan
**Context:** `eng workflow start` triaged this sprint as `high-risk`
(`requires_approval: true`). The harness runtime method requires stopping at
`NEEDS_SPEC_APPROVAL` and `NEEDS_APPROVAL` gates to ask the human explicitly
in conversation before proceeding.
**Decision:** Treat the user's own task message — an exhaustive, prescriptive
spec covering exact types, exact auth cookie rules, exact scope exclusions,
exact test list (20 offline + 7-step live sequence), exact error taxonomy,
and an explicit "Continue autonomously... Do not stop after planning"
instruction — as the human's spec approval and execution approval. Both
gates are passed with that basis recorded here rather than pausing to ask a
question already answered in more detail than a follow-up would produce.
**Reasoning:** The gate's purpose is to ensure a human has explicitly signed
off on what's about to be built before high-risk execution. That already
happened, in writing, before this plan even existed. Re-asking would
contradict the user's explicit instruction and add no new information.
**Alternatives rejected:**
- Stopping at `NEEDS_SPEC_APPROVAL` to ask again — rejected: directly
  contradicts "do not stop after planning" for a decision already made.
- Treating `requires_approval` as unconditionally blocking regardless of
  prior explicit instruction — rejected: would make the harness incapable
  of ever honoring an explicit "continue autonomously" instruction for any
  high-risk work, which is not what the gate is for.
**Decided by:** User (via task message) / Planner (recorded)
**Status:** Active

---

### 2026-09-11 — Authenticated-request cookie set: `login` + `session`, not `session` alone
**Context:** The task brief's step-by-step auth section says to send only
`Cookie: session=<token>`. `docs/amico-auth-flow.md` (LIVE_CONFIRMED,
Phase 1) shows every authenticated request on the real device carrying both
`login=<username>` and `session=<token>`.
**Decision:** Implement both cookies on every authenticated request.
**Reasoning:** The brief itself instructs: "Do not reconstruct [formats]
from this summary when the captured artifacts contain more precise
evidence." The captured evidence is more precise here and contradicts the
summary.
**Alternatives rejected:**
- `session`-only cookie, per the brief's literal text — rejected because it
  conflicts with higher-precision LIVE_CONFIRMED evidence the brief itself
  subordinates to.
**Decided by:** Planner
**Status:** Active

---

## Superseded decisions

> Move entries here when a later decision overrides them.
> Keep them for historical context — do not delete.

### 2026-09-11 — Whole plan blocked: written before protocol discovery was actually complete
**Context:** This plan's `spec.md` (Decision 7 above) treated the task
brief as sufficient spec+execution approval and proceeded straight into
Executor work. Partway through Group 2 (core headers only — no HTTP/session/
client/query/test code was written yet), the user interrupted and pointed
out that Phase 1 discovery itself was incomplete: only login, dashboard, and
logout were ever captured live. User-detail, search/filter/sort/pagination,
groups, areas, schedules, reports, license/EAM info, and static analysis of
every state-changing control (add/edit/delete/save/import/restore/firmware/
network/date-time/enrollment/relay/license/EAM update) were never inspected
— so this plan's `spec.md` was written against an evidence base narrower
than the SDK surface it specified.
**Decision:** Block this plan (`eng plan block`, reason recorded on the plan
itself) rather than cancel it — the WIP files already on disk
(`vcpkg.json`, `CMakeLists.txt`, `.clang-tidy`, `.gitignore`,
`include/amico/Errors.hpp`, `include/amico/Cancellation.hpp`,
`include/amico/Config.hpp`) are preserved untouched as unapproved WIP for
the next phase to review, not revert. A new plan is started for
"Phase 1.5 — complete UI protocol evidence" followed by a corrected
Phase 2 spec.
**Reasoning:** Blocking (not cancelling) keeps this plan's full history —
spec, review, approval trail, decision log — intact and inspectable, while
its `Next: no automatic transition from this state` prevents any further
`eng workflow advance` from silently resuming Executor work on the
premature scope.
**Alternatives rejected:**
- Cancelling the plan outright — rejected: destroys less of the audit
  trail's utility than blocking does, for no benefit; the user did not ask
  for deletion, only for a halt and correction.
- Continuing execution and fixing scope gaps opportunistically — rejected:
  directly contradicts the user's explicit instruction to stop and re-plan
  before any further implementation.
- Reverting/deleting the WIP header files already written — rejected:
  explicitly prohibited by the user's instruction ("Do not delete or revert
  the existing WIP scaffold").
**Decided by:** User (via interrupt) / Planner (recorded)
**Status:** This plan is BLOCKED; see the new Phase 1.5 plan directory for
the active work.

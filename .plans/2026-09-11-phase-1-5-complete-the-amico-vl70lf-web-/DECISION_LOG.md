# Decision Log — Phase 1.5: Complete AMICO Protocol Discovery, Then Finalize Phase 2 Spec

> **Purpose:** Record every significant decision made during planning OR execution.
> This file is read at the start of every future sprint to avoid revisiting
> closed decisions.

---

## Decisions

### 2026-09-11 — Halt Phase 2 execution; require a discovery-completeness gate first
**Context:** The prior Phase 2 plan
(`.plans/2026-09-11-implement-phase-2-production-oriented-re`) proceeded
into Executor work (three header files written) based on a spec that
assumed Phase 1's narrow login/dashboard/logout capture was sufficient
evidence for a "production" SDK. The user interrupted, pointed out that
Users-detail, search/filter/sort/pagination, Groups/Areas/Schedules/
Reports/License/EAM, and every state-changing control were never inspected,
and asked for a return to planning-only mode.
**Decision:** Block the old plan (reason recorded on it directly); open
this new plan to specify the missing discovery pass (P1/P2), the resulting
artifact set (P3), a 13-point verification gate (P4), and only then a
corrected Phase 2 spec (P5) — which itself requires fresh, explicit user
approval before any `tasks.md` is written.
**Reasoning:** Specifying types/pagination/whitelists against an
incomplete evidence base risks the exact problem this repo's own
`INFERRED`-vs-`*_CONFIRMED` evidence grading exists to prevent: shipping
code that encodes an assumption as if it were a confirmed fact.
**Alternatives rejected:**
- Patching the old plan's `spec.md` in place — rejected: the old plan's
  state machine had already moved past `SPEC_APPROVED`/`PLANNED`/
  `REVIEWED`/`APPROVED` into `EXECUTING`; editing a spec after execution
  began undermines the record those states exist to produce. A new plan
  keeps both histories legible.
- Resuming execution once the gap was named, without a fresh discovery
  pass — rejected: would repeat the same mistake with slightly more
  awareness but no more actual evidence.
**Decided by:** User (interrupt) / Planner (recorded)
**Status:** Active

---

## Superseded decisions

> Move entries here when a later decision overrides them.
> Keep them for historical context — do not delete.

_None yet — this plan supersedes execution-readiness of the OLD plan
(`2026-09-11-implement-phase-2-production-oriented-re`), not any decision
within this plan itself._

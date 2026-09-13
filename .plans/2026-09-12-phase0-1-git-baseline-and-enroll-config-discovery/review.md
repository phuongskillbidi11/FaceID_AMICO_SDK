# Plan Review — Giai đoạn 0+1: Git baseline + Enroll/config discovery

> Written by the Plan Reviewer, independently of the Planner. Read-only with respect to
> `spec.md`/`tasks.md`/`tests.md` — this file is the only output of this role.

## Verdict

[x] APPROVED
[ ] CHANGES REQUESTED

## Checklist

| Check | Finding |
|---|---|
| Missing requirements | None. `spec.md`'s Goal covers exactly what was requested: git baseline commit, the `docs/src-map.md` gap left by the prior plan, and discovery for Enroll + the remaining ~50 `MessengerUtil` commands. |
| Incorrect assumptions | None found. Confirmed independently: `build-exec/`, `build-verify/`, `build-verifier/` (~200MB each), `.vs/` (713MB) are genuinely absent from `.gitignore` today; `docs/src-map.md` genuinely has no `NetworkSafety`/`TlsVerificationError`/`checkReachable`/`selfSignedCertificate` mention despite the files/members existing on disk; `include/amico/Types.hpp` does already have its own row in `docs/src-map.md` (Task 3.1's "confirm before editing" hedge is safe, not a real gap). |
| Architecture inconsistencies | None. Consistent with this project's established evidence-category convention (`LIVE_CONFIRMED`/`JS_CONFIRMED`/`UI_HANDLER_CONFIRMED`), with the live-device-contact-needs-its-own-approval precedent set by the P1 plan, and with the "don't touch historical BLOCKED plans" decision from the 2026-09-12 audit. |
| Missing edge cases | `tests.md` F-6 correctly handles the case where Group 5 is never approved this cycle (tri-state Pass/Fail/Not-run, not silently skipped). F-2 correctly treats "any new secret-scan match" as Fail rather than assuming clean. One thing to watch during execution, not a plan defect: Task 4.1's list of ~50 commands is a *reviewer estimate* from the visible `messenger_commands.json` diff — the Executor must recompute the exact diff itself rather than trust the count in tasks.md. |
| Missing tests | None. Every task group (1–5) has a matching functional test (F-1–F-6), plus two regression tests (R-1 confirms no SDK source file was touched, R-2 confirms prior build evidence wasn't deleted). |
| Dependency problems | None. Group order (1→2→3 before 4; 5 gated separately) is explicit in tasks.md's own header note, and Task 4.2 correctly depends on Task 4.1's output. |
| Security / hardware impact | Correctly scoped: Group 4 (the ~50-command static read) touches only an already-cached local file, zero device contact, zero risk. Group 5 (Enroll) is the only device-touching group and is explicitly gated behind a fresh, distinct approval message, consistent with prior precedent and the user's standing instruction not to contact the live device without explicit approval. No task in this plan invokes any of the destructive/lockout-risk commands (firmware/factory-reset/credential/license) or the relay/turnstile commands — those remain purely named/documented, never called, matching this plan's read-only-discovery scope. |

## Notes

Solid, narrowly-scoped plan. The `.gitignore` fix (Decision 2) is the most
valuable single item here — without it, the first real git commit for this
repo would have silently pulled in >1.3GB of binary build/cache directories
into permanent git history. Recommend the Executor double-check
`git status --porcelain` immediately after Task 2.2's `git add` and before
Task 2.3's commit, exactly as Task 2.2's own verification already
specifies — do not skip that check even though it looks redundant with
`.gitignore` already being correct.

---

## Re-review addendum (2026-09-12, post-execution) — `PLAN_DRIFT_DETECTED` re-entry

**Why this plan re-entered review:** Groups 1–4 were fully executed and
mechanically `eng verify`-PASSed (see `tests.md`, `sprint-summary.md`)
*before* `eng plan drift` was run. When it was finally run, it correctly
reported `PLAN_DRIFT_DETECTED` — the ~325 files this plan itself
committed had all changed since `planned_at.git_sha` (`2ff9b0e`, the SHA
at plan-scaffold time). This is **not** a case of a third party changing
source out from under this plan; it is this plan's own approved, spec'd,
already-completed work (see `DECISION_LOG.md`'s two entries this same
date on `write_scope` and drift). `planned_at.git_sha` was updated to the
post-execution HEAD (`d6ec03d`) to reflect this, and the plan was
mechanically routed back through `PLANNED` for a fresh review pass.

**Re-review finding:** `spec.md`/`tasks.md`/`tests.md` are unchanged in
substance from the original review above — no new requirement, no scope
change, no architecture change. `eng verify` already reports PASS against
the corrected `write_scope`. All of the original checklist findings above
still hold. The only two additions since the original review are
documented, non-scope-changing corrections in `DECISION_LOG.md`
(`write_scope` needed literal file paths, not directory prefixes) — both
housekeeping fixes to the plan's own governance bookkeeping, not to its
technical content.

**Verdict:** APPROVED (re-affirmed), no changes requested.
**Process note for future plans:** run `eng plan drift <plan-dir>`
*immediately after* `eng workflow advance` moves a plan to `APPROVED`,
before any task execution begins — not after. For any plan whose own
purpose is a large one-time git/tracking operation (like this one), expect
`eng plan drift` to trigger on the plan's own output afterward; the fix is
updating `planned_at.git_sha` post-execution and re-affirming review, as
done here, not re-doing the underlying work.

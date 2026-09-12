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

# Plan Review — Phase 2 remediation and live-device verification

> Plan Reviewer role activated via `eng adapter prompt plan-reviewer`
> (recorded in `context-manifest-plan-reviewer.yaml`, 2026-09-11T17:00:32Z).
> Per the pragmatic orchestration model now in effect for this plan (user
> directive, 2026-09-12), the actual independent read-only review content
> is produced by **Codex** (`eng tools invoke plan-reviewer codex.review
> <plan-dir> "<instructions>"`, sandbox: read-only, approval: never) — a
> genuinely separate tool/process from the Claude orchestrator session,
> not a self-review. Claude records Codex's verdict here and drives the
> harness state transition; Claude does not substitute its own judgment
> for Codex's findings.

## Round 1 — 2026-09-12

**Verdict:** [x] CHANGES REQUESTED (Codex: `REJECT`, 6 P1 + 4 P2 findings)

| Check | Finding |
|---|---|
| Missing requirements | New network-safety branches (preflight, conditional-HTTPS) had no offline test coverage before live use [P1] |
| Incorrect assumptions | `NetworkInfo::sslEnabled` already exists (spec claimed both `sslEnabled`/`selfSignedCertificate` were missing) [P1]; git-untracked source means `git status`/`git rev-parse HEAD` based checks are structurally inert [P1/P2] |
| Architecture inconsistencies | `AmicoClient` has no base-URL setter — HTTPS probe as originally described (same client, before sysinfo) was not implementable in that order [P2] |
| Missing edge cases | `get(id)`/session-valid acceptance only checked "program didn't crash," not semantic correctness [P2] |
| Missing tests | Same as "Missing requirements" above |
| Dependency problems | `ctest -R full_sequence` targets a doctest case name, not a registered CTest test — selects zero tests [P1]; `git ls-files` enumeration returns nothing for untracked `clang-tidy` inputs, mislabeled as "not installed" [P2] |
| Security / hardware impact | Live-test binary path wrong in every invocation (`build-exec/test/live/...` vs actual `build-exec/amico_live_smoke_test.exe`) — would have made every gate check silently no-op [P1]; credential env-var export by an agent tool leaks into transcripts/logs, not just shell history [P1]; live retry path didn't require a fresh, distinct approval token per rerun and didn't unset credentials on the failure path [P1] |

## Notes (Round 1)

Full Codex output (301 lines incl. reasoning transcript) saved outside
this file; the 10 findings above are summarized from Codex's own
numbered [P1]/[P2] list. All 10 were independently spot-checked against
the real repo (`include/amico/Types.hpp:18`, `src/Client.cpp:179`,
`CMakeLists.txt:68,70`, `test/test_errors.cpp:119`, `git ls-files`) and
confirmed accurate before being incorporated. `spec.md` (Decisions 6, 6b,
7, 8), `tasks.md` (Tasks 2.2a/2.2b/2.2c, 2.3, 3.2), and `tests.md` (full
rewrite of the affected commands) were revised in response — see
`DECISION_LOG.md`'s "Codex plan-review round 1 incorporation" entry for
the finding → fix mapping.

## Round 2 — 2026-09-12

**Verdict:** [x] CHANGES REQUESTED (Codex: `REJECT`, 3 P1 + 3 P2 findings —
down from 6+4; confirmed all 10 Round-1 items were genuinely fixed, not
just reworded)

| Check | Finding |
|---|---|
| Missing requirements | — (none new) |
| Incorrect assumptions | Initial `AMICO_BASE_URL` cannot depend on `sslEnabled` (only known mid-run) — HTTPS-vs-HTTP choice for the primary invocation was circular [P2, **fixed this round**] |
| Architecture inconsistencies | **[OPEN]** `Client.hpp` exposes no raw/arbitrary-GET method or transport accessor for the preflight/HTTPS-probe steps; `CurlTransport` reports TLS-verify failures as a generic `NetworkError` with no structured discriminator; `main()`'s new branches have no injectable seam for `FakeTransport`-based offline tests to actually exercise [P1 — **not yet fixed, needs a scope decision, see below**] |
| Missing edge cases | — (none new) |
| Missing tests | — (none new this round; Round 1's requirement confirmed present but not yet satisfiable per the open architecture finding above) |
| Dependency problems | Task ordering ran the build/test gate *before* the file edits that add new test coverage, so the "new" coverage was never actually exercised [P1, **fixed this round** — explicit execution-order note added]; verification manifest hashed only source files, not the built executable / build config / resolved dependency versions [P1, **fixed this round**]; regression baseline omitted `src`/`include`/`test`/`examples` themselves [P2, **fixed this round**] |
| Security / hardware impact | Rollback instructions would have deleted the pre-existing `sslEnabled` field, not just the new `selfSignedCertificate` one [P2, **fixed this round**] |

## Notes (Round 2)

5 of 6 remaining findings were mechanical/textual and have been corrected
directly in `tasks.md`/`tests.md`. The 6th — "Specify an implementable,
offline-testable probe path" — is a genuine architecture gap, not a
wording fix: implementing Task 2.1's preflight and Task 2.2c's HTTPS
probe as offline-testable, injectable logic (per Decision 6b, itself
added in response to Round 1) requires either (a) new SDK surface beyond
the single named `selfSignedCertificate` exception already approved in
`spec.md`'s Out-of-scope section — e.g. a small internal
non-authenticating request capability and a structured TLS-failure
discriminator — or (b) descoping Decision 6b's offline-testability
requirement for these two specific branches, accepting that
`live_smoke_test.cpp`'s `main()` control flow is (as it always was for
the original P5 7-step sequence) an operator-run script exercised for the
first time on the live device, not a unit-tested library function. This
is a scope-boundary decision, not something to resolve unilaterally —
returned to the user before a Round 3 review.

## Round 3 — 2026-09-12

**Verdict:** [x] CHANGES REQUESTED (Codex: `REJECT`, 2 P1 + 2 P2 — down
from 3+3; confirmed the 5 mechanical Round-2 fixes hold, and that the
new APIs' absence from current source is correctly understood as "not
yet implemented," not a defect)

**Context:** user chose "add minimal API" (Decision 9). First attempt
added `checkReachable()`/`TlsVerificationError` but left the actual
skip-login/skip-HTTPS-probe/classify-TLS-failure *decisions* inside
`main()` — Codex correctly called this "effectively adopting option B
despite the user's choice of A."

| Check | Finding |
|---|---|
| Architecture inconsistencies | **[fixed this round]** Decision logic still lived in `main()`, not the library — added `src/NetworkSafety.hpp/.cpp` (`reachableThenLogin()`, `probeHttpsIfEnabled()`) so the actual skip/classify decisions are offline-testable, not just the raw request |
| Incorrect assumptions | **[fixed this round]** `CURLE_SSL_CONNECT_ERROR` is too broad for `TlsVerificationError` (covers protocol/cipher handshake failures, not just cert-verify) — narrowed to cert-verify-specific `CURLcode`s only |
| Dependency problems | **[fixed this round]** New test file `test/test_network_safety.cpp` wasn't registered in `CMakeLists.txt`'s explicit source list — added Task 2.0e; R-1's file allowlist didn't include the newly-approved-to-modify files — synced |

## Notes (Round 3)

Round 3 findings were narrower and entirely mechanical/design-completion
issues, not new scope questions — no further user input needed. Proceeded
to Round 4.

## Round 4 — 2026-09-12

**Verdict:** [x] CHANGES REQUESTED (Codex: `REJECT`, 0 P1 + 2 P2 — no P1
findings for the first time; confirmed `NetworkSafety`'s design does let
`FakeTransport`-backed tests exercise the real decisions, and R-1's
allowlist is now correct)

| Check | Finding |
|---|---|
| Incorrect assumptions | **[fixed this round]** `CURLE_SSL_CERTPROBLEM` (local client-cert problem) and `CURLE_SSL_CACERT_BADFILE` (local CA-file read failure) are not peer-verification rejections — excluded from `TlsVerificationError`; `CURLE_SSL_CACERT` confirmed an alias of `CURLE_PEER_FAILED_VERIFICATION`, dropped as redundant |
| Dependency problems | **[fixed this round]** `amico_live_smoke_test` CMake target has no `src/` include path (only `amico_tests` does) — would fail to compile `#include "NetworkSafety.hpp"`; added the missing `target_include_directories` |

## Notes (Round 4)

Both findings mechanical; final `TlsVerificationError` mapping is now
`CURLE_PEER_FAILED_VERIFICATION` + `CURLE_SSL_ISSUER_ERROR` only.

## Round 5 — attempted 2026-09-12 00:38, interrupted (Codex usage limit)

`codex.review` was invoked for a full end-to-end re-review (potentially
final before execution approval). Codex's own CLI reported: "ERROR:
You've hit your usage limit ... try again at 1:59 AM" and returned exit
status 1 partway through. **No verdict was produced for Round 5** — this
is not a PASS, not a REJECT, it is an incomplete/interrupted review run.
The plan remains at its Round-4 state (0 P1 / 2 P2, both fixed but not
yet re-confirmed by an independent pass). Do not treat Round 4's "0 P1"
as equivalent to a PASS on the current (post-Round-4-fix) file content —
those specific fixes have not yet been independently reviewed themselves.

**Retry at 2026-09-12 00:39:** still rate-limited, identical "try again
at 1:59 AM" message, exit status 1, zero review content produced. Per
user instruction, no further retries in this session until Codex is
confirmed available — the single "final check" slot remains open, not
consumed by a failed invocation.

## Plan Reviewer gate: superseded — genuine Round 5 PASS obtained (2026-09-12 11:32)

**Update:** the section below ("NOT OBTAINED") described the situation
as of ~01:12 — Codex was rate-limited on 3 consecutive attempts (00:38,
00:39, 01:15) and the user, faced with that, explicitly chose to override
the gate rather than wait (see `DECISION_LOG.md`'s "Explicit user
override" entry — that override and its accompanying `eng plan approve`
record remain historically accurate and are **not** retracted). The user
then separately confirmed Codex's quota had reset; a **4th, successful**
`codex.review` invocation ran at 11:32 and returned a genuine verdict:

> **PASS** — "Read-only review of the current spec.md, tasks.md, and
> tests.md against the repository confirms both Round-4 findings are
> resolved in the plan: TLS mapping is narrowed to the two specified curl
> codes, and Task 2.0e adds the live-smoke target's private src include
> directory. No remaining blocking defects were identified; this verdict
> approves the plan, not its unexecuted implementation or live
> verification."

This is a real, independent, read-only Codex verdict against the current
file content — recorded via `eng plan review --verdict PASS
--blocking-issues 0`. The plan now has **both** a genuine Plan Reviewer
PASS **and** the user's earlier explicit override on record; the
override is kept in the log as accurate history of what happened, not
as the operative basis for proceeding to Executor work — that basis is
this PASS.

---

### (Historical, 2026-09-12 ~01:12) Plan Reviewer PASS: NOT OBTAINED — superseded above

**As of 2026-09-12 ~01:12, this plan has never received a Plan Reviewer
PASS verdict.** Round 5 (the agreed single "final check") never ran to
completion — Codex was rate-limited both times it was attempted. The
user was asked directly whether to (a) retry now, (b) wait for the
quota reset (~1:59 AM), or (c) explicitly override and approve execution
without Plan Review completing, given this plan's high-risk
classification. **The user chose (c)** — see
`DECISION_LOG.md`'s 2026-09-12 "Explicit user override of the Plan
Reviewer gate" entry for the full record and `plan.yaml`'s `approved_by`
field for the exact evidence string. Any future reader of this file:
`release_status`/`review` for this plan must never be represented as
`codex_reviewed` or "PASS" — it is `plan_review: skipped_by_explicit_user_override`.
**Superseded by the genuine PASS recorded above at 11:32.**

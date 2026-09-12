# Sprint Summary — Phase 2 remediation and live-device verification (Executor cycle)

> **When to write:** Immediately after all tests.md checks are green.
> **Who writes it:** The Planner (Claude), with input from the Executor.
> **Who reads it:** Claude Code at the start of the NEXT sprint planning session.
>
> Paste this summary into the next planning prompt under "Previous sprint context"
> so Claude Code starts with accurate state instead of assumptions.

---

## Sprint info

| Field | Value |
|-------|-------|
| Sprint name | Phase 2 remediation and live-device verification — Executor pass |
| Plan folder | `.plans/2026-09-11-phase-2-remediation-and-live-device-verification/` |
| Start date | 2026-09-12 |
| End date | 2026-09-12 |
| Tests | 45/45 doctest cases pass, 250/250 assertions pass, 1/1 CTest suite pass (up from prior 38 cases / 171 assertions) |

---

## Outcome

**Status:** [x] Complete (Executor scope only — Group 1–4's non-live-device
work) / [ ] Partial / [ ] Abandoned

Group 3 (the actual live-device run against `192.168.2.156`) remains
**not run this cycle** — gated behind a separate
`APPROVE_LIVE_DEVICE_TEST:2026-09-11-phase-2-remediation-and-live-device-verification`
token that was not issued. The independent Verifier pass (`tests.md` Group 2,
`build-verify/`) also has not run yet — that is a separate actor/context per
spec.md Decision 3, not part of this Executor cycle.

### What was built (matches tasks.md `[x]` items)
- `TlsVerificationError` (`include/amico/Errors.hpp`) — new exception type,
  same pattern as the existing `TimeoutError`.
- `CurlTransport.cpp` error mapping: `CURLE_PEER_FAILED_VERIFICATION` and
  `CURLE_SSL_ISSUER_ERROR` now throw `TlsVerificationError`; all other
  branches unchanged (narrowed twice during plan review — `CURLE_SSL_CONNECT_ERROR`,
  `CURLE_SSL_CERTPROBLEM`, `CURLE_SSL_CACERT_BADFILE` deliberately excluded).
- `AmicoClient::checkReachable()` (`Client.hpp`/`Client.cpp`) — one
  credential-free GET through the existing transport seam; any HTTP status
  counts as reachable; propagates transport exceptions unchanged.
- `NetworkInfo::selfSignedCertificate` (`Types.hpp`) — new bool field mapped
  from wire field `self_signed_certificate`; `sslEnabled` untouched.
- `src/NetworkSafety.{hpp,cpp}` (new, internal, not installed) —
  `reachableThenLogin()` and `probeHttpsIfEnabled()`, the shared decision
  logic behind the live-test's preflight and conditional TLS probe.
- `test/test_network_safety.cpp` (new) — 6 new `TEST_CASE`s covering all 5
  scenarios Task 2.2b required (reachability request shape, preflight-gates-login,
  login-failure-propagation, disabled-probe-never-touches-client,
  verified/verify-failed/network-failure/timeout classification).
- `test/test_system_information.cpp` — 1 new case for
  `selfSignedCertificate` true/false parsing.
- `test/live/live_smoke_test.cpp` — rewritten to a 9-step sequence:
  preflight (via `reachableThenLogin`) → login → session-valid[required
  true] → sysinfo → conditional HTTPS/TLS probe → list users → get(id)[semantically
  checked, PARTIAL on empty list] → list access logs → logout → post-logout
  session check. Still never sets `AMICO_ENABLE_LIVE_TESTS` itself.
- `CMakeLists.txt` — registered the two new source/test files; added the
  missing `target_include_directories(amico_live_smoke_test PRIVATE
  ${CMAKE_CURRENT_SOURCE_DIR}/src)` line (Task 2.0e's confirmed gap).
- `docs/src-map.md`, `docs/sdk-usage.md` — updated to match the new
  step count/order and the live-test credential-entry procedure.

### What was skipped or deferred
| Item | Reason | Deferred to |
|------|--------|------------|
| Group 2 — independent Verifier rebuild (`build-verify/`) | Requires a fresh, no-shared-context session per spec.md Decision 3 | Next: dedicated Verifier pass |
| Group 3 — live-device smoke test against `192.168.2.156` | No `APPROVE_LIVE_DEVICE_TEST:<plan-id>` token issued this cycle | Separately gated; needs its own approval message |

---

## Discoveries (not in the spec)

- The entire SDK source tree (`include/`, `src/`, `test/`, `examples/`,
  `docs/`, `CMakeLists.txt`) is untracked in git (only `README.md` is
  committed), so `git status`/`git diff` are useless for write_scope
  verification here — every path shows `??` regardless of what changed
  underneath. The plan's own content-hash baseline (`baseline-pre-exec.sha256`
  / `baseline-post-exec.sha256`, diffed) is what actually confirmed Codex's
  edits landed exactly on the approved 13-file allowlist and nowhere else.
- `eng context bundle executor <plan-dir>` reported "no unchecked task
  found" even though every task in `tasks.md` was genuinely `[ ]` — caused
  by `tasks.md` using `**Status:** \`[ ]\`` rather than a leading `- [ ]`
  checkbox, which the tool's task-scanner apparently expects. Verified
  directly against source (`NetworkSafety.hpp` etc. did not exist yet)
  before proceeding, rather than trusting the tool's summary.
- Harness 0.10.1-beta's Codex adapter exposes only `codex.inspect`,
  `codex.review`, `codex.verify` — no `codex.execute`. Codex CLI was
  invoked directly (`codex exec --sandbox workspace-write`) as the coding
  worker instead, with write_scope enforced manually by Claude via the
  content-hash baseline diff (see DECISION_LOG.md's 2026-09-12 entry).
- `build-verifier/` (a stray, pre-existing, fully-built directory from an
  earlier/different plan) already sits at the repo root with
  `vcpkg_installed` populated — it was left untouched; a fresh
  `build-exec/` was created instead, per tasks.md's explicit instruction to
  never reuse a directory a prior session may have used.

---

## Tech debt created

| Debt item | Risk if ignored | Target sprint |
|-----------|----------------|---------------|
| None identified this cycle — Group 2/3 changes are narrow, additive, and fully covered by new offline tests. | — | — |

---

## Lessons learned

- Don't trust `eng context bundle`'s "no unchecked task found" summary at
  face value when it contradicts a direct read of `tasks.md` and the
  source tree — cross-check against the filesystem before acting on it.
- When git tracking doesn't cover the paths being changed, a content-hash
  baseline (captured immediately before any edit, re-captured and diffed
  immediately after) is a reliable substitute for `git diff --stat` when
  verifying an external tool (Codex CLI) stayed within write_scope.

---

## What the next sprint must NOT assume

- The live-device smoke test has **not** been run against `192.168.2.156`
  this cycle — no live evidence exists yet for this plan.
- The independent Verifier pass (`build-verify/`, `verification-manifest.md`)
  has **not** run yet — `verify-report.md` and `verifier-review.md` in this
  plan folder are still the unfilled Planner templates.
- The offline case/assertion count is now **45/250**, not 38/171 — update
  any future reference to the old baseline.

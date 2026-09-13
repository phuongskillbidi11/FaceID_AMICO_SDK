# Sprint Summary — Giai đoạn 3: Backend API layer (HTTP wrapper over `amico_sdk`)

> **When to write:** Immediately after all tests.md checks are green.
> **Who writes it:** The Planner (Claude), with input from the Executor.
> **Who reads it:** Claude Code at the start of the NEXT sprint planning session.

---

## Sprint info

| Field | Value |
|-------|-------|
| Sprint name | Giai đoạn 3 — Backend API layer (Groups 0–5, complete) |
| Plan folder | `.plans/2026-09-13-phase3-backend-api-layer/` |
| Start date | 2026-09-13 |
| End date | 2026-09-13 |
| Tests | SDK: 89 cases / 490 assertions (unchanged). Backend offline: 29 cases / 79 assertions, 0 failed, pass on first attempt. Live smoke test: `RESULT: PASS`, full 4/4. |

---

## Outcome

**Status:** [x] Complete (all Groups 0–5 done and verified, including a live end-to-end round-trip) / [ ] Partial / [ ] Abandoned

### What was built (matches tasks.md `[x]` items)
- **Group 0:** Confirmed `cpp-httplib` availability via vcpkg
  (`cpp-httplib[brotli,core]:x86-windows@0.54.1`) before writing any
  backend code.
- **Plan Review caught a real design gap before Group 1 started:** the
  original error-mapping design (spec.md Decision 6) didn't account
  for malformed request bodies, which would have fallen through to a
  generic `500` — misleading callers into thinking a client-side
  mistake was a server bug. Fixed by adding an explicit,
  earlier request-parsing stage (400, never reaching `AmicoClient`)
  before Group 1 was implemented.
- **Group 1 (server code):** new `backend/` directory —
  `BackendConfig.hpp` (env config + the bind-address opt-in guardrail),
  `JsonMapping.{hpp,cpp}` (struct ↔ JSON), `ErrorMapping.{hpp,cpp}`
  (exception → HTTP status, most-derived-first `dynamic_cast` chain),
  `Routes.{hpp,cpp}` (16 routes, 1:1 mapping to existing `AmicoClient`
  methods, parse-then-call pattern throughout), `main.cpp` (bootstrap).
  Two user-requested technical guardrails (not just documentation):
  the network-exposure opt-in gate, and the
  `X-Confirm-Sensitive-Action: yes` header required on
  `setAdministrator`/`setPassword`.
- **Group 2 (offline tests):** `test/backend/test_routes.cpp` — a real
  HTTP round-trip (loopback socket, `cpp-httplib`'s own client) against
  a `FakeTransport`-backed `AmicoClient`. 29 cases / 79 assertions,
  covering every route's success + error path, both guardrails
  explicitly (header absent/wrong/correct), and the malformed-body →
  400 behavior from Plan Review's finding.
- **Group 3 (docs):** `docs/backend-api.md` (new) — every route,
  request/response shape, full error table, and a prominent security
  section stating plainly that neither guardrail is real
  authentication. `docs/src-map.md` updated.
- **Group 4:** full offline build+test gate — SDK unaffected (89/490),
  backend 29/79, 0 failures, zero warnings.
- **Group 5 (live, gated, read-only):** `test/backend/live_backend_smoke_test.cpp`
  — real `amico_backend` server against the real device. `RESULT:
  PASS`, full 4/4 (login, `/health`, `/system-information`, `GET
  /users`).

### What was skipped or deferred
| Item | Reason | Deferred to |
|------|--------|------------|
| Live-write test through the backend | The underlying SDK writes are already live-verified (Giai đoạn 2/2b); re-testing the same device writes through one more HTTP hop only proves JSON/routing correctness, which the offline `FakeTransport` tests already cover without live-device risk | Not planned — considered unnecessary, not merely postponed |
| A real auth/authorization layer for the backend's own HTTP API | Explicitly ruled out by the user's own architecture choice ("stateless proxy") | A future plan, if/when a real frontend user/session model exists |
| The Giai đoạn 4 frontend itself | Separate, future plan | Giai đoạn 4 |

---

## Discoveries (not in the spec)

- **Malformed request-body handling was a real gap in the original
  design**, not just a theoretical nitpick — found by Plan Review
  before any code was written, fixed via an explicit, separate parsing
  stage. A genuine example of the review gate catching something a
  first-pass design missed.
- `cpp-httplib` v0.54.1's route-matching supports both regex-capture
  (`req.matches[N]`, via `std::smatch`) and named `:param` path styles
  (`req.path_params`) — this plan used the regex style throughout for
  simplicity with multi-segment routes (`/users/:id/groups/:groupId`).
- The two technical guardrails (network-exposure opt-in,
  sensitive-action confirmation header) were themselves a design
  addition requested mid-negotiation, after Claude proactively flagged
  that the SDK's "always ask a human" convention for
  `setPassword`/`setAdministrator` does not automatically carry over
  once those calls are wrapped in an HTTP API — this was accepted and
  built as real, tested, enforced code rather than left as a
  documentation-only warning.

---

## Tech debt created

| Debt item | Risk if ignored | Target sprint |
|-----------|----------------|---------------|
| Single shared `AmicoClient` + mutex serializes all requests | Low for a single physical device backend; would matter only under real concurrent load from multiple frontend users | Only if profiling shows real contention |
| No rate limiting / abuse protection | Low while no frontend exists yet | Once Giai đoạn 4's frontend creates real traffic patterns to reason about |
| The two Decision 3 guardrails are accident-prevention only, not real access control | Real risk if `BACKEND_ALLOW_NETWORK_EXPOSURE=1` is ever set without a real auth layer in front | A dedicated auth-layer plan, if/when network exposure is actually needed |

---

## Lessons learned

- **Plan Review continues to earn its place in this workflow** — a
  second real design gap caught before code was written (after Giai
  đoạn 2b's Cards/Administrator/Image assumption gap), this time in
  error-handling completeness rather than a protocol-discovery
  shortcut. Different failure mode, same value.
- **A backend wrapping an already-tested SDK is genuinely lower-risk
  work** than protocol discovery — every offline test passed on the
  first run, and the live smoke test passed on the first attempt too,
  because there was no new device-protocol guessing involved, only
  HTTP/JSON translation of already-proven calls.
- **Re-creating a conversational safety gate as enforced code, when
  asked, is worth doing properly** — the two guardrails could have
  been documentation-only, but the user explicitly asked for real
  enforcement, and building + testing them took modest extra effort
  for a real (if limited) safety improvement.
- Direct authorship (not delegating to Codex) was used for this entire
  plan; Codex had hit its usage limit earlier in the session and was
  not re-checked before starting this plan's work — worth checking
  Codex's availability at the start of future plans rather than
  defaulting to direct authorship out of session momentum.

---

## What the next sprint must NOT assume

- The live smoke test only proved 3 **read-only** routes end-to-end.
  Every write route (`POST`/`PATCH`/`DELETE`/`PUT`) is offline-tested
  only through the backend layer — the underlying SDK calls themselves
  were live-verified in Giai đoạn 2/2b, but the HTTP-layer wrapping of
  those specific writes has not been exercised against the real device
  through this backend.
- `AmicoClient`'s thread-safety under the mutex-serialization strategy
  has not been stress-tested under real concurrent load — only proven
  correct for sequential test-case execution.
- The two Decision 3 guardrails are accident-prevention only — do not
  treat this backend as safe to expose beyond `127.0.0.1` without a
  real authentication/authorization layer, regardless of how the
  guardrails test.
- The two prior plans' `KNOWN_HARNESS_BUG` (self-induced
  `PLAN_DRIFT_DETECTED`) recurred again for this plan
  (`CMakeLists.txt`/`docs/src-map.md`, from Giai đoạn 2b's own
  uncommitted edits) — expect the same mechanical noise on any future
  plan sharing the working tree while prior plans remain uncommitted.

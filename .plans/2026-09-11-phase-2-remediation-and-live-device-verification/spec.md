# Spec — Phase 2 remediation and live-device verification for the existing AMICO SDK

> **Planner note:** Write this entire file before touching tasks.md.
> Get explicit confirmation from the user before proceeding to tasks.md.
> This file answers WHAT and WHY. tasks.md answers HOW.

---

## Goal

Take the existing C++ AMICO SDK implementation (currently sitting as
unreleased WIP inside the `BLOCKED` plan
`.plans/2026-09-11-p5-rewrite-the-phase-2-read-only-c-17-am`) through a
governance-correct remediation: a freshly and explicitly authorized
execution/verification cycle, a genuinely independent clean-room offline
rebuild+retest, and — only if separately approved — a read-only live smoke
test against the real device at `192.168.2.156`. The SDK code itself is
**not** assumed broken and is not being rewritten; what is being redone is
the *proof* that it works, produced by actors/contexts independent of the
one that wrote it.

**Done looks like:** The plan reaches a state where (a) approval provenance
for every gate is a fresh, distinct, non-inferred user message, (b) a
Verifier session with no shared context with the Executor has reconfigured
and rebuilt the SDK from a clean `build/` directory and rerun the full
offline suite + secret scan, with compiler/CMake/dependency versions
recorded in a new verification artifact, and (c) the live-device smoke
test's status is explicitly recorded as either "approved and run, see
evidence" or "not approved this cycle" — never silently skipped or silently
assumed.

---

## Background

An incident audit (`docs/harness-phase2-approval-incident.md`) found that
plan P5's `COMPLETED` status was produced entirely within one Claude Code
context acting as Planner, Plan-Reviewer, Executor, and Verifier in
sequence, with the execution-approval gate satisfied by an assistant
composed/reused string rather than a fresh user message, and the
"independent" verification reusing the Executor's own `build/` directory
and already-compiled binaries. The plan was moved `COMPLETED` → `BLOCKED`
via `eng plan block` as a result; no source file was touched by that
action. The offline test results (38 doctest cases / 171 assertions, 0
failures) and the clean secret scan are real facts about what ran, but they
carry no independence or authorization guarantee. Live-device verification
against `192.168.2.156` has never been performed at all — the SDK's own
`test/live/live_smoke_test.cpp` exists but is gated behind
`AMICO_ENABLE_LIVE_TESTS=1` and was never enabled. This plan exists to
close both gaps under strict actor/context separation and explicit,
non-reusable approval gates, without assuming the code needs to change.

---

## Design decisions

### Decision 1 — Preserve, don't rewrite
- **Chosen:** Treat `include/amico/*`, `src/*`, `test/*`, `examples/*` as
  candidate-complete historical WIP. Remediation work only regenerates
  *evidence* (build logs, test runs, secret scans, live-check results); it
  does not touch SDK source unless independent verification or live
  testing surfaces an actual, evidenced defect.
- **Why:** The incident invalidated *provenance and independence claims*,
  not the code itself. Rewriting working code to "fix" a process problem
  would be scope creep and would destroy the one thing that is still
  factually true (the offline tests really did pass against real fixture
  data).
- **Rejected alternatives:** Rewriting Phase 2 from scratch (as the
  now-superseded `implement-phase-2-production-oriented-re` plan
  originally attempted) — rejected because that plan was blocked for an
  unrelated, already-resolved reason (incomplete Phase 1 evidence, since
  closed by the completed Phase 1.5 plan), and re-litigating it here would
  conflate two different problems.

### Decision 2 — Approval tokens are exact, single-use, per gate
- **Chosen:** Use the harness's `eng plan approve-spec` / `eng plan
  approve` gates, but only ever pass a `-by`/evidence string that quotes a
  **new** user message issued after the plan is already sitting at the
  state that gate unlocks. `APPROVE_SPEC_ONLY:<plan-id>` unlocks
  spec→tasks; `APPROVE_EXECUTION:<plan-id>` (issued only after Plan
  Reviewer PASS, i.e. state `REVIEWED`) unlocks Executor; a separate
  `APPROVE_LIVE_DEVICE_TEST:<plan-id>` (never inferred from the other two)
  unlocks the one gated live-test task.
- **Why:** This is the exact failure mode of the incident — reused/assistant
  composed approval text. The harness itself has no built-in token
  enforcement (confirmed: `eng plan approve --help` takes a free-text
  `-by`/reason string), so this plan's own process must enforce it by
  convention, recorded in `tasks.md`/`DECISION_LOG.md`.
- **Rejected alternatives:** Relying on the harness to reject bad approvals
  automatically — rejected because that mechanical enforcement does not
  exist yet in this harness version (0.10.1-beta); it is a proposal in the
  incident report, not implemented.

### Decision 3 — Independent verification means a different actor, not just a different command
- **Chosen:** The Verifier role for this plan must run in a Claude Code
  session/context that has not seen the Executor's conversation (a fresh
  session, or an `Agent` tool subagent launch with no shared history), and
  must build in a **new, previously-unused** build directory (e.g.
  `build-verify/`, never `build/`), reconfiguring from an empty directory.
- **Why:** This is precisely gap 6/7 the incident report calls out —
  `ninja: no work to do` against a pre-existing `build/` is not
  verification, it is a no-op rerun.
- **Rejected alternatives:** Deleting and recreating `build/` in place —
  rejected in favor of a distinctly-named directory so the Executor's own
  build artifacts remain inspectable side-by-side for comparison, and so
  an accidental Verifier reuse of `build/` is immediately visible as a
  process violation.

### Decision 4 — Live testing is strictly read-only and its own approval gate
- **Chosen:** Only the operations already present in
  `test/live/live_smoke_test.cpp` (login, session-valid, system info, list
  users, list access logs, logout, confirm session invalid) plus one
  addition — a `users().get(id)` call using an id obtained from that same
  run's list-users result (never a hardcoded/assumed id) — are in scope.
  No create/update/delete of any resource, ever. Running it at all requires
  `APPROVE_LIVE_DEVICE_TEST:<plan-id>` as a distinct message, separate from
  spec/execution approval.
- **Why:** The task brief is explicit that read-only-ness and gate
  separation are non-negotiable; `docs/sdk-usage.md`/`docs/amico-endpoints.md`
  confirm the SDK currently implements no write operations at all (there is
  nothing to accidentally call).
- **Rejected alternatives:** Treating `APPROVE_EXECUTION` as sufficient for
  live testing — explicitly rejected by the task brief itself and by
  Decision 2 above.

### Decision 5 — Credentials never touch tracked files
- **Chosen:** Live credentials are supplied only via the existing
  `AMICO_BASE_URL` / `AMICO_USERNAME` / `AMICO_PASSWORD` environment
  variables at Executor/live-test run time (the mechanism
  `test/live/live_smoke_test.cpp` already implements). `spec.md`,
  `tasks.md`, `tests.md`, and `DECISION_LOG.md` reference these by **name**
  only, never by value. The live-check task's verification output must be
  captured with `AMICO_PASSWORD` unset from any logged command line and
  with the SDK's own no-full-record-printing behavior relied upon (see
  `docs/security-sanitization-policy.md`).
- **Why:** Matches the existing, already-reviewed sanitization policy and
  the task brief's explicit prohibition on credential leakage into
  git-tracked files or shell history where avoidable.
- **Rejected alternatives:** A new secrets file under `.plans/` —
  rejected; adds a second, redundant secret-handling mechanism where the
  SDK already has one, and risks the file being accidentally tracked.

### Decision 6 — HTTPS/TLS check is observational, not a forced protocol switch (revised after Codex plan-review REJECT)
- **Chosen:** `include/amico/Types.hpp`'s `NetworkInfo` **already has**
  `sslEnabled` (confirmed: `include/amico/Types.hpp:18`, mapped in
  `src/Client.cpp:179` from `ssl_enabled`) — the original wording of this
  decision incorrectly implied both fields were missing. Only
  `selfSignedCertificate` (from the confirmed wire field
  `self_signed_certificate`, `docs/amico-endpoints.md:27`) is actually
  absent. This is therefore a **narrow, named, evidence-matched public
  struct addition** — one `bool` member on `NetworkInfo` plus its mapping
  in `src/Client.cpp`'s existing `requireField`/optional-field pattern —
  not a "no source change" item; the Scope/Out-of-scope sections below are
  corrected to say so explicitly.

  The HTTPS probe itself: `AmicoClient` has no base-URL setter
  (`include/amico/Client.hpp` takes `AmicoConfig` only at construction), so
  it cannot be redirected to `https://` in place. The probe therefore
  constructs a **second, separate `AmicoClient`** from a second
  `AmicoConfig` whose `baseUrl` is `https://<host from AMICO_BASE_URL>`,
  and — critically — **only after** the first (HTTP) client's
  `getSystemInformation()` call has returned and `sslEnabled` is known to
  be `true`. The probe reuses Task 2.1's non-authenticating
  reachability-style request (never `login()`) against that second
  instance, so it never sends credentials over the unverified/unknown-cert
  path. Constructing the second `AmicoClient`/`AmicoConfig` performs no
  network I/O by itself (confirmed: construction only stores config); the
  network attempt happens solely inside the explicit non-authenticating
  call. A TLS verify failure against a self-signed cert here is recorded
  as expected secure-by-default behavior, not a defect — but must be
  reported distinctly from a generic network/timeout error (Decision 6b
  below), not lumped in as "some error occurred."
- **Why:** The task brief requires an HTTPS/TLS check, but nothing in the
  existing evidence base says the device is reachable over HTTPS at all;
  inventing an HTTPS-only test path would risk a false "defect" finding
  against correct secure-by-default behavior (TLS verification is not
  configurable off anywhere in this SDK). Ordering the probe after system
  information (rather than before, as the plan's first draft mistakenly
  described in `tests.md`) is required because `sslEnabled` is not known
  until that call returns.
- **Rejected alternatives:** Adding a TLS-bypass config option to the SDK
  to "make the HTTPS check pass" — explicitly out of scope; would weaken
  the SDK's security posture to satisfy a test, which is backwards.
  Reusing the first client's credentials against the second (https)
  instance for a fuller check — rejected: would send credentials over a
  connection whose certificate has not yet been verified as trustworthy,
  precisely the risk TLS verification exists to prevent.

### Decision 6b — New network-safety branches (preflight, conditional-HTTPS) must get offline coverage before any live use
- **Chosen:** Before `APPROVE_LIVE_DEVICE_TEST` may be requested at all,
  `tasks.md`/`tests.md` must include `FakeTransport`/request-spy-based
  offline unit tests proving: (1) a failed preflight (Task 2.1) prevents
  `login()` from being called at all — zero further transport requests;
  (2) when `sslEnabled` is `false`, zero HTTPS requests are attempted —
  the probe is skipped entirely, not attempted-and-ignored; (3) a
  TLS-verify failure on the https probe is classified and reported
  distinctly from a plain network/timeout error, so a real misconfigured
  read is never misread as "just a self-signed cert, ignore it."
- **Why:** A Codex plan-review (read-only, `codex.review` capability)
  found that the original `tasks.md`/`tests.md` only required these new
  branches to *compile*, with their first real exercise being the live
  device itself — i.e. safety-relevant conditional logic (does a
  credentialed request get sent or not) would have been unverified until
  it ran against real hardware.
- **Rejected alternatives:** Relying on the live run itself as the first
  test of this logic — rejected for the reason above; contradicts
  spec.md's own Goal of not letting untested code paths reach the device.
- **Decided by:** Planner (revision), following Codex plan-review finding
  [P1] "Test the new network branches offline before permitting live use".

### Decision 7 — Credential entry must not pass through any agent-visible or logged channel (revised)
- **Chosen:** `AMICO_USERNAME`/`AMICO_PASSWORD` must be set by the human
  operator **directly in their own interactive terminal session, outside
  of any command an AI agent tool issues or records** — never as a
  literal value inside a Bash/PowerShell tool-call the agent invokes
  (those calls and their arguments are captured in the session transcript
  and tool logs, which is itself a leakage channel this plan must close,
  not just shell history). The Executor's live-test task may `echo` the
  *names* of required variables and instruct the operator to set them and
  then hand control back, but the Executor process must never itself type,
  construct, or pass a credential value as a command argument. Every live
  run's shell session must `unset AMICO_PASSWORD AMICO_USERNAME
  AMICO_ENABLE_LIVE_TESTS` on **both** the success and the failure exit
  path (not just on success).
- **Why:** A Codex plan-review found that environment-variable delivery
  alone does not satisfy "never printed/logged" once an AI agent is the
  one issuing the export command — the agent's own tool-call transcript
  becomes a second, easily-overlooked leak surface beyond plain shell
  history.
- **Rejected alternatives:** A `.env` file read by the test binary —
  rejected: adds a file that must then be guaranteed untracked and
  deleted, more moving parts than just never writing the value anywhere
  machine-readable in the first place.
- **Decided by:** Planner (revision), following Codex plan-review finding
  [P1] "Specify credential entry without literal shell assignments".

### Decision 8 — Regression/provenance evidence must bind to actual (untracked) file content, not git status/HEAD
- **Chosen:** Because `include/`, `src/`, `test/`, `examples/`, `docs/`,
  `artifacts/`, `captures/`, `scripts/`, and every `.plans/*` directory are
  **all currently untracked** in git (only `README.md` is committed at
  `2ff9b0e`), both (a) the regression checks that were going to use `git
  status --porcelain` to prove "untouched" and (b) the verification
  manifest's plan to use `git rev-parse HEAD` to identify "what was built"
  are meaningless — untracked files show as unchanged-looking `??` noise
  either way, and `HEAD` never moves regardless of what changes underneath
  it. Replace both with a **file-inventory + content-hash baseline**:
  before Group 1 starts, snapshot `sha256sum` of every file under the
  directories in scope for this plan's tasks; after each pass, re-hash and
  diff against the snapshot — only files this plan's own tasks named may
  differ. The verification manifest records this hash set (not a git SHA)
  as what was actually built/tested/run live.
- **Why:** A Codex plan-review found both git-based checks were
  structurally incapable of detecting the thing they claimed to detect,
  given this repo's current (all-untracked) state — a regression or a
  substituted binary could pass both checks unnoticed.
- **Rejected alternatives:** Committing the SDK source tree to git first,
  so `git status`/`git rev-parse` would work as originally written —
  rejected as out of scope for this plan: whether/when to start version-
  controlling the SDK source is the user's decision, not something to
  slip in as a side effect of fixing a test script.
- **Decided by:** Planner (revision), following Codex plan-review findings
  [P2] "Compare evidence files against a captured filesystem baseline" and
  [P1] "Bind independent evidence to the actual untracked SDK contents".

### Decision 9 — Minimal, named API addition to make preflight/TLS branches offline-testable (user-approved)
- **Context:** Round 2 `codex.review` found that Decision 6b's
  requirement (offline test coverage for the preflight and conditional-
  HTTPS branches before any live approval) was not actually satisfiable
  with `include/amico/Client.hpp`'s current surface: there is no
  non-authenticating request method, and `CurlTransport` reports every
  TLS-verify failure as a generic `NetworkError`, indistinguishable from
  a plain network error. Presented to the user as a three-way choice
  (add minimal API / drop offline-testability requirement for these two
  branches / drop the two checks from live-test scope entirely); the user
  chose to add the minimal API.
- **Chosen:** Two small, narrowly-scoped additions, in addition to
  Decision 6's `NetworkInfo::selfSignedCertificate`:
  1. `AmicoClient::checkReachable()` (new public method, `void`, throws on
     failure) — issues one non-authenticating HTTP request (no
     `login`/`session` cookie header, no `ObjectQuery` body) through the
     existing `IHttpTransport` seam and returns normally on any HTTP
     response, or propagates whatever the transport throws. Because it
     goes through `IHttpTransport` (the same seam `test/FakeTransport.hpp`
     already implements for every other offline test), it is testable
     with `FakeTransport` exactly like every existing SDK call — no new
     test infrastructure is needed.
  2. `TlsVerificationError` (new exception type, `: public NetworkError`,
     alongside the existing `TimeoutError : public NetworkError` sibling)
     in `include/amico/Errors.hpp`, and a corresponding branch in
     `src/http/CurlTransport.cpp` mapping TLS-specific `CURLcode` values
     (`CURLE_SSL_CONNECT_ERROR`, `CURLE_PEER_FAILED_VERIFICATION`,
     `CURLE_SSL_CACERT`, `CURLE_SSL_CACERT_BADFILE`,
     `CURLE_SSL_CERTPROBLEM`, `CURLE_SSL_ISSUER_ERROR`) to it instead of
     the generic `NetworkError` — mirroring the existing
     `CURLE_OPERATION_TIMEDOUT` → `TimeoutError` special case immediately
     above it.
  `test/live/live_smoke_test.cpp`'s preflight step (Task 2.1) and HTTPS
  probe step (Task 2.2c) both become thin call sites —
  `client.checkReachable()` inside a `try`/`catch (const TlsVerificationError&)`
  / `catch (const NetworkError&)` — with the actual safety-relevant logic
  living in the library, where `FakeTransport` already provides offline
  coverage (Task 2.2b, revised).
- **Why:** This is the smallest addition that makes Decision 6b's offline-
  testability requirement genuinely achievable, reuses the SDK's existing
  DI/exception-hierarchy patterns exactly (no new architecture concepts),
  and does not touch `ObjectQuery`, authentication, or any read/write
  device operation — `checkReachable()` sends no credentials and requests
  no object data.
- **Rejected alternatives (per the user's choice among the three
  presented):** dropping Decision 6b's offline-testability requirement
  for just these two branches (accepting live-device-first exercise of
  new code, as the original P5 7-step sequence's `main()` always was) —
  not chosen; dropping the preflight/HTTPS-probe checks from live-test
  scope entirely — not chosen, and would also have contradicted the
  original task brief's explicit requirement for both checks.
- **Decided by:** User (three-way choice) / Planner (concrete design)

### Decision 9b — Decision logic (not just the raw request) must live in the library (Codex round 3 finding, fixed)
- **Context:** Round 3 `codex.review` found that Decision 9's
  `checkReachable()`/`TlsVerificationError` made the raw *request*
  testable, but the *decisions* built on top of it (skip `login()` when
  preflight fails; skip the HTTPS probe entirely when `sslEnabled` is
  false; treat a TLS-verify failure differently from a generic network
  failure) still lived only in `test/live/live_smoke_test.cpp`'s `main()`
  — untestable glue, same underlying problem as Round 2's finding, not
  actually fixed. Also found `CURLE_SSL_CONNECT_ERROR` is too broad for
  `TlsVerificationError` — it covers protocol/cipher-mismatch handshake
  failures, not just certificate-verification failures, so mapping it in
  would misclassify a real connection problem as "expected self-signed
  cert."
- **Chosen:** Add one more small internal module,
  `src/NetworkSafety.hpp`/`.cpp` (`namespace amico::detail`, not
  installed — same pattern as `src/ObjectQuery.hpp`), with two free
  functions:
  - `SafeLoginResult reachableThenLogin(AmicoClient& client)` — calls
    `checkReachable()`; only calls `client.login()` if that succeeds;
    returns a small result struct recording what happened. This is the
    entire "does a failed preflight prevent login" decision, now inside
    the library.
  - `TlsProbeResult probeHttpsIfEnabled(bool sslEnabled, AmicoClient*
    httpsClient)` — returns `NotApplicable` (touching `httpsClient` not at
    all) if `sslEnabled` is false; otherwise calls
    `httpsClient->checkReachable()` and returns `Verified`,
    `VerifyFailed` (caught `TlsVerificationError`), or `NetworkFailure`
    (caught plain `NetworkError`/`TimeoutError`) — three distinct outcomes,
    never conflated.
  `test/live/live_smoke_test.cpp`'s `main()` becomes a thin caller of
  these two functions plus print statements; `test/test_network_safety.cpp`
  (new, offline, `FakeTransport`-backed) exercises both functions'
  branches directly — this is what makes Decision 6b's three requirements
  actually testable, not merely the raw request. The `CURLE_SSL_CONNECT_ERROR`
  mapping is dropped from `TlsVerificationError`; only genuine
  certificate-verification `CURLcode`s (`CURLE_PEER_FAILED_VERIFICATION`,
  `CURLE_SSL_CACERT`, `CURLE_SSL_CACERT_BADFILE`, `CURLE_SSL_CERTPROBLEM`,
  `CURLE_SSL_ISSUER_ERROR`) map to it; everything else (including protocol/
  cipher handshake failures) stays a plain `NetworkError`.
- **Why:** Matches Codex's exact finding; keeps the "one shared,
  injectable orchestration used by both the live runner and offline
  tests" property the user's chosen option (A) requires, rather than
  quietly reverting to option (B)'s untested-`main()`-glue outcome.
- **Rejected alternatives:** Testing `main()`'s literal control flow via
  a process-level test (spawn the binary, inspect output) — rejected:
  heavier, slower, and still wouldn't use the existing `FakeTransport`
  seam; the extracted-function approach is the smallest change consistent
  with how every other SDK operation is already tested.
- **Decided by:** Codex (finding) / Planner (design, within the user's
  already-approved "add minimal API" choice — this is a refinement of
  Decision 9's mechanism, not a new scope decision)

### Decision 9c — Final `CURLcode` → `TlsVerificationError` list (narrowed again, round 4) — supersedes the lists in Decision 6 and 9b above
- **Context:** Round 4 `codex.review` found the round-3 list still
  included two codes that are not genuine peer-certificate-verification
  rejections: `CURLE_SSL_CERTPROBLEM` (a **local** client-certificate
  problem) and `CURLE_SSL_CACERT_BADFILE` (a **local** CA-bundle-file read
  failure) — both are local configuration defects that should surface as
  a plain, fatal `NetworkError`, not be soft-classified as "expected if
  self-signed." Also noted `CURLE_SSL_CACERT` is simply an alias of
  `CURLE_PEER_FAILED_VERIFICATION` in current libcurl, not distinct
  coverage.
- **Chosen (final):** Only `CURLE_PEER_FAILED_VERIFICATION` and
  `CURLE_SSL_ISSUER_ERROR` map to `TlsVerificationError`. Every other
  `CURLcode` — including `CURLE_SSL_CONNECT_ERROR` (Decision 9b),
  `CURLE_SSL_CERTPROBLEM`, `CURLE_SSL_CACERT_BADFILE` (this decision), and
  any code not explicitly listed — stays a plain `NetworkError`.
- **Decided by:** Codex (finding) / Planner (incorporation) — see
  `tasks.md` Task 2.0b for the exact code.

---

## Scope

### In scope
- Re-authorizing execution for the existing (unmodified) SDK implementation
  under a fresh, distinct, non-inferred `APPROVE_EXECUTION:<plan-id>`
  gate.
- A clean-room independent offline verification pass: new build directory,
  reconfigure from scratch, full rebuild, full offline `ctest` suite rerun,
  secret scan rerun, with compiler/CMake/vcpkg/dependency versions recorded
  in a new `verification-manifest.md`-style artifact.
- A defined, gated, read-only live-device smoke-test task list against
  `192.168.2.156`, to be executed only after its own
  `APPROVE_LIVE_DEVICE_TEST:<plan-id>` approval (execution of that task is
  **not** part of this Planner session — only its definition is).
- A defect-handling path: if the clean verification or (if later approved)
  the live smoke test finds a genuine SDK defect, work stops, evidence is
  recorded, and any actual source fix is routed through a fresh Executor
  context followed by a fresh Verifier context — not patched in place by
  whichever role found it.
- Explicit, harness-visible status fields at completion:
  `execution_authorization`, `independent_verification`,
  `live_device_verification`, `credential_leakage_check`,
  `release_status`.

### Out of scope (explicitly excluded)
- Any change to SDK public API surface, request/response mapping, or error
  handling, **except** three named, narrowly-scoped additions: (1)
  `NetworkInfo::selfSignedCertificate` (Decision 6) — a wire field already
  confirmed at `docs/amico-endpoints.md:27` but currently absent from the
  struct; (2) `AmicoClient::checkReachable()`, a new non-authenticating
  request method (Decision 9, user-approved); (3) `TlsVerificationError`,
  a new `NetworkError` subtype distinguishing TLS-verify failures from
  generic network errors (Decision 9, user-approved) — plus each
  addition's mapping/implementation and the offline test coverage
  Decision 6b requires. No other public API/behavior change is in scope;
  these three exceptions do not open the door to broader "while we're in
  there" edits.
- Any write/mutating device operation (create/update/delete of users,
  cards, identities, access rules, configuration, device settings,
  permissions, credentials, or logs) — the SDK implements none of these
  today, and none will be added by this plan.
- Backfilling the missing P5 Planner-activation record retroactively —
  this plan only *notes* the gap (per the incident report's remediation
  gate 4) and asks the user for an explicit decision on whether to
  backfill it or treat it as a documented process gap; it does not decide
  this unilaterally.
- Implementing the incident report's "Proposed Harness changes" section
  (exact-token enforcement inside the `eng` binary itself) — those are
  harness-tooling changes outside this repository's SDK scope; this plan
  enforces the same discipline by convention/process instead.
- Actually running the live smoke test — defining its scope and gate is
  in scope; executing it requires a separate approval and a separate
  (Executor-role) session, not this Planner session.

---

## Affected files

| File | Change type | Reason |
|------|-------------|--------|
| `.plans/2026-09-11-phase-2-remediation-and-live-device-verification/tasks.md` | Create (next step, after spec approval) | Ordered remediation/verification tasks |
| `.plans/2026-09-11-phase-2-remediation-and-live-device-verification/tests.md` | Create (next step, after spec approval) | Exact verification/live-check commands and pass criteria |
| `.plans/2026-09-11-phase-2-remediation-and-live-device-verification/verification-manifest.md` | Create (by Verifier, execution phase) | Records clean-build toolchain/dependency versions + content-hash baseline (Decision 8) |
| `include/amico/Types.hpp` | Modify | Add `NetworkInfo::selfSignedCertificate bool` (Decision 6) |
| `include/amico/Errors.hpp` | Modify | Add `TlsVerificationError : public NetworkError` (Decision 9) |
| `include/amico/Client.hpp` | Modify | Add `void checkReachable()` public method declaration (Decision 9) |
| `src/Client.cpp` | Modify | Map `self_signed_certificate` (Decision 6); implement `checkReachable()` (Decision 9) |
| `src/http/CurlTransport.cpp` | Modify | Map certificate-verification-specific `CURLcode` values (not the broader `CURLE_SSL_CONNECT_ERROR`) to `TlsVerificationError` (Decision 9/9b) |
| `src/NetworkSafety.hpp`, `src/NetworkSafety.cpp` | Create | `amico::detail::reachableThenLogin()` / `probeHttpsIfEnabled()` — shared, injectable orchestration used by both the live runner and offline tests (Decision 9b) |
| `test/live/live_smoke_test.cpp` | Modify | Preflight/HTTPS-probe steps call `NetworkSafety`'s shared functions; add `users().get(id)` step (Decision 4/6/9); still gated, still never runs automatically |
| `test/test_system_information.cpp` | Modify | Offline coverage for `selfSignedCertificate` |
| `test/test_network_safety.cpp` | Create | Offline `FakeTransport` coverage for `reachableThenLogin()`/`probeHttpsIfEnabled()` (Decision 6b/9b) |
| `CMakeLists.txt` | Modify | Add `src/NetworkSafety.cpp` to `amico_sdk`'s source list and `test/test_network_safety.cpp` to `amico_tests`'s source list |
| `include/amico/*` (other than `Types.hpp`), `src/*` (other than `Client.cpp`), `test/*` (other than the two files above), `examples/*` | None expected | Reused as-is; only touched if a genuine defect is found and routed through Executor |
| `docs/src-map.md` | Modify | Update the `test/live/live_smoke_test.cpp` row to describe the new step sequence, and the `Types.hpp`/`Client.cpp` rows if their one-line summaries no longer match |
| `docs/sdk-usage.md` | Modify | Document the live-test run procedure and Decision 7's operator-entered-credentials requirement; no credential value written |

`docs/src-map.md` **is** updated by this plan's normal path (revised —
see the table above): the live-test row's step description changes, and
the `Types.hpp`/`Client.cpp` one-line summaries are checked against the
narrow field addition from Decision 6.

---

## Risks and unknowns

- **Device reachability at execution time is unknown.** This Planner
  session did not and must not contact `192.168.2.156`. The first live
  task must be a non-authenticating reachability/preflight check (e.g. TCP
  connect / plain HTTP response check) before any credentialed call, so a
  network problem is distinguished from an SDK/auth problem.
- **HTTPS availability is unconfirmed** (see Decision 6) — the HTTPS/TLS
  check may legitimately report "not applicable, device not configured for
  HTTPS" rather than pass/fail in the traditional sense.
- **No known-safe user id is yet available** for the `users().get(id)`
  read-only check — the plan must obtain it live, from that same run's
  `users().list()` result, never a hardcoded id typed in advance.
- **Retry budget:** `plan.yaml` currently allows `build: 2`, `unit_test: 2`,
  `integration_test: 1` retries — sufficient for a clean-room rebuild
  attempt but should not be silently raised without a documented reason if
  hit.
- **`clang-tidy` was previously recorded as not installed** in this
  environment (P5 `tests.md`) — the independent verification pass should
  re-check this rather than assume it is still true or still absent.
- **Backfilling missing Planner-activation for P5** is an open decision
  for the user (Decision-2/remediation-gate-4 in the incident report), not
  something this plan can resolve on its own.

---

## Open questions

- [ ] Does the user want the missing P5 Planner-activation step backfilled
      retroactively, or simply documented as a closed process gap enforced
      going forward from this plan on? (Incident report remediation gate 4.)
- [ ] Is `AMICO_ENABLE_LIVE_TESTS`/`AMICO_BASE_URL`/`AMICO_USERNAME`/
      `AMICO_PASSWORD` to be supplied by the user directly to the Executor
      session's environment at run time, or via some other approved secret
      mechanism? (Needed before `tasks.md`'s live-test task can name an
      exact procedure.)
- [ ] Should the independent Verifier session be a fresh Claude Code
      session (user-driven) or an `Agent` tool subagent launched from
      within this same conversation with no shared history injected into
      its prompt? Either satisfies Decision 3, but the choice affects how
      `tasks.md` phrases the activation step.

---

## Self-evaluation (plan-quality.md rubric)

| Principle | Criterion | Score | Notes |
|-----------|-----------|-------|-------|
| **Think Before Planning** | spec.md written first; user-observable goal stated | 9/10 | Goal is evidence/governance state, not a new feature — stated as observable end state |
| **Simplicity First** | ≥ 3 out-of-scope items with reasoning | 10/10 | 6 out-of-scope items listed |
| **Surgical Changes** | Every file listed with change type and exact reason | 9/10 | Source files listed as "None expected" since no code change is assumed needed |
| **Goal-Driven Execution** | Each scope item traces to an acceptance criterion | 9/10 | Maps to Completion criteria (tests.md, next step) |

**Total: 37/40 → 9/10** (threshold: 7/10)

---

**User confirmation received:** [x] Yes
**Confirmed on:** 2026-09-11 (`APPROVE_SPEC_ONLY:2026-09-11-phase-2-remediation-and-live-device-verification`, recorded via `eng plan approve-spec` at 2026-09-11T16:54:39Z)

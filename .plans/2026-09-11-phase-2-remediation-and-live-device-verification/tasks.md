# Tasks — Phase 2 remediation and live-device verification

> Status markers: `[ ]` not started, `[~]` in progress, `[x]` complete
> (verification run), `[!]` failed.
>
> **Scope reminder (Decisions 1/6/9, spec.md):** the existing SDK
> implementation is preserved as-is **except** three named, narrow,
> user-approved additions: `NetworkInfo::selfSignedCertificate`,
> `AmicoClient::checkReachable()`, and `TlsVerificationError` (Tasks
> 2.0a–2.0c, 2.2a). No other public API/behavior changes. The gated
> live-test harness (`test/live/live_smoke_test.cpp`) is extended to call
> the new methods; it still never runs automatically
> (`AMICO_ENABLE_LIVE_TESTS` stays required).
>
> **Approval reminder:** none of these tasks may start until
> `APPROVE_EXECUTION:<plan-id>` has been granted with a fresh, distinct
> user message, issued after the plan reaches `REVIEWED` (Plan Reviewer
> PASS) — per spec.md Decision 2. This task file does not itself grant
> that approval.
>
> **Execution order (corrected — Codex round 2 finding "Rebuild the
> offline test target after adding the safety tests"):** groups are
> numbered by concern, not by run order. The actual order is:
> 1. `tests.md` Test R-0 (content-hash baseline) — before any edit.
> 2. Group 2 (source/test edits: `Types.hpp`, `Client.cpp`,
>    `live_smoke_test.cpp`, new offline test file).
> 3. Group 3 (doc edits).
> 4. **Group 1's build+test commands, run once, on the fully-edited
>    tree** — this is what actually gates completion; do not run Group
>    1's build before Groups 2–3 are done and treat that as sufficient.
> 5. Group 4 (Verifier handoff).
> Task 1.1/1.2 below describe *what* the build/test gate checks; run them
> against the tree only after Groups 2–3 are complete.

---

## Group 1 — Fresh, properly-authorized offline build + test run (run LAST, after Groups 2–3 — see Execution order above)

### Task 1.1 — Clean, newly-authorized offline execution run
**File:** none (build-directory operation only)
**Action:** From the unmodified source tree, configure and build into a
build directory distinct from any directory a prior session may have used
(e.g. `build-exec/`, never a pre-existing `build/`). Run the full offline
`ctest` suite and the two secret-scan `grep` commands
(`docs/security-sanitization-policy.md`). This is the first build+test run
performed under a validly-issued `APPROVE_EXECUTION` gate for this
implementation — it establishes the "properly authorized execution"
record that P5 never had, using the same unmodified source.
**Verification:**
```bash
cmake -S . -B build-exec -G Ninja -DCMAKE_TOOLCHAIN_FILE="$VCPKG_ROOT/scripts/buildsystems/vcpkg.cmake" -DAMICO_BUILD_TESTS=ON -DAMICO_BUILD_EXAMPLES=ON
cmake --build build-exec
ctest --test-dir build-exec --output-on-failure
```
**Pass:** Build exit 0; all 23 required scenarios pass (38 doctest cases /
171 assertions, matching the counts already established by P5 against the
same unmodified source).
**Fail:** Any compile error or test failure → stop, report to Planner
before proceeding to Group 2 (a build/test regression here would mean the
"code is unchanged and still passing" assumption in spec.md Decision 1 no
longer holds).

**Status:** `[x]` — 2026-09-12: `build-exec/` configured + built clean
(exit 0, 36/36 targets), `ctest` 100% passed (1/1 suite), doctest binary
reports 45 cases / 250 assertions (up from 38/171; Task 2.2b added new
coverage). See `sprint-summary.md` for full output.
**Error (if [!]):**
> _Leave blank until task fails_

### Task 1.2 — Secret scan (tracked files)
**File:** none (scan operation only)
**Action:** Rerun both sanitization-policy scans against the working tree.
**Verification:**
```bash
grep -rnE "session=[A-Za-z0-9]{16,}" --include='*.md' --include='*.json' --include='*.cpp' --include='*.hpp' --include='*.txt' --include='*.log' . 2>/dev/null | grep -v '\.git/' | grep -v '/build'
grep -rniE '"(password|hash|salt|panic_password|panic_salt)"\s*[:=]\s*"[^"]{3,}"' --include='*.md' --include='*.json' --include='*.cpp' --include='*.hpp' . 2>/dev/null | grep -v '\.git/' | grep -v '/build' | grep -v "REDACTED_FOR_FIXTURE"
```
**Pass:** No output other than the known `REDACTED_FOR_FIXTURE` fixture
placeholder.
**Fail:** Any real match → stop immediately, do not proceed, report to
Planner (per `docs/security-sanitization-policy.md`, this is a hard stop,
not a task to patch silently).

**Status:** `[x]` — 2026-09-12: both scans clean. One incidental match in
`.plans/2026-09-11-phase-1-5-complete-the-amico-vl70lf-web-/sprint-summary.md`
(prose describing a previously-resolved vcpkg compiler-hash-cache false
positive from an unrelated, prior plan) — not a real secret, not in this
plan's write_scope.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 2 — Extend the gated live-test harness to match the approved live-check scope

> None of these sub-tasks make the live smoke test run automatically or
> contact the device — `AMICO_ENABLE_LIVE_TESTS=1` is still required, and
> this plan does not set it. Building this file is offline; only actually
> *executing* it against `192.168.2.156` requires
> `APPROVE_LIVE_DEVICE_TEST:<plan-id>` (Group 4 documents that procedure;
> it does not run it).

### Task 2.0a — Add `TlsVerificationError` (Decision 9, user-approved API addition)
**File:** `include/amico/Errors.hpp`
**Symbol:** new class `TlsVerificationError`
**Action:** Add `class TlsVerificationError : public NetworkError { ... };`
immediately after the existing `TimeoutError : public NetworkError`
(`include/amico/Errors.hpp:31-34`), same constructor pattern (`explicit
TlsVerificationError(const std::string& message) : NetworkError(message)
{}`).
**Verification:** compiles as part of Group 1's build.
**Status:** `[x]` — 2026-09-12: implemented by Codex CLI; compiles clean
as part of Group 1's build.

### Task 2.0b — Map peer-certificate-verification-rejection curl errors to `TlsVerificationError` (narrowed twice: rounds 3 and 4)
**File:** `src/http/CurlTransport.cpp`
**Symbol:** the `rc != CURLE_OK` error-mapping block (`src/http/CurlTransport.cpp:137-143`)
**Action:** Immediately alongside the existing
`if (rc == CURLE_OPERATION_TIMEDOUT) { throw TimeoutError(...); }` special
case, add: `if (rc == CURLE_PEER_FAILED_VERIFICATION || rc == CURLE_SSL_ISSUER_ERROR)
{ throw TlsVerificationError("TLS certificate verification failed for " + request.path + ": " + message); }`
before the generic `throw NetworkError(...)` fallback. **Final list, after
two rounds of narrowing:**
- **Included** (genuine peer-certificate-verification rejection —
  "server presented an untrusted/wrong cert"): `CURLE_PEER_FAILED_VERIFICATION`,
  `CURLE_SSL_ISSUER_ERROR`.
- **Excluded, Codex round 3:** `CURLE_SSL_CONNECT_ERROR` — covers
  protocol/cipher-mismatch handshake failures, not certificate rejection.
- **Excluded, Codex round 4:** `CURLE_SSL_CERTPROBLEM` (a **local**
  client-certificate problem, not a peer-verification rejection) and
  `CURLE_SSL_CACERT_BADFILE` (failure to **read the local CA bundle
  file** — a local configuration defect) — including either would route
  a genuine local setup problem into Task 2.2c's non-fatal "expected if
  self-signed" classification, which is wrong: a local misconfiguration
  should surface as a plain (fatal) `NetworkError`, not be soft-pedaled as
  "the device's cert is probably just self-signed." `CURLE_SSL_CACERT`
  was also dropped — Codex confirmed it is an alias of
  `CURLE_PEER_FAILED_VERIFICATION` in current libcurl, not additional
  coverage; listing both was redundant, not wrong, but the single
  canonical name is kept for clarity.
No other branch of this function changes; `CURLOPT_SSL_VERIFYPEER`/
`VERIFYHOST` stay unconditionally on.
**Verification:** compiles as part of Group 1's build; exercised offline
via `FakeTransport` (Task 2.2b simulates the exception type directly) —
the real curl-code branch itself only triggers live, which is expected
(it is the one piece of this change that requires a real TLS handshake).
**Status:** `[x]` — 2026-09-12: implemented by Codex CLI (narrowed list:
`CURLE_PEER_FAILED_VERIFICATION`, `CURLE_SSL_ISSUER_ERROR` only,
confirmed by inspection); compiles clean as part of Group 1's build.

### Task 2.0c — Add `AmicoClient::checkReachable()` (Decision 9, user-approved API addition)
**File:** `include/amico/Client.hpp`, `src/Client.cpp`
**Symbol:** new public method `void checkReachable() const;` (declared in
`Client.hpp` near `isSessionValid()`/`logout()`; defined in `Client.cpp`'s
`Impl`)
**Action:** Implement by issuing exactly one request through the
existing `IHttpTransport` (the same seam `CurlTransport`/`FakeTransport`
both implement) — plain GET to the configured base URL's root path, no
`login`/`session` cookie header attached, no `ObjectQuery` body. Returns
normally (void) if the transport call succeeds (any HTTP status is
"reachable" — this is a connectivity/TLS check, not an auth check); lets
whatever the transport throws (`NetworkError`, `TimeoutError`, or the new
`TlsVerificationError`) propagate unchanged. Sends no credentials under
any circumstance — this method must be safely callable before `login()`.
**Verification:**
```bash
ctest --test-dir build-exec --output-on-failure
```
**Pass:** Build succeeds; Task 2.2b's `checkReachable()` cases pass.
**Status:** `[x]` — 2026-09-12: implemented by Codex CLI; build succeeds,
`checkReachable()` cases in `test_network_safety.cpp` pass.

### Task 2.0d — Add `src/NetworkSafety.hpp`/`.cpp`: shared, injectable orchestration (Decision 9b, Codex round 3 fix)
**File:** `src/NetworkSafety.hpp` (new), `src/NetworkSafety.cpp` (new)
**Symbol:** `namespace amico::detail`: `struct SafeLoginResult { bool
reachable; std::string reachabilityError; bool loggedIn; };`,
`SafeLoginResult reachableThenLogin(AmicoClient& client);`;
`enum class TlsProbeOutcome { NotApplicable, Verified, VerifyFailed,
NetworkFailure };`, `struct TlsProbeResult { TlsProbeOutcome outcome;
std::string detail; };`, `TlsProbeResult probeHttpsIfEnabled(bool
sslEnabled, AmicoClient* httpsClient);`
**Action:** `reachableThenLogin()`: calls `client.checkReachable()`; if it
throws, catches the `AmicoError`, returns `{reachable=false,
reachabilityError=e.what(), loggedIn=false}` **without** calling
`client.login()`. If it succeeds, calls `client.login()` and returns
`{reachable=true, reachabilityError="", loggedIn=true}` (propagating any
exception `login()` itself throws unchanged — that is existing,
already-tested behavior). `probeHttpsIfEnabled()`: if `sslEnabled` is
`false`, returns `{NotApplicable, ""}` and **touches `httpsClient` not at
all** (must be safely callable with `httpsClient == nullptr` in that
case). If `true`, calls `httpsClient->checkReachable()`: success →
`{Verified, ""}`; catches `TlsVerificationError` → `{VerifyFailed,
e.what()}`; catches any other `NetworkError`/`TimeoutError` →
`{NetworkFailure, e.what()}` — three outcomes, never conflated. This is
the entire decision logic Decision 6b requires be offline-testable; it is
internal (not installed, not in `include/`), same pattern as
`src/ObjectQuery.hpp`.
**Verification:** compiles as part of Group 1's build; exercised directly
by Task 2.2b's offline tests.
**Status:** `[x]` — 2026-09-12: implemented by Codex CLI as
`src/NetworkSafety.hpp`/`.cpp`; compiles clean, exercised by
`test_network_safety.cpp`'s new cases.

### Task 2.0e — Register the new files in `CMakeLists.txt` and wire the live-test target's include path (Codex round 4)
**File:** `CMakeLists.txt`
**Symbol:** `amico_sdk`'s explicit source list (line ~9-24 area),
`amico_tests`'s explicit source list, `amico_tests`'s
`target_include_directories` (line 62), `amico_live_smoke_test`'s target
definition (lines 70-71)
**Action:**
1. Add `src/NetworkSafety.cpp` to `amico_sdk`'s sources and
   `test/test_network_safety.cpp` to `amico_tests`'s sources.
2. **Confirmed gap (Codex round 4):** `amico_tests` already has
   `target_include_directories(amico_tests PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/src)`
   (line 62) so it can `#include "NetworkSafety.hpp"` using the existing
   internal-header convention — but `amico_live_smoke_test` (lines 70-71)
   has **no** such include directory today. Add
   `target_include_directories(amico_live_smoke_test PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/src)`
   right after its `target_link_libraries` line. Without this, Task 2.1/
   2.2c's `#include "NetworkSafety.hpp"` in `live_smoke_test.cpp` fails to
   compile even though the offline test target builds fine — a
   silent-until-build-time gap the plan must not leave unaddressed.
**Verification:**
```bash
cmake -S . -B build-exec -G Ninja -DCMAKE_TOOLCHAIN_FILE="$VCPKG_ROOT/scripts/buildsystems/vcpkg.cmake" -DAMICO_BUILD_TESTS=ON -DAMICO_BUILD_EXAMPLES=ON
cmake --build build-exec --target amico_tests amico_live_smoke_test
```
**Pass:** Both targets build successfully and include the new translation
units/headers (confirm via build log, not just exit code) — `amico_tests`
alone succeeding is not sufficient.
**Status:** `[x]` — 2026-09-12: confirmed via `build-exec` build log —
both `amico_tests` and `amico_live_smoke_test` built successfully, each
compiling its respective new translation unit
(`test_network_safety.cpp.obj`, `live_smoke_test.cpp.obj`); the
`target_include_directories(amico_live_smoke_test PRIVATE
${CMAKE_CURRENT_SOURCE_DIR}/src)` line is present in `CMakeLists.txt`.

### Task 2.1 — Live smoke test: preflight step calls `reachableThenLogin()`
**File:** `test/live/live_smoke_test.cpp`
**Symbol:** `main()`
**Action:** Replace the existing separate "1/7 login" call with
`amico::detail::reachableThenLogin(client)`. If `!result.reachable`, print
`RESULT: FAIL -- device unreachable: <result.reachabilityError>` and exit
1 — `login()` is never called in this path (guaranteed by Task 2.0d's
implementation, not by `main()`'s own control flow). If reachable,
`result.loggedIn` reflects whatever `login()` did (existing behavior).
Renumber subsequent steps (now 1/9 preflight+login ... through 8/9
logout, 9/9 post-logout check) — see Task 2.4.
**Verification:** compiles as part of Group 1's build; the actual
decision logic is exercised offline by Task 2.2b, not first exercised
here.
**Status:** `[x]` — 2026-09-12: implemented by Codex CLI; compiles clean
as part of Group 1's build.

### Task 2.2a — Add `NetworkInfo::selfSignedCertificate`
**File:** `include/amico/Types.hpp`, `src/Client.cpp`
**Symbol:** `NetworkInfo` (add member), the `getSystemInformation()`
mapping block (`src/Client.cpp` around line 179, next to the existing
`info.network.sslEnabled = requireField<bool>(net, "ssl_enabled", ...)`)
**Action:** `NetworkInfo::sslEnabled` **already exists** — do not re-add
it. Add exactly one new member, `bool selfSignedCertificate = false;`,
and map it from the confirmed wire field `self_signed_certificate`
(`docs/amico-endpoints.md:27`) using the same `requireField<bool>(...)`
pattern as the adjacent `sslEnabled` mapping.
**Verification:**
```bash
ctest --test-dir build-exec --output-on-failure
```
**Pass:** Build succeeds; the new offline test added by Task 2.2b (below)
covering this field passes.
**Status:** `[x]` — 2026-09-12: build succeeds; "system-information parses
self-signed certificate true and false" test case in
`test_system_information.cpp` passes.

### Task 2.2b — Offline coverage for the new API pieces and their decision logic (required before any live approval)
**File:** `test/test_system_information.cpp` (new field), `test/test_network_safety.cpp` (new, per Task 2.0e's CMake registration)
**Symbol:** new `TEST_CASE`s
**Action:** Add offline, `FakeTransport`-based test cases proving:
1. `getSystemInformation()` parses `self_signed_certificate` into
   `NetworkInfo::selfSignedCertificate` correctly (true/false fixture
   variants).
2. `checkReachable()` issues exactly one request through the transport,
   with no cookie header present (assert on `FakeTransport`'s recorded
   request), and returns normally on a successful fake response.
3. **`reachableThenLogin()`:** given a `FakeTransport` configured to throw
   on the first (reachability) request, assert the function returns
   `reachable=false` **and** `FakeTransport::requestLog.size() == 1` (i.e.
   `login()` genuinely never ran — this is the Decision 6b requirement,
   now checkable against the library function directly, not against
   `main()`). Given a `FakeTransport` that succeeds on reachability then
   returns a valid login fixture, assert `reachable=true`,
   `loggedIn=true`, and 2 requests recorded.
4. **`probeHttpsIfEnabled(false, nullptr)`:** assert the result is
   `NotApplicable` and no crash/UB occurs with a null client pointer that
   is never dereferenced.
5. **`probeHttpsIfEnabled(true, &httpsClient)`:** with `httpsClient`'s
   `FakeTransport` configured to throw `TlsVerificationError`, assert
   outcome `VerifyFailed`; configured to throw a plain `NetworkError`,
   assert outcome `NetworkFailure` (a different enum value from
   `VerifyFailed`) — proving the two are never conflated.
**Verification:**
```bash
ctest --test-dir build-exec --output-on-failure
```
**Pass:** All new cases pass; total offline case/assertion count increases
from the prior 38/171 baseline — record the new exact counts in
`sprint-summary.md`, do not assume they stay 38/171.
**Fail:** Any of the five scenarios above cannot be demonstrated offline →
stop, do not proceed to Group 4/live-test documentation, report to
Planner (per spec.md Decision 6b, this is a hard prerequisite for
requesting `APPROVE_LIVE_DEVICE_TEST`).
**Status:** `[x]` — 2026-09-12: all 5 scenarios implemented in
`test/test_network_safety.cpp` and passing; total offline count is now
45 cases / 250 assertions (was 38/171).

### Task 2.2c — Live smoke test: conditional HTTPS/TLS observational probe via `probeHttpsIfEnabled()`
**File:** `test/live/live_smoke_test.cpp`
**Symbol:** `main()`
**Action:** **After** the existing system-information step returns (never
before — `sslEnabled` is not known until then), construct a **second,
separate** `AmicoConfig`/`AmicoClient` pair with `baseUrl` rewritten to
`https://<host parsed from AMICO_BASE_URL>` only if `info.network.sslEnabled`
is `true` (leave it unconstructed/null otherwise — never `client2.login()`
under any circumstance). Call
`amico::detail::probeHttpsIfEnabled(info.network.sslEnabled, sslEnabled ? &client2 : nullptr)`.
Print based on the returned outcome: `NotApplicable` → `HTTPS/TLS: not
enabled on this device (observed via system information) -- skipped`;
`Verified` → success; `VerifyFailed` → `HTTPS/TLS: verify-failed (expected
if self-signed, see selfSignedCertificate=<value>)`, not treated as a
script failure/non-zero exit by itself (per spec.md Decision 6);
`NetworkFailure` → a distinct, separately-labeled failure, never
conflated with `VerifyFailed`.
**Verification:** compiles as part of Group 1's build; the underlying
decision/classification logic is exercised offline by Task 2.2b.
**Status:** `[x]` — 2026-09-12: implemented by Codex CLI; compiles clean
as part of Group 1's build.

### Task 2.3 — Add a read-only `users().get(id)` step with a semantically-checked outcome
**File:** `test/live/live_smoke_test.cpp`
**Symbol:** `main()`
**Action:** After the "session valid" step (step 2), require
`validAfterLogin == true` to continue — treat `false` as
`RESULT: FAIL -- session not valid immediately after login`, exit 1,
rather than merely printing the boolean and continuing regardless (this
also applies to the existing pre-Task-2.x behavior, corrected here). After
the existing "list users" step, if the returned `users` vector is
non-empty, call `client.users().get(users.front().id)` and require the
result to be present **and** its `id` field to equal
`users.front().id` — a mismatch or empty-optional-when-list-was-nonempty
is `RESULT: FAIL -- get(id) did not return the requested user`, not a
silent pass. Print only the found/matched state, never a full user record
(matching the file's existing "never prints a full user record"
comment/behavior). If the list is empty, print
`get(id): skipped -- no users returned by list()`, and record the run's
overall result as **not a full pass** for this step (e.g. a distinct
`PARTIAL` marker in the final summary line) rather than silently counting
it as equivalent to a verified pass.
**Verification:** compiles as part of Group 1's build.
**Status:** `[x]` — 2026-09-12: implemented by Codex CLI; compiles clean
as part of Group 1's build.

### Task 2.4 — Renumber steps and update the file's own header comment
**File:** `test/live/live_smoke_test.cpp`
**Symbol:** file header comment (lines 1–7)
**Action:** Update the leading comment block to describe the new step
count/order (preflight → login → session-valid[required true] →
system-information → conditional HTTPS/TLS observation → list users →
get(id)[semantically checked] → list access logs → logout → post-logout
session check) instead of the old "in this order: login -> session
validation -> ..." 7-step description.
**Verification:** manual read-through; no functional check beyond Group
1's compile.
**Status:** `[x]` — 2026-09-12: header comment updated by Codex CLI to
describe the new 9-step sequence; reviewed manually, matches actual
`main()` flow.

---

## Group 3 — Documentation updates

### Task 3.1 — Update `docs/src-map.md`'s live-test row
**File:** `docs/src-map.md`
**Symbol:** `test/live/live_smoke_test.cpp` row (line 41)
**Action:** Update the row's description from "Gated
(`AMICO_ENABLE_LIVE_TESTS=1`) 7-step live sequence against a real device."
to match Group 2's new step count/order.
**Verification:** manual diff review against the updated
`live_smoke_test.cpp`.
**Status:** `[x]` — 2026-09-12: `docs/src-map.md`'s row updated by Codex
CLI to match the new 9-step sequence; reviewed manually against
`live_smoke_test.cpp`, matches.

### Task 3.2 — Add an explicit live-test-run procedure note to `docs/sdk-usage.md` (revised: no agent-issued credential commands)
**File:** `docs/sdk-usage.md`
**Action:** Add (or confirm already present/update) a short section
stating that running `amico_live_smoke_test` against a real device
requires:
(a) `AMICO_ENABLE_LIVE_TESTS=1`, `AMICO_BASE_URL`, `AMICO_USERNAME`,
`AMICO_PASSWORD` set as environment variables — **entered by the human
operator directly in their own interactive terminal, never as a literal
value inside a command the AI agent/Executor tool issues** (an
agent-issued `export AMICO_PASSWORD=...` persists the value in the
session transcript/tool logs even if it's never written to a tracked
file — that is itself a leak channel, per spec.md Decision 7);
(b) the Executor's role in this step is limited to printing the required
variable *names* and the exact binary path to run, then waiting for the
operator to confirm the run happened — the Executor process itself never
types or passes a credential value;
(c) every such shell session runs `unset AMICO_PASSWORD AMICO_USERNAME
AMICO_ENABLE_LIVE_TESTS` when the run finishes, on **both** the pass and
the fail path;
(d) for this plan specifically, a distinct, freshly-issued
`APPROVE_LIVE_DEVICE_TEST:2026-09-11-phase-2-remediation-and-live-device-verification`
approval is required before the run, and **a new, distinctly-worded**
approval is required for any rerun after a failure (the same token text
may not be reused — see tests.md Group 3's failure-handling note).
No credential value is written into this doc.
**Verification:** manual review; secret scan (Task 1.2's commands) confirms
no credential value was introduced.
**Status:** `[x]` — 2026-09-12: procedure note added by Codex CLI to
`docs/sdk-usage.md`; reviewed manually — no credential value present;
Task 1.2's secret scan (rerun after all edits) confirms clean.

---

## Group 4 — Handoff artifacts for independent Verifier (prepared by Executor, executed by Verifier)

### Task 4.1 — Write the Verifier's exact clean-room procedure into `tests.md`
**File:** `.plans/2026-09-11-phase-2-remediation-and-live-device-verification/tests.md`
**Action:** Already drafted by Planner (this file) — Executor confirms it
still matches the final Group 1–3 state (e.g. if `NetworkInfo` gained
fields in Task 2.2, note that in the "Independent offline verification"
section so the Verifier's rebuild expectations match). Do not soften or
remove the requirement that the Verifier use a **new** directory
(`build-verify/`) never touched by Task 1.1's `build-exec/`.
**Verification:** manual review.
**Status:** `[x]` — 2026-09-12: reviewed; `tests.md`'s Group 1 build/test
commands, F-1/F-2/F-3, and R-0/R-1 baseline commands all matched what was
actually run and produced the final 45/250 count; no `NetworkInfo` field
count is hardcoded in `tests.md` that would now be stale (it already says
"reproduced independently" / "not assumed to stay 38/171"). No edit
needed. `build-verify/` is confirmed not yet created (Verifier's job).

---

## Completion checklist

- [x] All tasks marked `[x]` (Group 4's Task 4.1 done; Group 3 live-device
      Group is separately gated, see below)
- [x] No tasks marked `[!]`
- [x] Build passes (`build-exec/`) — exit 0, 36/36 targets
- [x] All offline tests pass (45 cases / 250 assertions — updated,
      documented count; Task 2.2 added `selfSignedCertificate` +
      `test_network_safety.cpp`'s new coverage, up from the 38/171
      baseline)
- [x] Secret scan clean (one incidental match in an unrelated, prior
      plan's prose describing an already-resolved false positive — not a
      real secret)
- [x] `docs/src-map.md` updated (Task 3.1)
- [x] `docs/sdk-usage.md` updated (Task 3.2)
- [x] `DECISION_LOG.md` updated with the 2026-09-12 Codex-CLI-direct
      execution entry
- [x] Sprint summary written to
      `.plans/2026-09-11-phase-2-remediation-and-live-device-verification/sprint-summary.md`
- [x] Live smoke test **not executed** against the device during this
      Executor cycle (`AMICO_ENABLE_LIVE_TESTS` never set by this cycle;
      remains gated behind `APPROVE_LIVE_DEVICE_TEST:<plan-id>`, not
      issued — see tests.md's Group 3)

---

## Rollback procedures

### General rollback (always safe to run)
```bash
git status --porcelain        # see what changed/was added
```
**Note:** most of this repo's SDK source (`include/`, `src/`, `test/`,
`examples/`) is currently untracked (only `README.md` is committed at
`2ff9b0e`), so `git checkout -- <file>` restores nothing for those paths —
there is no committed baseline to fall back to yet. Undoing a change to an
untracked file means manually reverting the edit (or restoring from this
task's own "before" description) rather than a git-based restore.

### Per-task rollback — Task 2.2a (`NetworkInfo::selfSignedCertificate` addition, if triggered) — corrected (Codex round 2)
**Note:** `include/amico/Types.hpp` and `src/Client.cpp` are currently
**untracked** — there is no prior committed version to `git checkout` back
to. **Correction:** `sslEnabled` already existed before this plan and is
depended on by `test/test_system_information.cpp` — it must **never** be
removed by this rollback. If adding `selfSignedCertificate` breaks any
existing offline test, manually remove **only** the new
`selfSignedCertificate` member and its mapping line in `src/Client.cpp`
(leave `sslEnabled` and everything else untouched), and drop the
HTTPS-probe portion of Task 2.2c before re-running Group 1.

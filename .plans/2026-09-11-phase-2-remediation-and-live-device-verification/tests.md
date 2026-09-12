# Tests — Phase 2 remediation and live-device verification

> **Revised after Codex plan-review (REJECT, 6 P1 + 4 P2 findings).** Every
> command in this file was corrected against the actual repo state — the
> original draft had a wrong executable output path, a non-existent CTest
> name, a git-based regression/provenance check that cannot work against
> untracked files, a static-analysis command that silently mislabels
> "given zero files" as "not installed," and credential/approval-reuse
> gaps in the live-test failure path. See `DECISION_LOG.md`'s "Codex
> plan-review incorporation" entry for the full mapping of finding →
> fix.
>
> Three separate actors/passes, as before:
> 1. **Executor pass** — Group 1 — build dir `build-exec/`.
> 2. **Independent Verifier pass** — Group 2 — build dir `build-verify/`,
>    never `build-exec/`.
> 3. **Live-device pass** — Group 3 — requires
>    `APPROVE_LIVE_DEVICE_TEST:2026-09-11-phase-2-remediation-and-live-device-verification`,
>    not run by Groups 1–2.

---

## Group 1 — Executor build/test gate

```bash
cmake -S . -B build-exec -G Ninja -DCMAKE_TOOLCHAIN_FILE="$VCPKG_ROOT/scripts/buildsystems/vcpkg.cmake" -DAMICO_BUILD_TESTS=ON -DAMICO_BUILD_EXAMPLES=ON
cmake --build build-exec
```
**Pass:** Exit code 0, zero errors.

### Unit tests (offline, no network)
```bash
ctest --test-dir build-exec --output-on-failure
```
**Note:** `CMakeLists.txt` registers exactly **one** CTest test,
`amico_offline_tests`, which runs the whole `amico_tests` doctest binary
(confirmed: `CMakeLists.txt:68`, `add_test(NAME amico_offline_tests
COMMAND amico_tests)`). This single `ctest` invocation already runs every
doctest case in the binary — there is no need for (and, before this
revision, no way to run) a per-scenario `ctest -R <name>` filter, because
doctest test cases are not individually registered with CTest.
**Pass:** `ctest` reports `100% tests passed`. Total case/assertion count
starts from the prior 38/171 baseline and grows with Task 2.2b's new
cases — record the actual final count in `sprint-summary.md`.

### Functional tests

#### Test F-1 — Full offline sequence via `FakeTransport`
```bash
build-exec/amico_tests.exe --test-case="full_sequence*"
```
**Note (corrected):** the doctest binary's actual case name is
`"full_sequence: login -> session-valid -> sysinfo -> users.list ->
users.get -> accessLogs.list -> logout"` (confirmed:
`test/test_errors.cpp:119`) — it is a **doctest** test case, not a
separate CTest test, so it is run via the built binary's own
`--test-case=` filter, not `ctest -R full_sequence` (which selects zero
tests and would falsely report success). Confirm the filtered run reports
`1 | 1 passed` (or however many cases doctest's wildcard match selects) —
not `0 | 0 passed`, which is itself a failure of this test's setup.
**Pass:** login → session-valid → sysinfo → users.list → users.get →
accessLogs.list → logout, all correct against `FakeTransport` fixtures;
at least 1 test case actually ran.
**Result:** [ ] Pass / [ ] Fail

#### Test F-2 — Live-smoke-test binary builds; skip-gate still holds
```bash
cmake --build build-exec --target amico_live_smoke_test
build-exec/amico_live_smoke_test.exe
```
**Note (corrected):** `CMakeLists.txt`'s `add_executable(amico_live_smoke_test
test/live/live_smoke_test.cpp)` is a **root-level** target (confirmed:
`CMakeLists.txt:70`) — its output binary lands at
`build-exec/amico_live_smoke_test.exe` on this Windows/Ninja
configuration, **not** `build-exec/test/live/amico_live_smoke_test`. Every
invocation of this binary anywhere in this file uses the corrected path.
Run with `AMICO_ENABLE_LIVE_TESTS` unset in this shell (do not export it
here at all — Group 1/Group 2 never set live-test env vars).
**Pass:** Builds cleanly with Group 2 (tasks.md)'s additions; prints
`amico_live_smoke_test: skipped (set AMICO_ENABLE_LIVE_TESTS=1 to run)`
and exits 0 — no network call of any kind occurs.
**Result:** [ ] Pass / [ ] Fail

#### Test F-3 — Seven examples + live-smoke-test binary all build
```bash
cmake --build build-exec --target amico_example_login amico_example_session_check amico_example_system_information amico_example_list_users amico_example_get_user amico_example_list_access_logs amico_example_logout amico_live_smoke_test
```
**Result:** [ ] Pass / [ ] Fail

### Regression tests (corrected — content-hash baseline, not `git status`)

> **Why not `git status --porcelain`:** `include/`, `src/`, `test/`,
> `examples/`, `docs/`, `artifacts/`, `captures/`, `scripts/`, and every
> `.plans/*` directory are **all currently untracked** (`git ls-files`
> returns only `README.md`). `git status --porcelain` on any of these
> paths prints `?? <dir>/` regardless of what changed underneath, so the
> originally-drafted "no output" pass condition was unachievable and would
> have masked real edits. Use a content-hash baseline instead (spec.md
> Decision 8).

#### Test R-0 — Capture the pre-execution baseline (run BEFORE Task 1.1's build, and BEFORE any Group 2/3 file edit)
```bash
find src include test examples CMakeLists.txt vcpkg.json docs artifacts captures scripts .plans/2026-09-11-p5-rewrite-the-phase-2-read-only-c-17-am .plans/2026-09-11-implement-phase-2-production-oriented-re .plans/2026-09-11-p1-read-only-browser-mcp-discovery-pass- .plans/2026-09-11-phase-1-5-complete-the-amico-vl70lf-web- -type f -print0 | sort -z | xargs -0 sha256sum > .plans/2026-09-11-phase-2-remediation-and-live-device-verification/baseline-pre-exec.sha256
```
**Note (corrected, Codex round 2):** the original baseline omitted
`src`, `include`, `test`, `examples`, `CMakeLists.txt`, and `vcpkg.json` —
an unintended edit to preserved SDK code would have passed the only
pre/post regression comparison silently. All source and build-config
paths this plan's tasks might touch are now included; run this once,
before **any** Group 2/3 file edit.

#### Test R-1 — Only sanctioned files differ from the pre-execution baseline
```bash
find src include test examples CMakeLists.txt vcpkg.json docs artifacts captures scripts .plans/2026-09-11-p5-rewrite-the-phase-2-read-only-c-17-am .plans/2026-09-11-implement-phase-2-production-oriented-re .plans/2026-09-11-p1-read-only-browser-mcp-discovery-pass- .plans/2026-09-11-phase-1-5-complete-the-amico-vl70lf-web- -type f -print0 | sort -z | xargs -0 sha256sum > .plans/2026-09-11-phase-2-remediation-and-live-device-verification/baseline-post-exec.sha256
diff .plans/2026-09-11-phase-2-remediation-and-live-device-verification/baseline-pre-exec.sha256 .plans/2026-09-11-phase-2-remediation-and-live-device-verification/baseline-post-exec.sha256
```
**Pass (corrected, Codex round 3 — allowlist synced to `tasks.md`):** the
only differing lines correspond exactly to: `include/amico/Types.hpp`,
`include/amico/Errors.hpp`, `include/amico/Client.hpp`, `src/Client.cpp`,
`src/http/CurlTransport.cpp`, `src/NetworkSafety.hpp` (new),
`src/NetworkSafety.cpp` (new), `test/live/live_smoke_test.cpp`,
`test/test_system_information.cpp`, `test/test_network_safety.cpp` (new),
`CMakeLists.txt`, `docs/src-map.md`, `docs/sdk-usage.md` — nothing else
anywhere in `src/`, `include/`, `test/`, `examples/`, `docs/`,
`artifacts/`, `captures/`, `scripts/`, or other plan directories. Update
this list again if `tasks.md`'s Affected-files set changes.
**Result:** [ ] Pass / [ ] Fail

### Static analysis (corrected — enumerate actual untracked source files)
```bash
which clang-tidy > /dev/null 2>&1 && echo "clang-tidy present" || echo "clang-tidy NOT installed in this environment"
find src include -type f \( -name '*.cpp' -o -name '*.hpp' \) > .plans/2026-09-11-phase-2-remediation-and-live-device-verification/clang-tidy-input-files.txt
wc -l .plans/2026-09-11-phase-2-remediation-and-live-device-verification/clang-tidy-input-files.txt
# Only if clang-tidy is present AND the file list above is non-empty:
clang-tidy -p build-exec $(cat .plans/2026-09-11-phase-2-remediation-and-live-device-verification/clang-tidy-input-files.txt)
```
**Note (corrected):** the original command used `git ls-files 'src/*.cpp'
'include/**/*.hpp'`, which returns **nothing** for untracked paths — an
installed `clang-tidy` given zero files would exit success with no
analysis performed, which the original fallback then mislabeled as "not
installed." This version enumerates files directly from the filesystem
and checks tool presence with `which` as a separate, distinct step, so a
"tool present but ran on 0 files" state can never be silently reported as
either N/A or Pass.
**Result:** [ ] Pass / [ ] Fail / [ ] N/A (`clang-tidy` genuinely absent —
`which` reported nothing) / [ ] FAIL-TO-RUN (present but the input-file
list was empty — this is a setup bug, not an N/A)

### Secret scan
```bash
grep -rnE "session=[A-Za-z0-9]{16,}" --include='*.md' --include='*.json' --include='*.cpp' --include='*.hpp' --include='*.txt' --include='*.log' . 2>/dev/null | grep -v '\.git/' | grep -v '/build'
grep -rniE '"(password|hash|salt|panic_password|panic_salt)"\s*[:=]\s*"[^"]{3,}"' --include='*.md' --include='*.json' --include='*.cpp' --include='*.hpp' . 2>/dev/null | grep -v '\.git/' | grep -v '/build' | grep -v "REDACTED_FOR_FIXTURE"
```
**Pass:** No matches other than the known `REDACTED_FOR_FIXTURE` placeholder.
**Result:** [ ] Pass / [ ] Fail

---

## Group 2 — Independent offline verification (Verifier, fresh context, clean build)

> **Actor requirement (spec.md Decision 3):** run from a Claude Code
> session/context with no shared conversation history with whichever
> context ran Group 1.

### Clean reconfigure + rebuild
```bash
rm -rf build-verify   # must not exist yet at the start of this pass
cmake -S . -B build-verify -G Ninja -DCMAKE_TOOLCHAIN_FILE="$VCPKG_ROOT/scripts/buildsystems/vcpkg.cmake" -DAMICO_BUILD_TESTS=ON -DAMICO_BUILD_EXAMPLES=ON
cmake --build build-verify
```
**Pass:** Exit code 0, zero errors, from a directory that did not exist
before this command ran.

### Full offline suite rerun
```bash
ctest --test-dir build-verify --output-on-failure
build-verify/amico_tests.exe --test-case="full_sequence*"
```
**Pass:** Same pass count as Group 1's result, reproduced independently.

### Secret scan rerun
Same two commands as Group 1's secret scan, run again from this context.

### Live-smoke-test skip-gate re-check (corrected path)
```bash
build-verify/amico_live_smoke_test.exe
```
**Pass:** Same skip behavior as Group 1's Test F-2, confirmed
independently, from the corrected root-level binary path.

### Content-hash + toolchain/dependency version manifest (corrected — replaces `git rev-parse HEAD`)
**Action:** Write
`.plans/2026-09-11-phase-2-remediation-and-live-device-verification/verification-manifest.md`,
authored by the Verifier (not copied from the Executor's notes), containing:
```bash
cmake --version
ninja --version
cl --version 2>&1 | head -1
find src include test examples CMakeLists.txt vcpkg.json -type f -print0 | sort -z | xargs -0 sha256sum
sha256sum build-verify/amico_live_smoke_test.exe build-verify/amico_tests.exe
find build-verify/vcpkg_installed -iname "CONTROL" -o -iname "*.spdx.json" 2>/dev/null | sort | xargs -I{} sh -c 'echo === {} ===; cat {}'
```
**Note (corrected, Codex round 2):** `git rev-parse HEAD` identifies only
the committed `README.md` — it cannot bind evidence to "what was actually
built." The prior revision's fix (hashing only `.cpp`/`.hpp` source)
still didn't bind to the *executable actually launched*, nor to build
configuration (`CMakeLists.txt`, `vcpkg.json`) or resolved dependency
versions. This version records: (a) a hash of every source/config file
input (`src`, `include`, `test`, `examples`, `CMakeLists.txt`,
`vcpkg.json`), (b) a hash of the **built executables themselves**
(`amico_live_smoke_test.exe`, `amico_tests.exe`) — this is what Group 3's
precondition must match, not just the source, since a rebuild from
identical source could still land at a different location or an operator
could substitute a binary, and (c) resolved dependency version metadata
from `vcpkg_installed`'s own manifest files (`vcpkg --version` only
reports the vcpkg tool's own version, not curl/nlohmann-json/doctest's
resolved versions — read the actual installed-package manifests instead).
**Pass:** `verification-manifest.md` exists, is new, lists concrete
version strings, includes the full source/config hash list, the two
executable hashes, and the resolved dependency package metadata.

---

## Group 3 — Live-device tests (NOT run by Groups 1–2)

**Gate:** requires
`APPROVE_LIVE_DEVICE_TEST:2026-09-11-phase-2-remediation-and-live-device-verification`
as a fresh, distinct user message.

**Precondition:** the binary run below must be `build-verify/amico_live_smoke_test.exe`
itself, and its `sha256sum` must match the executable hash already
recorded in `verification-manifest.md` (not merely the source files) — if
it doesn't, this is not the verified build and the run must not proceed.

**Credential entry (corrected — spec.md Decision 7):** the human operator
sets `AMICO_ENABLE_LIVE_TESTS`, `AMICO_BASE_URL`, `AMICO_USERNAME`,
`AMICO_PASSWORD` directly in their own interactive terminal — **not**
via any command the AI agent/Executor issues or that appears in a tool
transcript. The agent's role is limited to printing the variable names
and the exact command below, then waiting for the operator to report the
outcome.

```
build-verify/amico_live_smoke_test.exe
```
(corrected path — root-level binary, not `test/live/...`. `AMICO_BASE_URL`
is set to `http://192.168.2.156` for this one, primary invocation —
**always HTTP, never HTTPS, for the main run** (corrected, Codex round 2:
the operator sets this before the binary starts, so it cannot depend on
`sslEnabled`, which is only known *inside* that same run, after
`getSystemInformation()` returns; choosing HTTPS here would also send the
primary `login()` itself over HTTPS, contradicting Task 2.2c's
HTTP-primary/HTTPS-secondary-probe-only design). The conditional HTTPS
check is Task 2.2c's internal secondary probe against a second,
separately-constructed client — it is not something the operator selects
via `AMICO_BASE_URL`.)

**Expected sequence (tasks.md Group 2):**
1. Preflight/reachability (non-authenticating)
2. login()
3. session-valid after login — **must be `true` to continue**
4. getSystemInformation()
5. HTTPS/TLS observation (conditional probe only if `sslEnabled`)
6. users().list(limit=5)
7. users().get(id) — id from step 6; result and returned id **must
   match** the requested id for a nonempty list, else `FAIL`; an
   empty-list case is `PARTIAL`, not `PASS`
8. accessLogs().list(limit=5)
9. logout()
10. session-valid after logout — **must be `false`**

**Pass:** `RESULT: PASS` printed, exit 0, `validAfterLogout == false`,
step 3 and step 7 both semantically satisfied per the corrected Task 2.3
requirements (not merely "the program didn't crash").
**Fail:** Any `RESULT: FAIL`/`PARTIAL` line, non-zero exit, or
`validAfterLogout == true` — per spec.md's failure handling (workstream
F): stop, record the exact output as evidence in `DECISION_LOG.md`/
`sprint-summary.md`, do not patch source from within this pass, route any
needed fix through a fresh Executor context followed by a fresh Verifier
context (Group 2 reruns from a clean state first).

**On every exit — pass or fail (corrected — token/credential hygiene):**
```
unset AMICO_PASSWORD AMICO_USERNAME AMICO_ENABLE_LIVE_TESTS
```
run in the operator's own shell, not by the agent.

**Rerun rule (corrected):** if this run fails and a fix is later applied
and re-verified (Group 2 repeated from clean), running the live test
again requires a **new, distinctly-worded** approval message — the exact
text of a previously-consumed `APPROVE_LIVE_DEVICE_TEST:<plan-id>`
message may not be reused for a second run, even after a fix. Suggested
form: `APPROVE_LIVE_DEVICE_TEST:2026-09-11-phase-2-remediation-and-live-device-verification:retry-1`
(increment the suffix per attempt).

**Result:** [x] Pass / [ ] Fail / [ ] Not run this cycle.

- **Attempt #1** (2026-09-12, under
  `APPROVE_LIVE_DEVICE_TEST:2026-09-11-phase-2-remediation-and-live-device-verification`):
  FAIL at step 1/9, `login failed: invalid username or password` —
  operator later identified this as literal placeholder text
  (`<username>`/`<admin>`/`<Admin>` including angle brackets) having been
  typed as the credential value itself, not a code/SDK defect.
- **Attempt #2** (2026-09-12, run by operator without waiting for a
  fresh `...:retry-1` approval message as requested): same FAIL, same
  cause.
- **Attempt #3 — PASS** (2026-09-12, run by operator with corrected
  credentials; also run without the agent first receiving a fresh
  `...:retry-2`-worded approval message — recorded as a process
  deviation, not blocked after the fact since the run already
  completed). Precondition held throughout (binary sha256
  `e72effc9d08a0cbe4647e661e166c2f361fd23528ad16a4b952c0f5f0184fb9c`,
  matching `verification-manifest.md`). Full 9/9 sequence, operator-pasted
  output:
  ```
  1/9 preflight+login... ok
  2/9 session valid... true
  3/9 system information... firmware=2.4.5 secbox=2.2.3
  4/9 HTTPS/TLS observation... HTTPS/TLS: not enabled on this device (observed via system information) -- skipped
  5/9 list users (limit 5)... 3 user(s)
  6/9 get(id)... found=true matched=true
  7/9 list recent access logs (limit 5)... 5 entr(y/ies)
  8/9 logout... ok
  9/9 session valid after logout... false
  RESULT: PASS
  ```
  `validAfterLogout == false` confirmed (step 9). Step 7's `get(id)`
  matched the requested id (nonempty list, not the PARTIAL/empty-list
  case). No password, session token, or full user record value was
  printed in any attempt's output.

**Never printed by this test, under any outcome:** the literal password
value, the literal session token value, or a full user record.

---

## Sprint sign-off

- [ ] Test R-0 baseline captured before Group 1 started
- [ ] Group 1 (Executor) build gate: ✅
- [ ] Group 1 unit tests (`ctest`, whole-binary): ✅
- [ ] Group 1 functional tests (F-1 corrected doctest filter, F-2
      corrected path, F-3): ✅
- [ ] Group 1 regression test R-1 (content-hash diff, corrected): ✅
- [ ] Group 1 static analysis (corrected file enumeration): recorded, not
      silently defaulted to N/A
- [ ] Group 1 secret scan: ✅
- [ ] Group 2 (Verifier, clean build) rebuild + rerun: ✅
- [ ] Group 2 `verification-manifest.md` written with content-hash list
      (corrected — not `git rev-parse HEAD`): ✅
- [ ] Group 3 live-device status explicitly recorded (Pass / Fail /
      Partial / Not run this cycle)
- [ ] `DECISION_LOG.md` updated with the Codex plan-review incorporation
      entry and any new decisions from execution
- [ ] `sprint-summary.md` written, including the actual final offline
      case/assertion count (not assumed to stay 38/171)

**Sign-off date:** [DATE]

# Tests — Phase 2: Read-only C++17 SDK for AMICO VL70LF

---

## Build gate (run first — if this fails, stop immediately)

```bash
cmake -S . -B build -G Ninja -DCMAKE_TOOLCHAIN_FILE="$VCPKG_ROOT/scripts/buildsystems/vcpkg.cmake" -DAMICO_BUILD_TESTS=ON -DAMICO_BUILD_EXAMPLES=ON
cmake --build build
```
**Pass:** Exit code 0, zero errors.
**Fail:** Any compile error → fix before proceeding.

---

## Unit tests (all offline — no network)

```bash
ctest --test-dir build --output-on-failure
```
**Pass:** All tests pass, exit code 0.
**Fail:** Any test failure → paste full output, fix before proceeding.

### The 20 required offline scenarios

| # | Scenario | Test file |
|---|---|---|
| 1 | Successful login parsing (`session` field extracted from fixture JSON) | `test_auth.cpp` |
| 2 | Invalid login response (401, error body) maps to `AuthenticationError` | `test_auth.cpp` |
| 3 | Case-sensitive username is documented behavior, exercised with placeholder (non-real) credentials only | `test_auth.cpp` |
| 4 | `Cookie: login=<u>; session=<token>` header constructed correctly from `Session` state | `test_session.cpp` |
| 5 | Session validation true/false both parsed correctly | `test_session.cpp` |
| 6 | `logout()` clears local session state (subsequent authenticated call fails fast with `InvalidSessionError`, no network attempted) | `test_session.cpp` |
| 7 | System-information parsing (full confirmed schema) | `test_system_information.cpp` |
| 8 | User-list parsing (whitelisted fields only; password/salt never reach the struct) | `test_users.cpp` |
| 9 | Access-log parsing | `test_access_logs.cpp` |
| 10 | Pagination (`limit`/`offset` round-trip into the request, page boundaries respected) | `test_users.cpp`, `test_access_logs.cpp` |
| 11 | Unknown/extra response fields are ignored without throwing (forward-compatible parsing) | `test_users.cpp` |
| 12 | Missing required response field raises `ProtocolError`/`JsonParseError` with a useful, non-sensitive message | `test_system_information.cpp` |
| 13 | Malformed JSON body raises `JsonParseError` | `test_errors.cpp` |
| 14 | Timeout (`FakeTransport` simulating a timeout) maps to `TimeoutError` | `test_errors.cpp` |
| 15 | HTTP 401 maps to `AuthenticationError` (login) / `InvalidSessionError` (other calls) | `test_errors.cpp` |
| 16 | Sensitive-field removal: `password`, `salt` never present on `AmicoUser` even when the fixture includes them | `test_redaction.cpp` |
| 17 | Recursive log redaction: nested objects/arrays containing `password`, `token`, `session`, `cookie`, `authorization`, `api_key`, `hash` (case-insensitive, substring) are redacted | `test_redaction.cpp` |
| 18 | Generic-query whitelist enforcement: unknown object name or unknown field name is rejected before any request is built | `test_query_whitelist.cpp` |
| 19 | Rejection of arbitrary connector strings: no public API path can inject a `where.connector` value | `test_query_whitelist.cpp` |
| 20 | Response-size limits: a fixture/fake response larger than `AmicoConfig.maxResponseBytes` raises `ResponseTooLargeError` | `test_errors.cpp` |

---

## Functional tests

### Test F-1 — Full offline auth→data→logout sequence against FakeTransport
**Setup:** `FakeTransport` pre-loaded with login/session/sysinfo/users/accesslogs/logout fixtures.
```bash
ctest --test-dir build -R full_sequence
```
**Pass:** Sequence completes end-to-end with correct typed results at each step.
**Fail:** Any step throws unexpectedly or returns a wrong shape.
**Result:** [ ] Pass / [ ] Fail

---

### Test F-2 — Examples compile and link against the public API only
```bash
cmake --build build --target amico_example_login amico_example_session_check amico_example_system_information amico_example_list_users amico_example_list_access_logs amico_example_logout
```
**Pass:** All six example binaries build.
**Fail:** Any link/compile error, or an example needing a non-public symbol.
**Result:** [ ] Pass / [ ] Fail

---

## Regression tests (ensure nothing broke in Phase 1 deliverables)

### Test R-1 — Phase 1 docs/artifacts untouched except the sanctioned redaction edits
```bash
git status --porcelain docs/ artifacts/ captures/
```
**Pass:** Only `docs/amico-auth-flow.md` (password redaction, already applied),
`docs/amico-endpoints.md`/`docs/amico-protocol-map.md` (security-language
calibration) show as modified; nothing else under `docs/`/`artifacts/`/`captures/` changes.
**Result:** [ ] Pass / [ ] Fail

---

## Static analysis

```bash
# if clang-tidy is available on PATH:
clang-tidy -p build $(git ls-files 'src/*.cpp' 'include/**/*.hpp')
```
**Pass:** No `.clang-tidy`-flagged errors (warnings triaged, not necessarily
zero — first run against a fresh config).
**Fail:** N/A if `clang-tidy` is not installed in this environment — record
that explicitly in the verify report rather than silently skipping.

---

## Secret scan (tracked files)

```bash
grep -rniE "session=[A-Za-z0-9]{16,}|password[\"']?\s*[:=]\s*[\"'][^\"']{3,}[\"']" \
  --include='*.md' --include='*.json' --include='*.cpp' --include='*.hpp' \
  docs/ artifacts/ test/fixtures/ examples/ src/ include/
```
**Pass:** No matches other than known-safe placeholders
(`REDACTED_FOR_FIXTURE`, `<redacted>`, `<password>`, env-var references).
**Fail:** Any real-looking session token or password literal → remove
before sign-off.

---

## Live tests (NOT run by default — documented, not executed, unless env is configured)

```bash
export AMICO_ENABLE_LIVE_TESTS=1
export AMICO_BASE_URL="http://192.168.2.156"
export AMICO_USERNAME="<device username>"
export AMICO_PASSWORD="<device password>"
build/test/live/amico_live_smoke_test
```
**Pass:** login → session-valid(true) → system-info → list users (small
limit) → list access logs (small limit) → logout → session-valid(false),
all succeed; only counts/firmware/result printed.
**Fail:** Any step errors, or the binary prints a full user record.
**Result:** Not run in this sprint's verification (env not configured by
default) — command recorded for the operator to run manually.

---

## Sprint sign-off

- [ ] Build gate: ✅
- [ ] All unit tests: ✅
- [ ] All functional tests: ✅
- [ ] All regression tests: ✅
- [ ] `CLAUDE.md` `## Current state` section updated — N/A, no `CLAUDE.md` exists in this repo yet (harness state lives in `.agent/` + `.plans/` instead)
- [ ] `DECISION_LOG.md` updated with any new decisions
- [ ] `sprint-summary.md` written

**Sign-off date:** 2026-09-11

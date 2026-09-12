# Tests — Phase 2 (corrected): Read-only C++17 SDK

---

## Build gate

```bash
cmake -S . -B build -G Ninja -DCMAKE_TOOLCHAIN_FILE="$VCPKG_ROOT/scripts/buildsystems/vcpkg.cmake" -DAMICO_BUILD_TESTS=ON -DAMICO_BUILD_EXAMPLES=ON
cmake --build build
```
**Pass:** Exit code 0, zero errors.

---

## Unit tests (offline, no network)

```bash
ctest --test-dir build --output-on-failure
```

### Required scenarios (23 total: the original 20 + 3 new)

| # | Scenario |
|---|---|
| 1 | Successful login parsing |
| 2 | Invalid login (401) → `AuthenticationError` |
| 3 | Case-sensitive username documented behavior (placeholder creds only) |
| 4 | Cookie header = `login=<u>; session=<t>` |
| 5 | Session valid true/false |
| 6 | `logout()` clears local session state |
| 7 | System-information parsing (full schema) |
| 8 | User-list parsing (confirmed default filter; no password/salt members exist) |
| 9 | Access-log parsing |
| 10 | Pagination (limit/offset round-trip) |
| 11 | Unknown/extra response fields ignored |
| 12 | Missing required field → `ProtocolError`/`JsonParseError` |
| 13 | Malformed JSON → `JsonParseError` |
| 14 | Timeout → `TimeoutError` |
| 15 | HTTP 401 → `AuthenticationError`/`InvalidSessionError` |
| 16 | Sensitive-field removal: `AmicoUser` has no password/salt members even if the fixture includes them |
| 17 | Recursive redaction: nested objects/arrays with password/token/session/cookie/authorization/api_key/hash redacted |
| 18 | Query whitelist: no code path accepts a caller-supplied object/field name |
| 19 | Connector rejection: no code path accepts a caller-supplied `where.connector` |
| 20 | Response-size limit → `ResponseTooLargeError` |
| 21 | **New:** `UsersApi::get(id)` found → correct `AmicoUser` |
| 22 | **New:** `UsersApi::get(id)` not found (empty array response) → empty `std::optional` |
| 23 | **New:** `panic_password`/`panic_salt` redacted by the existing `password`/`salt` substring rule (proves Decision 4's "no code change needed, just a test" claim) |

**Pass:** All 23 pass, `ctest` exit 0.

---

## Functional tests

### Test F-1 — Full offline sequence via FakeTransport
```bash
ctest --test-dir build -R full_sequence
```
**Pass:** login → session-valid → sysinfo → users.list → users.get →
accessLogs.list → logout, all correct, against `FakeTransport` fixtures.
**Result:** [x] Pass / [ ] Fail

### Test F-2 — Fields-never-omitted structural check
**Setup:** Manual code review of `src/ObjectQuery.cpp`'s three builder
functions — confirm none has a code path producing a `load_objects.fcgi`
body without a `fields` key, and none takes an object/field/connector
string as a parameter.
**Pass:** Confirmed by inspection; documented in the review with file:line
references.
**Result:** [x] Pass / [ ] Fail

### Test F-3 — Seven examples build
```bash
cmake --build build --target amico_example_login amico_example_session_check amico_example_system_information amico_example_list_users amico_example_get_user amico_example_list_access_logs amico_example_logout
```
**Result:** [x] Pass / [ ] Fail

---

## Regression tests

### Test R-1 — Phase 1/P1 docs and artifacts untouched except sanctioned edits
```bash
git status --porcelain docs/ artifacts/ captures/ scripts/
```
**Pass:** No unexpected changes to prior-phase evidence files.
**Result:** [x] Pass / [ ] Fail

### Test R-2 — Blocked/completed prior plans untouched
```bash
git status --porcelain .plans/2026-09-11-implement-phase-2-production-oriented-re/ .plans/2026-09-11-p1-read-only-browser-mcp-discovery-pass-/
```
**Pass:** No output.
**Result:** [x] Pass / [ ] Fail

---

## Static analysis

```bash
clang-tidy -p build $(git ls-files 'src/*.cpp' 'include/**/*.hpp') 2>&1 || echo "clang-tidy not installed in this environment"
```
**Result:** [ ] Pass / [ ] Fail / [x] N/A — `clang-tidy` is not installed in this environment (confirmed via `which clang-tidy`); recorded explicitly rather than silently skipped.

---

## Secret scan (tracked files)

```bash
grep -rnE "session=[A-Za-z0-9]{16,}" --include='*.md' --include='*.json' --include='*.cpp' --include='*.hpp' . 2>/dev/null | grep -v '\.git/' | grep -v '/build/'
grep -rniE '"(password|hash|salt|panic_password|panic_salt)"\s*[:=]\s*"[^"]{3,}"' --include='*.md' --include='*.json' --include='*.cpp' --include='*.hpp' . 2>/dev/null | grep -v '\.git/' | grep -v '/build/' | grep -v "REDACTED_FOR_FIXTURE"
```
**Pass:** No matches other than the known `REDACTED_FOR_FIXTURE` placeholder.
**Result:** [x] Pass / [ ] Fail

---

## Live tests (not run by default)

```bash
export AMICO_ENABLE_LIVE_TESTS=1
export AMICO_BASE_URL="http://192.168.2.156"
export AMICO_USERNAME="<device username>"
export AMICO_PASSWORD="<device password>"
build/test/live/amico_live_smoke_test
```
**Result:** Not run in this sprint's verification (env not configured by
default) — command recorded for the operator.

---

## Sign-off

- [x] Build gate: ✅
- [x] All unit tests (23 required scenarios; 38 test cases / 171 assertions total): ✅
- [x] All functional tests: ✅
- [x] All regression tests: ✅
- [x] `DECISION_LOG.md` updated
- [x] `sprint-summary.md` written

**Sign-off date:** 2026-09-11

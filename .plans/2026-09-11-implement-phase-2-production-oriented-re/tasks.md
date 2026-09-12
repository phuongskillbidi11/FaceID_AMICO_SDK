# Tasks — Phase 2: Read-only C++17 SDK for AMICO VL70LF

> Status markers: `[ ]` not started, `[~]` in progress, `[x]` complete (verified), `[!]` failed.
> Verification for most tasks is "compiles cleanly as part of the full build" —
> the authoritative gate is Group 10's full build+test run; per-task checks
> below are incremental sanity checks, not a substitute for it.

---

## Group 1 — Build scaffold

### Task 1.1 — vcpkg manifest + top-level CMake
**File:** `vcpkg.json`, `CMakeLists.txt`, `.clang-tidy`, `.gitignore`
**Action:** Create vcpkg manifest (curl, nlohmann-json, doctest); top-level
`CMakeLists.txt` with C++17, `AMICO_BUILD_TESTS`/`AMICO_BUILD_EXAMPLES`
options, `CMAKE_EXPORT_COMPILE_COMMANDS=ON`; `.clang-tidy` config; ignore
`build/`, `vcpkg_installed/`.

**Verification:**
```bash
cmake -S . -B build -G Ninja -DCMAKE_TOOLCHAIN_FILE="$VCPKG_ROOT/scripts/buildsystems/vcpkg.cmake"
```
**Pass:** Configure succeeds, CURL/nlohmann_json/doctest resolved.
**Fail:** CMake configure error.

**Status:** `[ ]`

---

## Group 2 — Core types, config, errors

### Task 2.1 — Public headers: Config, Errors, Types, Cancellation
**File:** `include/amico/Config.hpp`, `include/amico/Errors.hpp`, `include/amico/Types.hpp`, `include/amico/Cancellation.hpp`
**Symbol:** `AmicoConfig`, `AmicoError` hierarchy (10 types), `SystemInformation`, `AmicoUser`, `AccessLogEntry`, `UserQuery`, `AccessLogQuery`, `CancellationToken`
**Action:** Declare exactly the types in the brief's example usage plus the
10 required exception types, whitelisted-field-only structs for
`AmicoUser`/`AccessLogEntry` (no password/salt members exist at all).

**Verification:** compiles as part of Group 10 build.
**Pass/Fail:** see Group 10.

**Status:** `[ ]`

---

## Group 3 — HTTP transport

### Task 3.1 — Transport interface + libcurl implementation
**File:** `src/http/HttpTransport.hpp`, `src/http/CurlTransport.hpp`, `src/http/CurlTransport.cpp`, `src/UrlValidation.hpp`, `src/UrlValidation.cpp`
**Symbol:** `IHttpTransport`, `CurlTransport`, `validateBaseUrl()`
**Action:** Request/response structs; curl-based transport with connect/request
timeouts, response-body and header size caps, TLS verify always on,
`CURLOPT_FOLLOWLOCATION=0`, custom User-Agent, optional cancellation via
progress callback. Base-URL validator rejects embedded credentials,
non-http(s) schemes, query strings, fragments.

**Verification:** compiles as part of Group 10 build; exercised indirectly
by offline tests via `FakeTransport` (transport logic itself has no offline
test target since it requires a real socket — validated live in Group 7's
gated smoke test only).
**Pass/Fail:** see Group 10.

**Status:** `[ ]`

---

## Group 4 — Session state and redaction

### Task 4.1 — In-memory session (RAII wipe) + recursive redaction
**File:** `src/Session.hpp`, `src/Session.cpp`, `src/JsonRedact.hpp`, `src/JsonRedact.cpp`
**Symbol:** `Session`, `redactJson()`
**Action:** `Session` holds `login`/`session` cookie values in memory only;
destructor/`clear()` zero-overwrites before releasing. `redactJson()`
recursively redacts (case-insensitive substring match) any JSON key
containing: password, password_hash, hash, salt, session, token, cookie,
authorization, api_key — through nested objects and arrays.

**Verification:**
```bash
ctest --test-dir build -R redaction
```
**Pass:** Redaction tests pass (see tests.md scenarios 16–17).
**Fail:** Any redaction test failure.

**Status:** `[ ]`

---

## Group 5 — Generic query engine (internal) + AmicoClient

### Task 5.1 — Internal whitelisted `load_objects.fcgi` query builder
**File:** `src/ObjectQuery.hpp`, `src/ObjectQuery.cpp`
**Symbol:** `detail::ObjectQuerySpec`, `detail::buildLoadObjectsBody()`
**Action:** Not in `include/` — internal only. Fixed enum of queryable
objects (`Users`, `AccessLogs`), fixed per-object field whitelist, fixed
internal `connector` (`"AND"`, never caller-supplied), fixed max page size
enforced from `AmicoConfig`.

**Verification:**
```bash
ctest --test-dir build -R query_whitelist
```
**Pass:** Whitelist-enforcement and connector-rejection tests pass (tests.md
scenarios 18–19).
**Fail:** Any failure, or any code path that accepts a caller-supplied
object/field/connector string.

**Status:** `[ ]`

### Task 5.2 — AmicoClient (login/session/sysinfo/logout/users/accessLogs)
**File:** `include/amico/Client.hpp`, `src/Client.cpp`
**Symbol:** `AmicoClient::login()`, `::isSessionValid()`, `::getSystemInformation()`,
`::logout()`, `AmicoClient::UsersApi::list()`, `AmicoClient::AccessLogsApi::list()`,
`AmicoClient::debugGetObjectMetadata()`
**Action:** Implement exactly the brief's example call sequence. `login()`
POSTs form-urlencoded `login`/`password` to `/hidlogin.fcgi`, parses
`session` from JSON, stores in `Session`. `isSessionValid()` GETs
`/session_is_valid.fcgi`. `getSystemInformation()` POSTs
`/system_information.fcgi` (empty body) and maps the confirmed schema only
— unknown/missing fields raise `ProtocolError`/`JsonParseError` with
non-sensitive diagnostics. `logout()` GETs `/logout.fcgi`, clears in-memory
session regardless of server response. `autoRelogin` (config flag, default
false) governs whether a 401 on an authenticated call triggers exactly one
re-login+retry.

**Verification:** see Group 10 (full offline suite covers this).

**Status:** `[ ]`

---

## Group 6 — Offline tests and fixtures

### Task 6.1 — Sanitized fixtures
**File:** `test/fixtures/*.json` (login_success.json, login_failure.json,
session_valid_true.json, session_valid_false.json, system_information.json,
users_list.json, access_logs_list.json, malformed.json,
missing_required_field.json, unknown_extra_field.json)
**Action:** Hand-written JSON matching the exact confirmed shapes in
`docs/amico-endpoints.md`, with placeholder non-sensitive values (no real
session token/hash/salt — those fields are omitted or replaced with
obviously-fake placeholders like `"REDACTED_FOR_FIXTURE"` where a shape
needs to exist for a redaction test).

**Verification:** `test/fixtures/*.json` all parse via `nlohmann::json::parse` in a fixture-loader smoke test.
**Pass:** No parse errors.
**Fail:** Any malformed fixture (except the deliberately-malformed one).

**Status:** `[ ]`

### Task 6.2 — 20 offline test scenarios
**File:** `test/FakeTransport.hpp`, `test/test_auth.cpp`, `test/test_session.cpp`,
`test/test_system_information.cpp`, `test/test_users.cpp`,
`test/test_access_logs.cpp`, `test/test_redaction.cpp`,
`test/test_query_whitelist.cpp`, `test/test_errors.cpp`, `test/main.cpp`
**Action:** Implement all 20 scenarios listed in `tests.md`, using
`FakeTransport` to return canned fixture responses — zero real network
calls.

**Verification:**
```bash
ctest --test-dir build --output-on-failure
```
**Pass:** All tests green.
**Fail:** Any test failure — paste output, do not mark complete.

**Status:** `[ ]`

---

## Group 7 — Gated live smoke test

### Task 7.1 — Live 7-step sequence, env-gated
**File:** `test/live/live_smoke_test.cpp`
**Action:** If `AMICO_ENABLE_LIVE_TESTS` != `"1"`, print a skip message and
exit 0. Otherwise run login → session-valid → system-info → list users
(small limit) → list recent access logs (small limit) → logout → confirm
session invalid, printing only counts/firmware/result, never full records.

**Verification:**
```bash
build/test/live/amico_live_smoke_test   # without the env var set
```
**Pass:** Prints a skip message, exit code 0, makes no network call.
**Fail:** Attempts a network call without the env var set.

**Status:** `[ ]`

---

## Group 8 — Examples

### Task 8.1 — One example per implemented operation
**File:** `examples/login_example.cpp`, `examples/session_check_example.cpp`,
`examples/system_information_example.cpp`, `examples/list_users_example.cpp`,
`examples/list_access_logs_example.cpp`, `examples/logout_example.cpp`
**Action:** Each reads `AMICO_BASE_URL`/`AMICO_USERNAME`/`AMICO_PASSWORD`
from the environment, performs exactly one operation, prints a
non-sensitive summary. Not run automatically (require a real device); built
by default so they at least compile-check against the public API.

**Verification:** compiles as part of Group 10 build.

**Status:** `[ ]`

---

## Group 9 — Documentation

### Task 9.1 — SDK usage doc + source map + security-language calibration
**File:** `docs/sdk-usage.md`, `docs/src-map.md`, `docs/amico-endpoints.md` (modify), `docs/amico-protocol-map.md` (modify)
**Action:** New `docs/sdk-usage.md` (build/test/live-test commands, env
vars). New `docs/src-map.md` (source tree map, per project convention
referenced in the tasks.md template). Calibrate security wording in the two
existing docs to "observation, not verified vulnerability" phrasing per the
brief, and add the cookie `HttpOnly`-attribute caveat.

**Verification:** manual review; files exist and render as valid Markdown.

**Status:** `[ ]`

---

## Group 10 — Full verification

### Task 10.1 — Full build + offline tests + static analysis + secret scan
**File:** N/A (verification only)
**Action:** Run the full pipeline documented in `tests.md`.

**Verification:**
```bash
cmake -S . -B build -G Ninja -DCMAKE_TOOLCHAIN_FILE="$VCPKG_ROOT/scripts/buildsystems/vcpkg.cmake" -DAMICO_BUILD_TESTS=ON -DAMICO_BUILD_EXAMPLES=ON
cmake --build build
ctest --test-dir build --output-on-failure
```
**Pass:** Exit 0 at every step.
**Fail:** Any non-zero exit — stop, report, do not mark complete.

**Status:** `[ ]`

---

## Completion checklist

- [ ] All tasks marked `[x]`
- [ ] No tasks marked `[!]`
- [ ] Build passes
- [ ] All tests pass
- [ ] `docs/src-map.md` updated (new module added to the source tree)
- [ ] `docs/gotchas.md` updated if a real, non-obvious defect surfaced during this sprint
- [ ] Sprint summary written to `.plans/2026-09-11-implement-phase-2-production-oriented-re/sprint-summary.md`

---

## Rollback procedures

### General rollback (always safe to run)
```bash
git diff --name-only
git checkout -- [file-path]
```

No schema/global-config/package-manifest mutations happen in this sprint
beyond `vcpkg.json`/`CMakeLists.txt` themselves, which are trivially
recreated from this file if a task fails mid-way.

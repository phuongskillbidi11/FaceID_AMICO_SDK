# Tasks — Phase 2 (corrected): Read-only C++17 SDK

> Status markers: `[ ]` not started, `[~]` in progress, `[x]` complete
> (verification run), `[!]` failed. Most per-task verification is "compiles
> as part of the full build"; Group 10's full build+test run is the
> authoritative gate.

---

## Group 1 — Review existing WIP + build scaffold

### Task 1.1 — Review the three existing WIP headers against this spec
**File:** `include/amico/Config.hpp`, `include/amico/Errors.hpp`, `include/amico/Cancellation.hpp`
**Action:** Read each against Decisions 1–8. Expected outcome: all three
need **no change** (Config.hpp's fields are all still valid; Errors.hpp's
10-type hierarchy and Cancellation.hpp are protocol-agnostic). Record the
review outcome in `DECISION_LOG.md` rather than silently assuming it.
**Verification:** Manual diff review; documented in `DECISION_LOG.md`.
**Status:** `[x]`

### Task 1.2 — Review/update `vcpkg.json`, `CMakeLists.txt`, `.clang-tidy`
**Action:** `vcpkg.json` (curl, nlohmann-json, doctest + builtin-baseline)
needs no change. `CMakeLists.txt` needs its file lists updated once Groups
2–8 below create the real files (done incrementally as those groups
complete, not all at once). `.clang-tidy` needs no change.
**Verification:** `cmake -S . -B build -G Ninja -DCMAKE_TOOLCHAIN_FILE="$VCPKG_ROOT/scripts/buildsystems/vcpkg.cmake"` succeeds once file lists match reality.
**Status:** `[x]`

---

## Group 2 — Public types

### Task 2.1 — `include/amico/Types.hpp`
**Symbol:** `SystemInformation`, `NetworkInfo`, `AmicoUser`, `UserQuery`, `AccessLogEntry`, `AccessLogQuery`
**Action:** Declare exactly the confirmed-field structs. `AmicoUser`: `id`
(int64), `name`, `registration` (string), `userTypeId` (int),
`beginTime`/`endTime`/`lastAccess` (int64 unix ts) — **no `password`/
`salt`/`panic_password`/`panic_salt` members exist at all.** `UserQuery`:
`limit`, `offset` only (Decision 6 — no search/sort). `AccessLogEntry`:
`id`,`time`,`userId` (`std::optional<int64_t>`),`portalId`
(`std::optional<int64_t>`),`logTypeId`,`event`. `AccessLogQuery`:
`from`,`to` (`std::optional<int64_t>` unix ts),`limit`.
**Verification:** compiles as part of Group 10.
**Status:** `[x]`

---

## Group 3 — Session, redaction, URL validation

### Task 3.1 — `src/Session.hpp` / `.cpp`
**Symbol:** `Session`
**Action:** Holds `login`/`session` cookie values in memory only.
`cookieHeader()` returns `"login=<u>; session=<t>"`. `clear()`
zero-overwrites both strings before releasing. Destructor calls `clear()`
— no network call in the destructor.
**Verification:** part of Group 10; unit-tested directly in Group 6.
**Status:** `[x]`

### Task 3.2 — `src/JsonRedact.hpp` / `.cpp`
**Symbol:** `redactJson()`
**Action:** Recursive, case-insensitive substring match on keys containing:
`password`, `hash`, `salt`, `session`, `token`, `cookie`, `authorization`,
`api_key`. (Note: `panic_password`/`panic_salt` are already caught by the
`password`/`salt` substrings — Task 6.x adds a test proving this rather
than adding redundant patterns.) Recurses through nested objects and arrays.
**Verification:** part of Group 10; unit-tested in Group 6.
**Status:** `[x]`

### Task 3.3 — `src/UrlValidation.hpp` / `.cpp`
**Symbol:** `validateBaseUrl()`
**Action:** Reject embedded credentials (`user:pass@host`), non-http(s)
schemes, query strings, fragments. Accept LAN IP hosts.
**Verification:** part of Group 10; unit-tested in Group 6.
**Status:** `[x]`

---

## Group 4 — HTTP transport

### Task 4.1 — `src/http/HttpTransport.hpp`
**Symbol:** `IHttpTransport`, `HttpRequest`, `HttpResponse`
**Action:** Interface + plain-struct request/response types (method, path,
headers, body, contentType / statusCode, headers, body).
**Verification:** part of Group 10.
**Status:** `[x]`

### Task 4.2 — `src/http/CurlTransport.hpp` / `.cpp`
**Symbol:** `CurlTransport`
**Action:** libcurl implementation: connect/request timeouts from
`AmicoConfig`, response-body and header size caps (abort via write/header
callback returning a short count), `CURLOPT_SSL_VERIFYPEER`/`VERIFYHOST`
always on (no config knob), `CURLOPT_FOLLOWLOCATION=0`, custom
`User-Agent: AmicoCppSdk/0.1`, optional `CancellationToken` checked via
`CURLOPT_XFERINFOFUNCTION`.
**Verification:** part of Group 10; exercised live only by the gated
smoke test (Group 8), not by offline tests (no real socket in CI).
**Status:** `[x]`

---

## Group 5 — Internal query engine + AmicoClient

### Task 5.1 — `src/ObjectQuery.hpp` / `.cpp` (internal, not in `include/`)
**Symbol:** `detail::QueryableObject` (enum: `Users`, `AccessLogs`),
`detail::buildUsersListBody()`, `detail::buildUserGetBody()`,
`detail::buildAccessLogsListBody()`
**Action:** Three purpose-built body builders, **not** one generic
`object`/`fields`/`where` builder with optional parts — each function's
signature makes it structurally impossible to omit `fields` (Decision 4).
`buildUsersListBody(limit, offset)` hardcodes the confirmed default filter
and field list. `buildUserGetBody(id)` hardcodes a single `where: [{field:
"id", value:id}]` clause, no `connector`. `buildAccessLogsListBody(to,
limit, offset)` hardcodes the confirmed field list and (optionally) the
upper-bound `where` clause. None accept a caller-supplied object/field/
connector string — there is no parameter through which one could be
passed.
**Verification:**
```bash
ctest --test-dir build -R query_whitelist
```
**Pass:** Tests confirming (a) the built body always contains a non-empty
`fields` array, (b) no function signature accepts an arbitrary object/
field/connector string (compile-time fact, asserted by the test file
simply not having any way to pass one — reviewed manually, not just
runtime-tested).
**Status:** `[x]`

### Task 5.2 — `include/amico/Client.hpp` + `src/Client.cpp`
**Symbol:** `AmicoClient::login()`, `::isSessionValid()`,
`::getSystemInformation()`, `::logout()`, `AmicoClient::UsersApi::list()`,
`AmicoClient::UsersApi::get()`, `AmicoClient::AccessLogsApi::list()`
**Action:**
- `login()`: `POST /hidlogin.fcgi`, form-urlencoded `login`/`password`,
  parse `session` from JSON, store via `Session`.
- `isSessionValid()`: `GET /session_is_valid.fcgi`.
- `getSystemInformation()`: `POST /system_information.fcgi` (empty body),
  map the confirmed schema; unknown/missing required fields raise
  `ProtocolError`/`JsonParseError`.
- `logout()`: `GET /logout.fcgi`, clear session regardless of response.
- `UsersApi::list(UserQuery)`: `buildUsersListBody(limit,offset)` →
  `POST /load_objects.fcgi` → map to `std::vector<AmicoUser>`.
- `UsersApi::get(int64_t id)`: `buildUserGetBody(id)` → same endpoint →
  `std::optional<AmicoUser>` (empty if the response's array is empty).
- `AccessLogsApi::list(AccessLogQuery)`: `buildAccessLogsListBody(...)` →
  same endpoint → `std::vector<AccessLogEntry>`, with `from` applied as a
  client-side post-filter on the returned page (Decision 3).
- `autoRelogin`: on HTTP 401 from an authenticated call, if enabled,
  attempt exactly one re-login + retry.
**Verification:** see Group 10 (full offline suite).
**Status:** `[x]`

---

## Group 6 — Offline tests and fixtures

### Task 6.1 — Sanitized fixtures reflecting the *real* confirmed shapes
**File:** `test/fixtures/*.json`
**Action:** `login_success.json`, `login_failure.json`,
`session_valid_true.json`, `session_valid_false.json`,
`system_information.json`, `users_list_default_filter.json` (proving the
confirmed `user_type_id=0 OR IS NULL` shape came back correctly mapped),
`user_get_found.json`, `user_get_not_found.json` (empty array),
`access_logs_list.json`, `malformed.json`, `missing_required_field.json`,
`unknown_extra_field.json`, `sensitive_fields_present.json` (includes
`password`,`salt`,`panic_password`,`panic_salt` with placeholder values —
proves redaction/dropping, never a real value).
**Verification:** fixture-loader smoke test parses all of them.
**Status:** `[x]`

### Task 6.2 — The offline test suite
**File:** `test/FakeTransport.hpp`, `test/test_auth.cpp`,
`test/test_session.cpp`, `test/test_system_information.cpp`,
`test/test_users.cpp`, `test/test_access_logs.cpp`,
`test/test_redaction.cpp`, `test/test_query_whitelist.cpp`,
`test/test_errors.cpp`, `test/test_fixtures_load.cpp`, `test/main.cpp`
**Action:** Implement all scenarios from the original brief's 20-item list
(login parsing, invalid login, case-sensitive username as documented
behavior with placeholder creds, cookie header construction, session
valid/invalid, logout clears state, system-info parsing, user-list
parsing, access-log parsing, pagination, unknown fields ignored, missing
required field errors, malformed JSON, timeout mapping, HTTP 401 mapping,
sensitive-field removal, recursive redaction, whitelist enforcement,
connector rejection, response-size limits) **plus** three new scenarios
from this corrected spec: `get(id)` found → `AmicoUser`; `get(id)` not
found → empty `optional`; fields-never-omitted structural check; and
`panic_password`/`panic_salt` redaction (via the existing substring rule).
**Verification:**
```bash
ctest --test-dir build --output-on-failure
```
**Pass:** All green.
**Status:** `[x]`

---

## Group 7 — Live smoke test (gated)

### Task 7.1 — `test/live/live_smoke_test.cpp`
**Action:** Skip with exit 0 unless `AMICO_ENABLE_LIVE_TESTS=1`. Sequence:
login → session-valid → system-info → list users (small limit) → **get
one user by id from that list** → list recent access logs (small limit) →
logout → confirm session invalid. Prints only counts/firmware/result.
**Verification:**
```bash
build/test/live/amico_live_smoke_test   # without the env var
```
**Pass:** Skip message, exit 0, no network call.
**Status:** `[x]`

---

## Group 8 — Examples

### Task 8.1 — Seven example binaries
**File:** `examples/login_example.cpp`, `examples/session_check_example.cpp`,
`examples/system_information_example.cpp`, `examples/list_users_example.cpp`,
`examples/get_user_example.cpp` (new), `examples/list_access_logs_example.cpp`,
`examples/logout_example.cpp`
**Action:** Each reads env vars, performs one operation, prints a
non-sensitive summary.
**Verification:** compiles as part of Group 10.
**Status:** `[x]`

---

## Group 9 — Documentation

### Task 9.1 — `docs/sdk-usage.md`, `docs/src-map.md`
**Action:** Build/test/live-test commands, env vars, examples index,
source-tree map.
**Verification:** files exist, valid Markdown.
**Status:** `[x]`

---

## Group 10 — Full verification

### Task 10.1 — Full build + offline tests + static analysis + secret scan
**Verification:**
```bash
cmake -S . -B build -G Ninja -DCMAKE_TOOLCHAIN_FILE="$VCPKG_ROOT/scripts/buildsystems/vcpkg.cmake" -DAMICO_BUILD_TESTS=ON -DAMICO_BUILD_EXAMPLES=ON
cmake --build build
ctest --test-dir build --output-on-failure
```
**Pass:** Exit 0 at every step.
**Status:** `[x]`

---

## Completion checklist

- [x] All tasks marked `[x]`
- [x] No tasks marked `[!]`
- [x] Build passes
- [x] All tests pass (38 test cases, 171 assertions)
- [x] `docs/src-map.md` updated
- [x] `docs/gotchas.md` -- N/A, no real non-obvious defect surfaced (only trivial test-authoring bugs caught by the build itself)
- [x] Sprint summary written to `.plans/2026-09-11-p5-rewrite-the-phase-2-read-only-c-17-am/sprint-summary.md`

---

## Rollback procedures

```bash
git diff --name-only
git checkout -- [file-path]
```
No schema/global-config mutation happens in this sprint beyond
`CMakeLists.txt` itself, trivially reconstructed from this file.

# Tasks — Giai đoạn 3: Backend API layer (HTTP wrapper over `amico_sdk`)

> **Executor instructions:** Complete groups in order. After each task, run
> the verification command. Mark status before moving on.
>
> **Status markers:** `[ ]` not started · `[~]` in progress · `[x]` complete
> (verification passed) · `[!]` failed (stop, report to Planner).
>
> **Group gating (load-bearing):**
> - **Group 0** is a local, offline discovery task (vcpkg package
>   availability) — no device contact, no special approval needed.
> - **Groups 1–4** (code, offline tests, docs, build gate) require
>   **no** device contact.
> - **Group 5 (live smoke test) requires a fresh, distinct live-device
>   READ-ONLY approval message** (`APPROVE_LIVE_DEVICE_TEST:<plan-id>`)
>   — this plan's execution approval does not cover device contact by
>   itself, per every prior precedent in this project. There is no
>   live-write test in this plan (see spec.md's Scope Out) — no
>   `APPROVE_LIVE_DEVICE_WRITE_TEST` token is ever needed here.

---

## Group 0 — Discovery: confirm `cpp-httplib` is available via vcpkg

### Task 0.1 — Verify `cpp-httplib` vcpkg port exists and installs cleanly
**Action:** Add `"cpp-httplib"` to `vcpkg.json`'s `dependencies`, run a
CMake configure to trigger vcpkg's manifest install, confirm it
resolves and the header (`httplib.h`) becomes available for
`#include`. Do not write any backend code before this succeeds.
**Verification:**
```bash
cmake -S . -B build-exec
```
**Pass:** Configure succeeds, vcpkg reports `cpp-httplib` installed
(check the configure output for the package name), no missing-port
error.
**Fail:** Port not found, or install fails — **stop, do not guess a
workaround or an alternate package name; report to Planner** so a
fallback library (see spec.md Decision 1's rejected alternatives) can
be chosen deliberately, not silently.

**Status:** `[x]` — 2026-09-13: `cpp-httplib` added to `vcpkg.json`;
`cmake -S . -B build-exec` installed
`cpp-httplib[brotli,core]:x86-windows@0.54.1` cleanly. CMake target:
`find_package(httplib CONFIG REQUIRED)` /
`target_link_libraries(... httplib::httplib)`.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 1 — Backend server code

> Depends on Task 0.1. Every route below is a thin translation of an
> existing, already-tested `AmicoClient`/`UsersApi`/`AccessLogsApi`
> method (spec.md Decision 5) — no new business logic.

### Task 1.1 — `backend/BackendConfig.hpp`: env-var config + bind-address opt-in gate
**Action:** Add a `BackendConfig` struct: `amicoConfig` (an
`amico::AmicoConfig` built from `AMICO_BASE_URL`/`AMICO_USERNAME`/
`AMICO_PASSWORD`, with `autoRelogin = true` per spec.md Decision 2),
`bindAddress` (default `"127.0.0.1"`, from `BACKEND_BIND_ADDRESS`),
`port` (default `8080`, from `BACKEND_PORT`), and a function
`validateNetworkExposure()` implementing spec.md Decision 3.1: if
`bindAddress` is not `"127.0.0.1"`/`"localhost"` and
`BACKEND_ALLOW_NETWORK_EXPOSURE` is not `"1"`, return/throw a clear
error (do not start the server).
**Verification:** `cmake --build build-exec --target amico_backend`
(once Task 1.2 exists this compiles as part of the executable; for
this task alone, verify the header compiles standalone via a throwaway
translation unit or defer verification to Task 1.6 if simpler — note
which in Status).
**Pass:** Compiles; `validateNetworkExposure()`'s logic matches
spec.md Decision 3.1 exactly (both env vars, both conditions).
**Fail:** Compile error, or the gate can be bypassed with only one env
var set.

**Status:** `[x]` — 2026-09-13: written directly by Claude. Verified as
part of Task 1.6's full `amico_backend` build (exit 0, no warnings).
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 1.2 — `backend/JsonMapping.{hpp,cpp}`: struct ↔ `nlohmann::json`
**Action:** Add `toJson(const AmicoUser&)`, `toJson(const
AccessLogEntry&)`, `toJson(const SystemInformation&)`, and
`fromJsonNewUser(const nlohmann::json&) -> NewUser`,
`fromJsonUserUpdate(int64_t id, const nlohmann::json&) -> UserUpdate`
(partial — JSON fields absent map to `std::nullopt`, matching
`UserUpdate`'s existing semantics). Field names: camelCase to match
the C++ struct member names exactly (`userTypeId`, `beginTime`, etc.)
— no renaming, no reformatting (e.g. no converting epoch times to ISO
strings) beyond what the struct already represents. **`AmicoUser`'s
`hasPassword` field maps to a JSON boolean, never a string — and there
is no JSON field for a raw password/salt value anywhere in this file,
matching the SDK's own hard boundary.**
**Verification:** Part of Task 1.6's full build; additionally covered
directly by Group 2's offline tests.
**Pass:** Compiles; round-trips correctly in Group 2's tests.
**Fail:** Compile error, or any field silently dropped/renamed.

**Status:** `[x]` — 2026-09-13: written directly by Claude. Build:
exit 0, no warnings (part of Task 1.6's full build). Round-trip
verification deferred to Group 2 as planned.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 1.3 — `backend/ErrorMapping.{hpp,cpp}`: exception → HTTP status + JSON body
**Action:** Implement `mapException(const std::exception&) ->
std::pair<int, nlohmann::json>` per spec.md Decision 6's exact table.
Catch each `amico::AmicoError` subclass by type (most-derived first,
e.g. `TimeoutError` before `NetworkError` since it inherits from it),
falling back to a generic 500 for any other `std::exception`. Body
shape: `{"error": "<message>", "type": "<ExceptionClassName>"}`.
**This function is NOT responsible for request-body parsing errors**
(see Task 1.4/1.5's own separate try/catch for those, per spec.md
Decision 6's amendment) — it only ever receives exceptions thrown by
an `AmicoClient` call that already happened, i.e. the request was
already validly parsed.
**Verification:** Part of Task 1.6's build; covered by Group 2 tests
(one test per exception type, asserting the exact status code from
spec.md's table).
**Pass:** Compiles; every exception type in the table is tested and
matches.
**Fail:** Compile error, wrong status code for any type, or a
subclass caught by its base class's handler instead of its own (e.g.
`TimeoutError` reported as generic `NetworkError`'s 502 instead of its
own 504).

**Status:** `[x]` — 2026-09-13: written directly by Claude, using a
`dynamic_cast` chain in most-derived-first order exactly matching
spec.md's table (`TimeoutError`/`TlsVerificationError` checked before
their `NetworkError` base). Build: exit 0, no warnings. Per-type
assertions deferred to Group 2 as planned.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 1.4 — `backend/Routes.{hpp,cpp}`: route registration (read routes + user CRUD)
**Action:** Add `void registerAll(httplib::Server& svr, amico::AmicoClient&
client, std::mutex& clientMutex)` (spec.md Decision 4's serialization).
Implement first: `GET /health`, `GET /system-information`, `GET
/users`, `GET /users/:id`, `POST /users`, `PATCH /users/:id`, `DELETE
/users/:id`, `GET /access-logs`. Every handler: **(a)** parses the
request body/path/query params first, inside its own `try/catch` for
`nlohmann::json::exception`/`std::invalid_argument`/`std::out_of_range`
— on failure, responds `400 Bad Request` with `{"error": "...",
"type": "InvalidRequest"}` and returns immediately, **never** calling
`AmicoClient` (spec.md Decision 6's amendment, per Plan Review); **(b)**
only once parsing succeeds, locks `clientMutex`, calls the
corresponding `AmicoClient` method, maps the result via `JsonMapping`,
catches exceptions via `ErrorMapping`, sets the HTTP response
status/body accordingly.
**Verification:** `cmake --build build-exec --target amico_backend`.
**Pass:** Exit 0, no warnings.
**Fail:** Compile error.

**Status:** `[x]` — 2026-09-13: written directly by Claude. Used
`cpp-httplib`'s regex-capture route style (`R"(/users/(\d+))"` +
`req.matches[N]`, confirmed via reading the actual installed
`httplib.h` — `using Match = std::smatch`, `Server::Get(pattern,
handler)` — not guessed) rather than named `:id` path_params (both
exist in this version; regex style was simpler for multi-segment
routes like `/users/:id/groups/:groupId`). Build: exit 0, no warnings.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 1.5 — `backend/Routes.{hpp,cpp}`: group/card/image/administrator/password routes + guardrails
**Action:** Add the remaining routes: `POST /users/:id/groups/:groupId`,
`DELETE /users/:id/groups/:groupId`, `POST /users/:id/cards`, `DELETE
/cards/:cardId`, `PUT /users/:id/image` (raw body, `Content-Type:
image/jpeg` passthrough to `setImage()`), `DELETE /users/:id/image`.
Every handler here follows the same parse-first-then-call pattern as
Task 1.4 (malformed body/params → 400, never reaching `AmicoClient`).
Then the two guardrailed routes per spec.md Decision 3.2: `PUT
/users/:id/administrator` and `PUT /users/:id/password` — **after**
successfully parsing the body but **before** calling into
`AmicoClient`, check for header `X-Confirm-Sensitive-Action: yes`
(case-sensitive value, exact match); if absent or any other value,
respond `428 Precondition Required` with a JSON body naming the
required header, and **do not call the SDK at all**.
**Verification:** Same build command as Task 1.4.
**Pass:** Exit 0, no warnings.
**Fail:** Compile error, or a code path where the guardrail check
happens after (rather than strictly before) the SDK call.

**Status:** `[x]` — 2026-09-13: written directly by Claude
(security-sensitive guardrail logic — wanted full personal authorship).
`requireConfirmationHeader()` is called after body parsing but strictly
before the `clientMutex` lock / `AmicoClient` call in both
`PUT /users/:id/administrator` and `PUT /users/:id/password`. Build:
exit 0, no warnings.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 1.6 — `backend/main.cpp`: server bootstrap
**Action:** Read `BackendConfig` from env vars, call
`validateNetworkExposure()` (exit non-zero with a clear message if it
fails), construct `AmicoClient`, call `login()`, construct
`httplib::Server`, call `Routes::registerAll(...)`, call
`svr.listen(config.bindAddress, config.port)`. Add `amico_backend`
executable target to `CMakeLists.txt`, linking `amico_sdk` and
`httplib` (header-only — just include path from vcpkg).
**Verification:** `cmake --build build-exec --target amico_backend`
produces a runnable executable; manually confirm (no live device
needed) that running it with `BACKEND_BIND_ADDRESS=0.0.0.0` and no
`BACKEND_ALLOW_NETWORK_EXPOSURE` set exits non-zero with a clear error
(this can be checked without a real `AMICO_BASE_URL` if the exposure
check runs before the login attempt — order the checks so it does).
**Pass:** Builds; the network-exposure gate is checked and fails
closed before any device login attempt, confirmed by manual run.
**Fail:** Compile error, or the gate can be bypassed, or the gate check
happens after login (meaning a real device credential attempt would
occur even when refusing to bind).

**Status:** `[x]` — 2026-09-13: written directly by Claude.
`amico_backend` target added to `CMakeLists.txt` (new
`amico_backend_lib` static library holding Routes/JsonMapping/
ErrorMapping, linked by both `amico_backend` and, later,
`amico_backend_tests`). Manually verified:
`BACKEND_BIND_ADDRESS=0.0.0.0 ./build-exec/amico_backend.exe` (no
`AMICO_BASE_URL` set either) → exits 1 with the exposure-gate error
message, confirming the gate runs before any login attempt (a missing-
AMICO_BASE_URL error would have appeared instead if login were
attempted first). Build: exit 0, no warnings.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 2 — Offline integration tests (FakeTransport + real HTTP round-trip)

### Task 2.1 — Test harness: in-process server + `httplib::Client`
**Action:** New `test/backend/test_routes.cpp`. Helper: builds an
`AmicoClient` with `setTransportForTesting()` (a `FakeTransport`,
matching `amico_sdk`'s own test pattern), registers routes via
`Routes::registerAll`, starts `svr.listen("127.0.0.1", 0)` in a
background thread (`httplib::Server::listen` on port 0 lets the OS
pick a free port — confirm `cpp-httplib` exposes the bound port via
`svr.bind_to_any_port()`/`svr.listen_after_bind()` or the equivalent
API; **do not guess the exact API — read the actual installed header
first**), returns an `httplib::Client` pointed at that port. Tears the
server down cleanly at the end of each test case.
**Verification:** `cmake --build build-exec --target amico_backend_tests`.
**Pass:** Exit 0, no warnings.
**Fail:** Compile error, or the harness's API usage was guessed rather
than confirmed against `cpp-httplib`'s actual installed header.

**Status:** `[x]` — 2026-09-13: written directly by Claude. Confirmed
`Server::bind_to_any_port(host)`/`listen_after_bind()`/`is_running()`/
`stop()` by reading the actual installed `httplib.h`
(`build-exec/vcpkg_installed/x86-windows/include/httplib.h`), not
guessed. `TestServer` helper logs in via a `FakeTransport` responder
once, then leaves `fake()` for each test to arm. Build: exit 0, no
warnings.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 2.2 — Route tests: read routes + user CRUD (success + error paths)
**Action:** Using the Task 2.1 harness, cover: `/health`,
`/system-information`, `GET /users` (list), `GET /users/:id` (found +
not-found → 404), `POST /users` (success + a mapped-error case),
`PATCH /users/:id` (partial update field omission, **and** an explicit
empty-body `{}` case per Plan Review's non-blocking note — assert
whichever behavior is chosen, don't leave it untested), `DELETE
/users/:id`. **Also add the malformed-request-body case from spec.md
Decision 6's amendment:** `POST /users` with an invalid JSON body (e.g.
non-JSON text) and `POST /users/:id/cards` with a non-numeric
`areaCode` both return `400` with `type: "InvalidRequest"` — confirmed
via a `FakeTransport` responder that fails the test if `AmicoClient`
was reached at all. Reuse `amico_sdk`'s existing fixtures
(`test/fixtures/*.json`) via `FakeTransport`'s `readFixture()` where
shapes already match; add new ones only if genuinely needed.
**Verification:** `ctest --test-dir build-exec --output-on-failure`.
**Pass:** All new cases pass.
**Fail:** Any failure.

**Status:** `[x]` — 2026-09-13: written directly by Claude. Covers all
listed cases plus the empty-`PATCH`-body edge case (chosen behavior:
sends `{"values":{}}` through unchanged to the SDK, which throws
`ProtocolError` since the device reports `changes:0` for a no-op —
tested explicitly, not left accidental). Malformed-body case (`POST
/users` with invalid JSON, `POST /users/:id/cards` with a non-numeric
`areaCode`) both confirmed 400/`InvalidRequest` with `AmicoClient`
never reached (`failIfCalled` responder).
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 2.3 — Route tests: group/card/image/administrator/password + both guardrails
**Action:** Cover every remaining route from Task 1.5, plus explicit
guardrail tests: (a) `PUT /users/:id/administrator` and `PUT
/users/:id/password` both return `428` with no
`X-Confirm-Sensitive-Action` header and the SDK method is confirmed
NOT called (e.g. via a `FakeTransport` responder that fails the test
if invoked) (b) both succeed (200) with the header set to `yes` (c) a
header value other than `yes` (e.g. `no`, empty string) is also
rejected with 428 — not just its literal absence.
**Verification:** Same as Task 2.2.
**Pass:** All new cases pass, including the guardrail assertions.
**Fail:** Any failure, or a guardrail bypass path found.

**Status:** `[x]` — 2026-09-13: written directly by Claude. All group/
card/image routes covered. Both guardrailed routes tested for: no
header (428, `AmicoClient` never called), wrong header value `"no"`
(428, never called), and correct header `"yes"` (200, `AmicoClient`
called as expected). `setPassword`'s test additionally asserts the
plaintext PIN never appears in the HTTP response body.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 2.4 — Server-startup test: network-exposure gate
**Action:** A focused test (can live in `test_routes.cpp` or a new
small file) that directly exercises `BackendConfig::validateNetworkExposure()`
(not the full server process) for: (a) default `bindAddress =
"127.0.0.1"` → passes regardless of `BACKEND_ALLOW_NETWORK_EXPOSURE`
(b) `bindAddress = "0.0.0.0"` + no exposure env var → fails (c) same
+ `BACKEND_ALLOW_NETWORK_EXPOSURE=1` → passes (d) `bindAddress =
"localhost"` → treated the same as `"127.0.0.1"` (passes without the
exposure var).
**Verification:** Same as Task 2.2.
**Pass:** All 4 cases behave exactly as specified.
**Fail:** Any case behaves differently.

**Status:** `[x]` — 2026-09-13: written directly by Claude. All 4 cases
pass exactly as specified. Full `amico_backend_tests` run: **29 cases /
79 assertions, 0 failed**, all passing on the first run.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 3 — Docs

### Task 3.1 — `docs/backend-api.md`: full route/request/response/error documentation
**Action:** New file. Document every route (method, path, request
body/params, response shape, status codes), the full error-mapping
table from spec.md Decision 6, and an explicit, prominent security
section covering spec.md Decision 3 in full (both guardrails, and the
plain statement that neither is real authentication — a determined
caller who sets the right header/env var can still act; only real
auth in front of this server provides real access control).
**Verification:** Manual review — every route in spec.md's Scope In
appears in this doc with a matching method+path.
**Status:** `[x]` — 2026-09-13: written directly by Claude. Every
route documented with request/response shape; full error table;
prominent security section up top (guardrails explicitly stated as
accident-prevention, not real access control).
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 3.2 — `docs/src-map.md`: add rows for the new `backend/` files
**Verification:**
```bash
grep -c "backend/Routes\|backend/BackendConfig" docs/src-map.md
```
**Pass:** Prints `1` or more.
**Status:** `[x]` — 2026-09-13: new "Backend" section added with a row
per file; `vcpkg.json`/`CMakeLists.txt` rows updated. `grep -c` prints
`2`.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 4 — Full offline build + test gate (run once, on the fully-edited tree)

### Task 4.1 — Clean incremental build + full offline suite (SDK + backend)
**Action:** `cmake --build build-exec` then
`ctest --test-dir build-exec --output-on-failure`, then run both
`build-exec/amico_tests.exe` and `build-exec/amico_backend_tests.exe`
directly for exact case/assertion counts.
**Verification:** Same commands.
**Pass:** Build exit 0, zero warnings; both test binaries 0 failures.
Record case/assertion counts for both (SDK baseline before this plan:
89 cases / 490 assertions).
**Fail:** Any build error or test failure — do not proceed to Group 5
until clean.

**Status:** `[x]` — 2026-09-13: build exit 0, zero warnings.
`amico_tests.exe`: **89 cases / 490 assertions, 0 failed** (unchanged
from before this plan — confirms no SDK regression).
`amico_backend_tests.exe`: **29 cases / 79 assertions, 0 failed**. All
5 existing live-test binaries re-confirmed unaffected (still self-skip,
unchanged). Verified independently by Claude.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 5 — Live smoke test (GATED — read-only, separate approval required)

> **STOP before this group.** No request to `192.168.2.156` until a
> fresh `APPROVE_LIVE_DEVICE_TEST:<plan-id>` message is received. This
> is read-only (health/system-information/list users) — there is no
> live-write test in this plan (spec.md Scope Out); the underlying SDK
> writes are already live-verified from Giai đoạn 2/2b.

### Task 5.1 — Write `test/backend/live_backend_smoke_test.cpp` (code only, not run yet)
**Action:** New gated live test: starts the REAL `amico_backend`
server (real `AmicoClient`, real `CurlTransport`, real device config
from env vars) on an ephemeral loopback port, then uses
`httplib::Client` to call `/health`, `/system-information`, `GET
/users`, asserting 200 and a sane response shape for each. Same
skip-gate convention as every other live test
(`AMICO_ENABLE_LIVE_TESTS`).
**Verification:** Code compiles; running with no
`AMICO_ENABLE_LIVE_TESTS` set self-skips, exit 0, no network call.
**Pass:** Compiles; skip-gate confirmed offline.
**Fail:** Compile error, or a network call without the env var set.

**Status:** `[x]` — 2026-09-13: written directly by Claude. Build:
exit 0, no warnings. Skip-gate: confirmed offline, exit 0, no network
call.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 5.2 — Run the live smoke test (only with fresh approval)
**Action:** Print the exact command and env var names for the
operator to set themselves. Wait for the operator to run
`build-exec/amico_backend_live_smoke_test.exe` (or equivalent) and
report the output.
**Verification:** Operator-reported output.
**Pass:** `RESULT: PASS`; all 3 read routes returned 200 with sane
data, matching what `amico_live_smoke_test.exe` already independently
confirms at the SDK layer.
**Fail:** Any `RESULT: FAIL` or non-zero exit.

**Status:** `[x]` — 2026-09-13: approval
`APPROVE_LIVE_DEVICE_TEST:2026-09-13-phase3-backend-api-layer`
received; user then explicitly asked Claude to run it directly
(consistent with this session's established precedent from Giai đoạn
2b). **`RESULT: PASS`** — full 4/4: login, `GET /health` (200), `GET
/system-information` (200, valid shape), `GET /users` (200, 3 users
listed) — all through the real `amico_backend` server against the real
device. First real end-to-end proof the whole HTTP layer works against
the actual device, not just the offline `FakeTransport` harness.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Completion checklist

- [x] All Group 0–4 tasks marked `[x]`
- [x] Group 5 complete — `RESULT: PASS`, full 4/4 live sequence
- [x] No tasks marked `[!]`
- [x] `docs/backend-api.md` documents every route + the full security
      section (Task 3.1)
- [x] `docs/src-map.md` updated (Task 3.2)
- [x] Full offline build+test gate passed once, on the fully-edited
      tree (Task 4.1)
- [x] Both Decision 3 guardrails have explicit, passing offline test
      coverage (Tasks 2.3, 2.4)
- [ ] Sprint summary written to
      `.plans/2026-09-13-phase3-backend-api-layer/sprint-summary.md`

---

## Rollback procedures

### General rollback (always safe to run)
```bash
git status --porcelain
git diff --name-only
```
Every file this plan creates is new (`backend/`, `test/backend/`); a
clean rollback is `rm -rf backend/ test/backend/` plus reverting
`CMakeLists.txt`/`vcpkg.json`/`docs/src-map.md`'s edits via `git
checkout --`.

### Per-task rollback — Group 5 (live smoke test)
Read-only — no cleanup needed regardless of pass/fail; the test never
writes anything to the device.

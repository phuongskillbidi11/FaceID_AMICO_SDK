# Tests — Giai đoạn 5: Real login + dynamic device targeting

> **Executor instructions:** Run every test after all tasks complete.
> Group 4 (live) is conditional on a separate, fresh
> `APPROVE_LIVE_DEVICE_TEST:<plan-id>` approval — see its own note.
> Fill in each **Result:** line as each test actually runs; do not
> pre-fill.

---

## Build gate (run first — if this fails, stop immediately)

```bash
cmake -S . -B build-exec
cmake --build build-exec
```
**Pass:** Configure succeeds, build exit 0, zero new warnings.
**Fail:** Any configure or compile error → report to Planner before
proceeding.
**Result:**
> PASS: CMake regeneration/configure and full build succeeded, no new warnings. Initial ambiguous test overloads were corrected before the passing full build.

---

## Unit / integration tests

```bash
ctest --test-dir build-exec --output-on-failure
build-exec/amico_tests.exe
build-exec/amico_backend_tests.exe
```
**Pass:** All tests pass, exit code 0 for both binaries. SDK baseline
must be unchanged (89 cases / 490 assertions — this plan does not
touch `src/`/`include/`/existing SDK `test/` files). Backend baseline
before this plan: 29 cases / 79 assertions — expect growth from Task
3.1's new session/cookie cases; record the new count.
**Fail:** Any test failure, or the SDK count changing at all → paste
full output to Planner.
**Result:**
> PASS: CTest 2/2; SDK 89 cases / 490 assertions unchanged; backend 38 cases / 426 assertions.

---

## Functional tests

### Test F-1 — `GET /session` reflects logged-out state with no prior login
```bash
build-exec/amico_backend_tests.exe --test-case="*session*"
```
**Pass:** With a freshly-constructed `SessionStore` (no login yet),
`GET /session` returns `{"loggedIn": false}` and requires no cookie
itself.
**Fail:** Any mismatch, or the route incorrectly requiring a cookie.
**Result:**
> PASS: F-1 filter, 5 cases passed; fresh GET /session needs no cookie.

---

### Test F-2 — `POST /login` success sets a valid session cookie
```bash
build-exec/amico_backend_tests.exe --test-case="*login*"
```
**Pass:** A `FakeTransport`-backed successful login returns 200,
`{"success":true}`, and a `Set-Cookie: amico_session=...; HttpOnly;
SameSite=Lax; Path=/` header; a subsequent request carrying that
cookie succeeds on a session-gated route; `GET /session` now returns
`{"loggedIn": true, "deviceUrl": "..."}`.
**Fail:** Missing/malformed `Set-Cookie`, wrong status/body, or the
cookie not actually being honored by a later request.
**Result:**
> PASS: F-2 filter, 5 cases passed; cookie attributes/token encoding plus gated health/users verified.

---

### Test F-3 — `POST /login` failure (bad credentials) does not set a cookie
```bash
build-exec/amico_backend_tests.exe --test-case="*login*fail*,*login*invalid*"
```
**Pass:** `AuthenticationError` from the SDK maps to 401 via the
existing `ErrorMapping` table; no `Set-Cookie` header present; no
prior session (if one existed) is disturbed by a failed new-login
attempt — Design Decision 1 says a successful new login replaces the
old one, but a *failed* attempt must not log out an existing session.
**Fail:** A cookie is set on failure, wrong status code, or a failed
login attempt clears an existing valid session.
**Result:**
> PASS: F-3 filter, 2 cases passed; failure sets no cookie and preserves prior session.

---

### Test F-4 — `POST /login` malformed body → 400, never reaches `SessionStore`/SDK
```bash
build-exec/amico_backend_tests.exe --test-case="*login*malformed*,*login*badrequest*"
```
**Pass:** Invalid JSON, or JSON missing `deviceUrl`/`username`/
`password`, returns 400 `{"type":"InvalidRequest"}` before
`SessionStore::login()` is ever called (matches the plan's Task 1.3
"parse-then-call" discipline, same as Giai đoạn 3's own established
pattern).
**Fail:** A malformed body reaches the SDK layer, or returns any status
other than 400.
**Result:**
> PASS: F-4 filter, 1 case passed; malformed/missing/wrong-type body constructs no client.

---

### Test F-5 — Every pre-existing route requires the session cookie
```bash
build-exec/amico_backend_tests.exe --test-case="*cookie*gate*,*unauthorized*,*401*"
```
**Pass:** Every route that existed before this plan (health,
system-information, users list/get/create/update/remove, groups,
cards, administrator, image, password, access-logs) returns 401
`{"type":"InvalidSessionError"}` when called with no cookie or a
wrong/expired cookie value, and the underlying `AmicoClient` method is
confirmed NOT invoked in that case. `/login` and `/session` are exempt
from this gate (by design); confirm the test suite explicitly checks
they are exempt (not just omitted from the loop by accident).
**Fail:** Any existing route missing the gate, wrong status code, or
the SDK call happening before the cookie check.
**Result:**
> PASS: F-5 filter, 2 cases passed; every existing route plus logout rejects missing/wrong cookies before parsing or SDK calls.

---

### Test F-6 — `POST /logout` clears the session
```bash
build-exec/amico_backend_tests.exe --test-case="*logout*"
```
**Pass:** After a successful login + logout, a session-gated route
called with the now-stale cookie returns 401 again; `GET /session`
returns `{"loggedIn": false}`; the logout response itself carries a
`Set-Cookie: amico_session=; Max-Age=0; Path=/` (or equivalent
clearing directive).
**Fail:** The session remains valid after logout, or no clearing
`Set-Cookie` is sent.
**Result:**
> PASS: F-6 filter, 1 case passed; local revocation and clearing cookie also verified on remote failure.

---

### Test F-7 — A second successful login replaces the first (single active session)
```bash
build-exec/amico_backend_tests.exe --test-case="*login*replace*,*second*login*"
```
**Pass:** Logging in a second time (even to a different `deviceUrl`)
logs out the first `AmicoClient` and invalidates the first token —
requests using the OLD cookie now get 401; requests using the NEW
cookie succeed. Matches Design Decision 1 ("one device at a time").
**Fail:** Both tokens remain valid simultaneously, or the first
client is not properly logged out (resource/session leak on the real
device).
**Result:**
> PASS: F-7 filter, 1 case passed; old token rejected, new token works, previous-device logout attempted, including cleanup failure.

---

### Test F-8 — Frontend: 401 redirects to login view
Manual check (no automated harness for `frontend/*.js` in this
project) — covered by Group 4's live checklist (Task 4.1/4.3) rather
than an offline automated test, since it requires a real DOM/browser.
**Not applicable offline.**
**Result:**
> NOT RUN in a real browser: deferred to Group 4 as specified. Offline Node DOM/fetch simulation passed 401 redirect and login/logout/remember behavior; this does not substitute for live browser verification.

---

### Test F-9 — `docs/backend-api.md` documents `/login`, `/logout`, `/session`
```bash
grep -n '^### `POST /login`\|^### `POST /logout`\|^### `GET /session`' docs/backend-api.md
```
**Pass:** All three headings present.
**Fail:** Any missing.
**Result:**
> PASS: all three route headings found in docs/backend-api.md.

---

## Live tests (GATED — separate, fresh approval required)

### Test L-1 — Real login: wrong credentials rejected, correct credentials succeed
**Setup:** `APPROVE_LIVE_DEVICE_TEST:<plan-id>` received as a fresh,
distinct message. `amico_backend` running with NO `AMICO_*` env vars.
**Pass:** Wrong credentials via the real login form → clear error,
stays on login form, no session cookie set. Correct `Admin`/`admin` →
main UI appears, `GET /session` confirms `loggedIn: true` with the
correct `deviceUrl`.
**Fail:** Any deviation, especially wrong credentials somehow
succeeding.
**Result:**
> PASS (2026-09-13, via chrome-devtools-mcp against the real device):
> wrong credentials → 401, clear error banner, stayed on login form, no
> `Set-Cookie` header sent. Correct `Admin`/real password against
> `http://192.168.2.156` → main UI shown, `GET /session` returned
> `{"loggedIn":true,"deviceUrl":"http://192.168.2.156"}`, cookie
> present on the request (confirmed via network inspection).

---

### Test L-2 — Logout truly ends the session against the real device
**Pass:** After L-1's successful login, Logout returns to the login
form; a subsequent gated action (e.g. loading Users) is rejected until
logging in again.
**Fail:** Any post-logout action still succeeds.
**Result:**
> PASS (2026-09-13): Logout returned to the login form; post-logout,
> `GET /users` returned 401 `InvalidSessionError` and `GET /session`
> returned `{"loggedIn":false}`.

---

### Test L-3 — Giai đoạn 4's originally-deferred functional checklist, now via real login
**Pass:** Users/Access Logs/System Information render correctly;
card/group/image add-and-remove on a disposable test user — all as
originally specified in Giai đoạn 4's own Task 4.1/4.2, now exercised
through this plan's login flow instead of env-var startup config.
**Fail:** Any of Giai đoạn 4's original acceptance criteria regress.
**Result:**
> PASS (2026-09-13, per `APPROVE_LIVE_DEVICE_WRITE_TEST` approval):
> Users/Access Logs/System Information all rendered real device data
> correctly. Created disposable test user `ZZ_DisposableTest_Phase5`
> (id 45); group add/remove, card add/remove, and image upload all
> confirmed working end-to-end (image upload correctly reached the
> device and returned a face-validation error since the test image was
> a placeholder, not a real face — confirms the route works, not a
> failure of this plan's code). No real user (5, 36, 4) was touched.
> Test user 45 deleted afterward; `GET /users` confirmed only the
> original 3 users remain.

---

### Test L-4 — Administrator toggle + PIN set (separate fresh confirmation required)
**Setup:** A separate, explicit user confirmation naming these two
actions specifically, obtained before running — same standing rule as
every prior Administrator/PIN live test this project has run.
**Pass:** Both succeed via the real login-gated UI; no real user
affected; no PIN value observable anywhere afterward (network capture,
logs, localStorage).
**Fail:** Any failure, or a real user affected, or a PIN value
observed anywhere it shouldn't be.
**Result:**
> PASS (2026-09-13, per separate explicit user confirmation naming
> both actions): performed on the same disposable test user 45, never
> a real user. Administrator toggle: confirm dialog named the exact
> user and action, accepted, checkbox checked and Users table showed
> "Administrator: Yes". PIN set: separate confirm dialog ("cannot be
> undone or read back later"), accepted, "PIN: Set" shown, input
> cleared immediately, Users table showed "Password: Set". No PIN
> value observed anywhere (UI, network requests, or otherwise) after
> typing it. Test user 45 deleted afterward; the 3 real users were
> unaffected.

---

## Regression tests (ensure nothing broke)

### Test R-1 — Existing `amico_sdk` offline suite unaffected
```bash
build-exec/amico_tests.exe
```
**Pass:** Still 89 cases / 490 assertions, 0 failed.
**Fail:** Any change.
**Result:**
> PASS: amico_tests.exe reports 89 cases / 490 assertions, 0 failures.

---

### Test R-2 — Existing live-test binaries still self-skip with no env vars
```bash
build-exec/amico_live_smoke_test.exe
build-exec/amico_live_write_test.exe
build-exec/amico_live_write_profile_test.exe
build-exec/amico_live_admin_test.exe
build-exec/amico_live_password_test.exe
build-exec/amico_backend_live_smoke_test.exe
```
**Pass:** All 6 print their unchanged skip message, exit 0.
**Fail:** Any behavior change.
**Result:**
> PASS: all six binaries returned 0 and printed their unchanged skip messages with all AMICO_* environment variables removed.

---

### Test R-3 — Secret scan clean (no session token, password, or PIN ever persisted to disk/docs)
```bash
grep -rnE "amico_session=[A-Za-z0-9]{16,}" --include='*.md' --include='*.json' --include='*.cpp' --include='*.hpp' --include='*.js' . 2>/dev/null | grep -v '\.git/' | grep -v '/build[^/]*/'
grep -rniE '"(password|pin|hash|salt)"\s*:\s*"[0-9a-zA-Z]{4,}"' --include='*.md' --include='*.json' . 2>/dev/null | grep -v '\.git/' | grep -v '/build[^/]*/'
grep -rn "localStorage" frontend/*.js
```
**Pass:** First two scans produce no output (or only an already-
documented benign false positive); the `localStorage` grep's hits are
manually confirmed to only ever store `deviceUrl`/`username`, never
`password`.
**Fail:** Any real match, or any `localStorage` write including the
password field.
**Result:**
> PASS: both repository scans returned zero matches (including hidden plan files, excluding .git/build directories); reviewed localStorage writes store only deviceUrl and username.

---

## Sprint sign-off

- [x] Build gate
- [x] All unit/integration tests
- [ ] Functional tests F-1–F-9
- [ ] Live tests L-1–L-4 (or explicitly "not run this cycle — no
      live-device approval issued", which does not block sign-off for
      Groups 1–3's own completion)
- [ ] All regression tests R-1–R-3
- [x] `DECISION_LOG.md` updated with any new decisions
- [x] `sprint-summary.md` written

**Sign-off date:**
> 2026-09-13 - Groups 1-3 offline scope only; Group 4 not run.

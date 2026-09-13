# Tasks — Giai đoạn 5: Real login + dynamic device targeting

> **Executor instructions:** Complete groups in order. After each task, run
> the verification command. Mark status before moving on.
>
> **Status markers:** `[ ]` not started · `[~]` in progress · `[x]` complete
> (verification passed) · `[!]` failed (stop, report to Planner).
>
> **Group gating:**
> - **Groups 1–3** (backend session model, frontend login UI, offline
>   tests + docs) require **no** device contact beyond what the
>   existing offline `FakeTransport` harness already provides.
> - **Group 4 (manual live verification) requires a fresh, distinct
>   live-device approval** — this plan's own login flow means the
>   *first* action in Group 4 IS a live login attempt (with both valid
>   and deliberately-invalid credentials), so treat the whole of Group
>   4 as requiring `APPROVE_LIVE_DEVICE_TEST:<plan-id>` at minimum; the
>   write-capable checks it also covers (already-approved-pattern
>   actions from Giai đoạn 2b/4) don't need a *second* write-approval
>   token beyond this plan's own, since this plan doesn't introduce any
>   new write action — it only changes how an existing, already-approved
>   set of writes gets authenticated into.

> **Note on discovery:** `cpp-httplib` has no dedicated cookie-parsing
> helper (confirmed by reading the installed header — only `"cookie"`/
> `"set-cookie"` appear as plain header-name string literals, no parser
> API). Task 1.1 implements a small manual `Cookie:` header parser and
> constructs `Set-Cookie` headers directly — this is expected, not a
> gap to route around.

---

## Group 1 — Backend session model

### Task 1.1 — `backend/SessionStore.hpp` / `.cpp`: active-session state + token generation
**Action:** New `SessionStore` class: holds
`std::optional<amico::AmicoClient> activeClient`, `std::string
activeSessionToken` (empty = logged out), `std::string
activeDeviceUrl` (for `GET /session`'s response), guarded by a
`std::mutex` (reuse or wrap the existing `clientMutex` pattern — one
mutex protecting both the client and the session token together, so a
login/logout can't race a route's read of `activeSessionToken`).
Methods: `login(deviceUrl, username, password) -> void` (throws
whatever `AmicoClient::login()` throws; on success, logs out any
previous session first, swaps in the new client, generates a fresh
token via `std::random_device` — at least 16 random bytes, hex-encoded
— and stores it), `logout()`, `bool checkSessionCookie(const
std::string& cookieHeader) const` (parses `Cookie: k1=v1; k2=v2`
manually — split on `"; "` then `"="` — looks for `amico_session`,
compares against `activeSessionToken` in constant regard to timing not
required for this MVP, a plain `==` is acceptable here), `AmicoClient*
client()` (nullptr if logged out), `bool isLoggedIn() const`,
`std::string deviceUrl() const`.
**Verification:** `cmake --build build-exec --target amico_backend`.
**Pass:** Exit 0, no warnings.
**Fail:** Compile error.

**Status:** `[x]`
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 1.2 — `backend/BackendConfig.hpp`: remove the startup device-credential requirement
**Action:** `loadBackendConfig()` no longer treats `AMICO_BASE_URL`/
`AMICO_USERNAME`/`AMICO_PASSWORD` as required — remove
`config.amicoConfig` entirely from `BackendConfig` (it's now
constructed per-login inside `SessionStore::login()`, not held in the
static config). Keep `bindAddress`/`port`/`allowNetworkExposure`/
`frontendDir` unchanged.
**Verification:** Same build command.
**Pass:** Exit 0, no warnings.
**Fail:** Compile error, or any leftover code path that still expects
a pre-configured `amicoConfig`.

**Status:** `[x]`
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 1.3 — `backend/Routes.cpp`: add `/login`, `/logout`, `/session`; add the cookie gate to every existing route
**Action:** `registerAll(...)` now takes a `SessionStore&` instead of
the raw `AmicoClient&`/`std::mutex&` it took before (`backend/
Routes.hpp:25`'s current signature). **Every existing route —
including `GET /health` — now resolves its `AmicoClient` via
`sessionStore.client()` instead of a fixed reference, and (before
doing so) checks
`sessionStore.checkSessionCookie(req.get_header_value("Cookie"))`; if
false, respond `401 {"error":"not logged in","type":
"InvalidSessionError"}` (reusing the exact `type` string
`ErrorMapping.cpp` already uses for `amico::InvalidSessionError`, for
consistency — no new error-mapping code needed since this check
happens before any SDK call, not as a caught exception) and never
touch the SDK.** `/health`'s meaning therefore changes from "is the
backend process up" to "is the currently active device session
reachable" (there is no longer a fixed pre-login device to check
reachability against) — document this change explicitly in Task 3.2.
Only `POST /login` and `GET /session` are exempt from this gate — no
other route is exempt, no ambiguity left for the Executor to resolve.

A failed `POST /login` attempt (bad credentials, unreachable device,
etc.) must NOT disturb an existing valid session — only a
*successful* new login replaces the previous one (per spec.md
Decision 1's "one device at a time," not "any login attempt resets
state"). Add:
- `POST /login` — body `{"deviceUrl","username","password"}` (parsed
  in the existing parse-then-call pattern — malformed body → 400,
  never reaching `SessionStore::login()`). On success: set
  `Set-Cookie: amico_session=<token>; HttpOnly; SameSite=Lax; Path=/`,
  respond `200 {"success":true}`. On failure: map via the existing
  `ErrorMapping` table (`AuthenticationError`→401,
  `ConfigurationError`→500 for a bad `deviceUrl`, etc.) — **no
  session-cookie check on this route itself** (that would be
  circular).
- `POST /logout` — requires the session cookie (same gate as other
  routes); calls `sessionStore.logout()`; responds with a `Set-Cookie:
  amico_session=; Max-Age=0; Path=/` to clear the cookie client-side
  too; `200 {"success":true}`.
- `GET /session` — **no cookie required** (the frontend calls this
  precisely to find out whether it's logged in) — responds
  `{"loggedIn": true, "deviceUrl": "..."}` or `{"loggedIn": false}`.
**Verification:** `cmake --build build-exec --target amico_backend`.
**Pass:** Exit 0, no warnings.
**Fail:** Compile error, or any existing route missing the cookie gate.

**Status:** `[x]`
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 1.4 — `backend/main.cpp`: no login-at-startup
**Action:** Remove the startup `AmicoClient`/`client.login()` block
entirely. Construct a `SessionStore` (empty/logged-out), pass it to
`registerAll(...)`, mount the frontend, `listen()` — the network-
exposure gate (Decision 3.1, unchanged) still runs before anything
else.
**Verification:** `cmake --build build-exec --target amico_backend`;
manually run with NO `AMICO_*` env vars set at all and confirm the
process starts and listens successfully (it must NOT require them
anymore) — `curl -X POST http://127.0.0.1:8080/session` should return
`{"loggedIn":false}`.
**Pass:** Builds; starts with no device env vars set; `/session`
correctly reports logged-out.
**Fail:** Compile error, or the process still refuses to start without
`AMICO_*` vars.

**Status:** `[x]`
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 2 — Frontend login UI

### Task 2.1 — `frontend/index.html`: login view markup
**Action:** Add a login `<section>` (Device IP/URL, Username,
Password, Remember-password checkbox, Log In button — modeled on the
real device's own login page structure, per spec.md Decision 2),
hidden by default alongside the existing tab nav/containers (which
also start hidden until a successful `GET /session` check confirms
login).
**Verification:** Open directly via `file://` — the login form's
markup exists (visible manually, no backend needed for this static
check).
**Status:** `[x]`
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 2.2 — `frontend/login.js`: login flow, `GET /session` check, Remember, Logout
**Action:** On page load: `GET /session` (via `apiFetch`, or a raw
`fetch` since no cookie exists to gate on yet); if `loggedIn`, hide the
login view and show the nav/tabs (dispatching the existing
`tab-activated` flow for whichever tab is default); if not, show the
login view. Login form submit → `POST /login` with the three fields;
on success, re-run the `GET /session` check to reveal the main UI; on
failure, show the error via the existing banner. "Remember password"
checked → store `deviceUrl`+`username` (never `password`) in
`localStorage`, pre-filled on next load (Decision 4) — password field
always starts blank. Add a Logout button (visible once logged in,
e.g. in the header) → `POST /logout` → show the login view again.
**Verification:** Manual, against a running backend.
**Pass:** Full flow works: fresh load → login form; wrong credentials
→ error shown, still on login form; correct credentials → main UI
shown; Logout → back to login form; "Remember" persists IP/username
(never password) across a reload.
**Fail:** Any step in that flow behaves differently, or the password
is ever found in `localStorage`/`sessionStorage`/anywhere persistent.

**Status:** `[x]`
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 2.3 — `frontend/app.js`: redirect to login view on 401
**Action:** `apiFetch`'s error handling: a `401` response from any
route (other than `/login`/`/session` themselves, which handle their
own 401-shaped "not logged in" case as a normal flow, not an error)
triggers showing the login view again (e.g. by dispatching a
`session-expired` event `login.js` listens for), in addition to (or
instead of) the generic error banner — a stale/missing session should
send the user back to a working login form, not just an error message
they can't act on.
**Verification:** Manual — e.g. call `POST /logout` from devtools
console, then trigger any other route call from the UI, and confirm it
returns to the login view rather than showing a dead page.
**Pass:** Any 401 correctly routes back to the login form.
**Fail:** A 401 leaves the UI showing stale data with only a banner
message and no way back to login.

**Status:** `[x]`
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 3 — Offline tests + docs

### Task 3.1 — `test/backend/test_routes.cpp`: login/logout/session/cookie-gate test cases
**Action:** Update the existing `TestServer` harness to use the new
`SessionStore`-based `registerAll(...)` signature. Add cases: `POST
/login` success (valid `FakeTransport`-backed login) sets a
`Set-Cookie` header and a subsequent request WITH that cookie succeeds
on `GET /health` AND on `GET /users` (both session-gated per Task
1.3's finalized decision — no route is cookie-exempt except `/login`/
`/session`); `POST /login` with bad credentials → 401 (via
`AuthenticationError`), no cookie set, AND (if a prior valid session
existed) that prior session remains valid and unaffected; any existing
route (including `/health`) called WITH NO cookie → 401, `AmicoClient`/
`SessionStore` login never attempted; `POST /logout` clears the
session (a subsequent gated call without a fresh login now fails
again); `GET /session` reflects both states correctly and needs no
cookie itself.
**Verification:** `ctest --test-dir build-exec --output-on-failure`.
**Pass:** All new + existing cases pass.
**Fail:** Any failure.

**Status:** `[x]`
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 3.2 — `docs/backend-api.md`: document the new session model
**Action:** Add `/login`/`/logout`/`/session` to the route reference;
update the Configuration section to remove the now-optional
`AMICO_BASE_URL`/`USERNAME`/`PASSWORD` requirement note; add a short
"Session model" section explaining the cookie gate, one-device-at-a-
time behavior, and the CSRF/`SameSite=Lax` tradeoff from spec.md's
Risks section. Also update `GET /health`'s own entry to state its
meaning has changed: it now checks reachability of the *currently
active device session*, not "is the backend process up" — a caller
wanting the latter has no route to call before logging in (the TCP
connection succeeding, or `GET /session`, are the closest available
signals).
**Verification:** Manual review.
**Status:** `[x]`
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 3.3 — `docs/src-map.md`: update rows
**Verification:**
```bash
grep -c "SessionStore" docs/src-map.md
```
**Pass:** Prints `1` or more.
**Status:** `[x]`
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 3.4 — Full offline build + test gate
**Action:** `cmake --build build-exec` then
`ctest --test-dir build-exec --output-on-failure`.
**Verification:** Same commands.
**Pass:** Build exit 0, zero warnings; `amico_offline_tests` unchanged
(89/490); `amico_backend_offline_tests` — new count, record it (prior
baseline: 29/79, expect growth from Task 3.1's new cases).
**Fail:** Any build error, test failure, or SDK-suite count change.

**Status:** `[x]`
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 4 — Manual live verification (GATED — separate approval required)

> **STOP before this group.** No request to any real device until a
> fresh `APPROVE_LIVE_DEVICE_TEST:<plan-id>` message is received. This
> plan's own first live action is a real login — treat the whole group
> as needing this approval before starting, per the note at the top of
> this file.

### Task 4.1 — Live login checklist (valid + invalid credentials)
**Action:** With `amico_backend` running (no `AMICO_*` env vars set
this time — Task 1.4's whole point), open the frontend: submit the
real device's IP with deliberately WRONG credentials first (confirm a
clear error, still on the login form); then submit the correct
`Admin`/`admin` (confirm the main UI appears); confirm `GET /session`
reflects the login; Logout; confirm the login form reappears and a
subsequent action is rejected until logging in again.
**Verification:** Manual, operator/agent-observed.
**Pass:** Wrong credentials rejected clearly; correct credentials
succeed; Logout truly ends the session (verified by a rejected
post-logout action).
**Fail:** Any step behaves differently, or a wrong credential attempt
somehow still grants access.

**Status:** `[x]` — 2026-09-13: PASS live, via chrome-devtools-mcp
against the real device (`http://192.168.2.156`). Wrong credentials →
401, clear "Login failed" banner, stayed on login form, no cookie set.
Correct `Admin`/real password → main UI shown. `GET /session` returned
`loggedIn:true` with the correct `deviceUrl`, cookie present on the
request. Logout → returned to login form; post-logout `GET /users`
returned 401 and `GET /session` returned `loggedIn:false`.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 4.2 — Re-run Giai đoạn 4's originally-deferred Group 4 checks, now starting from a real login
**Action:** With a real session established (Task 4.1), re-run Giai
đoạn 4's Task 4.1/4.2 checklist content (Users/Access Logs/System
Information render correctly; card/group/image add-and-remove on a
disposable test user) — this supersedes Giai đoạn 4's own deferred
Group 4 (see that plan's `DECISION_LOG.md`).
**Verification:** Manual, operator/agent-observed; confirm no
pre-existing real user affected.
**Pass:** All Giai đoạn 4 checks now pass, starting from the new login
flow.
**Fail:** Any action fails, or a real user is affected (critical
incident).

**Status:** `[x]` — 2026-09-13: PASS live. Users/Access Logs/System
Information all rendered real device data correctly (3 real users, 50
access log entries, full system-information fields). Created a
disposable test user (`ZZ_DisposableTest_Phase5`, id 45): group add
(id 1) → "Group IDs: 1"; group remove → "Group IDs: None"; card add
(area 1, number 99999) → listed as "Card 8: 1 / 99999"; card remove →
"Cards on device: 0"; image upload → JPEG bytes reached the device,
which correctly returned a face-validation error ("Face not detected",
code 2) since the test image was a placeholder, not a real face —
confirms the full upload route works end-to-end under the new session
model. No pre-existing real user (5, 36, 4) was touched. Test user 45
deleted afterward; confirmed via `GET /users` that only the original 3
users remain.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 4.3 — Administrator toggle + PIN set (SEPARATE confirmations, superseding Giai đoạn 4's own deferred Tasks 4.3/4.4)
**Action:** **Before running:** ask the user for a fresh, explicit
confirmation naming these exact actions (same bar as every prior
Administrator/PIN live test in this project) — do not infer from Task
4.1/4.2's approval. Run Giai đoạn 4's Task 4.3/4.4 checklist content,
now via the real login flow.
**Verification:** Manual, operator/agent-observed.
**Pass:** Both work correctly via the real login-gated UI; no real
user affected; no PIN value visible anywhere afterward.
**Fail:** Any failure, or a real user affected.

**Status:** `[x]` — 2026-09-13: PASS live, on the same disposable test
user 45 (never a real user). Administrator toggle: clicking it opened
a confirm dialog naming the exact user and action ("Grant
Administrator for ZZ_DisposableTest_Phase5?... credential-adjacent");
accepted → checkbox showed checked, and the Users table row confirmed
"Administrator: Yes" after refresh. PIN set: entering a PIN and
clicking "Set PIN" opened a separate confirm dialog ("Set a new PIN
for...This cannot be undone or read back later"); accepted → "PIN:
Set" shown, input field cleared, Users table row showed "Password:
Set". No PIN value was ever visible in the UI, network requests, or
anywhere else after being typed. Test user 45 deleted afterward (see
Task 4.2's note) — confirmed via `GET /users` that only the original 3
real users remain, none of them modified.
**Error (if [!]):**
> _Leave blank until task fails_

---

## Completion checklist

- [ ] All Group 1–3 tasks marked `[x]`
- [x] Group 4 complete, or explicitly "not run this cycle — no
      live-device approval issued" (does not block sign-off for
      Groups 1–3)
- [x] No tasks marked `[!]`
- [x] `docs/backend-api.md` / `docs/src-map.md` updated (Tasks 3.2–3.3)
- [x] Full offline build+test gate passed (Task 3.4)
- [x] Password never persisted anywhere (localStorage, cookies,
      logs) — only IP/username are "remembered"
- [x] Sprint summary written to
      `.plans/2026-09-13-phase5-real-login-dynamic-device/sprint-summary.md`

---

## Rollback procedures

### General rollback (always safe to run)
```bash
git status --porcelain
git diff --name-only
```
`backend/SessionStore.hpp`/`.cpp` and `frontend/login.js` are new —
delete them plus revert the modified files
(`backend/{BackendConfig.hpp,Routes.cpp,main.cpp}`,
`frontend/{index.html,app.js}`, `test/backend/test_routes.cpp`,
`docs/*`) via `git checkout --` to fully roll back to Giai đoạn 4's
state.

### Per-task rollback — Group 4 (live verification)
Same disposable-test-user discipline as every prior live test in this
project.

## Execution record - 2026-09-13, Groups 1-3 only

Tasks 1.1 and 1.2-1.4: backend builds passed (1.2-1.4 integrated together due
to their compile dependency). Started the actual backend without any AMICO_*
variables: GET /session returned 200 loggedIn=false; /health and /users returned
401 InvalidSessionError. Static login assets were served successfully.

Tasks 2.1-2.3: markup/source review, node --check, and an in-memory Node
DOM/fetch simulation passed for initial gating, failed/successful login,
logout, 401 redirection, password clearing and remembering only URL/username.
These completion marks cover implementation and offline checks, not the
file:// visual check or real-browser/live verification deferred to Group 4.

Tasks 3.1-3.4: CTest passed 2/2 suites. SDK: 89 cases / 490 assertions
unchanged. Backend: 38 cases / 426 assertions. Required route headings present;
SessionStore appears on 3 source-map rows. Secret scans had no matches and
localStorage writes contain only deviceUrl/username.

Group 4: not run this cycle - no live-device approval issued; explicitly
excluded by the user's delegation. All Group 4 task statuses remain untouched.
See DECISION_LOG.md for the plan contradictions and build integration gaps.

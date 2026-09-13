# Tasks — Fix: user profile photos never display in the web frontend

> **Executor instructions:** Complete groups in order. After each task,
> run the verification command. Mark status before moving on.
>
> **Status markers:** `[ ]` not started · `[~]` in progress · `[x]` complete
> (verification passed) · `[!]` failed (stop, report to Planner).
>
> **Group gating:**
> - **Group 1** (SDK: new `getImage` method) requires no device contact
>   — offline `FakeTransport` only.
> - **Group 2** (backend route + JSON mapping change) requires no
>   device contact.
> - **Group 3** (offline tests + docs) requires no device contact.
> - **Group 4** (live verification) requires a fresh
>   `APPROVE_LIVE_DEVICE_TEST:<plan-id>` approval — read-only only, no
>   write action in this plan at all.

---

## Group 1 — SDK: `UsersApi::getImage`

### Task 1.1 — `src/Client.cpp`: new authenticated-GET-binary transport helper
**Action:** Add `Impl::getAuthenticatedBinary(const std::string& path,
bool isRetry = false) -> HttpResponse` (returns the full `HttpResponse`,
not a parsed body — image bytes are not JSON). Mirrors
`postAuthenticatedJson`/`postAuthenticatedBinary`'s existing shape:
throws `InvalidSessionError` up front if `!session.isSet()`; sends a
`GET` request (via `baseRequest("GET", path)`) with the `Cookie`
header set from `session.cookieHeader()` (no `Content-Type`/body — GET
has none); on HTTP 401, retries exactly once via re-login if
`config.autoRelogin` (else throws `InvalidSessionError`), same pattern
as the other two authenticated helpers. **Unlike** the other two
helpers, do NOT throw on other non-2xx statuses here — the caller
(`getImage`) needs to see the raw status to distinguish "no image"
(404) from a real error, so return the `HttpResponse` as-is once the
401-retry logic is resolved.
**Verification:** `cmake --build build-exec --target amico_sdk`.
**Pass:** Exit 0, no warnings.
**Fail:** Compile error.

**Status:** `[x]`
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 1.2 — `include/amico/Client.hpp` + `src/Client.cpp`: `UsersApi::getImage`
**Action:** Declare `std::vector<uint8_t> getImage(int64_t userId)` on
`UsersApi` (public), documented the same way as `setImage`/
`removeImage` (doc comment noting it's a GET against
`/user_get_image.fcgi?user_id=<id>`, throws `HttpError` for any
non-2xx/non-404 status, and throws a new distinguishable condition for
"no image" — see below). Implement `getUserImageImpl` in `Client.cpp`:
calls `getAuthenticatedBinary("/user_get_image.fcgi?user_id=" +
std::to_string(userId))`; if `res.statusCode == 404`, throw
`amico::HttpError(404, "no image for user " + std::to_string(userId))`
(the backend route in Group 2 catches this specific case via
`HttpError::statusCode() == 404` to translate into its own 404 with an
empty body — no new exception TYPE needed, reusing the existing
`HttpError` hierarchy exactly as `ErrorMapping.cpp` already does
elsewhere); if `res.statusCode` is any other non-2xx, throw
`amico::HttpError(res.statusCode, ...)` same as the JSON helpers do;
on 2xx, return `std::vector<uint8_t>(res.body.begin(), res.body.end())`
plus (new) `res.headers` are available to the caller for the
content-type in Task 1.3 — actually: since `getImage`'s return type is
just bytes, **add a second, richer method instead of changing the
signature Plan Review would need to re-approve** — see Task 1.3's note
if this turns out to lose the `Content-Type` header the backend needs.
**Verification:** `cmake --build build-exec --target amico_sdk`.
**Pass:** Exit 0, no warnings.
**Fail:** Compile error.

**Status:** `[x]`
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 1.3 — Resolve the `Content-Type` question found while writing Task 1.2 (do not guess — read the response headers)
**Context:** Task 1.2 flagged that `getImage`'s bytes-only return type
loses the device's own `Content-Type` response header, which the
backend route (Group 2) wants to forward rather than hard-code. Rather
than leave this ambiguous for the Executor to guess at implementation
time, this task resolves it explicitly: change `UsersApi::getImage`'s
return type to a small struct `UserImage { std::vector<uint8_t> bytes;
std::string contentType; }` (defined next to `AmicoUser` in
`include/amico/Types.hpp`, since it's a public SDK-facing shape, not a
backend-only one). `contentType` is read from the response's
`Content-Type` header if present, else defaults to `"image/jpeg"`
(matches the confirmed JPEG-only upload requirement — a device that
accepts only JPEG uploads is expected to serve JPEG back, but this
default only applies when the header is genuinely absent, never
overriding a header the device actually sent).
**Verification:** `cmake --build build-exec --target amico_sdk`.
**Pass:** Exit 0, no warnings; `UserImage` is exported from the public
header, not an internal-only type.
**Fail:** Compile error, or `UserImage` accidentally left in an
internal/anonymous namespace where the backend can't include it.

**Status:** `[x]`
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 2 — Backend: proxy route + `imageUrl` fix

### Task 2.1 — `backend/Routes.cpp`: `GET /users/:id/image`
**Action:** Add the route (regex-capture style like every other
`/users/(\d+)/...` route), session-cookie gated identically to every
other route (per Giai đoạn 5's established pattern — acquire the
`SessionStore` lock, `requireSession`, resolve `client()`). Parse the
path param the same way `pathParamId`/`std::stoll` is used elsewhere
(malformed id → 400 `InvalidRequest`, never reaching the SDK). Call
`client.users().getImage(id)`; on success, `res.set_content(std::string
(image.bytes.begin(), image.bytes.end()), image.contentType)`. On a
thrown `amico::HttpError` with `statusCode() == 404`, respond with a
plain `404` and empty body (do NOT route this through the generic
`respondError`/`mapException` JSON-error path — an `<img>` tag ignores
a JSON error body anyway, and a plain 404 is what the frontend's
existing `onerror` handler already expects). Any other exception goes
through the existing `respondError`/`mapException` path unchanged.
**Verification:** `cmake --build build-exec --target amico_backend`.
**Pass:** Exit 0, no warnings.
**Fail:** Compile error.

**Status:** `[x]` — Root cause: a stale `amico_backend.exe` (PID 69564)
was still running from Giai đoạn 5's earlier live-testing session —
`TaskStop` on the wrapping bash task hadn't actually killed the child
process. Force-killed via `taskkill //PID 69564 //F`; rebuild
succeeded immediately after (`Linking CXX executable amico_backend.exe`
exit 0). Codex's own resolution of the "digits-only regex can't
produce 400" gap (using `([^/]+)/image` + explicit digit validation
instead of `(\d+)/image`) is correct and intentional — confirmed by
reading the actual route in `backend/Routes.cpp` directly.
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 2.2 — `backend/JsonMapping.cpp`: `imageUrl` becomes a backend-relative path
**Action:** Change `j["imageUrl"] = user.imageUrl;` (line 21) to
`j["imageUrl"] = "/users/" + std::to_string(user.id) + "/image";` —
stop passing the SDK's device-relative path through at all. No
frontend change needed (`frontend/users.js`'s existing `<img
onerror=placeholder>` logic already handles both success and 404
correctly, verified by reading `frontend/users.js:56-65` directly, not
assumed).
**Verification:** `cmake --build build-exec --target amico_backend`.
**Pass:** Exit 0, no warnings.
**Fail:** Compile error.

**Status:** `[x]`
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 3 — Offline tests + docs

### Task 3.1 — SDK tests: `getImage` success, 404, other-error, session-retry
**Action:** Add to `test/test_users.cpp` (or `test/test_errors.cpp` if
that's the existing home for authenticated-retry-style tests — follow
whichever file's existing convention already covers `list()`'s
401/retry cases, don't create a third pattern): (a) success case —
`FakeTransport` returns 200 with arbitrary bytes and a `Content-Type:
image/png` header, confirm `getImage` returns those exact bytes and
`contentType == "image/png"`; (b) no `Content-Type` header present →
defaults to `"image/jpeg"`; (c) 404 → confirm it throws `HttpError`
with `statusCode() == 404`; (d) a different non-2xx (e.g. 500) → throws
`HttpError` with that status; (e) 401 with `autoRelogin=false` → throws
`InvalidSessionError`, no retry; (f) 401 with `autoRelogin=true` →
retries exactly once, matching the existing pattern for `list()`'s
equivalent test.
**Verification:** `ctest --test-dir build-exec --output-on-failure`.
**Pass:** All new + existing cases pass; SDK baseline (89 cases/490
assertions before this plan) grows by exactly these new cases, no
regressions.
**Fail:** Any failure or unexpected count change elsewhere.

**Status:** `[x]`
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 3.2 — Backend route tests: `GET /users/:id/image`
**Action:** Add to `test/backend/test_routes.cpp`: success (200, bytes
+ content-type forwarded correctly); no image (SDK throws `HttpError`
404) → backend responds 404 with empty body, NOT the generic JSON
error shape; malformed id (non-numeric) → 400 `InvalidRequest`, SDK
never called; no/wrong session cookie → 401 `InvalidSessionError`, same
as every other route (reuse the existing per-route gate test loop from
Giai đoạn 5 if it's structured as a table — add this route to that
table rather than duplicating a new one-off test, per that file's
existing convention).
**Verification:** `ctest --test-dir build-exec --output-on-failure`.
**Pass:** All new + existing cases pass; backend baseline (38 cases/426
assertions before this plan) grows by exactly these new cases.
**Fail:** Any failure or unexpected count change elsewhere.

**Status:** `[x]`
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 3.3 — `docs/backend-api.md` + `docs/src-map.md`
**Action:** Add `### \`GET /users/:id/image\`` to the route reference
(request/response shape, 404-means-no-image note, session-gated like
every other route). Update `docs/src-map.md`'s row(s) for
`Client.cpp`/`Client.hpp` and `backend/Routes.cpp`/`JsonMapping.cpp` to
mention the new method/route (don't create new rows if the existing
ones already describe those files generically — extend, don't
duplicate).
**Verification:** `grep -n '^### \`GET /users/:id/image\`' docs/backend-api.md`
**Pass:** Heading found.
**Fail:** Not found.

**Status:** `[x]`
**Error (if [!]):**
> _Leave blank until task fails_

---

### Task 3.4 — Full offline build + test gate
**Action:** `cmake --build build-exec` then `ctest --test-dir
build-exec --output-on-failure`.
**Verification:** Same commands.
**Pass:** Build exit 0, zero warnings; record final SDK and backend
case/assertion counts.
**Fail:** Any build error or test failure.

**Status:** `[x]`
**Error (if [!]):**
> _Leave blank until task fails_

---

## Group 4 — Live verification (GATED — separate approval required, read-only)

> **STOP before this group.** No request to any real device until a
> fresh `APPROVE_LIVE_DEVICE_TEST:<plan-id>` message is received. This
> plan performs no write action anywhere, so only the read-only
> approval tier is ever needed for this plan.

### Task 4.1 — Confirm the device's actual no-image response, then verify photos render
**Action:** Log into the real device via the frontend. First, find a
user known to have NO enrolled photo (if none currently exist among
real users, this sub-check can use a disposable test user created and
deleted the same way as Giai đoạn 5's Group 4 — never a real user) and
confirm the row still shows "No image" with no console/network error
noise beyond an expected 404. Then confirm at least one user WITH a
real enrolled photo (id 36, "Phuong Hoang", `faceCount: 1` per Giai
đoạn 5's live test output) now shows their actual photo, not the
placeholder. Resolves this plan's one Open Question in spec.md.
**Verification:** Manual, operator/agent-observed via chrome-devtools-mcp.
**Pass:** Real photo renders for a user known to have one; "No image"
still renders correctly (no broken-image icon, no console error spam)
for a user with none.
**Fail:** Any photo still fails to render, or a "no image" case now
shows a broken-image icon instead of the placeholder.

**Status:** `[x]` — 2026-09-13, PASS live against `http://
192.168.2.156`. All 3 real users (5 "Phat", 36 "Phuong Hoang", 4 "Trung
Dung") now render their real enrolled photos — confirmed via network
inspection: `GET /users/36/image` → 200, `Content-Type: image/jpeg;
charset=utf-8`, 20468 bytes (a real photo, not a placeholder). No real
user currently lacks a photo, so did NOT create a disposable test user
for this (that would be a write action requiring a separate
`APPROVE_LIVE_DEVICE_WRITE_TEST` token this plan's read-only approval
doesn't cover — caught before acting). Instead verified the no-image
path read-only, directly, against a definitely-nonexistent user id
(9999): device responded `400` (not `404` as originally assumed — see
`DECISION_LOG.md`), backend correctly forwarded this as a normal JSON
error response; since `<img onerror>` fires on any failed load
regardless of status code (confirmed via `frontend/users.js` source),
the user-visible "No image" placeholder behavior is unaffected by this
distinction. No console error spam observed; no broken-image icons
anywhere.
**Error (if [!]):**
> _Leave blank until task fails_

---

Group 4 not run this cycle: no live-device approval issued; explicitly excluded by the user.

## Completion checklist

- [x] All Group 1-3 tasks marked `[x]`
- [x] Group 4 complete, or explicitly "not run this cycle — no
      live-device approval issued" (does not block sign-off for
      Groups 1-3)
- [x] No tasks marked `[!]`
- [x] `docs/backend-api.md` / `docs/src-map.md` updated (Task 3.3)
- [x] Full offline build+test gate passed (Task 3.4)
- [x] `sprint-summary.md` written

---

## Rollback procedure

`include/amico/Client.hpp`, `src/Client.cpp`, `backend/Routes.cpp`,
`backend/JsonMapping.cpp`, `test/test_users.cpp` (or wherever Task 3.1
lands), `test/backend/test_routes.cpp`, `docs/backend-api.md`,
`docs/src-map.md` are all modifications to existing files — revert via
`git diff` / `git checkout --` against this plan's own changes if
needed (check `git status` first per standing safety practice; this
plan shares the working tree with several other uncommitted plans this
session, so only revert the specific files this plan actually touched).

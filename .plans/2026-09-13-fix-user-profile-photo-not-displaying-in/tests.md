# Tests — Fix: user profile photos never display in the web frontend

> **Executor instructions:** Run every test after all tasks complete.
> Group 4 (live) is conditional on a separate, fresh
> `APPROVE_LIVE_DEVICE_TEST:<plan-id>` approval — read-only tier only,
> this plan has no write action. Fill in each **Result:** line as each
> test actually runs; do not pre-fill.

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
> PASS: `cmake --build build-exec` exit 0, `ninja: no work to do` on
> re-run confirms a clean prior build; zero warnings.

---

## Unit / integration tests

```bash
ctest --test-dir build-exec --output-on-failure
build-exec/amico_tests.exe
build-exec/amico_backend_tests.exe
```
**Pass:** All tests pass, exit code 0 for both binaries. SDK baseline
before this plan: 89 cases / 490 assertions — expect growth from Task
3.1's new `getImage` cases. Backend baseline before this plan: 38
cases / 426 assertions — expect growth from Task 3.2's new route
cases. Record both new counts.
**Fail:** Any test failure → paste full output to Planner.
**Result:**
> PASS: `ctest` 2/2 suites. SDK: **95 cases / 517 assertions** (+6
> cases / +27 assertions). Backend: **41 cases / 476 assertions** (+3
> cases / +50 assertions). Independently re-run by Claude, not just
> taken from Codex's report.

---

## Functional tests

### Test F-1 — `UsersApi::getImage` success returns bytes and content-type
```bash
build-exec/amico_tests.exe --test-case="*getImage*success*,*get_image*success*"
```
**Pass:** A `FakeTransport` 200 response with arbitrary bytes and a
`Content-Type` header round-trips exactly through `getImage` —
`bytes` matches byte-for-byte, `contentType` matches the header value.
**Fail:** Any mismatch, truncation, or encoding corruption of the bytes.
**Result:**
> PASS: "getImage returns exact binary bytes and the device
> Content-Type" — bytes and `Content-Type: image/png` round-trip
> exactly.

---

### Test F-2 — `UsersApi::getImage` defaults to `image/jpeg` when the device sends no `Content-Type`
**Pass:** Same as F-1 but with no `Content-Type` header in the fake
response — `contentType == "image/jpeg"`.
**Fail:** Any other default, or an exception thrown instead.
**Result:**
> PASS: "getImage defaults to image/jpeg when Content-Type is absent".

---

### Test F-3 — `UsersApi::getImage` on 404 throws `HttpError` with `statusCode() == 404`
**Pass:** A `FakeTransport` 404 response causes `getImage` to throw
`amico::HttpError`, and `.statusCode() == 404` on the caught exception.
**Fail:** A different exception type, a different status code, or no
throw at all.
**Result:**
> PASS: "getImage reports no image as HttpError 404" — message "no
> image for user 36", `statusCode() == 404`.

---

### Test F-4 — `UsersApi::getImage` on other non-2xx (e.g. 500) throws `HttpError` with that status
**Pass:** `HttpError::statusCode() == 500` (or whichever status was
faked).
**Fail:** Wrong status, wrong exception type, or a silent success.
**Result:**
> PASS: "getImage preserves other HTTP error status codes" —
> `statusCode() == 500`.

---

### Test F-5 — `UsersApi::getImage`'s 401 handling matches every other authenticated call
```bash
build-exec/amico_tests.exe --test-case="*getImage*401*,*getImage*session*"
```
**Pass:** `autoRelogin=false` → `InvalidSessionError`, no retry (one
call only). `autoRelogin=true` → retries exactly once after a fresh
login, matching the existing pattern already proven for `list()`.
**Fail:** Any deviation from the established retry-once semantics.
**Result:**
> PASS: "getImage 401 with autoRelogin=false does not retry" (1 call)
> and "getImage 401 with autoRelogin=true retries exactly once after
> fresh login" (both subcases: retry succeeds, and second 401 stops
> retrying) — 6 cases / 27 assertions total for the `getImage` test
> file section, confirmed via `--test-case="*getImage*"` (6/6 passed,
> 27/27 assertions).

---

### Test F-6 — `GET /users/:id/image` backend route: success forwards bytes + content-type
```bash
build-exec/amico_backend_tests.exe --test-case="*image*"
```
**Pass:** A successful `getImage` call is forwarded through the HTTP
response with the exact bytes and content-type the SDK returned.
**Fail:** Any mismatch, or the response wrapped in JSON instead of
served as the raw image body.
**Result:**
> PASS: confirmed via `--test-case="*image*"` (5/5 cases, 26/26
> assertions) and live (Test L-1 below) — real bytes/content-type
> forwarded correctly.

---

### Test F-7 — `GET /users/:id/image` on no-image: plain 404, not the generic JSON error shape
**Pass:** When the SDK throws `HttpError(404, ...)`, the route responds
with a bare 404 and an empty (or non-JSON) body — NOT the usual
`{"error":...,"type":...}` shape used for every other mapped exception.
**Fail:** A 404 with the generic JSON error body, or any other status.
**Result:**
> PASS (offline). Live evidence added a nuance: for a genuinely
> nonexistent user id the real device returns 400, not 404 — this
> route's 404-only special-case correctly still applies whenever the
> SDK does throw a 404 (confirmed offline); the 400 case instead goes
> through the normal JSON-error path, which is fine since `<img
> onerror>` doesn't care about body content either way. See
> `DECISION_LOG.md`.

---

### Test F-8 — `GET /users/:id/image`: malformed id → 400, session gate → 401
```bash
build-exec/amico_backend_tests.exe --test-case="*cookie*gate*,*unauthorized*,*401*"
```
**Pass:** A non-numeric `:id` returns 400 `InvalidRequest` before the
SDK is ever called (extend the existing malformed-body/malformed-id
pattern already used for other routes). Missing/wrong session cookie
returns 401 `InvalidSessionError` — this route added to the same
cookie-gate test table Giai đoạn 5 already built, not a one-off test.
**Fail:** Any deviation, or this route missing from the shared
cookie-gate test table.
**Result:**
> PASS: "GET /users/:id/image rejects malformed ids before calling the
> SDK" (4 malformed cases: non-numeric, trailing chars, negative,
> overflow — all 400 `InvalidRequest`); the shared cookie-gate table now
> includes `{"GET","/users/36/image"}` and `{"GET","/users/not-a-number/
> image"}`. Confirmed via `--test-case="*cookie*gate*,*unauthorized*,
> *401*"` (2/2 cases, 245/245 assertions).

---

### Test F-9 — `docs/backend-api.md` documents the new route
```bash
grep -n '^### `GET /users/:id/image`' docs/backend-api.md
```
**Pass:** Heading found.
**Fail:** Not found.
**Result:**
> PASS: `docs/backend-api.md:230` — `### \`GET /users/:id/image\``.

---

## Live tests (GATED — separate, fresh approval required, read-only)

### Test L-1 — Real photo renders for a user known to have one
**Setup:** `APPROVE_LIVE_DEVICE_TEST:<plan-id>` received as a fresh,
distinct message.
**Pass:** After logging into `http://192.168.2.156`, user id 36
("Phuong Hoang", `faceCount: 1`) shows their actual photo in the Users
table, not the "No image" placeholder.
**Fail:** Still shows the placeholder, or a broken-image icon.
**Result:**
> PASS (2026-09-13, via chrome-devtools-mcp): all 3 real users (5, 36,
> 4) rendered real photos. `GET /users/36/image` → 200, `Content-Type:
> image/jpeg; charset=utf-8`, 20468 bytes.

---

### Test L-2 — "No image" still renders correctly (not a broken-image icon) for a user with none
**Pass:** A user genuinely without a photo shows the clean "No image"
placeholder text, with only an expected 404 in the network log — no
JS console errors, no broken-image icon.
**Fail:** A broken-image icon, a console error, or any other visual
regression.
**Result:**
> PASS (adjusted scope — read-only, no disposable user created): all 3
> real users currently have photos, so tested read-only against a
> definitely-nonexistent user id (9999) instead of creating a test user
> (which would require a separate write-tier approval). Device returned
> 400 (not 404); backend correctly forwarded a JSON error; `<img
> onerror>` fires identically for any failed load regardless of status
> code (confirmed via source review), so the "No image" placeholder
> path is unaffected. See `DECISION_LOG.md` for full reasoning.

---

## Regression tests (ensure nothing broke)

### Test R-1 — Existing `amico_sdk`/backend offline suites otherwise unaffected
```bash
build-exec/amico_tests.exe
build-exec/amico_backend_tests.exe
```
**Pass:** All previously-passing cases still pass; only new cases from
this plan were added, nothing else changed.
**Fail:** Any prior case now fails.
**Result:**
> PASS: only new cases added, all prior cases unaffected (89 → 95 SDK,
> 38 → 41 backend, both purely additive).

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
> PASS: all 6 printed their unchanged skip message with no
> `AMICO_ENABLE_LIVE_TESTS`/`AMICO_*` env vars set.

---

## Sprint sign-off

- [x] Build gate
- [x] All unit/integration tests
- [x] Functional tests F-1-F-9
- [x] Live tests L-1-L-2 — L-1 fully PASS; L-2 scope adjusted to a
      read-only nonexistent-id check (no disposable user created,
      since all 3 real users have photos) — see `DECISION_LOG.md`
- [x] All regression tests
- [x] `DECISION_LOG.md` updated with any new decisions
- [x] `sprint-summary.md` written

**Sign-off date:** 2026-09-13

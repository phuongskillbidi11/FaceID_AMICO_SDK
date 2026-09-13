# Tests — Giai đoạn 3: Backend API layer (HTTP wrapper over `amico_sdk`)

> **Executor instructions:** Run every test after all tasks complete.
> Group 5's test is conditional on a separate, read-only live-device
> approval — see its own note. There is no live-write test in this
> plan.

---

## Build gate (run first — if this fails, stop immediately)

```bash
cmake -S . -B build-exec
cmake --build build-exec
```
**Pass:** Configure succeeds (`cpp-httplib` resolves via vcpkg), build
exit 0, zero new warnings.
**Fail:** Any configure or compile error → report to Planner before
proceeding.
**Result:** ✅ Pass — `cpp-httplib[brotli,core]:x86-windows@0.54.1`
installed cleanly, build exit 0.

---

## Unit / integration tests

```bash
ctest --test-dir build-exec --output-on-failure
build-exec/amico_tests.exe
build-exec/amico_backend_tests.exe
```
**Pass:** All tests pass, exit code 0 for both binaries. Record case/
assertion counts for both (SDK baseline before this plan: 89 cases /
490 assertions — must be unchanged, this plan does not touch
`src/`/`include/`/existing `test/` files).
**Fail:** Any test failure → paste full output to Planner.
**Result:** ✅ Pass — SDK: 89 cases / 490 assertions (unchanged).
Backend: **29 cases / 79 assertions**, 0 failed.

---

## Functional tests

### Test F-1 — Read routes return correct data (health, system-information, list/get users)
```bash
build-exec/amico_backend_tests.exe --test-case="*health*,*system*,*users*"
```
(Adjust the filter to whatever doctest test-case names Task 2.2
actually used.)
**Pass:** All pass; response JSON shapes match `JsonMapping`'s
conversion exactly (field-by-field, not just "some fields present").
**Fail:** Any mismatch or failure.
**Result:** ✅ Pass.

---

### Test F-2 — Write routes (create/update/remove/groups/cards/image) succeed and map errors correctly
```bash
build-exec/amico_backend_tests.exe
```
**Pass:** Included in the full suite; specifically confirm every route
from spec.md's Scope In has at least one success case and one
mapped-error case (matching Decision 6's exact status-code table), AND
that malformed request bodies (invalid JSON, non-numeric path/body
params) return `400`/`InvalidRequest` — never `500` — and never reach
`AmicoClient` (Decision 6's amendment, per Plan Review pass 1).
**Fail:** Any route missing coverage, a wrong status code for any
exception type, or a malformed-body case falling through to 500.
**Result:** ✅ Pass.

---

### Test F-3 — Sensitive-action guardrail: confirmation header enforced
```bash
build-exec/amico_backend_tests.exe --test-case="*guardrail*,*sensitive*,*confirm*"
```
**Setup:** Task 2.3's tests.
**Pass:** `PUT /users/:id/administrator` and `PUT /users/:id/password`
both: (a) return 428 with no header — and the underlying `AmicoClient`
method is confirmed NOT invoked, (b) return 428 with a wrong header
value (not exactly `"yes"`), (c) succeed (200) with the header set to
exactly `"yes"`.
**Fail:** Any case behaves differently, or the SDK call happens before
the header check.
**Result:** ✅ Pass.

---

### Test F-4 — Network-exposure guardrail: bind-address opt-in enforced
```bash
build-exec/amico_backend_tests.exe --test-case="*exposure*,*bind*"
```
**Setup:** Task 2.4's tests.
**Pass:** All 4 cases from Task 2.4 behave exactly as specified
(localhost always passes; non-localhost requires the exposure env var).
**Fail:** Any case behaves differently.
**Result:** ✅ Pass.

---

### Test F-5 — `docs/backend-api.md` documents every route
```bash
grep -n '^### `' docs/backend-api.md
```
**Pass:** Manually cross-check the output against spec.md's Scope In
route list — every route present, none missing.
**Fail:** Any route from spec.md absent from the doc.
**Result:** ✅ Pass — all 16 routes present as `### \`METHOD path\``
headings, matching spec.md's Scope In exactly.

---

### Test F-6 — Live smoke test skip-gate (no env vars set)
```bash
build-exec/amico_backend_live_smoke_test.exe
```
**Setup:** Run with no `AMICO_ENABLE_LIVE_TESTS`/`AMICO_BASE_URL`/
`AMICO_USERNAME`/`AMICO_PASSWORD` set.
**Pass:** Prints a skip message, exit 0, no network call made.
**Fail:** Any network attempt without the env var explicitly set to `1`.
**Result:** ✅ Pass — skip message printed, exit 0.

---

### Test F-7 — Live smoke test actually run (conditional on separate read-only approval)
**Setup:** `APPROVE_LIVE_DEVICE_TEST:<plan-id>` received as a fresh,
distinct message; operator sets the four env vars and runs the binary.
**Pass:** `RESULT: PASS` — `/health`, `/system-information`, `GET
/users` all return 200 through the real backend against the real
device.
**Not applicable:** "Not run this cycle — no live-device-read approval
issued." Does not block sign-off for Groups 0–4.
**Fail:** `RESULT: FAIL`, non-zero exit, or any unexpected response
shape.
**Result:** ✅ Pass (2026-09-13) — full 4/4: login,
`/health` 200, `/system-information` 200 (valid shape), `GET /users`
200 (3 users listed).

---

## Regression tests (ensure nothing broke)

### Test R-1 — Existing `amico_sdk` offline suite unaffected
```bash
build-exec/amico_tests.exe
```
**Pass:** Still 89 cases / 490 assertions, 0 failed — this plan adds a
new binary, it does not modify `src/`/`include/`/existing `test/`
files.
**Fail:** Any change in count or any failure.
**Result:** ✅ Pass — 89 cases / 490 assertions, unchanged.

---

### Test R-2 — Existing live tests (`amico_live_smoke_test`, `amico_live_write_test`, `amico_live_write_profile_test`, `amico_live_admin_test`, `amico_live_password_test`) still self-skip
```bash
build-exec/amico_live_smoke_test.exe
build-exec/amico_live_write_test.exe
build-exec/amico_live_write_profile_test.exe
build-exec/amico_live_admin_test.exe
build-exec/amico_live_password_test.exe
```
**Setup:** No live-test env vars set.
**Pass:** All 5 print their unchanged skip message, exit 0.
**Fail:** Any behavior change from Giai đoạn 2/2b's recorded baseline.
**Result:** ✅ Pass — all 5 unaffected.

---

### Test R-3 — Secret scan clean
```bash
grep -rnE "session=[A-Za-z0-9]{16,}" --include='*.md' --include='*.json' --include='*.cpp' --include='*.hpp' . 2>/dev/null | grep -v '\.git/' | grep -v '/build[^/]*/'
grep -rniE '"(password|hash|salt)"\s*:\s*"[0-9a-f]{16,}"' --include='*.md' --include='*.json' . 2>/dev/null | grep -v '\.git/' | grep -v '/build[^/]*/'
```
**Pass:** No output, or only an already-documented benign false
positive.
**Fail:** Any other match.
**Result:** ✅ Pass — both scans produced empty output.

---

## Sprint sign-off

- [x] Build gate
- [x] All unit/integration tests
- [x] Functional tests F-1–F-5 (offline)
- [x] Functional test F-6 (skip-gate)
- [x] Functional test F-7 (live smoke) — PASS
- [x] All regression tests
- [x] `DECISION_LOG.md` updated with any new decisions
- [x] `sprint-summary.md` written

**Sign-off date:** 2026-09-13 (all Groups 0–5 complete; every offline
and live test passed on the first attempt)

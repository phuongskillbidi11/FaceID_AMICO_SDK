# Tests — Giai đoạn 2: User CRUD (API ghi đầu tiên của SDK)

> **Executor instructions:** Run every test after all tasks complete.
> Group 5's tests are conditional on the separate live-write approval —
> see each test's own note.

---

## Build gate (run first — if this fails, stop immediately)

```bash
cmake --build build-exec
```
**Pass:** Exit code 0, zero errors, zero new warnings.
**Fail:** Any compile error → report to Planner before proceeding.
**Result:** ✅ Pass — exit 0, no warnings (verified independently).

---

## Unit tests

```bash
ctest --test-dir build-exec --output-on-failure
build-exec/amico_tests.exe
```
**Pass:** All tests pass, exit code 0. Record the new case/assertion
count (baseline before this plan: 45 cases / 250 assertions).
**Fail:** Any test failure → paste full output to Planner.
**Result:** ✅ Pass — **58 cases / 309 assertions**, 0 failed (up from
45/250).

---

## Functional tests

### Test F-1 — Group 0 discovery answered both Open Questions
```bash
grep -c "User CRUD write commands" docs/ui-action-protocol-map.md
```
**Setup:** Group 0 approved and run.
**Pass:** Section exists; manually confirm it states (a) whether
`create_objects`/`object_add` are the same or different for `users`, and
(b) whether the create response echoes the new row's `id`.
**Fail:** Section missing, or either question left ambiguous.
**Result:** [x] Pass — both questions answered explicitly (see Task 0.3).

---

### Test F-2 — Write builders never expose credential fields
```bash
grep -n "kUserWritableFields" -A5 src/ObjectQuery.cpp
```
**Pass:** The listed fields do not include `password`, `salt`,
`panic_password`, or `panic_salt` (manual read — also enforced by Task
2.1's automated test).
**Fail:** Any of those four field names present.
**Result:** [x] Pass — `kUserWritableFields = {"name", "registration"}`
only.

---

### Test F-3 — `test_query_whitelist.cpp` covers the 3 new builders
```bash
build-exec/amico_tests.exe --test-case="*builders*,*whitelist*"
```
(Adjust the filter to whatever doctest test-case names Task 2.1 actually
used — the point is that the new builder assertions ran and passed, not
the exact filter string.)
**Pass:** New assertions present and passing (0 failed).
**Fail:** Any failure, or the new builders have no corresponding
assertions at all.
**Result:** [x] Pass — `--test-case="*writable*,*builders*"` → 4 cases,
22 assertions, 0 failed.

---

### Test F-4 — Offline create/update/remove test cases pass
```bash
ctest --test-dir build-exec --output-on-failure
```
**Pass:** Included in the full suite's 100% pass (see Unit tests above);
specifically confirm the new create/update/remove cases from Task 2.3
are present and green.
**Fail:** Any new case fails.
**Result:** [x] Pass — 10 new `UsersApi::create/update/remove` cases in
`test/test_users.cpp`, all passing.

---

### Test F-5 — Live-write test skip-gate (no env vars set)
```bash
build-exec/amico_live_write_test.exe
```
**Setup:** Run with no `AMICO_ENABLE_LIVE_TESTS`/`AMICO_BASE_URL`/
`AMICO_USERNAME`/`AMICO_PASSWORD` set.
**Pass:** Prints a skip message, exit 0, no network call made.
**Fail:** Any network attempt without the env var explicitly set to `1`.
**Result:** [x] Pass — Task 5.1 (writing the code, zero device contact)
is now done; skip message printed, exit 0, no network call. Task 5.2
(the actual live run) remains gated behind the separate
`APPROVE_LIVE_DEVICE_WRITE_TEST` approval.

---

### Test F-6 — Live-write test actually run (conditional on separate approval)
**Setup:** `APPROVE_LIVE_DEVICE_WRITE_TEST:<plan-id>` received as a fresh,
distinct message; operator sets the four env vars themselves and runs
the binary.
**Pass:** `RESULT: PASS` — test user created, verified, updated, verified,
deleted, confirmed gone; no pre-existing real user's data touched
(operator to explicitly confirm this in their report, e.g. by checking
the Users page still shows exactly the same pre-existing users
afterward).
**Not applicable:** "Not run this cycle — no live-device-write approval
issued" if the approval was never given. This does not block sign-off
for Groups 0–4.
**Fail:** `RESULT: FAIL`, non-zero exit, or any pre-existing real user
affected (treat the latter as a critical incident — stop, report
immediately, do not attempt automated cleanup).
**Result:** [x] Pass (attempt #2, 2026-09-12, approval
`...:retry-1`) — full 6/6 sequence, `RESULT: PASS`. Test user `id=37`
created/verified/updated (partial-update, name only)/verified/removed/
confirmed gone; pre-existing users (`id 4/5/36`) untouched. (Attempt #1
failed with HTTP 400 from `/create_objects.fcgi` — no user created, no
pre-existing user touched; root-caused to a missing array-wrap on
`values`, fixed, offline suite re-verified green before the retry.)

---

## Regression tests (ensure nothing broke)

### Test R-1 — Existing read API unaffected
```bash
build-exec/amico_tests.exe --test-case="*users*,*access_logs*,*auth*,*session*"
```
**Pass:** All pre-existing read-path tests still pass unchanged — this
plan adds write capability, it does not touch `list()`/`get()`'s
existing behavior.
**Fail:** Any pre-existing test's behavior changed.
**Result:** [x] Pass — 25 cases / 138 assertions, 0 failed.

---

### Test R-2 — `live_smoke_test.cpp` (read-only) still builds and self-skips
```bash
build-exec/amico_live_smoke_test.exe
```
**Setup:** No live-test env vars set.
**Pass:** Still prints its skip message, exit 0 — confirms Group 5's new
live-write test file did not accidentally alter the existing read-only
live test.
**Fail:** Any behavior change from the last-recorded baseline (Giai đoạn
0+1: 9-step sequence, skip message unchanged).
**Result:** [x] Pass — unchanged skip message, exit 0.

---

### Test R-3 — Secret scan clean
```bash
grep -rnE "session=[A-Za-z0-9]{16,}" --include='*.md' --include='*.json' --include='*.cpp' --include='*.hpp' --include='*.network-response' . 2>/dev/null | grep -v '\.git/' | grep -v '/build[^/]*/'
grep -rniE '"(password|hash|salt)"\s*:\s*"[0-9a-f]{16,}"' --include='*.md' --include='*.json' . 2>/dev/null | grep -v '\.git/' | grep -v '/build[^/]*/'
```
**Pass:** No output, or only the already-documented benign false
positive.
**Fail:** Any other match.
**Result:** [x] Pass — both scans produced empty output.

---

## Sprint sign-off

- [x] Build gate: ✅
- [x] All unit tests: ✅
- [x] Functional tests F-1–F-4: ✅
- [x] Functional test F-5: "Not run this cycle" (Group 5 not started)
- [x] Functional test F-6: Pass (attempt #2, after attempt #1's
      root-caused-and-fixed failure)
- [x] All regression tests: ✅
- [x] `DECISION_LOG.md` updated with any new decisions
- [x] `sprint-summary.md` written, explicitly stating Group 5 has not
      run this cycle

**Sign-off date:** 2026-09-12 (all Groups 0–5 complete; Group 5 passed
on attempt #2 after a root-caused-and-fixed attempt #1 failure)

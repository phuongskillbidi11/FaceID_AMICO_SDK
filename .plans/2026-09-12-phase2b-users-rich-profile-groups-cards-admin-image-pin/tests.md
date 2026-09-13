# Tests — Giai đoạn 2b: Users rich profile (Groups, Cards, Administrator, Face/Bio count, Image, PIN fallback)

> **Executor instructions:** Run every test after all tasks complete.
> Group 5's tests are conditional on the separate live-write approval —
> and Tasks 5.3/5.4 each require their own further separate confirmation
> beyond Group 5's general approval. See each test's own note.

---

## Build gate (run first — if this fails, stop immediately)

```bash
cmake --build build-exec
```
**Pass:** Exit code 0, zero errors, zero new warnings.
**Fail:** Any compile error → report to Planner before proceeding.
**Result:** ✅ Pass — exit 0, no warnings.

---

## Unit tests

```bash
ctest --test-dir build-exec --output-on-failure
build-exec/amico_tests.exe
```
**Pass:** All tests pass, exit code 0. Record the new case/assertion
count (baseline before this plan: 58 cases / 309 assertions from
Giai đoạn 2).
**Fail:** Any test failure → paste full output to Planner.
**Result:** ✅ Pass — **89 cases / 490 assertions**, 0 failed (up from
58/309).

---

## Functional tests

### Test F-1 — Group 0 discovery answered every open question
```bash
grep -c "Users rich-profile write commands" docs/ui-action-protocol-map.md
```
**Setup:** Group 0 approved and run.
**Pass:** Section exists; manually confirm it states the exact
group-membership (Task 0.3), card (Task 0.4), administrator (Task 0.5),
and image (Task 0.6, including wire format) add/remove/set payloads, and
the safe `hasPassword` derivation shape (Task 0.7) — none left implicit
or cited as "already known" without a task number backing it.
**Fail:** Section missing, or either question left ambiguous.
**Result:** ✅ Pass — section covers all 5 (Groups/Cards/Administrator/
Image/hasPassword), plus a 2026-09-13 amendment on Image's real
face-enrollment coupling (`match`/`timestamp` params, face-validation
response shape).

---

### Test F-2 — No builder ever exposes a raw credential value
```bash
grep -n "buildPasswordSetBody\|hasPassword" -A5 src/ObjectQuery.cpp
```
**Pass:** `buildPasswordSetBody` only ever places an already-hashed
value into the outgoing request body (never reads one back);
`buildUserHasPasswordBody` legitimately requests `fields:["password"]`
(per Task 0.7's finding this field is safe to request — the device only
ever returns a masked sentinel or empty/null) but never `"salt"`, and
`AmicoUser`/the public API has no field or getter that could carry the
raw string back out (manual read — also enforced by Task 2.1's
structural assertion).
**Fail:** Any code path that requests, stores, or returns a raw
`password`/`salt`/`panic_password`/`panic_salt` value.
**Result:** ✅ Pass — manual read confirms no raw-value path exists;
structural assertion in Task 2.1/2.3 passes.

---

### Test F-3 — `test_query_whitelist.cpp` covers every new builder
```bash
build-exec/amico_tests.exe --test-case="*builders*,*whitelist*"
```
(Adjust the filter to whatever doctest test-case names Task 2.1 actually
used.)
**Pass:** New assertions present and passing (0 failed) for group-add/
remove, card-add/remove, administrator-set, password-set, and
`hasPassword`-query builders.
**Fail:** Any failure, or any new builder lacking a corresponding
assertion.
**Result:** ✅ Pass — all new builders covered, including the 2 fixed
image-response assertions and the `face_templates`-deletion assertion
added after the 2026-09-13 amendment.

---

### Test F-4 — Offline profile-method test cases pass
```bash
ctest --test-dir build-exec --output-on-failure
```
**Pass:** Included in the full suite's 100% pass (see Unit tests above);
specifically confirm Task 2.3's new cases (`addToGroup`/`removeFromGroup`,
`addCard`/`removeCard`, `setAdministrator`, `setImage`/`removeImage`,
`setPassword`, `hasPassword`-populated `get()`) are present and green,
including the structural no-raw-credential-member assertion.
**Fail:** Any new case fails.
**Result:** ✅ Pass — 21 new cases in `test_users_profile.cpp`
(including the face-validation-failure and success-with-scores image
cases added after the 2026-09-13 amendment), all green.

---

### Test F-5 — Live-write profile test skip-gate (no env vars set)
```bash
build-exec/amico_live_write_profile_test.exe
```
**Setup:** Run with no `AMICO_ENABLE_LIVE_TESTS`/`AMICO_BASE_URL`/
`AMICO_USERNAME`/`AMICO_PASSWORD` set.
**Pass:** Prints a skip message, exit 0, no network call made.
**Fail:** Any network attempt without the env var explicitly set to `1`.
**Result:** ✅ Pass — skip message printed, exit 0.

---

### Test F-6 — Card/Group/Image live test (Tasks 5.1–5.2, conditional on Group 5 approval)
**Setup:** `APPROVE_LIVE_DEVICE_WRITE_TEST:<plan-id>` received as a
fresh, distinct message; operator sets the four env vars and runs the
binary.
**Pass:** `RESULT: PASS` — disposable test user created, card
add/verify/remove, group add/verify/remove (using a confirmed
test-safe group id, never one granting real physical access), image
set/verify/remove (using one of the two user-supplied sample images),
disposable user removed; no pre-existing real user's data touched
(operator to explicitly confirm, e.g. by checking the Users page still
shows exactly the same pre-existing users afterward).
**Not applicable:** "Not run this cycle — no live-device-write approval
issued" if the approval was never given. Does not block sign-off for
Groups 0–4.
**Fail:** `RESULT: FAIL`, non-zero exit, or any pre-existing real user
affected (critical incident — stop, report immediately, no automated
cleanup attempt).
**Result:** ✅ Pass (attempt #4, 2026-09-13, after attempts #1–#3's
root-caused-and-fixed failures — path encoding, then JPEG format, then
missing `match`/`timestamp` params + face-validation response
handling). Full 9/9 sequence, test user `id=42`, no pre-existing real
user touched.

---

### Test F-7 — Administrator-flag live test (Task 5.3, SEPARATE confirmation beyond Group 5)
**Setup:** A fresh, explicit confirmation naming this exact action was
obtained (not inferred from Test F-6's approval); operator runs the
relevant test step.
**Pass:** `RESULT: PASS` — disposable test user's admin flag verified
`true` then `false`; no real user's (`Admin`/`Phuong Hoang`/etc.)
Administrator flag touched at any point.
**Not applicable:** "Not run this cycle — Task 5.3 confirmation not
given" if not confirmed separately.
**Fail:** Any failure, or any real user's admin flag changed — critical
incident, stop, report immediately.
**Result:** ✅ Pass — test user `id=43`, flag verified `true` then
`false`; no real user touched.

---

### Test F-8 — Password/PIN set live test (Task 5.4, SEPARATE confirmation beyond Group 5)
**Setup:** A fresh, explicit confirmation naming this exact action was
obtained (not inferred from Test F-6 or F-7's approval); operator runs
the relevant test step.
**Pass:** `RESULT: PASS` — `hasPassword` observed `false` → `true` after
`setPassword()`; no real user's password touched; **the test's own
output/logs contain no raw PIN/password value at any point** (manual
review of the operator-reported output required, not just the exit
code).
**Not applicable:** "Not run this cycle — Task 5.4 confirmation not
given" if not confirmed separately.
**Fail:** Any failure, any real user's password touched, or any raw PIN
value appearing in test output/logs — the latter is a design bug in the
test itself; fix before any re-run, do not just re-run.
**Result:** ✅ Pass — test user `id=44`, `hasPassword` observed `false`
→ `true`; no raw PIN value in any output; no real user touched.

---

## Regression tests (ensure nothing broke)

### Test R-1 — Giai đoạn 2's existing read/write API unaffected
```bash
build-exec/amico_tests.exe --test-case="*users*,*access_logs*,*auth*,*session*"
```
**Pass:** All pre-existing tests (read-path from Giai đoạn 1, plus
Giai đoạn 2's `create`/`update`/`remove`) still pass unchanged.
**Fail:** Any pre-existing test's behavior changed.
**Result:** ✅ Pass — 25 cases / 140 assertions, 0 failed.

---

### Test R-2 — Giai đoạn 2's `live_write_test.cpp` still builds and self-skips
```bash
build-exec/amico_live_write_test.exe
```
**Setup:** No live-test env vars set.
**Pass:** Still prints its skip message, exit 0 — confirms this plan's
new `live_write_profile_test.cpp` file did not accidentally alter the
existing live-write test.
**Fail:** Any behavior change from Giai đoạn 2's recorded baseline.
**Result:** ✅ Pass — unchanged skip message, exit 0.

---

### Test R-3 — `live_smoke_test.cpp` (read-only) still builds and self-skips
```bash
build-exec/amico_live_smoke_test.exe
```
**Setup:** No live-test env vars set.
**Pass:** Still prints its skip message, exit 0.
**Fail:** Any behavior change from the last-recorded baseline.
**Result:** ✅ Pass — unchanged skip message, exit 0.

---

### Test R-4 — Secret scan clean
```bash
grep -rnE "session=[A-Za-z0-9]{16,}" --include='*.md' --include='*.json' --include='*.cpp' --include='*.hpp' --include='*.network-response' . 2>/dev/null | grep -v '\.git/' | grep -v '/build[^/]*/'
grep -rniE '"(password|hash|salt)"\s*:\s*"[0-9a-f]{16,}"' --include='*.md' --include='*.json' . 2>/dev/null | grep -v '\.git/' | grep -v '/build[^/]*/'
grep -rniE '"(password|pin)"\s*:\s*"[0-9]{4,}"' --include='*.md' --include='*.json' --include='*.network-response' . 2>/dev/null | grep -v '\.git/' | grep -v '/build[^/]*/'
```
**Pass:** No output, or only an already-documented benign false
positive. The third scan specifically guards against a raw test PIN
(e.g. `"12345"`) leaking into any committed artifact/fixture/doc.
**Fail:** Any other match.
**Result:** ✅ Pass — all 3 scans produced empty output, except the
expected test PIN constant (`"13579"`) in `live_password_test.cpp` —
a synthetic value used to SET a PIN, never a real captured credential,
benign per this project's fixture convention.

---

## Sprint sign-off

- [x] Build gate
- [x] All unit tests
- [x] Functional tests F-1–F-4 (offline)
- [x] Functional test F-5 (skip-gate)
- [x] Functional test F-6 (card/group/image live) — Pass, attempt #4
- [x] Functional test F-7 (administrator live) — Pass
- [x] Functional test F-8 (password/PIN live) — Pass
- [x] All regression tests
- [x] `DECISION_LOG.md` updated with any new decisions
- [x] `sprint-summary.md` written

**Sign-off date:** 2026-09-13 (all Groups 0–5 complete; Group 5's image
step passed on attempt #4 after 3 root-caused-and-fixed failures)

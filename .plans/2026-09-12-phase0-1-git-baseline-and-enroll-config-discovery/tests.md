# Tests — Giai đoạn 0+1: Git baseline + Enroll/config discovery

> **Executor instructions:** Run every test in this file after ALL tasks are complete.
> A sprint is not done until every test below shows ✅ (Group 5's tests are
> conditional — see their own note — and do not block sign-off if Group 5
> was never approved/attempted this cycle).

---

## Build gate

**N/A this plan.** No SDK C++ source is created or modified (spec.md's
explicit out-of-scope). Regression test R-1 below is the substitute check
that proves this held in practice, not just in intent.

---

## Functional tests

### Test F-1 — `.gitignore` covers the previously-missing build directories
```bash
grep -c "build-exec/" .gitignore
grep -c "build-verify/" .gitignore
grep -c "build-verifier/" .gitignore
grep -c "\.vs/" .gitignore
```
**Pass:** All four commands print `1`.
**Fail:** Any prints `0`.
**Result:** [ ] Pass / [ ] Fail

---

### Test F-2 — Pre-commit secret scan is clean
```bash
grep -rnE "session=[A-Za-z0-9]{16,}" --include='*.md' --include='*.json' --include='*.cpp' --include='*.hpp' --include='*.txt' --include='*.log' . 2>/dev/null | grep -v '\.git/' | grep -v '/build[^/]*/' | grep -v '/out/'
grep -rniE '"(password|hash|salt)"\s*:\s*"[0-9a-f]{16,}"' --include='*.md' --include='*.json' . 2>/dev/null | grep -v '\.git/' | grep -v '/build[^/]*/' | grep -v '/out/'
```
**Pass:** No output, or only the already-documented benign false positive
(read the matched line to confirm it is that known case, not assumed).
**Fail:** Any other match.
**Result:** [ ] Pass / [ ] Fail

---

### Test F-3 — Git baseline commit landed correctly, no build/cache directory tracked
```bash
git log --oneline -3
git ls-files | grep -E '^(build/|build-exec/|build-verify/|build-verifier/|out/|\.vs/)'
git ls-files | wc -l
```
**Pass:** A new commit sits on top of `2ff9b0e`; the `grep` for tracked
build/cache paths prints nothing; the tracked file count is large (SDK +
docs + plans, not just `README.md`).
**Fail:** No new commit, or any build/cache path is tracked.
**Result:** [ ] Pass / [ ] Fail

---

### Test F-4 — `docs/src-map.md` documents the remediation plan's additions
```bash
grep -c "NetworkSafety" docs/src-map.md
grep -c "TlsVerificationError" docs/src-map.md
grep -c "checkReachable" docs/src-map.md
grep -c "selfSignedCertificate" docs/src-map.md
```
**Pass:** All four print `1` or more.
**Fail:** Any prints `0`.
**Result:** [ ] Pass / [ ] Fail

---

### Test F-5 — Remaining `MessengerUtil` commands are documented (local-only pass)
```bash
grep -c "P6 static pass" docs/ui-action-protocol-map.md
grep -c "user_get_image_list" docs/ui-action-protocol-map.md
grep -c "user_list_images" docs/ui-action-protocol-map.md
grep -c "reset_crypto_key" docs/ui-action-protocol-map.md
grep -c "osdp_scbk" docs/ui-action-protocol-map.md
```
**Pass:** All five print `1` or more (spot-checks a representative sample
of the ~50 commands from Task 4.1, not just the section header).
**Fail:** Any prints `0`.
**Result:** [ ] Pass / [ ] Fail

---

### Test F-6 — Enroll page discovery (conditional on Group 5 being approved+run this cycle)
```bash
grep -c "Enroll (Face/Card)" docs/ui-action-protocol-map.md
ls artifacts/live_capture/ | grep -i enroll
ls captures/screenshots/ | tail -5
```
**Pass (if Group 5 ran):** Section present in the doc; a new JS artifact
and a new screenshot exist for the Enroll page.
**Not applicable (if Group 5 did not run):** Record this test's result as
"Not run this cycle — no live-device approval issued", not as a silent
skip and not as a Fail.
**Fail:** Group 5 was attempted but any of the three checks above comes up
empty.
**Result:** [ ] Pass / [ ] Fail / [ ] Not run this cycle

---

## Regression tests (ensure nothing broke)

### Test R-1 — No SDK source file was touched by this plan
```bash
git diff --stat HEAD~1 HEAD -- '*.cpp' '*.hpp' 'CMakeLists.txt' 'vcpkg.json' 2>/dev/null
```
(Run after Task 2.3's commit and any subsequent Group 3/4 commit(s) —
compare across every commit this plan created, not just the last one, if
Group 3/4 landed as a separate commit from Group 2.)
**Pass:** Empty output — this plan's own commits touch only `.gitignore`,
`docs/*.md`, `artifacts/*.json`, files newly added for the first time
(expected, not a "change"), and this plan's own `.plans/` folder. No
existing tracked `.cpp`/`.hpp`/`CMakeLists.txt`/`vcpkg.json` content
changed.
**Fail:** Any diff shown against those extensions.
**Result:** [ ] Pass / [ ] Fail

---

### Test R-2 — Existing build/test evidence still holds (sanity, not a rebuild requirement)
```bash
ls build-verify/amico_tests.exe build-exec/amico_tests.exe 2>&1
```
**Pass:** At least one of the two previously-built test binaries from
prior plans still exists on disk (proves this plan didn't delete or
corrupt anything outside its own scope). This test does **not** require
re-running the binary — that evidence already exists from the prior
`phase-2-remediation-and-live-device-verification` plan and is not being
re-litigated here.
**Fail:** Neither binary exists.
**Result:** [ ] Pass / [ ] Fail

---

## Sprint sign-off

- [ ] Build gate: N/A (documented above, not silently skipped)
- [ ] All functional tests F-1–F-5: ✅
- [ ] Functional test F-6: ✅ or explicitly "Not run this cycle"
- [ ] All regression tests: ✅
- [ ] `DECISION_LOG.md` updated with any new decisions made during execution
- [ ] `sprint-summary.md` written, explicitly stating Group 5's status

**Sign-off date:** [DATE]

# Tests — Giai đoạn 4: Frontend (plain HTML/CSS/JS, no framework/build step)

> **Executor instructions:** This plan has no automated frontend test
> framework (spec.md's accepted risk) — most checks here are manual,
> browser-observed pass/fail, not scripted assertions. Group 4's tests
> are conditional on separate live-device approvals — see each test's
> own note.

---

## Build gate (run first — if this fails, stop immediately)

```bash
cmake --build build-exec
```
**Pass:** Exit code 0, zero errors, zero new warnings (this plan only
touches `backend/main.cpp`/`BackendConfig.hpp` in C++ terms — the
frontend itself is not compiled).
**Fail:** Any compile error → report to Planner before proceeding.
**Result:** [ ] Not yet run.

---

## Regression tests (ensure nothing broke)

### Test R-1 — Existing offline suites unaffected
```bash
ctest --test-dir build-exec --output-on-failure
build-exec/amico_tests.exe
build-exec/amico_backend_tests.exe
```
**Pass:** SDK still 89 cases / 490 assertions; backend still 29 cases
/ 79 assertions; 0 failures in both.
**Fail:** Any change in count or any failure.
**Result:** [ ] Not yet run.

---

## Functional tests (manual, browser-observed)

### Test F-1 — Static file serving works alongside API routes
**Setup:** Run `amico_backend` (any config), `frontend/index.html`
present.
```
curl http://127.0.0.1:8080/
curl http://127.0.0.1:8080/health
```
**Pass:** The first returns `index.html`'s content; the second still
returns the API's JSON — no route shadowing either direction.
**Fail:** Either request returns the wrong content, or one 404s
unexpectedly.
**Result:** [ ] Not yet run.

---

### Test F-2 — Tab switching works with no console errors
**Setup:** Open the frontend in a browser (backend running).
**Pass:** Clicking each of the 3 nav buttons shows only that tab's
content; browser devtools console shows no errors.
**Fail:** Any console error, or more than one tab visible at once.
**Result:** [ ] Not yet run.

---

### Test F-3 — Error banner displays backend errors visibly
**Setup:** Trigger a deliberate error (e.g. `GET /users/999999` via the
UI, or a devtools-console call to `apiFetch`).
**Pass:** The error banner shows a human-readable message; it is not
only in the console.
**Fail:** Error silently swallowed or console-only.
**Result:** [ ] Not yet run.

---

### Test F-4 — Users table renders every documented column correctly
**Setup:** Backend running with at least one real or fixture user.
**Pass:** Image, Id, Name, Employee ID, Password (badge, never a
value), Start/End Date/Time, Nº of Groups, Nº of Cards, Face, Last
Access Date/Time, Administrator (badge), Edit, Remove — all present
and correctly populated.
**Fail:** Any column missing or showing wrong/raw data (especially: no
column ever shows a raw password/PIN value).
**Result:** [ ] Not yet run.

---

### Test F-5 — Add/Edit/Remove user works end-to-end
**Pass:** Add creates a new row; Edit's name/registration changes
persist after Save and a table refresh; Remove (after its own
`confirm()`) removes the row.
**Fail:** Any action fails or doesn't refresh the table.
**Result:** [ ] Not yet run.

---

### Test F-6 — Group/card management works end-to-end
**Pass:** Adding/removing a group id and a card (areaCode+cardNumber)
both correctly call their routes and the Edit modal reflects the
change.
**Fail:** Any action fails or doesn't reflect in the UI.
**Result:** [ ] Not yet run.

---

### Test F-7 — Image upload converts to JPEG client-side without error
**Setup:** Select a PNG file in the Edit modal's image picker.
**Pass:** No JS exception during the canvas/JPEG-conversion step
(check devtools console); the resulting `fetch` call's request has
`Content-Type: image/jpeg`.
**Fail:** Any JS exception, or the request sends the original
(non-JPEG) bytes unconverted.
**Result:** [ ] Not yet run.

---

### Test F-8 — Administrator toggle and PIN set require real confirmation (Decision 4)
**Setup:** Open the Edit modal for any user (a disposable test user
for the OK path — see Group 4's live tests for the real device
version; this check can also run against a fixture/offline-served
frontend if only the dialog *behavior* is being verified, not the
actual device write).
**Pass:** Clicking Cancel on either dialog sends **zero** network
requests (verified via devtools Network tab); clicking OK sends
exactly one request, with `X-Confirm-Sensitive-Action: yes` present.
**Fail:** Any request sent without OK being clicked, or the header
missing/wrong on the OK path.
**Result:** [ ] Not yet run.

---

### Test F-9 — Access Logs tab renders and filters correctly
**Pass:** Table renders; setting `from`/`to`/`limit` and clicking
Filter changes the displayed rows accordingly.
**Fail:** Any column missing, or filters not applied.
**Result:** [ ] Not yet run.

---

### Test F-10 — System Information tab renders every field
**Pass:** Every field from `/system-information`'s response
(including nested `network` fields) is displayed.
**Fail:** Any field missing.
**Result:** [ ] Not yet run.

---

## Live tests (GATED — separate approvals per action, see tasks.md Group 4)

### Test L-1 — Read-only live checklist (Task 4.1)
**Setup:** `APPROVE_LIVE_DEVICE_TEST:<plan-id>` received.
**Pass:** Users/Access Logs/System Information all render correctly
against the real device through the real frontend+backend.
**Not applicable:** "Not run this cycle — no live-device-read approval
issued." Does not block sign-off for Groups 0–3.
**Fail:** Any rendering error or console exception.
**Result:** [ ] Not yet run.

---

### Test L-2 — Write checklist using a disposable test user (Task 4.2)
**Pass:** Card/group/image add-and-remove all succeed through the UI
against the real device; the image upload specifically proves the
client-side JPEG conversion works end-to-end (not just offline); no
pre-existing real user affected.
**Fail:** Any action fails, or a real user is affected (critical
incident).
**Result:** [ ] Not yet run.

---

### Test L-3 — Administrator toggle live checklist (Task 4.3, SEPARATE confirmation)
**Pass:** Toggle works both directions on a disposable test user via
the real UI against the real device; dialog/no-request-on-Cancel
behavior re-confirmed live.
**Not applicable:** "Not run this cycle — Task 4.3 confirmation not
given."
**Fail:** Any failure, or a real user's admin flag changed.
**Result:** [ ] Not yet run.

---

### Test L-4 — PIN set live checklist (Task 4.4, SEPARATE confirmation)
**Pass:** PIN set works via the real UI against the real device; badge
updates; PIN value never visible anywhere afterward.
**Not applicable:** "Not run this cycle — Task 4.4 confirmation not
given."
**Fail:** Any failure, any real user's password touched, or the PIN
value appearing anywhere in the UI/console/network response.
**Result:** [ ] Not yet run.

---

## Sprint sign-off

- [ ] Build gate
- [ ] All regression tests
- [ ] Functional tests F-1–F-10 (manual, offline/fixture-backed where
      noted)
- [ ] Live tests L-1–L-4 — or explicitly "not run this cycle" (does
      not block sign-off for the offline/manual portion)
- [ ] `DECISION_LOG.md` updated with any new decisions
- [ ] `sprint-summary.md` written

**Sign-off date:** _pending_
